import CourseVersion from '../models/CourseVersion.js';
import Regulation from '../models/Regulation.js';
import Program from '../models/Program.js';

const formatVersion = (version) => ({
  _id: version._id,
  code: version.courseId?.code || '',
  title: version.courseId?.title || '',
  category: version.category,
  level: version.level,
  credits: version.credits,
  semester: version.semester,
  status: version.status,
  description: version.description || '',
  courseId: version.courseId?._id,
  department: version.courseId?.departmentId ? {
    _id: version.courseId.departmentId._id,
    name: version.courseId.departmentId.name,
    code: version.courseId.departmentId.code
  } : null
});

const buildCategorySummary = (versions) => {
  const categories = ['MCC', 'MSC', 'UEC', 'MDC', 'AEC', 'SEC', 'VAC', 'SI', 'PROJ', 'MC', 'PC', 'ES', 'HS'];
  const semesterMap = new Map();

  versions.forEach((version) => {
    const semesterKey = version.semester || 1;
    const semesterItem = semesterMap.get(semesterKey) || {
      semester: semesterKey,
      categoryCredits: {},
      totalCredits: 0
    };

    const category = version.category || 'MCC';
    const creditValue = version.credits?.C || 0;
    semesterItem.totalCredits += creditValue;
    semesterItem.categoryCredits[category] = (semesterItem.categoryCredits[category] || 0) + creditValue;

    semesterMap.set(semesterKey, semesterItem);
  });

  const result = Array.from(semesterMap.values()).sort((a, b) => a.semester - b.semester);
  return result.map((item) => ({
    semester: item.semester,
    totalCredits: item.totalCredits,
    categoryCredits: categories.reduce((acc, cat) => {
      acc[cat] = item.categoryCredits[cat] || 0;
      return acc;
    }, {})
  }));
};

export const getCurriculumByRegulation = async (req, res, next) => {
  try {
    const { regulationId } = req.params;
    const regulation = await Regulation.findById(regulationId).populate('programId');
    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found.' });
    }

    const versions = await CourseVersion.find({ regulationId })
      .populate({ path: 'courseId', populate: { path: 'departmentId' } })
      .sort({ semester: 1, 'courseId.code': 1 });

    const semesters = Array.from({ length: regulation.semesterCount }, (_, index) => ({ semester: index + 1, courses: [] }));
    versions.forEach((version) => {
      const semesterIndex = Math.max(0, Math.min(regulation.semesterCount - 1, (version.semester || 1) - 1));
      semesters[semesterIndex].courses.push(formatVersion(version));
    });

    const department = versions[0]?.courseId?.departmentId
      ? {
          _id: versions[0].courseId.departmentId._id,
          name: versions[0].courseId.departmentId.name,
          code: versions[0].courseId.departmentId.code
        }
      : null;

    const totalCredits = versions.reduce((sum, version) => sum + (version.credits?.C || 0), 0);

    return res.status(200).json({
      regulation: {
        code: regulation.code,
        academicYear: regulation.academicYear,
        durationYears: regulation.durationYears
      },
      program: {
        name: regulation.programId?.name || 'B.Tech',
        code: regulation.programId?.code || 'B.Tech'
      },
      department,
      semesters,
      totalCredits,
      courseCount: versions.length
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurriculumSummary = async (req, res, next) => {
  try {
    const { regulationId } = req.params;
    const regulation = await Regulation.findById(regulationId).populate('programId');
    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found.' });
    }

    const versions = await CourseVersion.find({ regulationId }).sort({ semester: 1, 'courseId.code': 1 });
    const semesterSummaries = buildCategorySummary(versions);
    const cumulativeTotals = semesterSummaries.reduce((acc, sem) => {
      Object.entries(sem.categoryCredits).forEach(([category, credits]) => {
        acc[category] = (acc[category] || 0) + credits;
      });
      return acc;
    }, {});

    return res.status(200).json({
      regulation: {
        code: regulation.code,
        academicYear: regulation.academicYear,
        durationYears: regulation.durationYears
      },
      program: {
        name: regulation.programId?.name || 'B.Tech',
        code: regulation.programId?.code || 'B.Tech'
      },
      semesterSummaries,
      cumulativeCredits: cumulativeTotals
    });
  } catch (error) {
    return next(error);
  }
};

export const getSemesterCourses = async (req, res, next) => {
  try {
    const { regulationId, semester } = req.params;
    const regulation = await Regulation.findById(regulationId);
    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found.' });
    }

    const semesterNumber = Number(semester);
    const versions = await CourseVersion.find({ regulationId, semester: semesterNumber })
      .populate({ path: 'courseId', populate: { path: 'departmentId' } })
      .sort({ 'courseId.code': 1 });

    const courses = versions.map(formatVersion);
    return res.status(200).json({ semester: semesterNumber, courses });
  } catch (error) {
    return next(error);
  }
};
// CODEx-added start: API to get book layout configuration for a regulation.
export const getBookLayoutConfig = async (req, res, next) => {
  try {
    const { regulationId } = req.params;
    const regulation = await Regulation.findById(regulationId).populate('programId');
    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found.' });
    }
    const program = regulation.programId;

    // Merge program-level defaults with regulation-specific overrides (regulation wins)
    const layout = {
      coverTitle: regulation.curriculumLayout?.coverTitle || program.curriculumBookTemplate?.coverTitle || 'Curriculum',
      coverSubtitle: regulation.curriculumLayout?.coverSubtitle || program.curriculumBookTemplate?.coverSubtitle || '',
      coverNote: regulation.curriculumLayout?.coverNote || program.curriculumBookTemplate?.coverNote || '',
      headerText: regulation.curriculumLayout?.headerText || program.curriculumBookTemplate?.headerText || '',
      footerText: regulation.curriculumLayout?.footerText || program.curriculumBookTemplate?.footerText || '',
      watermarkText: regulation.curriculumLayout?.watermarkText || program.curriculumBookTemplate?.watermarkText || '',
      pageBorderStyle: regulation.curriculumLayout?.pageBorderStyle || 'classic',
      accentColor: regulation.curriculumLayout?.accentColor || '#1d4ed8'
    };

    return res.status(200).json({
      regulation: { code: regulation.code, academicYear: regulation.academicYear },
      program: { name: program.name, code: program.code },
      layout
    });
  } catch (error) {
    return next(error);
  }
};
// CODEx-added end

// CODEx-added start: API to save book layout configuration for a regulation.
export const saveBookLayoutConfig = async (req, res, next) => {
  try {
    const { regulationId } = req.params;
    const updates = req.body;

    const regulation = await Regulation.findByIdAndUpdate(
      regulationId,
      {
        $set: {
          curriculumLayout: {
            coverTitle: updates.coverTitle,
            coverSubtitle: updates.coverSubtitle,
            coverNote: updates.coverNote,
            headerText: updates.headerText,
            footerText: updates.footerText,
            watermarkText: updates.watermarkText,
            pageBorderStyle: updates.pageBorderStyle,
            accentColor: updates.accentColor
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!regulation) {
      return res.status(404).json({ message: 'Regulation not found.' });
    }

    return res.status(200).json({
      message: 'Curriculum book layout saved successfully.',
      layout: regulation.curriculumLayout
    });
  } catch (error) {
    return next(error);
  }
};
// CODEx-added end
