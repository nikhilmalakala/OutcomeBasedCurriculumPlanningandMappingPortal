import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useContextStore } from '../../store/contextStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import {
  Award, Database, BookMarked, CheckSquare, BarChart3, Users, Plus, Layers,
  CheckCircle2, RotateCw, AlertTriangle, FileText, ChevronRight,
  Sparkles, Save, Edit3, ArrowRightLeft, BookOpen, Trash2, Check, X,
  Download, Eye, KeyRound, Bell, Settings, ArrowLeft, Upload, FileSpreadsheet, Printer, Search, Copy, Lock, Unlock,
  User, Briefcase, Mail, Cpu, Building2, Phone
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import Papa from 'papaparse';
import CurriculumBuilder from './CurriculumBuilder';
import { HodSyllabusEditor } from './HodSyllabusEditor';
import { CurriculumBookGenerator } from '../../components/common/CurriculumBookGenerator';
import { CurriculumBookManager } from './CurriculumBookManager/CurriculumBookManager';


export const HodDashboard: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuthStore();
  const {
    programs, departments, regulations,
    selectedRegulation, selectedDepartment, selectedProgram,
    setRegulations, setPrograms, setSelectedProgram, setSelectedRegulation
  } = useContextStore();

  const [versions, setVersions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [peoPso, setPeoPso] = useState<any>({ peos: [], psos: [], pos: [] });
  const [loading, setLoading] = useState(false);

  const [minorStreams, setMinorStreams] = useState<any[]>([]);
  const [prereqs, setPrereqs] = useState<any[]>([]);
  const [minorStreamModalOpen, setMinorStreamModalOpen] = useState(false);
  const [editingMinorStream, setEditingMinorStream] = useState<any | null>(null);
  const defaultMinorStreamData = { streamCode: '', name: '', description: '', requiredCredits: 18, status: 'Draft', courses: [] as string[] };
  const [newMinorStreamData, setNewMinorStreamData] = useState(defaultMinorStreamData);

  const [addPrereqOpen, setAddPrereqOpen] = useState(false);
  const [newPrereqData, setNewPrereqData] = useState({ sourceCourseId: '', targetCourseId: '' });

  // Regulation Manager states
  const [createRegOpen, setCreateRegOpen] = useState(false);
  const [newRegData, setNewRegData] = useState({ code: '', academicYear: 2025 });
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [selectedClonePeos, setSelectedClonePeos] = useState<string[]>([]);
  const [selectedClonePsos, setSelectedClonePsos] = useState<string[]>([]);
  const [activeRegWorkspace, setActiveRegWorkspace] = useState<any | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'peo' | 'pso' | 'po'>('peo');
  const [newStatement, setNewStatement] = useState({ code: '', description: '', status: 'Draft' });
  const [editingStatement, setEditingStatement] = useState<{ idx: number; type: 'peos' | 'psos' | 'pos'; code: string; description: string; status: string } | null>(null);


  // Course Repository states
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [newCourseData, setNewCourseData] = useState({
    code: '', title: '', programId: '', category: 'PC', semester: 1,
    L: 3, T: 0, P: 0, S: 0, credits: 3, cieMarks: 40, seeMarks: 60, coordinatorId: '',
    courseLevel: 'FC - Foundation', suggestiveSemester: '1', status: 'Active', prerequisites: '',
    description: '', offeredFor: ['CSE'], objectives: ['']
  });
  const branchOptions = ['CSE', 'CSE AI', 'AI/ML', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'];
  const [courseSearch, setCourseSearch] = useState('');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState('');

  // Curriculum Builder / Semester Planner states
  const [builderSelectedCourse, setBuilderSelectedCourse] = useState<any | null>(null);
  const [builderTargetSem, setBuilderTargetSem] = useState(1);
  const [builderSearch, setBuilderSearch] = useState('');
  const [builderCourseSelectOpen, setBuilderCourseSelectOpen] = useState(false);
  const [builderProgram, setBuilderProgram] = useState('B.Tech');
  const [builderRegulationId, setBuilderRegulationId] = useState('');

  // Faculty Management states
  const [facultyForm, setFacultyForm] = useState({
    facultyId: '',
    name: '',
    email: '',
    departmentId: '',
    designation: 'Professor',
    role: 'Faculty',
    status: 'Active'
  });
  const [facultySearch, setFacultySearch] = useState('');

  // Course Approvals states
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [approvalEditModal, setApprovalEditModal] = useState<{ open: boolean, version: any }>({ open: false, version: null });
  const [editCourseData, setEditCourseData] = useState({
    title: '', code: '', programId: '', category: 'PC', semester: 1, courseLevel: 'FC - Foundation', status: 'Active',
    L: 3, T: 0, P: 0, S: 0, C: 3, cieMarks: 40, seeMarks: 60,
    description: '', offeredFor: ['CSE'], objectives: [''], coordinatorId: '', prerequisites: ''
  });

  // Full Syllabus Editor State
  const [editingSyllabusId, setEditingSyllabusId] = useState<string | null>(null);

  // Profile password reset
  const [profilePass, setProfilePass] = useState({ current: '', newPass: '', confirm: '' });

  // Profile Standardized States
  const [bookViewMode, setBookViewMode] = useState<'directory' | 'view'>('directory');
  const [builderViewMode, setBuilderViewMode] = useState<'directory' | 'edit'>('directory');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [phoneVal, setPhoneVal] = useState('+91 9876543210');
  const [altEmailVal, setAltEmailVal] = useState('ananya.rao.alt@university.edu');
  const [profileImageVal, setProfileImageVal] = useState('');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const { profileSuccess, setProfileSuccess, setChangePasswordModalOpen } = useUIStore();

  // HOD Preferences States
  const [facultySubNotif, setFacultySubNotif] = useState(true);
  const [courseApprovalAlerts, setCourseApprovalAlerts] = useState(true);
  const [deptAnnouncements, setDeptAnnouncements] = useState(false);
  const [curriculumReviewAlerts, setCurriculumReviewAlerts] = useState(true);

  // Load HOD Portal Data
  const loadData = async () => {
    if (!selectedDepartment) return;
    setLoading(true);
    try {
      // 1. Load context-centric curriculum course versions
      if (selectedRegulation) {
        const verRes = await api.courses.listByReg(selectedRegulation._id);
        setVersions(verRes.versions || []);
        setBuilderRegulationId(selectedRegulation._id);
      }

      // 1.5 Load Department PEO/PSO/POs
      const peoRes = await api.peoPso.getByDept(selectedDepartment._id);
      if (peoRes.peoPso) {
        setPeoPso(peoRes.peoPso);
      }

      // 2. Load Department Shared Course Repository
      const courseRes = await api.courses.listByDept(selectedDepartment._id);
      setCourses(courseRes.courses || []);

      // 3. Load Department Faculty list
      const facRes = await api.auth.getFaculty();
      setFaculty(facRes.faculty || []);

      // 4. Ensure programs are loaded and set selectedProgram
      let currentPrograms = programs;
      if (programs.length === 0) {
        const progRes = await api.programs.list();
        setPrograms(progRes.programs);
        currentPrograms = progRes.programs;
      }
      
      const progId = typeof selectedDepartment.programId === 'object' ? selectedDepartment.programId._id : selectedDepartment.programId;
      if (!selectedProgram && selectedDepartment) {
        const prog = currentPrograms.find((p: any) => p._id === progId);
        if (prog) setSelectedProgram(prog);
      }

      // 5. Load Regulations to contextual picker list
      const regRes = await api.regulations.list();
      const progRegs = regRes.regulations.filter((r: any) => {
        const rProgId = typeof r.programId === 'object' ? r.programId._id : r.programId;
        return rProgId === progId;
      });

      setRegulations(progRegs);

      if (selectedRegulation && selectedDepartment) {
        try {
          const streamsRes = await api.minorStreams.list({
            regulationId: selectedRegulation._id,
            departmentId: selectedDepartment._id
          });
          setMinorStreams(streamsRes.minorStreams || []);
        } catch (e) {
          console.error('[HOD Dashboard] Failed to load minor streams:', e);
        }

        try {
          const prereqsRes = await api.prerequisites.list({
            regulationId: selectedRegulation._id
          });
          setPrereqs(prereqsRes.prerequisites || []);
        } catch (e) {
          console.error('[HOD Dashboard] Failed to load prerequisites:', e);
        }
      }
    } catch (err) {
      console.error('[HOD Dashboard] Error fetching details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRegulation, selectedDepartment]);

  // Handle clone source change -> pre-populate outcomes checklist
  const handleCloneSourceChange = (sourceId: string) => {
    setCloneSourceId(sourceId);
    if (!sourceId) {
      setSelectedClonePeos([]);
      setSelectedClonePsos([]);
      return;
    }
    const sourceReg = regulations.find(r => r._id === sourceId) as any;
    if (sourceReg && sourceReg.peoPsoData) {
      setSelectedClonePeos(sourceReg.peoPsoData.peos.map((p: any) => p._id));
      setSelectedClonePsos(sourceReg.peoPsoData.psos.map((p: any) => p._id));
    }
  };

  // Create Regulation workflow
  const handleCreateRegulation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Direct blank creation
      const payload = {
        code: newRegData.code,
        academicYear: newRegData.academicYear,
        programId: programs[0]?._id,
        departmentId: selectedDepartment?._id,
        durationYears: 4,
        semesterCount: 8
      };
      await api.regulations.create(payload);

      alert('Regulation created successfully!');
      setCreateRegOpen(false);
      setNewRegData({ code: '', academicYear: 2025 });
      loadData();
    } catch (err: any) {
      alert(`Failed to create regulation: ${err.message}`);
    }
  };

  // Toggle Regulation Lock/Unlock
  const handleToggleLock = async (reg: any) => {
    try {
      await api.regulations.update(reg._id, { isActive: !reg.isActive });
      alert(`Regulation successfully ${!reg.isActive ? 'locked' : 'unlocked'}.`);
      loadData();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  // Add Statement Workspace
  const handleAddWorkspaceStatement = async () => {
    if (!selectedDepartment) return;
    if (!newStatement.code || !newStatement.description) return;
    const type = workspaceTab === 'peo' ? 'peos' : workspaceTab === 'pso' ? 'psos' : 'pos';
    const updated = { ...peoPso };
    if (!updated[type]) updated[type] = [];
    updated[type].push({
      code: newStatement.code,
      description: newStatement.description,
      status: newStatement.status
    });

    try {
      await api.peoPso.updateByDept(selectedDepartment._id, updated);
      setPeoPso(updated);
      setNewStatement({ code: '', description: '', status: 'Draft' });
      alert('Statement added successfully!');
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  // Delete Workspace Statement
  const handleDeleteStatement = async (idx: number) => {
    if (!selectedDepartment) return;
    const type = workspaceTab === 'peo' ? 'peos' : workspaceTab === 'pso' ? 'psos' : 'pos';
    const updated = { ...peoPso };
    updated[type].splice(idx, 1);
    try {
      await api.peoPso.updateByDept(selectedDepartment._id, updated);
      setPeoPso(updated);
      alert('Statement removed.');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Update Workspace Statement
  const handleUpdateStatement = async () => {
    if (!selectedDepartment || !editingStatement) return;
    const { idx, type, code, description, status } = editingStatement;
    const updated = { ...peoPso };
    if (!updated[type]) updated[type] = [];
    updated[type][idx] = { code, description, status };

    try {
      await api.peoPso.updateByDept(selectedDepartment._id, updated);
      setPeoPso(updated);
      setEditingStatement(null);
      alert('Statement updated successfully!');
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleSaveMinorStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegulation || !selectedDepartment) return;
    try {
      const payload = {
        streamCode: newMinorStreamData.streamCode,
        name: newMinorStreamData.name,
        description: newMinorStreamData.description,
        requiredCredits: newMinorStreamData.requiredCredits,
        status: newMinorStreamData.status,
        courses: newMinorStreamData.courses,
        regulationId: selectedRegulation._id,
        departmentId: selectedDepartment._id
      };
      if (editingMinorStream) {
        await api.minorStreams.update(editingMinorStream._id, payload);
        alert('Minor Stream updated successfully!');
      } else {
        await api.minorStreams.create(payload);
        alert('Minor Stream created successfully!');
      }
      setMinorStreamModalOpen(false);
      setEditingMinorStream(null);
      setNewMinorStreamData(defaultMinorStreamData);
      loadData();
    } catch (err: any) {
      alert(`Failed to save Minor Stream: ${err.message}`);
    }
  };

  const handleDeleteMinorStream = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Minor Stream?')) return;
    try {
      await api.minorStreams.delete(id);
      alert('Minor Stream deleted successfully.');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleAddPrereq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegulation) return;
    if (!newPrereqData.sourceCourseId || !newPrereqData.targetCourseId) {
      alert('Please select both courses.');
      return;
    }
    if (newPrereqData.sourceCourseId === newPrereqData.targetCourseId) {
      alert('A course cannot be a prerequisite of itself.');
      return;
    }
    try {
      const payload = {
        sourceCourseId: newPrereqData.sourceCourseId,
        targetCourseId: newPrereqData.targetCourseId,
        regulationId: selectedRegulation._id
      };
      await api.prerequisites.create(payload);
      alert('Prerequisite link created successfully!');
      setAddPrereqOpen(false);
      setNewPrereqData({ sourceCourseId: '', targetCourseId: '' });
      loadData();
    } catch (err: any) {
      alert(`Failed to create prerequisite link: ${err.message}`);
    }
  };

  const handleDeletePrereq = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Prerequisite link?')) return;
    try {
      await api.prerequisites.delete(id);
      alert('Prerequisite link deleted successfully.');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };


  // Create course repository item
  const handleAddRepositoryCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Create Course Identity in Repository
      const coursePayload = {
        code: newCourseData.code,
        title: newCourseData.title,
        departmentId: selectedDepartment?._id
      };

      // 2. Add course to active regulation context
      if (selectedRegulation) {
        const createdVerRes = await api.courses.create({
          ...coursePayload,
          regulationId: selectedRegulation._id,
          semester: newCourseData.semester,
          category: newCourseData.category
        });
        const createdVersion = createdVerRes.version;

        // 3. Immediately apply extended attributes to match high-density form
        if (createdVersion) {
          await api.courses.saveDraft(createdVersion._id, {
            category: newCourseData.category,
            credits: {
              L: Number(newCourseData.L),
              T: Number(newCourseData.T),
              P: Number(newCourseData.P),
              S: Number(newCourseData.S),
              C: Number(newCourseData.credits)
            },
            cieSee: {
              cieMaxMarks: Number(newCourseData.cieMarks),
              seeMaxMarks: Number(newCourseData.seeMarks)
            },
            description: newCourseData.description,
            offeredFor: newCourseData.offeredFor,
            prerequisites: newCourseData.prerequisites ? [newCourseData.prerequisites] : []
          });

          // Assign coordinator if mapped
          if (newCourseData.coordinatorId) {
            await api.courses.assign({
              courseVersionId: createdVersion._id,
              coordinatorId: newCourseData.coordinatorId
            });
          }
        }
      }

      alert('Course successfully registered in repository!');
      setAddCourseOpen(false);
      setNewCourseData({
        code: '', title: '', programId: '', category: 'PC', semester: 1,
        L: 3, T: 0, P: 0, S: 0, credits: 3, cieMarks: 40, seeMarks: 60, coordinatorId: '',
        courseLevel: 'FC - Foundation', suggestiveSemester: '1', status: 'Active', prerequisites: '',
        description: '', offeredFor: ['CSE'], objectives: ['']
      });
      loadData();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  const handleBulkImportSubmit = async () => {
    if (!bulkFile) {
      alert("Please select a file first.");
      return;
    }
    if (!selectedRegulation || !selectedDepartment) {
      alert("Please ensure a regulation and department are selected.");
      return;
    }

    Papa.parse(bulkFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          let successCount = 0;
          for (const row of rows) {
            const code = row['Course Code'] || row['code'] || row['Code'];
            const title = row['Course Title'] || row['title'] || row['Title'];
            if (!code || !title) continue;

            const category = row['Category'] || row['category'] || 'PC';
            const semester = Number(row['Semester'] || row['semester'] || 1);
            const L = Number(row['L'] || 3);
            const T = Number(row['T'] || 0);
            const P = Number(row['P'] || 0);
            const S = Number(row['S'] || 0);
            const credits = Number(row['Total Credits'] || row['credits'] || 3);
            const cieMarks = Number(row['CIE Marks'] || row['cieMarks'] || 40);
            const seeMarks = Number(row['SEE Marks'] || row['seeMarks'] || 60);
            const description = row['Description'] || row['description'] || '';
            const prerequisites = row['Prerequisites'] || row['prerequisites'] || '';
            const coordinatorQuery = row['Coordinator Email'] || row['coordinatorEmail'] || row['Coordinator'] || '';

            let coordinatorId = '';
            if (coordinatorQuery) {
              const fac = faculty.find((f: any) => 
                (f.email && f.email.toLowerCase() === coordinatorQuery.toLowerCase().trim()) || 
                (f.name && f.name.toLowerCase() === coordinatorQuery.toLowerCase().trim())
              );
              if (fac) {
                coordinatorId = fac._id;
              }
            }

            const coursePayload = {
              code,
              title,
              departmentId: selectedDepartment._id
            };

            const createdVerRes = await api.courses.create({
              ...coursePayload,
              regulationId: selectedRegulation._id,
              semester,
              category
            });

            const createdVersion = createdVerRes.version;
            if (createdVersion) {
              await api.courses.saveDraft(createdVersion._id, {
                category,
                credits: { L, T, P, S, C: credits },
                cieSee: { cieMaxMarks: cieMarks, seeMaxMarks: seeMarks },
                description,
                prerequisites: prerequisites ? [prerequisites] : []
              });

              if (coordinatorId) {
                await api.courses.assign({
                  courseVersionId: createdVersion._id,
                  coordinatorId: coordinatorId
                });
              }
            }
            successCount++;
          }
          
          alert(`Successfully imported ${successCount} courses!`);
          setBulkImportOpen(false);
          setBulkFile(null);
          loadData();
        } catch (err: any) {
          alert(`Bulk import failed: ${err.message}`);
        }
      },
      error: (error: any) => {
        alert(`Error parsing file: ${error.message}`);
      }
    });
  };

  // Add mapped course from Repository into Builder planner
  const handleBuilderAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderSelectedCourse || !builderRegulationId) {
      alert('Please select a course to map.');
      return;
    }

    try {
      await api.courses.create({
        code: builderSelectedCourse.code,
        title: builderSelectedCourse.title,
        departmentId: selectedDepartment?._id,
        regulationId: builderRegulationId,
        semester: builderTargetSem
      });

      alert('Course mapped to syllabus curriculum structure!');
      setBuilderSelectedCourse(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to map course: ${err.message}`);
    }
  };

  const handleDeleteCourseVersion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course version? This action cannot be undone.')) return;
    try {
      await api.courses.deleteVersion(id);
      alert('Course successfully deleted.');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete course: ${err.message}`);
    }
  };

  const handleDeleteGlobalCourse = async (courseId: string) => {
    if (!window.confirm('WARNING: This will permanently delete the global course and ALL its associated versions across all regulations. Are you absolutely sure?')) return;
    try {
      await api.courses.deleteCourse(courseId);
      alert('Global course and all versions successfully deleted.');
      loadData();
    } catch (err: any) {
      alert(`Failed to delete global course: ${err.message}`);
    }
  };

  // Faculty Management: Add Member account
  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.users.create({
        name: facultyForm.name,
        email: facultyForm.email,
        password: 'facultypassword', // Default password
        role: facultyForm.role,
        departmentId: selectedDepartment?._id,
        programId: programs[0]?._id
      });
      alert(`Faculty member (${facultyForm.name}) successfully registered!`);
      setFacultyForm({
        facultyId: '',
        name: '',
        email: '',
        departmentId: '',
        designation: 'Professor',
        role: 'Faculty',
        status: 'Active'
      });
      loadData();
    } catch (err: any) {
      alert(`Failed to add faculty: ${err.message}`);
    }
  };

  // Course Approvals Action
  const handleApprovalAction = async (versionId: string, status: 'Approved' | 'Returned') => {
    try {
      await api.courses.updateStatus(versionId, {
        status,
        comments: approvalComments[versionId] || ''
      });
      alert(`Course version workflow set to [${status}] successfully.`);
      loadData();
    } catch (err: any) {
      alert(`Workflow transition failed: ${err.message}`);
    }
  };

  // Save Quick Edit
  const handleSaveCourseEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      if (!approvalEditModal.version) return;
      await api.courses.saveDraft(approvalEditModal.version._id, {
        semester: editCourseData.semester,
        category: editCourseData.category,
        courseLevel: editCourseData.courseLevel,
        status: editCourseData.status,
        credits: { L: editCourseData.L, T: editCourseData.T, P: editCourseData.P, S: editCourseData.S, C: editCourseData.C },
        cieSee: { cieMaxMarks: editCourseData.cieMarks, seeMaxMarks: editCourseData.seeMarks },
        description: editCourseData.description,
        offeredFor: editCourseData.offeredFor,
        objectives: editCourseData.objectives,
        prerequisites: editCourseData.prerequisites ? [editCourseData.prerequisites] : []
      });

      if (editCourseData.coordinatorId && editCourseData.coordinatorId !== (approvalEditModal.version.coordinatorId?._id || approvalEditModal.version.coordinatorId)) {
        await api.courses.assign({
          courseVersionId: approvalEditModal.version._id,
          coordinatorId: editCourseData.coordinatorId
        });
      }

      alert('Course details updated successfully.');
      setApprovalEditModal({ open: false, version: null });
      loadData();
    } catch (err: any) {
      alert(`Failed to update course: ${err.message}`);
    }
  };

  // Remove Course Version from Regulation
  const handleRemoveCourseVersion = async (versionId: string) => {
    if (!window.confirm('Are you sure you want to remove this course from the current regulation?')) return;
    try {
      await api.courses.deleteVersion(versionId);
      alert('Course version removed successfully.');
      loadData();
    } catch (err: any) {
      alert(`Failed to remove course: ${err.message}`);
    }
  };

  const handleCreateCourseVersion = async (course: any) => {
    if (!selectedRegulation) {
      alert('Please select a regulation first.');
      return;
    }
    try {
      await api.courses.create({
        code: course.code,
        title: course.title,
        departmentId: course.departmentId,
        regulationId: selectedRegulation._id,
        semester: 1,
        category: 'PC'
      });
      alert('Course added to current regulation! You can now edit its syllabus.');
      loadData();
    } catch (err: any) {
      alert(`Failed to add course to regulation: ${err.message}`);
    }
  };

  // Toggle user active status (deactivate faculty)
  const handleToggleUserActive = async (userId: string) => {
    try {
      const res = await api.users.delete(userId);
      alert(res.message || 'User status toggled successfully.');
      loadData();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  const draftsCount = versions.filter(v => v.status === 'Draft' || v.status === 'Returned').length;
  const pendingCount = versions.filter(v => v.status === 'Pending HOD' || v.status === 'Pending').length;
  const approvedCount = versions.filter(v => v.status === 'Approved').length;
  const curriculumCoverage = courses.length > 0 ? Math.round((versions.length / courses.length) * 100) : 0;
  const approvalRate = versions.length > 0 ? Math.round((approvedCount / versions.length) * 100) : 0;


  if (editingSyllabusId) {
    return <HodSyllabusEditor courseVersionId={editingSyllabusId} onClose={() => { setEditingSyllabusId(null); loadData(); }} />;
  }

  return (
    <div className="space-y-6 font-sans">

      {/* TOPBAR BANNER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">{selectedDepartment?.name || 'Computer Science and Engineering'}</h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            AY {new Date().getFullYear()}-{new Date().getFullYear() + 1} • {selectedRegulation?.code || 'R2025'} Regulation context
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('curriculum-book')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${activeTab === 'curriculum-book' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Curriculum Book</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. HOD DASHBOARD SUBPAGE */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">

          {/* ── Welcome Header ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col sm:flex-row items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-sm flex-shrink-0">
              {(() => {
                if (!user?.name) return 'HD';
                return user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-widest">Aditya University · HOD Portal</p>
              <h1 className="text-xl font-bold text-text-primary mt-0.5">Welcome back, {user?.name || 'Dr. M. Sreenivasa Rao'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100 text-[11px] font-semibold">Head of Department</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold">{user?.department?.name || 'Computer Science & Engineering'}</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-success-50 text-success-700 border border-success-100 text-[11px] font-semibold">{user?.department?.code || 'CSE'} · Active Semester</span>
              </div>
              <p className="text-sm text-text-muted mt-3 leading-relaxed">
                Managing {courses.length} courses in the repository, with {faculty.length} assigned faculty members and PO/CO mapping compliance checks active.
              </p>
            </div>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Faculty', sub: 'Active curriculum developers', value: faculty.length, icon: Users, bg: 'bg-teal-50', iconCl: 'text-teal-600', border: 'border-teal-100' },
              { label: 'Total Courses', sub: 'Total syllabus definitions', value: courses.length, icon: BookOpen, bg: 'bg-success-50', iconCl: 'text-success-600', border: 'border-success-100' },
              { label: 'Total Programs', sub: 'B.Tech, M.Tech, etc.', value: programs?.length || 0, icon: Briefcase, bg: 'bg-blue-50', iconCl: 'text-blue-600', border: 'border-blue-100' },
              { label: 'Total Departments', sub: 'Enrolled in department', value: departments?.length || 0, icon: Building2, bg: 'bg-slate-50', iconCl: 'text-slate-600', border: 'border-slate-200' },
              { label: 'Syllabus Status', sub: 'Approved vs Total', value: `${approvedCount}/${courses.length || 1}`, icon: FileText, bg: 'bg-emerald-50', iconCl: 'text-emerald-600', border: 'border-emerald-100' },
              { label: 'CO-PO Mapping Status', sub: 'Matrices configured', value: '40%', icon: Award, bg: 'bg-indigo-50', iconCl: 'text-indigo-600', border: 'border-indigo-100' },
              { label: 'Pending Approvals', sub: 'Requires immediate HOD review', value: pendingCount, icon: CheckSquare, bg: 'bg-danger-50', iconCl: 'text-danger-600', border: 'border-danger-100' },

            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl border border-border shadow-card p-5 flex flex-col gap-3 hover:shadow-card-md hover:border-border-medium transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${kpi.bg} ${kpi.border}`}>
                    <Icon className={`w-4.5 h-4.5 ${kpi.iconCl}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-text-primary leading-none">{kpi.value}</p>
                    <p className="text-[11px] font-semibold text-text-muted mt-1">{kpi.label}</p>
                    <p className="text-[10px] text-text-subtle mt-0.5">{kpi.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle Section: Coverage / Approvals */}
          <div className="grid grid-cols-3 gap-6">

            {/* Left/Middle: Curriculum Health */}
            <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Curriculum Health & Alignment Metrics</h3>
              <p className="text-xs text-slate-500 font-semibold leading-normal">Real-time status of syllabus definitions and compliance checks.</p>

              <div className="space-y-4 pt-2">
                {[
                  { label: 'Curriculum Coverage Rate', val: curriculumCoverage, desc: 'Percentage of master courses added to the active semester-wise curriculum builder.' },
                  { label: 'Syllabus Active/Approval Rate', val: approvalRate, desc: 'Percentage of course files verified and transitioned to \'Active\' or \'Approved\' status.' }
                ].map((bar, i) => (
                  <div key={i} className="space-y-1.5 text-xs font-bold text-slate-700">
                    <div className="flex justify-between items-center">
                      <span>{bar.label}</span>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">{bar.val}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-none mb-1">{bar.desc}</p>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${bar.val}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-4 flex gap-4 text-xs font-bold text-slate-500">
                <span>Syllabus Compliance Status Breakdown:</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> {draftsCount} Drafts</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> {pendingCount} Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {approvedCount} Approved</span>
              </div>
            </div>

            {/* Right: Pending reviews queue card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">Pending reviews</h3>
                <p className="text-xs text-slate-400 mt-2">Syllabus submissions requiring coordinator validation.</p>
              </div>

              <div className="text-center py-6 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-700">All reviews completed. Good job!</span>
              </div>

              <button
                onClick={() => { }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold uppercase cursor-pointer text-center transition-all"
              >
                Manage Approvals Queue
              </button>
            </div>

          </div>

          {/* Bottom Section: Submissions Table & Activity Stream */}
          <div className="grid grid-cols-3 gap-6">

            {/* Table */}
            <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">Faculty Syllabus Submission Status</h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                    <th className="p-3 pl-4">Faculty</th>
                    <th className="p-3">Assigned Course</th>
                    <th className="p-3">Syllabus Definition</th>
                    <th className="p-3">CO Definitions</th>
                    <th className="p-3 pr-4">Document Upload</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50 text-slate-600 font-medium">
                    <td className="p-3 pl-4 font-bold text-slate-800">Dr. Kavitha Menon</td>
                    <td className="p-3 font-semibold text-teal-600">CS301 Data Structures and Algorithms</td>
                    <td className="p-3"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Completed</span></td>
                    <td className="p-3"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Verified</span></td>
                    <td className="p-3 pr-4"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Uploaded</span></td>
                  </tr>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50 text-slate-600 font-medium">
                    <td className="p-3 pl-4 font-bold text-slate-800">Prof. Arjun Nair</td>
                    <td className="p-3 font-semibold text-teal-600">CS451 Cloud Computing</td>
                    <td className="p-3"><span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold">Draft</span></td>
                    <td className="p-3"><span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px] font-bold">Pending</span></td>
                    <td className="p-3 pr-4"><span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold">Not Uploaded</span></td>
                  </tr>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/50 text-slate-600 font-medium">
                    <td className="p-3 pl-4 font-bold text-slate-800">Dr. Meera Iyer</td>
                    <td className="p-3 font-semibold text-teal-600">CS352 Database Management Systems Lab</td>
                    <td className="p-3"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Completed</span></td>
                    <td className="p-3"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Verified</span></td>
                    <td className="p-3 pr-4"><span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px] font-bold">Uploaded</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Stream */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col h-[320px]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-teal-600" />
                <span>Academic Activity Stream</span>
              </h3>
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {[
                  { title: 'Course Returned', details: 'CS451 - Cloud Computing marked as Returned.', time: '4:41:05 PM - 5/26/2026' },
                  { title: 'Course Approved', details: 'CS352 - Database Management Systems Lab marked as Approved.', time: '11:09:08 AM - 5/21/2026' },
                  { title: 'Course Approved', details: 'CS301 - Data Structures and Algorithms marked as Approved.', time: '10:30:15 AM - 5/18/2026' }
                ].map((act, i) => (
                  <div key={i} className="text-xs leading-normal">
                    <strong className="text-slate-800 block font-bold">{act.title}</strong>
                    <span className="text-slate-500 block mt-0.5">{act.details}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. PEO & PSO MANAGEMENT SCREEN */}
      {/* ============================================================== */}
      {activeTab === 'peo-pso' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 font-sans">Department Objectives & Outcomes</h1>
              <p className="text-xs text-slate-500 mt-1">Define and manage Program Educational Objectives (PEOs), Program Specific Outcomes (PSOs), and standard Program Outcomes (POs) for the entire department.</p>
            </div>
            {/* Outliner tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setWorkspaceTab('po')}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer border transition-all ${workspaceTab === 'po' ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
              >
                Standard POs
              </button>
              <button
                onClick={() => setWorkspaceTab('peo')}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer border transition-all ${workspaceTab === 'peo' ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
              >
                PEOs
              </button>
              <button
                onClick={() => setWorkspaceTab('pso')}
                className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer border transition-all ${workspaceTab === 'pso' ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
              >
                PSOs
              </button>
            </div>
          </div>

          {/* Workspace Split Layout */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left panel: Add form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
                Create {workspaceTab === 'po' ? 'PO' : workspaceTab === 'peo' ? 'PEO' : 'PSO'} Statement
              </h3>
              <div className="space-y-3 text-xs font-bold text-slate-500">
                <div className="space-y-1">
                  <span>{workspaceTab === 'po' ? 'PO' : workspaceTab === 'peo' ? 'PEO' : 'PSO'} Code *</span>
                  <input
                    type="text"
                    placeholder={`e.g. ${workspaceTab === 'po' ? 'PO1' : workspaceTab === 'peo' ? 'PEO1' : 'PSO1'}`}
                    value={newStatement.code}
                    onChange={(e) => setNewStatement({ ...newStatement, code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <span>Description *</span>
                  <textarea
                    rows={4}
                    placeholder="Define outcome details description..."
                    value={newStatement.description}
                    onChange={(e) => setNewStatement({ ...newStatement, description: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <span>Status</span>
                  <select
                    value={newStatement.status}
                    onChange={(e) => setNewStatement({ ...newStatement, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
                <button
                  onClick={handleAddWorkspaceStatement}
                  className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Outcome Statement</span>
                </button>
              </div>
            </div>

            {/* Right panel: Table list */}
            <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wide">
                {workspaceTab === 'po' ? 'Program Outcomes' : workspaceTab === 'peo' ? 'PEO Statements' : 'PSO Statements'}
              </h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                    <th className="p-3 pl-4 w-20">Code</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 w-28">Status</th>
                    <th className="p-3 pr-4 text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(workspaceTab === 'po' ? peoPso.pos : workspaceTab === 'peo' ? peoPso.peos : peoPso.psos)?.map((st: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                      <td className="p-3 pl-4">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold px-2 py-0.5 rounded font-mono">
                          {st.code}
                        </span>
                      </td>
                      <td className="p-3 leading-relaxed">{st.description}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${st.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                          {st.status || 'Draft'}
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        {workspaceTab !== 'po' && (
                          <>
                            <button
                              onClick={() => {
                                const type = workspaceTab === 'peo' ? 'peos' : 'psos';
                                setEditingStatement({
                                  idx,
                                  type,
                                  code: st.code,
                                  description: st.description,
                                  status: st.status || 'Draft'
                                });
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 mr-1"
                              title="Edit Outcome Statement"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStatement(idx)}
                              className="p-1.5 hover:bg-red-50 rounded text-red-500"
                              title="Delete Outcome Statement"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(workspaceTab === 'po' ? peoPso.pos : workspaceTab === 'peo' ? peoPso.peos : peoPso.psos)?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400">
                        No outcome statements registered for this workspace yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. COURSE REPOSITORY SUBPAGE */}
      {/* ============================================================== */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Curriculum Metadata Repository</h1>
              <p className="text-xs text-slate-500 mt-1">Centralized master bank of reusable course metadata across regulations, programs, and departments.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAddCourseOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Course</span>
              </button>
              <button
                onClick={() => setBulkImportOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Import</span>
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-3 text-xs font-bold text-slate-500">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search courses..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <select
              value={courseCategoryFilter}
              onChange={(e) => setCourseCategoryFilter(e.target.value)}
              className="border border-slate-300 rounded-lg p-2 bg-white outline-none w-44 font-semibold text-slate-600"
            >
              <option value="">All Categories</option>
              <option value="PC">Professional Core (PC)</option>
              <option value="PE">Professional Elective (PE)</option>
              <option value="OE">Open Elective (OE)</option>
              <option value="BS">Basic Sciences (BS)</option>
              <option value="ES">Engineering Sciences (ES)</option>
              <option value="HS">Humanities & Social Sciences (HS)</option>
              <option value="MC">Mandatory Course (MC)</option>
            </select>
            <select
              value={courseStatusFilter}
              onChange={(e) => setCourseStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg p-2 bg-white outline-none w-44 font-semibold text-slate-600"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending HOD">Pending HOD</option>
              <option value="Pending Admin">Pending Admin</option>
              <option value="Approved">Approved</option>
              <option value="Returned">Returned</option>
            </select>
          </div>

          {/* Datatable */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                  <th className="p-4 pl-6">COURSE CODE</th>
                  <th className="p-4">COURSE TITLE</th>
                  <th className="p-4">PROGRAM</th>
                  <th className="p-4">DEPARTMENT</th>
                  <th className="p-4">REGULATION</th>
                  <th className="p-4">CATEGORY</th>
                  <th className="p-4">L-T-P-S-C</th>
                  <th className="p-4 text-center">SUGGESTED SEMESTER</th>
                  <th className="p-4 pr-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {courses
                  .filter(c => {
                    const matchesSearch = c.code.toLowerCase().includes(courseSearch.toLowerCase()) || c.title.toLowerCase().includes(courseSearch.toLowerCase());
                    const v = versions.find((ver: any) => ver.courseId?._id === c._id || ver.courseId === c._id);
                    const category = v?.category || 'PC';
                    const matchesCat = courseCategoryFilter ? category === courseCategoryFilter : true;
                    const matchesStatus = courseStatusFilter ? (v?.status === courseStatusFilter) : true;
                    return matchesSearch && matchesCat && matchesStatus;
                  })
                  .map((c) => {
                    const v = versions.find((ver: any) => ver.courseId?._id === c._id || ver.courseId === c._id);
                    const category = v?.category || 'PC';

                    const formatCategory = (cat: string) => {
                      switch (cat) {
                        case 'PC': return 'Professional Core';
                        case 'PE': return 'Professional Elective';
                        case 'OE': return 'Open Elective';
                        case 'BS': return 'Basic Sciences';
                        case 'ES': return 'Engineering Sciences';
                        case 'HS': return 'Humanities & Social Sciences';
                        case 'MC': return 'Mandatory Course';
                        default: return cat;
                      }
                    };

                    const creditsStr = v?.credits
                      ? `${v.credits.L}-${v.credits.T}-${v.credits.P}-${v.credits.S}-${v.credits.C}`
                      : '3-0-0-0-3';
                    const sem = v?.semester || 1;

                    return (
                      <tr key={c._id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                        <td className="p-4 pl-6 font-mono font-bold text-teal-650">{c.code}</td>
                        <td className="p-4 font-bold text-slate-800">{c.title}</td>
                        <td className="p-4">B.Tech</td>
                        <td className="p-4">{selectedDepartment?.code || 'CSE'}</td>
                        <td className="p-4 font-semibold text-slate-500">{selectedRegulation?.code || 'R2025'}</td>
                        <td className="p-4 font-bold text-slate-650">{formatCategory(category)}</td>
                        <td className="p-4 font-mono font-semibold">{creditsStr}</td>
                        <td className="p-4 text-center">{sem}</td>
                        <td className="p-4 pr-6 text-right flex gap-1.5 justify-end">
                          {v ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditCourseData({
                                    title: v.courseId?.title || '',
                                    code: v.courseId?.code || '',
                                    programId: v.programId || '',
                                    category: v.category || 'PC',
                                    semester: v.semester || 1,
                                    courseLevel: v.courseLevel || 'FC - Foundation',
                                    status: v.status || 'Active',
                                    L: v.credits?.L || 0,
                                    T: v.credits?.T || 0,
                                    P: v.credits?.P || 0,
                                    S: v.credits?.S || 0,
                                    C: v.credits?.C || 0,
                                    cieMarks: v.cieSee?.cieMaxMarks || 40,
                                    seeMarks: v.cieSee?.seeMaxMarks || 60,
                                    description: v.description || '',
                                    offeredFor: v.offeredFor || ['CSE'],
                                    objectives: v.objectives?.length ? v.objectives : [''],
                                    coordinatorId: v.coordinatorId?._id || v.coordinatorId || '',
                                    prerequisites: v.prerequisites?.[0] || ''
                                  });
                                  setApprovalEditModal({ open: true, version: v });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Edit Course Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => setEditingSyllabusId(v._id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer"
                                title="Edit Complete Syllabus"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                Syllabus Console
                              </button>
                              <button
                                onClick={() => handleRemoveCourseVersion(v._id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
                                title="Remove course from regulation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCreateCourseVersion(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="Add this course to current regulation"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add to Regulation
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGlobalCourse(c._id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer ml-1"
                            title="Delete Global Course and all its versions"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Base Course
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CURRICULUM MANAGEMENT (BUILDER & BOOK) */}
      {/* ============================================================== */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          {bookViewMode === 'view' ? (
            <div className="space-y-4">
              <button
                onClick={() => setBookViewMode('directory')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold cursor-pointer w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Directory
              </button>
              <CurriculumBookGenerator />
            </div>
          ) : builderViewMode === 'edit' ? (
            <div className="space-y-4 animate-fadeIn">
              <button
                onClick={() => setBuilderViewMode('directory')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold cursor-pointer w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Directory
              </button>
              <div className="h-[calc(100vh-140px)]">
                <CurriculumBuilder />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-extrabold text-slate-800">Curriculum Management Directory</h2>
                <p className="text-sm text-slate-500 mt-1">Access the builder or generated curriculum books for your department's regulations.</p>
              </div>

              <div className="space-y-8 animate-fadeIn">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
                    {selectedDepartment?.name || 'Your Department'} Regulations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {regulations.map((reg) => (
                      <div key={reg._id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors bg-slate-50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100/50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
                        <h4 className="font-extrabold text-slate-800 text-lg relative z-10">{reg.code}</h4>
                        <p className="text-xs text-slate-500 font-medium mb-4 relative z-10">Academic Year: {reg.academicYear}</p>
                        
                        <div className="flex flex-wrap gap-2 relative z-10">
                          <button
                            onClick={() => {
                              setSelectedRegulation(reg);
                              setBookViewMode('view');
                              setBuilderViewMode('directory');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Book
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRegulation(reg);
                              setBuilderViewMode('edit');
                              setBookViewMode('directory');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Builder
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. FACULTY MANAGEMENT SUBPAGE */}
      {/* ============================================================== */}
      {activeTab === 'faculty-management' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-800">Faculty Management</h1>
            <p className="text-xs text-slate-500 mt-1">Add faculty, edit details, and activate or deactivate faculty records.</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Add form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Add Faculty</h3>
              <form onSubmit={handleAddFaculty} className="space-y-3 text-xs font-bold text-slate-500">
                <div className="space-y-1">
                  <span>Faculty ID</span>
                  <input
                    type="text"
                    placeholder="e.g. CSE-F004"
                    value={facultyForm.facultyId}
                    onChange={(e) => setFacultyForm({ ...facultyForm, facultyId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Faculty Name</span>
                  <input
                    type="text"
                    placeholder="Dr. Faculty Name"
                    value={facultyForm.name}
                    onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="faculty@university.edu"
                    value={facultyForm.email}
                    onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Department</span>
                  <select
                    value={selectedDepartment?._id}
                    disabled
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold"
                  >
                    <option value={selectedDepartment?._id}>{selectedDepartment?.name}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Designation</span>
                  <select
                    value={facultyForm.designation}
                    onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Role</span>
                  <select
                    value={facultyForm.role}
                    onChange={(e) => setFacultyForm({ ...facultyForm, role: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Faculty">Faculty</option>
                    <option value="Coordinator">Coordinator</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Status</span>
                  <select
                    value={facultyForm.status}
                    onChange={(e) => setFacultyForm({ ...facultyForm, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Faculty</span>
                </button>
              </form>
            </div>

            {/* Right Table */}
            <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Registered Faculty list</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search faculty..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs outline-none bg-white w-48 font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                    <th className="p-3 pl-4 w-32">Faculty ID</th>
                    <th className="p-3">Faculty Name</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3 w-20">Status</th>
                    <th className="p-3 pr-4 text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Standard predefined faculty details matching bottom-left screenshot */}
                  {[
                    { _id: undefined as string | undefined, id: 'CSE-F001', name: 'Dr. Kavitha Menon', email: 'kavitha.menon@university.edu', designation: 'Professor', status: 'Active' },
                    { _id: undefined as string | undefined, id: 'CSE-F002', name: 'Prof. Arjun Nair', email: 'arjun.nair@university.edu', designation: 'Associate Professor', status: 'Active' },
                    { _id: undefined as string | undefined, id: 'CSE-F003', name: 'Dr. Meera Iyer', email: 'meera.iyer@university.edu', designation: 'Assistant Professor', status: 'Active' }
                  ]
                    .concat(faculty.slice(3).map((f, i) => ({
                      _id: f._id,
                      id: `CSE-F00${4 + i}`,
                      name: f.name,
                      email: f.email,
                      designation: 'Assistant Professor',
                      status: f.isActive ? 'Active' : 'Inactive'
                    })))
                    .filter(f => f.name.toLowerCase().includes(facultySearch.toLowerCase()))
                    .map((f) => (
                      <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                        <td className="p-3 pl-4 font-mono font-bold text-teal-800">{f.id}</td>
                        <td className="p-3 font-bold text-slate-800">{f.name}</td>
                        <td className="p-3">{f.email}</td>
                        <td className="p-3">{selectedDepartment?.name || 'Computer Science and Engineering'}</td>
                        <td className="p-3 font-semibold">{f.designation}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${f.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            onClick={() => f._id && handleToggleUserActive(f._id)}
                            className={`p-1 text-slate-400 hover:text-red-500 ${!f._id ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={!f._id}
                            title={f.status === 'Active' ? "Deactivate Faculty" : "Activate Faculty"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. FACULTY MONITORING SUBPAGE */}
      {/* ============================================================== */}
      {activeTab === 'faculty-monitoring' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-800">Faculty Monitoring Console</h1>
            <p className="text-xs text-slate-500 mt-1">Track coordinator progress levels, syllabus definition completion rates, and last login dates.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                  <th className="p-4 pl-6">Faculty Name</th>
                  <th className="p-4">Assigned Courses</th>
                  <th className="p-4 w-64">Completion Progress</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f, idx) => (
                  <tr key={f._id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                    <td className="p-4 pl-6 font-bold text-slate-800">{f.name}</td>
                    <td className="p-4 font-semibold text-teal-600">CS301 Data Structures and Algorithms</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${80 - (idx * 20)}%` }}></div>
                        </div>
                        <span className="font-bold text-[10px] font-mono text-slate-500">{80 - (idx * 20)}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${idx === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                        {idx === 0 ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. COURSE APPROVALS QUEUE */}
      {/* ============================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-800 font-sans">Course Approvals</h1>
            <p className="text-xs text-slate-500 mt-1">Faculty submission to HOD review workflow.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                  <th className="p-4 pl-6 w-96">Course</th>
                  <th className="p-4">Submitted By</th>
                  <th className="p-4 w-28">Status</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4 pr-6 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Submissions mapping to match approvals grid */}
                {versions.filter(v => ['Pending HOD', 'Returned', 'Approved'].includes(v.status)).map((v) => (
                  <tr key={v._id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                    <td className="p-4 pl-6 font-bold text-slate-800">{v.courseId?.code} — {v.courseId?.title}</td>
                    <td className="p-4 font-semibold">{v.assignedCoordinator?.name || 'Coordinator'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${v.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        v.status === 'Pending HOD' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-red-50 text-red-700 border-red-100'
                        }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <input
                        type="text"
                        placeholder="Add comments..."
                        value={approvalComments[v._id] !== undefined ? approvalComments[v._id] : (v.comments || '')}
                        onChange={(e) => setApprovalComments({ ...approvalComments, [v._id]: e.target.value })}
                        className="w-full border border-slate-200 rounded p-1.5 text-xs outline-none bg-white font-semibold focus:border-teal-700"
                      />
                    </td>
                    <td className="p-4 pr-6 text-right flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditCourseData({
                            title: v.courseId?.title || '',
                            code: v.courseId?.code || '',
                            programId: v.programId || '',
                            category: v.category || 'PC',
                            semester: v.semester || 1,
                            courseLevel: v.courseLevel || 'FC - Foundation',
                            status: v.status || 'Active',
                            L: v.credits?.L || 0,
                            T: v.credits?.T || 0,
                            P: v.credits?.P || 0,
                            S: v.credits?.S || 0,
                            C: v.credits?.C || 0,
                            cieMarks: v.cieSee?.cieMaxMarks || 40,
                            seeMarks: v.cieSee?.seeMaxMarks || 60,
                            description: v.description || '',
                            offeredFor: v.offeredFor || ['CSE'],
                            objectives: v.objectives?.length ? v.objectives : [''],
                            coordinatorId: v.coordinatorId?._id || v.coordinatorId || '',
                            prerequisites: v.prerequisites?.[0] || ''
                          });
                          setApprovalEditModal({ open: true, version: v });
                        }}
                        title="Edit Details"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-all cursor-pointer shadow-sm border border-slate-200"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingSyllabusId(v._id)}
                        title="Edit Complete Syllabus"
                        className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-all cursor-pointer shadow-sm border border-blue-200"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleApprovalAction(v._id, 'Approved')}
                        title="Approve"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all cursor-pointer shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleApprovalAction(v._id, 'Returned')}
                        title="Return"
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-all border border-red-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}

      {/* ============================================================== */}




      {/* ============================================================== */}
      {/* MINOR STREAMS TAB */}
      {/* ============================================================== */}
      {activeTab === 'minor-streams' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Minor Streams Management</h1>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Define and manage special academic minor stream tracks and map courses to them.</p>
            </div>
            <button
              onClick={() => {
                setEditingMinorStream(null);
                setNewMinorStreamData(defaultMinorStreamData);
                setMinorStreamModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
            >
              <Plus className="w-4 h-4" />
              <span>Create Minor Stream</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                  <th className="p-4 pl-6 w-1/4">STREAM NAME</th>
                  <th className="p-4">MAPPED COURSES</th>
                  <th className="p-4 pr-6 text-right w-32">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {minorStreams.map((stream) => (
                  <tr key={stream._id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                    <td className="p-4 pl-6 font-bold text-slate-800">{stream.name}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {stream.courses && stream.courses.length > 0 ? (
                          stream.courses.map((c: any) => (
                            <span key={c._id || c} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded">
                              {typeof c === 'object' ? `${c.code} - ${c.title}` : c}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic font-normal">No courses mapped</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingMinorStream(stream);
                          setNewMinorStreamData({
                            streamCode: stream.streamCode || '',
                            name: stream.name,
                            description: stream.description || '',
                            requiredCredits: stream.requiredCredits || 18,
                            status: stream.status || 'Draft',
                            courses: stream.courses.map((c: any) => typeof c === 'object' ? c._id : c)
                          });
                          setMinorStreamModalOpen(true);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                        title="Edit Stream"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMinorStream(stream._id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-655 rounded border border-red-150 cursor-pointer"
                        title="Delete Stream"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {minorStreams.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400 font-semibold">
                      No minor streams defined in this regulation context.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PREREQUISITES TAB */}
      {/* ============================================================== */}
      {activeTab === 'prerequisites' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Prerequisite Links</h1>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Configure prerequisite links to form a course dependency graph (flowchart) in the curriculum book.</p>
            </div>
            <button
              onClick={() => {
                setNewPrereqData({ sourceCourseId: '', targetCourseId: '' });
                setAddPrereqOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
            >
              <Plus className="w-4 h-4" />
              <span>Add Prerequisite Link</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                  <th className="p-4 pl-6 w-1/2">PREREQUISITE COURSE (REQUIRED BEFORE)</th>
                  <th className="p-4 w-1/2">DEPENDENT COURSE (TARGET)</th>
                  <th className="p-4 pr-6 text-right w-24">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {prereqs.map((link) => (
                  <tr key={link._id} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                    <td className="p-4 pl-6">
                      <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 border border-teal-100 rounded mr-2">
                        {link.sourceCourseId?.code}
                      </span>
                      <strong className="text-slate-850 font-bold">{link.sourceCourseId?.title}</strong>
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 border border-blue-100 rounded mr-2">
                        {link.targetCourseId?.code}
                      </span>
                      <strong className="text-slate-855 font-bold">{link.targetCourseId?.title}</strong>
                    </td>
                    <td className="p-4 pr-6 text-right flex justify-end">
                      <button
                        onClick={() => handleDeletePrereq(link._id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded border border-red-150 cursor-pointer"
                        title="Remove Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {prereqs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400 font-semibold">
                      No prerequisite links defined for this regulation context.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 10. PROFILE SCREEN */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Success banner */}
          {(showProfileSuccess || profileSuccess) && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-3 font-semibold">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                <span>Profile updated successfully.</span>
              </div>
              <button onClick={() => setShowProfileSuccess(false)} className="text-emerald-600 hover:text-emerald-800 transition-colors" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <h1 className="text-xl font-extrabold text-slate-800 font-sans">Profile</h1>
            <p className="text-xs text-slate-500 mt-1 font-semibold">Manage your profile and preferences.</p>
          </div>

          {/* HOD Info Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-850">HOD Information</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Professional details and department information.</p>
              </div>
              <div>
                {!isEditingProfile ? (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditingProfile(false);
                        setShowProfileSuccess(true);
                        setProfileSuccess(true);
                        setTimeout(() => { setShowProfileSuccess(false); setProfileSuccess(false); }, 4000);
                      }}
                      className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingProfile(false);
                        setPhoneVal('+91 9876543210');
                        setAltEmailVal('ananya.rao.alt@university.edu');
                        setProfileImageVal('');
                      }}
                      className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 text-xs">

              {/* Full Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Full Name</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">{user?.name || 'Dr. Ananya Rao'}</strong>
                </div>
              </div>

              {/* Designation */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Designation</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">Professor & HOD</strong>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Official Email</span>
                  <strong className="text-slate-855 font-mono text-xs mt-0.5 block">{user?.email || 'ananya.rao@university.edu'}</strong>
                </div>
              </div>

              {/* Employee ID */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Employee ID</span>
                  <strong className="text-slate-800 font-mono text-xs mt-0.5 block">HOD-CSE-001</strong>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Department</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">{user?.department?.name || 'Computer Science and Engineering'}</strong>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Phone Number</span>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={phoneVal}
                      onChange={(e) => setPhoneVal(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white"
                    />
                  ) : (
                    <strong className="text-slate-800 font-mono text-xs mt-0.5 block">{phoneVal}</strong>
                  )}
                </div>
              </div>

              {/* Alternate Email */}
              <div className="flex items-center gap-3 col-span-1">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Alternate Email</span>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={altEmailVal}
                      onChange={(e) => setAltEmailVal(e.target.value)}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white w-full max-w-[220px]"
                    />
                  ) : (
                    <strong className="text-slate-855 font-mono text-xs mt-0.5 block truncate">{altEmailVal}</strong>
                  )}
                </div>
              </div>

              {/* Profile Image */}
              <div className="flex items-center gap-3 col-span-1">
                <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {profileImageVal ? (
                    <img src={profileImageVal} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4.5 h-4.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Profile Image</span>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={profileImageVal}
                      onChange={(e) => setProfileImageVal(e.target.value)}
                      placeholder="Image URL..."
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white w-full max-w-[220px]"
                    />
                  ) : (
                    <strong className="text-slate-800 font-mono text-xs mt-0.5 block truncate">{profileImageVal ? 'Custom Image Set' : 'Default Initials'}</strong>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-855">Preferences</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Customize your HOD experience.</p>
            </div>

            <div className="divide-y divide-slate-100">

              {/* Toggle 1 */}
              <div className="py-4 first:pt-0 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Faculty Submission Notifications</h4>
                  <p className="text-slate-500 font-medium">Receive alerts when faculty submit drafts or syllabus modifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={facultySubNotif}
                    onChange={(e) => setFacultySubNotif(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle 2 */}
              <div className="py-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Course Approval Alerts</h4>
                  <p className="text-slate-500 font-medium">Get notified when course files require immediate review</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courseApprovalAlerts}
                    onChange={(e) => setCourseApprovalAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle 3 */}
              <div className="py-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Department Announcements</h4>
                  <p className="text-slate-500 font-medium">Broadcast new regulatory schemes to all department faculty</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptAnnouncements}
                    onChange={(e) => setDeptAnnouncements(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle 4 */}
              <div className="py-4 last:pb-0 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Curriculum Review Alerts</h4>
                  <p className="text-slate-500 font-medium">Get notifications about PEO and PSO mapping deadlines</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={curriculumReviewAlerts}
                    onChange={(e) => setCurriculumReviewAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans">Security & Access</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Manage your credentials and login safety</p>
            </div>

            <div className="divide-y divide-slate-100 text-xs font-bold text-slate-500 font-sans">

              {/* Change Password */}
              <div className="py-4 first:pt-0 flex justify-between items-center">
                <div className="space-y-0.5 text-left">
                  <h4 className="font-bold text-slate-800">Change Password</h4>
                  <p className="text-slate-500 font-medium font-sans">Update your account login credentials</p>
                </div>
                <button
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Reset Password
                </button>
              </div>

              {/* Two Factor Authentication */}
              <div className="py-4 last:pb-0 flex justify-between items-center">
                <div className="space-y-0.5 text-left">
                  <h4 className="font-bold text-slate-800">Two Factor Authentication (2FA)</h4>
                  <p className="text-slate-500 font-medium font-sans">Add an extra layer of security to your ERP account</p>
                </div>
                <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-bold shadow-sm cursor-pointer">
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL POPUPS */}
      {/* ============================================================== */}

      {/* CREATE REGULATION DIALOGUE / CLONE WIZARD */}
      {createRegOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-teal-700" />
                <span>Create New Regulation</span>
              </h3>
              <button onClick={() => setCreateRegOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateRegulation} className="p-6 space-y-5 text-xs font-bold text-slate-500">

              <div className="space-y-3">
                <h4 className="text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wide">New Regulation Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span>Regulation Code *</span>
                    <input
                      type="text"
                      placeholder="e.g. R2025"
                      value={newRegData.code}
                      onChange={(e) => setNewRegData({ ...newRegData, code: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <span>Academic Year *</span>
                    <input
                      type="number"
                      value={newRegData.academicYear}
                      onChange={(e) => setNewRegData({ ...newRegData, academicYear: parseInt(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 bg-white"
                      required
                    />
                  </div>
                </div>
              </div>


              <div className="flex gap-3 pt-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setCreateRegOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all"
                >
                  Create Regulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD COURSE DIALOGUE (HIGH DENSITY MULTI-FIELD OVERLAY) */}
      {addCourseOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[650px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Database className="w-5 h-5 text-teal-700" />
                <span>Add Course to Repository</span>
              </h3>
              <button onClick={() => setAddCourseOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleAddRepositoryCourse} className="p-6 space-y-4 text-xs font-bold text-slate-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Course Name *</span>
                  <input
                    type="text"
                    placeholder="e.g. Data Structures and Algorithms"
                    value={newCourseData.title}
                    onChange={(e) => setNewCourseData({ ...newCourseData, title: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Course Code *</span>
                  <input
                    type="text"
                    placeholder="e.g. CS301"
                    value={newCourseData.code}
                    onChange={(e) => setNewCourseData({ ...newCourseData, code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Program *</span>
                  <select
                    value={newCourseData.programId}
                    onChange={(e) => setNewCourseData({ ...newCourseData, programId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="">B.Tech</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Department *</span>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold"
                    disabled
                  >
                    <option>{selectedDepartment?.name || 'Computer Science and Engineering'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Regulation *</span>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold"
                    disabled
                  >
                    <option>{selectedRegulation?.code || 'R2025'}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Course Type *</span>
                  <select
                    value={newCourseData.category}
                    onChange={(e) => setNewCourseData({ ...newCourseData, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="PC">Professional Core (PC)</option>
                    <option value="PE">Professional Elective (PE)</option>
                    <option value="OE">Open Elective (OE)</option>
                    <option value="BS">Basic Sciences (BS)</option>
                    <option value="ES">Engineering Sciences (ES)</option>
                    <option value="HS">Humanities & Social Sciences (HS)</option>
                    <option value="MC">Mandatory Course (MC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span>Course Level</span>
                  <select
                    value={newCourseData.courseLevel}
                    onChange={(e) => setNewCourseData({ ...newCourseData, courseLevel: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="FC - Foundation">FC - Foundation</option>
                    <option value="PC - Core">PC - Core</option>
                    <option value="PE - Elective">PE - Elective</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Semester *</span>
                  <select
                    value={newCourseData.semester}
                    onChange={(e) => setNewCourseData({ ...newCourseData, semester: Number(e.target.value), suggestiveSemester: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Status</span>
                  <select
                    value={newCourseData.status}
                    onChange={(e) => setNewCourseData({ ...newCourseData, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* L-T-P-S-C Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wide block">L-T-P-S—C Structure</span>
                <div className="grid grid-cols-5 gap-3 font-mono">
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">L</span>
                    <input
                      type="number"
                      value={newCourseData.L}
                      onChange={(e) => {
                        const lVal = parseInt(e.target.value) || 0;
                        const cVal = lVal + (newCourseData.T) + (newCourseData.P / 2) + (newCourseData.S);
                        setNewCourseData({ ...newCourseData, L: lVal, credits: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">T</span>
                    <input
                      type="number"
                      value={newCourseData.T}
                      onChange={(e) => {
                        const tVal = parseInt(e.target.value) || 0;
                        const cVal = (newCourseData.L) + tVal + (newCourseData.P / 2) + (newCourseData.S);
                        setNewCourseData({ ...newCourseData, T: tVal, credits: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">P</span>
                    <input
                      type="number"
                      value={newCourseData.P}
                      onChange={(e) => {
                        const pVal = parseInt(e.target.value) || 0;
                        const cVal = (newCourseData.L) + (newCourseData.T) + (pVal / 2) + (newCourseData.S);
                        setNewCourseData({ ...newCourseData, P: pVal, credits: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">S</span>
                    <input
                      type="number"
                      value={newCourseData.S}
                      onChange={(e) => {
                        const sVal = parseInt(e.target.value) || 0;
                        const cVal = (newCourseData.L) + (newCourseData.T) + (newCourseData.P / 2) + sVal;
                        setNewCourseData({ ...newCourseData, S: sVal, credits: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px] font-bold text-teal-800">Credits (C)</span>
                    <input
                      type="number"
                      value={newCourseData.credits}
                      onChange={(e) => setNewCourseData({ ...newCourseData, credits: parseInt(e.target.value) || 0 })}
                      className="w-full text-center border border-teal-300 font-bold bg-teal-50 rounded p-1.5 text-teal-850"
                    />
                  </div>
                </div>
              </div>



              <div className="space-y-2">
                <span>Course Offered for Branches *</span>
                <div className="grid grid-cols-4 gap-2">
                  {branchOptions.map((branch) => {
                    const isChecked = newCourseData.offeredFor.includes(branch);
                    return (
                      <label key={branch} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const offeredFor = isChecked
                              ? newCourseData.offeredFor.filter((item) => item !== branch)
                              : [...newCourseData.offeredFor, branch];
                            setNewCourseData({ ...newCourseData, offeredFor });
                          }}
                          className="accent-teal-700"
                        />
                        <span>{branch}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="hidden space-y-2">
                <div className="flex items-center justify-between">
                  <span>Course Objectives *</span>
                  <button
                    type="button"
                    onClick={() => setNewCourseData({ ...newCourseData, objectives: [...newCourseData.objectives, ''] })}
                    className="text-[10px] font-bold text-teal-700 hover:text-teal-850"
                  >
                    Add Objective
                  </button>
                </div>
                <div className="space-y-2">
                  {newCourseData.objectives.map((objective, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-7 shrink-0 text-center font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => {
                          const objectives = [...newCourseData.objectives];
                          objectives[idx] = e.target.value;
                          setNewCourseData({ ...newCourseData, objectives });
                        }}
                        placeholder="Official curriculum objective"
                        className="min-w-0 flex-1 border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white outline-none focus:ring-1 focus:ring-teal-700"
                      />
                      {newCourseData.objectives.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewCourseData({ ...newCourseData, objectives: newCourseData.objectives.filter((_, i) => i !== idx) })}
                          className="p-2 text-red-500 hover:text-red-700"
                          aria-label="Remove objective"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span>CIE Marks</span>
                  <input
                    type="number"
                    value={newCourseData.cieMarks}
                    onChange={(e) => setNewCourseData({ ...newCourseData, cieMarks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <span>SEE Marks</span>
                  <input
                    type="number"
                    value={newCourseData.seeMarks}
                    onChange={(e) => setNewCourseData({ ...newCourseData, seeMarks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <span>Total Marks (AUTO)</span>
                  <input
                    type="number"
                    value={newCourseData.cieMarks + newCourseData.seeMarks}
                    readOnly
                    className="w-full border border-teal-200 bg-teal-50/50 rounded-lg p-2.5 text-teal-850 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span>Course Coordinator</span>
                <select
                  value={newCourseData.coordinatorId}
                  onChange={(e) => setNewCourseData({ ...newCourseData, coordinatorId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                >
                  <option value="">-- Choose Coordinator --</option>
                  {faculty.map(f => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span>Prerequisites</span>
                <input
                  type="text"
                  placeholder="e.g. CS201 - Data Structures"
                  value={newCourseData.prerequisites}
                  onChange={(e) => setNewCourseData({ ...newCourseData, prerequisites: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div className="flex gap-3 pt-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setAddCourseOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all animate-pulse"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CURRICULUM BUILDER: COURSE SEARCH LOOKUP DIALOGUE */}
      {builderCourseSelectOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[500px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-800">Select Course from Repository</h3>
              <button onClick={() => setBuilderCourseSelectOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            {/* Search filter in modal */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Courses items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {courses
                .filter(c => c.code.toLowerCase().includes(builderSearch.toLowerCase()) || c.title.toLowerCase().includes(builderSearch.toLowerCase()))
                .map(c => (
                  <div
                    key={c._id}
                    onClick={() => {
                      setBuilderSelectedCourse(c);
                      setBuilderCourseSelectOpen(false);
                      setBuilderSearch('');
                    }}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-teal-700 hover:bg-teal-50/40 transition-colors cursor-pointer flex items-center justify-between font-sans text-xs font-bold"
                  >
                    <div>
                      <span className="block font-mono text-[10px] text-slate-400">{c.code}</span>
                      <span className="text-slate-800 text-xs font-bold">{c.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              {courses.filter(c => c.code.toLowerCase().includes(builderSearch.toLowerCase()) || c.title.toLowerCase().includes(builderSearch.toLowerCase())).length === 0 && (
                <p className="text-center py-16 text-slate-400 font-semibold">No courses found. Add courses to the repository first.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT DIALOGUE */}
      {bulkImportOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[500px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Bulk Import — Primary Workflow</span>
              </h3>
              <button onClick={() => { setBulkImportOpen(false); setBulkFile(null); }} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs font-bold text-slate-500 text-center">
              <p className="text-slate-400 font-semibold mb-2">Upload curriculum metadata via CSV. Headers should match: Course Code, Course Title, Category, Semester, etc.</p>
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-teal-700 transition-colors flex flex-col items-center gap-2 cursor-pointer bg-slate-50 relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                />
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-slate-600 font-bold">{bulkFile ? bulkFile.name : 'Choose CSV file'}</span>
                <span className="text-[10px] text-slate-400">File size limits up to 10MB</span>
              </label>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setBulkImportOpen(false); setBulkFile(null); }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImportSubmit}
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all disabled:opacity-50"
                  disabled={!bulkFile}
                >
                  Confirm Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Approval Edit Modal */}
      {approvalEditModal.open && approvalEditModal.version && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[650px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-teal-700" />
                <span>Review & Edit Course</span>
              </h3>
              <button onClick={() => setApprovalEditModal({ open: false, version: null })} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveCourseEdit} className="p-6 space-y-4 text-xs font-bold text-slate-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Course Name</span>
                  <input
                    type="text"
                    value={editCourseData.title}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 font-semibold outline-none bg-slate-50"
                    disabled
                  />
                </div>
                <div className="space-y-1">
                  <span>Course Code</span>
                  <input
                    type="text"
                    value={editCourseData.code}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 font-semibold outline-none bg-slate-50"
                    disabled
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Program</span>
                  <select
                    value={editCourseData.programId}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold"
                    disabled
                  >
                    <option value="">B.Tech</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Department</span>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold" disabled>
                    <option>{selectedDepartment?.name || 'Computer Science and Engineering'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Regulation</span>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-400 outline-none bg-slate-50 font-semibold" disabled>
                    <option>{selectedRegulation?.code || 'R2025'}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Course Type *</span>
                  <select
                    value={editCourseData.category}
                    onChange={(e) => setEditCourseData({ ...editCourseData, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="PC">Professional Core (PC)</option>
                    <option value="PE">Professional Elective (PE)</option>
                    <option value="OE">Open Elective (OE)</option>
                    <option value="BS">Basic Sciences (BS)</option>
                    <option value="ES">Engineering Sciences (ES)</option>
                    <option value="HS">Humanities & Social Sciences (HS)</option>
                    <option value="MC">Mandatory Course (MC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span>Course Level</span>
                  <select
                    value={editCourseData.courseLevel}
                    onChange={(e) => setEditCourseData({ ...editCourseData, courseLevel: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="FC - Foundation">FC - Foundation</option>
                    <option value="PC - Core">PC - Core</option>
                    <option value="PE - Elective">PE - Elective</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Semester *</span>
                  <select
                    value={editCourseData.semester}
                    onChange={(e) => setEditCourseData({ ...editCourseData, semester: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span>Status</span>
                  <select
                    value={editCourseData.status}
                    onChange={(e) => setEditCourseData({ ...editCourseData, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* L-T-P-S-C Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wide block">L-T-P-S—C Structure</span>
                <div className="grid grid-cols-5 gap-3 font-mono">
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">L</span>
                    <input
                      type="number"
                      value={editCourseData.L}
                      onChange={(e) => {
                        const lVal = parseInt(e.target.value) || 0;
                        const cVal = lVal + (editCourseData.T) + (editCourseData.P / 2) + (editCourseData.S);
                        setEditCourseData({ ...editCourseData, L: lVal, C: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">T</span>
                    <input
                      type="number"
                      value={editCourseData.T}
                      onChange={(e) => {
                        const tVal = parseInt(e.target.value) || 0;
                        const cVal = (editCourseData.L) + tVal + (editCourseData.P / 2) + (editCourseData.S);
                        setEditCourseData({ ...editCourseData, T: tVal, C: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">P</span>
                    <input
                      type="number"
                      value={editCourseData.P}
                      onChange={(e) => {
                        const pVal = parseInt(e.target.value) || 0;
                        const cVal = (editCourseData.L) + (editCourseData.T) + (pVal / 2) + (editCourseData.S);
                        setEditCourseData({ ...editCourseData, P: pVal, C: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px]">S</span>
                    <input
                      type="number"
                      value={editCourseData.S}
                      onChange={(e) => {
                        const sVal = parseInt(e.target.value) || 0;
                        const cVal = (editCourseData.L) + (editCourseData.T) + (editCourseData.P / 2) + sVal;
                        setEditCourseData({ ...editCourseData, S: sVal, C: cVal });
                      }}
                      className="w-full text-center border border-slate-300 rounded p-1.5 text-slate-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-center block text-[9px] font-bold text-teal-800">Credits (C)</span>
                    <input
                      type="number"
                      value={editCourseData.C}
                      onChange={(e) => setEditCourseData({ ...editCourseData, C: parseInt(e.target.value) || 0 })}
                      className="w-full text-center border border-teal-300 font-bold bg-teal-50 rounded p-1.5 text-teal-850"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span>Course Offered for Branches *</span>
                <div className="grid grid-cols-4 gap-2">
                  {branchOptions.map((branch) => {
                    const isChecked = editCourseData.offeredFor.includes(branch);
                    return (
                      <label key={branch} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const offeredFor = isChecked
                              ? editCourseData.offeredFor.filter((item) => item !== branch)
                              : [...editCourseData.offeredFor, branch];
                            setEditCourseData({ ...editCourseData, offeredFor });
                          }}
                          className="accent-teal-700"
                        />
                        <span>{branch}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span>CIE Marks</span>
                  <input
                    type="number"
                    value={editCourseData.cieMarks}
                    onChange={(e) => setEditCourseData({ ...editCourseData, cieMarks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <span>SEE Marks</span>
                  <input
                    type="number"
                    value={editCourseData.seeMarks}
                    onChange={(e) => setEditCourseData({ ...editCourseData, seeMarks: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <span>Total Marks (AUTO)</span>
                  <input
                    type="number"
                    value={editCourseData.cieMarks + editCourseData.seeMarks}
                    readOnly
                    className="w-full border border-teal-200 bg-teal-50/50 rounded-lg p-2.5 text-teal-850 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span>Course Coordinator</span>
                <select
                  value={editCourseData.coordinatorId}
                  onChange={(e) => setEditCourseData({ ...editCourseData, coordinatorId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                >
                  <option value="">-- Choose Coordinator --</option>
                  {faculty.map(f => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span>Prerequisites</span>
                <input
                  type="text"
                  placeholder="e.g. CS201 - Data Structures"
                  value={editCourseData.prerequisites}
                  onChange={(e) => setEditCourseData({ ...editCourseData, prerequisites: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div className="flex gap-3 pt-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setApprovalEditModal({ open: false, version: null })}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all animate-pulse"
                >
                  Save Course Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Outcome Statement Modal */}
      {editingStatement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-teal-700" />
                <span>Edit {editingStatement.type === 'pos' ? 'PO' : editingStatement.type === 'peos' ? 'PEO' : 'PSO'} Statement</span>
              </h3>
              <button
                onClick={() => setEditingStatement(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-slate-500">
              <div className="space-y-1">
                <span>Outcome Code *</span>
                <input
                  type="text"
                  value={editingStatement.code}
                  onChange={(e) => setEditingStatement({ ...editingStatement, code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span>Description *</span>
                <textarea
                  rows={4}
                  value={editingStatement.description}
                  onChange={(e) => setEditingStatement({ ...editingStatement, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span>Status</span>
                <select
                  value={editingStatement.status}
                  onChange={(e) => setEditingStatement({ ...editingStatement, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 outline-none bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                >
                  <option value="Draft">Draft</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => setEditingStatement(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatement}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 border border-teal-700 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Save Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MINOR STREAM DIALOGUE (HIGH DENSITY MULTI-FIELD OVERLAY) */}
      {minorStreamModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-[650px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-5 h-5 text-teal-700" />
                <span>{editingMinorStream ? 'Edit' : 'Create'} Minor Stream Track</span>
              </h3>
              <button
                onClick={() => { setMinorStreamModalOpen(false); setEditingMinorStream(null); }}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >✕</button>
            </div>
            <form onSubmit={handleSaveMinorStream} className="p-6 space-y-4 text-xs font-bold text-slate-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Stream Name *</span>
                  <input
                    type="text"
                    placeholder="e.g. Network Security"
                    value={newMinorStreamData.name}
                    onChange={(e) => setNewMinorStreamData({ ...newMinorStreamData, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Stream Code *</span>
                  <input
                    type="text"
                    placeholder="e.g. MIN-SEC"
                    value={newMinorStreamData.streamCode}
                    onChange={(e) => setNewMinorStreamData({ ...newMinorStreamData, streamCode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span>Description</span>
                <textarea
                  rows={2}
                  placeholder="Provide a brief overview of this minor track..."
                  value={newMinorStreamData.description}
                  onChange={(e) => setNewMinorStreamData({ ...newMinorStreamData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span>Required Credits *</span>
                  <input
                    type="number"
                    value={newMinorStreamData.requiredCredits}
                    onChange={(e) => setNewMinorStreamData({ ...newMinorStreamData, requiredCredits: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <span>Status *</span>
                  <select
                    value={newMinorStreamData.status}
                    onChange={(e) => setNewMinorStreamData({ ...newMinorStreamData, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-semibold outline-none bg-white"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wide block">Map Department Courses to Stream *</span>
                <div className="border border-slate-200 rounded-lg p-3 max-h-[200px] overflow-y-auto bg-slate-50 space-y-2">
                  {courses.map((course) => {
                    const isChecked = newMinorStreamData.courses.includes(course._id);
                    return (
                      <label key={course._id} className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-100 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updatedCourses = isChecked
                              ? newMinorStreamData.courses.filter(id => id !== course._id)
                              : [...newMinorStreamData.courses, course._id];
                            setNewMinorStreamData({ ...newMinorStreamData, courses: updatedCourses });
                          }}
                          className="accent-teal-700"
                        />
                        <span><strong className="text-teal-750 font-bold font-mono">{course.code}</strong> - {course.title}</span>
                      </label>
                    );
                  })}
                  {courses.length === 0 && (
                    <p className="text-slate-400 italic text-center py-6 font-normal">No department courses available in repository</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setMinorStreamModalOpen(false); setEditingMinorStream(null); }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all"
                >
                  {editingMinorStream ? 'Save Changes' : 'Create Stream Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Prerequisite Modal */}
      {addPrereqOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <ArrowRightLeft className="w-5 h-5 text-teal-700" />
                <span>Add Prerequisite Link</span>
              </h3>
              <button
                onClick={() => setAddPrereqOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddPrereq} className="p-6 space-y-4 text-xs font-bold text-slate-500">
              <div className="space-y-1">
                <span>Select Prerequisite Course (Source) *</span>
                <select
                  value={newPrereqData.sourceCourseId}
                  onChange={(e) => setNewPrereqData({ ...newPrereqData, sourceCourseId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  required
                >
                  <option value="">-- Choose Prerequisite Course --</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>{course.code} - {course.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span>Select Dependent Course (Target) *</span>
                <select
                  value={newPrereqData.targetCourseId}
                  onChange={(e) => setNewPrereqData({ ...newPrereqData, targetCourseId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold focus:ring-1 focus:ring-teal-700"
                  required
                >
                  <option value="">-- Choose Dependent Course --</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>{course.code} - {course.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddPrereqOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold shadow cursor-pointer transition-all"
                >
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CURRICULUM BOOK MANAGER SUBPAGE */}
      {/* ============================================================== */}
      {activeTab === 'curriculum-book' && (
        <CurriculumBookManager />
      )}

    </div>
  );
};

export default HodDashboard;
