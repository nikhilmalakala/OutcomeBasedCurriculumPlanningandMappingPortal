import * as courseRepository from '../repositories/courseRepository.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import SyllabusUnit from '../models/SyllabusUnit.js';
import { createNotification } from './notificationService.js';

const stripUnsafeHtml = (value = '') => String(value)
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
  .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const legacyUnitToHtml = (unit) => {
  const parts = [];
  if (unit.title) parts.push(`<h4>${escapeHtml(unit.title)}</h4>`);
  if (unit.description) parts.push(`<p>${escapeHtml(unit.description).replace(/\n/g, '<br>')}</p>`);
  if (Array.isArray(unit.topics) && unit.topics.some(topic => String(topic || '').trim())) {
    parts.push(`<p><strong>Topics:</strong> ${escapeHtml(unit.topics.filter(Boolean).join(', '))}</p>`);
  }
  if (unit.outcomes) parts.push(`<p><strong>Outcomes:</strong> ${escapeHtml(unit.outcomes)}</p>`);
  return parts.join('');
};

const normalizeSyllabusUnits = (units = []) => units
  .slice(0, 5)
  .map((unit, index) => {
    const richTextContent = stripUnsafeHtml(unit.richTextContent || legacyUnitToHtml(unit));
    return {
      unitNumber: unit.unitNumber || index + 1,
      richTextContent,
      title: unit.title || '',
      description: unit.description || '',
      topics: Array.isArray(unit.topics) ? unit.topics : [],
      outcomes: unit.outcomes || '',
      hours: Number.isFinite(Number(unit.hours)) ? Number(unit.hours) : 0,
    };
  });

const syncStandaloneSyllabusUnits = async (versionId, updatedVersion, operatorUser) => {
  if (!updatedVersion?.courseId || !Array.isArray(updatedVersion.syllabusUnits)) return;

  const courseId = updatedVersion.courseId._id || updatedVersion.courseId;
  const unitNumbers = updatedVersion.syllabusUnits.map(unit => unit.unitNumber);

  if (updatedVersion.syllabusUnits.length > 0) {
    await SyllabusUnit.bulkWrite(updatedVersion.syllabusUnits.map(unit => ({
      updateOne: {
        filter: {
          courseId,
          courseVersionId: versionId,
          unitNumber: unit.unitNumber,
        },
        update: {
          $set: {
            richTextContent: unit.richTextContent || '',
            updatedBy: operatorUser.id,
          },
          $setOnInsert: {
            createdBy: operatorUser.id,
          },
        },
        upsert: true,
      },
    })));
  }

  await SyllabusUnit.deleteMany({
    courseVersionId: versionId,
    unitNumber: { $nin: unitNumbers },
  });
};

export const getCoursesByDept = async (deptId) => {
  return courseRepository.findCoursesByDepartment(deptId);
};

export const getAllCourses = async () => {
  return courseRepository.findAllCourses();
};

export const createNewCourse = async (courseData, regulationId, semester, operatorUser) => {
  // 1. Check if course code already exists globally
  let course = await courseRepository.findCourseByCode(courseData.code);
  
  if (!course) {
    // Create new global course identity
    course = await courseRepository.createCourse(courseData);
  }

  // 2. Create the regulation-centric version mapping (default blank structure)
  const existingVersion = await courseRepository.findVersionByCourseAndRegulation(course._id, regulationId);
  if (existingVersion) {
    throw new Error('Course already registered in this regulation.');
  }

  const version = await courseRepository.createCourseVersion({
    courseId: course._id,
    regulationId,
    semester,
    status: 'Draft',
    cieSee: {
      cieMaxMarks: 40,
      seeMaxMarks: 60,
      cieBreakup: '2 Mid Exams (30M), Assignments/Quizzes (10M)',
      seeBreakup: 'Standard theory exam with 5 choice questions.'
    }
  });

  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: 'CREATE_CURRICULUM_COURSE',
    details: `Added course ${course.code} to regulation ID ${regulationId} at Semester ${semester}`,
    category: 'Academic'
  });

  const result = await courseRepository.findVersionById(version._id);

  try {
    await createNotification({
      recipientRole: 'Faculty',
      title: 'Curriculum Updates',
      description: `New course ${result.courseId.code} - ${result.courseId.title} added to regulation ${result.regulationId.code} under semester ${semester}.`,
      category: 'Course Updates',
      type: 'info',
      courseId: result.courseId._id
    });
  } catch (err) {
    console.error('[Notification Trigger] createNewCourse failed:', err.message);
  }

  return result;
};


export const assignCourseCoordinator = async (versionId, coordinatorId, operatorUser) => {
  const updated = await courseRepository.updateCourseVersion(versionId, { assignedCoordinator: coordinatorId });
  
  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: 'ASSIGN_COORDINATOR',
    details: `Assigned Coordinator ID ${coordinatorId} to Course Version ${versionId}`,
    category: 'Academic'
  });

  try {
    const course = updated.courseId;
    const regulation = updated.regulationId;
    const deadlineStr = updated.deadline || '2026-06-25';
    
    // 1. Coordinator receives: Course assigned
    await createNotification({
      recipientId: coordinatorId,
      title: 'Course Assigned by HOD',
      description: `Course ${course.code} - ${course.title} has been assigned to you by HOD ${operatorUser.name}.`,
      category: 'Course Updates',
      type: 'info',
      courseId: course._id
    });
    
    // 2. Coordinator receives: Deadline reminder
    await createNotification({
      recipientId: coordinatorId,
      title: 'Deadline Reminder',
      description: `Syllabus submission deadline for ${course.code} is ${deadlineStr}. Please submit before the deadline.`,
      category: 'Course Updates',
      type: 'warning',
      courseId: course._id
    });

    // 3. Admin receives: System workflow updates
    await createNotification({
      recipientRole: 'Admin',
      title: 'System Workflow Update',
      description: `Coordinator assigned for course ${course.code} under regulation ${regulation.code}.`,
      category: 'System',
      type: 'system',
      courseId: course._id
    });
  } catch (err) {
    console.error('[Notification Trigger] assignCourseCoordinator failed:', err.message);
  }

  return updated;
};

export const getVersionsByRegulation = async (regulationId) => {
  return courseRepository.findVersionsByRegulation(regulationId);
};

export const getVersionById = async (versionId) => {
  return courseRepository.findVersionById(versionId);
};

export const getVersionsByCoordinator = async (coordinatorId) => {
  return courseRepository.findVersionsByCoordinator(coordinatorId);
};

export const saveSyllabusDraft = async (versionId, updateData, operatorUser) => {
  // Ensure that only the assigned coordinator can modify if role is Coordinator
  const version = await courseRepository.findVersionById(versionId);
  if (!version) {
    throw new Error('Course version not found.');
  }

  const assignedId = version.assignedCoordinator?._id?.toString() || version.assignedCoordinator?.toString();
  if (operatorUser.role === 'Coordinator' && assignedId !== operatorUser.id) {
    throw new Error('Unauthorized: You are not the assigned coordinator for this course version.');
  }

  const coordinatorAllowedFields = [
    'courseOutcomes',
    'coPoMappings',
    'coPsoMappings',
    'syllabusUnits',
    'labPracticals',
    'miniProjects',
    'textbooks',
    'referenceMaterials',
    'journals',
    'onlineResources',
    'objectives',
    'prerequisites',
    'cieSee'
  ];

  if (Array.isArray(updateData.syllabusUnits)) {
    updateData.syllabusUnits = normalizeSyllabusUnits(updateData.syllabusUnits);
  }

  const sanitizedUpdateData = operatorUser.role === 'Coordinator'
    ? coordinatorAllowedFields.reduce((allowed, field) => {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          allowed[field] = updateData[field];
        }
        return allowed;
      }, {})
    : updateData;

  // Update version
  const updated = await courseRepository.updateCourseVersion(versionId, sanitizedUpdateData);

  if (Array.isArray(sanitizedUpdateData.syllabusUnits)) {
    await syncStandaloneSyllabusUnits(versionId, updated, operatorUser);
  }
  
  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: 'UPDATE_SYLLABUS_DRAFT',
    details: `Saved syllabus draft details for Course Version ${versionId} (${updated.courseId.code})`,
    category: 'Academic'
  });

  return updated;
};

export const updateWorkflow = async (versionId, status, comments = '', operatorUser) => {
  const version = await courseRepository.findVersionById(versionId);
  if (!version) {
    throw new Error('Course version not found.');
  }

  const prevStatus = version.status;

  // Enforce workflow transitions
  // Coordinator: Draft -> Pending HOD
  // HOD: Pending HOD -> Approved (or Returned to Draft)
  // Admin: Review and Publish
  
  if (operatorUser.role === 'Coordinator' && status !== 'Pending HOD') {
    throw new Error('Coordinator can only submit course files for HOD review.');
  }

  const updated = await courseRepository.updateWorkflowStatus(versionId, status, comments);

  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: `WORKFLOW_${status.toUpperCase()}`,
    details: `Workflow transition for course ${updated.courseId.code} set to [${status}]. Comments: "${comments}"`,
    category: 'Workflow'
  });

  try {
    const course = updated.courseId;
    const regulation = updated.regulationId;

    // 1. Coordinator submits course (status === 'Pending HOD')
    if (status === 'Pending HOD') {
      const deptId = course.departmentId._id || course.departmentId;
      const hods = await User.find({ role: 'HOD', departmentId: deptId });

      if (prevStatus === 'Returned') {
        // HOD receives: Coordinator resubmission
        for (const hod of hods) {
          await createNotification({
            recipientId: hod._id,
            title: 'Coordinator Resubmission',
            description: `Coordinator ${operatorUser.name} has resubmitted the syllabus for ${course.code} - ${course.title} after corrections.`,
            category: 'Approval Status',
            type: 'success',
            courseId: course._id
          });
        }
      } else {
        // HOD receives: Course submitted for approval
        for (const hod of hods) {
          await createNotification({
            recipientId: hod._id,
            title: 'Course Submitted for Approval',
            description: `Coordinator ${operatorUser.name} has submitted syllabus for ${course.code} - ${course.title} for review.`,
            category: 'Approval Status',
            type: 'info',
            courseId: course._id
          });
        }
      }

      // Coordinator receives: Submission success
      await createNotification({
        recipientId: operatorUser.id,
        title: 'Course Submitted to HOD',
        description: `Syllabus for ${course.code} successfully submitted for approval.`,
        category: 'Approval Status',
        type: 'success',
        courseId: course._id
      });
    }
    // 2. HOD approves course (status === 'Approved')
    else if (status === 'Approved') {
      // Coordinator receives: HOD approval
      if (updated.assignedCoordinator) {
        await createNotification({
          recipientId: updated.assignedCoordinator,
          title: 'Course Approved',
          description: `Syllabus for ${course.code} approved by HOD ${operatorUser.name}.`,
          category: 'Approval Status',
          type: 'success',
          courseId: course._id
        });
      }

      // Faculty receives: Approved syllabus published
      await createNotification({
        recipientRole: 'Faculty',
        title: 'Approved Syllabus Published',
        description: `The approved syllabus for ${course.code} - ${course.title} (${regulation.code}) is now published.`,
        category: 'Course Updates',
        type: 'success',
        courseId: course._id
      });

      // Admin receives: Department approval completion
      const allVersionsInReg = await courseRepository.findVersionsByRegulation(regulation._id);
      const nonApproved = allVersionsInReg.filter(v => v.status !== 'Approved' && v._id.toString() !== versionId.toString());
      if (nonApproved.length === 0) {
        await createNotification({
          recipientRole: 'Admin',
          title: 'Department Approval Completion',
          description: `All course syllabi for department regulation ${regulation.code} have been approved.`,
          category: 'System',
          type: 'success',
          courseId: course._id
        });
      }
    }
    // 3. HOD returns course (status === 'Returned')
    else if (status === 'Returned') {
      // Coordinator receives: HOD rejection / correction request
      if (updated.assignedCoordinator) {
        await createNotification({
          recipientId: updated.assignedCoordinator,
          title: 'HOD Returned Course',
          description: `${course.code} returned for corrections: "${comments}".`,
          category: 'Approval Status',
          type: 'warning',
          courseId: course._id
        });
      }
    }

    // Admin receives: System workflow updates
    await createNotification({
      recipientRole: 'Admin',
      title: 'System Workflow Update',
      description: `Course ${course.code} workflow status transitioned from [${prevStatus}] to [${status}] by ${operatorUser.name}.`,
      category: 'System',
      type: 'system',
      courseId: course._id
    });

  } catch (err) {
    console.error('[Notification Trigger] updateWorkflow failed:', err.message);
  }

  return updated;
};

export const deleteCourseVersion = async (versionId, operatorUser) => {
  const version = await courseRepository.findVersionById(versionId);
  if (!version) {
    throw new Error('Course version not found.');
  }

  await courseRepository.deleteCourseVersion(versionId);

  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: 'DELETE_CURRICULUM_COURSE',
    details: `Removed course version ${versionId} (${version.courseId?.code}) from regulation ${version.regulationId?.code}`,
    category: 'Academic'
  });
};

export const deleteGlobalCourse = async (courseId, operatorUser) => {
  const course = await courseRepository.findCourseById(courseId);
  if (!course) {
    throw new Error('Course not found.');
  }

  await courseRepository.deleteVersionsByCourseId(courseId);
  await courseRepository.deleteCourseById(courseId);

  await AuditLog.create({
    userId: operatorUser.id,
    userName: operatorUser.name,
    userEmail: operatorUser.email,
    action: 'DELETE_GLOBAL_COURSE',
    details: `Deleted base course ${course.code} and all its associated versions.`,
    category: 'Academic'
  });
};
