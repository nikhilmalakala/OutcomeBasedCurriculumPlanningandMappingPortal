import { z } from 'zod';

// Express schema validator middleware helper
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }
    return next(error);
  }
};

// Login Validation Schema
export const loginSchema = z.object({
  email: z.string().email({ message: 'Valid university email is required' }),
  password: z.string().min(5, { message: 'Password must be at least 5 characters long' })
});

// Program Validation Schema
export const programSchema = z.object({
  name: z.string().min(3, { message: 'Program name must be at least 3 characters' }),
  code: z.string().min(2, { message: 'Program code must be at least 2 characters' }),
  description: z.string().optional(),
  degree: z.string().optional(),
  duration: z.number().optional(),
  totalCredits: z.number().optional(),
  vision: z.string().optional(),
  mission: z.string().optional()
});

// Department Validation Schema
export const departmentSchema = z.object({
  name: z.string().min(3, { message: 'Department name must be at least 3 characters' }),
  code: z.string().min(2, { message: 'Department code must be at least 2 characters' }),
  programId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid program ID reference' }),
  regulationId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid regulation ID reference' }),
  description: z.string().optional()
});

// Regulation Validation Schema
export const regulationSchema = z.object({
  code: z.string().min(2, { message: 'Regulation code must be at least 2 characters' }),
  academicYear: z.number().int().min(2000).max(2100),
  programId: z.string().min(10),
  durationYears: z.number().int().min(1).max(6).default(4),
  semesterCount: z.number().int().min(1).max(12).default(8),
  status: z.enum(['Draft', 'Published', 'Archived']).default('Draft'),
  version: z.number().default(1),
  isActive: z.boolean().default(true)
});

// Course Creation Schema (Shared Identity)
export const courseSchema = z.object({
  code: z.string().min(3, { message: 'Course code must be at least 3 characters' }),
  title: z.string().min(3, { message: 'Course title must be at least 3 characters' }),
  departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid department ID reference' }),
  regulationId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid regulation ID reference' }),
  semester: z.number().int().min(1).max(12, { message: 'Semester must be between 1 and 12' })
});

// Assign Coordinator Schema
export const assignCoordinatorSchema = z.object({
  courseVersionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  coordinatorId: z.string().regex(/^[0-9a-fA-F]{24}$/)
});

// CourseVersion Syllabus & Mapping Update Schema (Draft/Coordinator saving)
export const updateCourseVersionSchema = z.object({
  credits: z.object({
    L: z.number().int().min(0).max(10),
    T: z.number().int().min(0).max(10),
    P: z.number().int().min(0).max(10),
    S: z.number().int().min(0).max(10),
    C: z.number().int().min(0).max(15)
  }).optional(),
  category: z.enum(['PC', 'PE', 'OE', 'BS', 'ES', 'HS', 'MC', 'MCC', 'MDC', 'AEC', 'SEC', 'VAC', 'MSC', 'UEC', 'SI', 'PROJ']).optional(),
  level: z.enum(['Foundation', 'Intermediate', 'Advanced']).optional(),
  knowledgeLevel: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  description: z.string().optional(),
  offeredFor: z.array(z.string()).optional(),

  courseOutcomes: z.array(z.object({
    coCode: z.string(),
    description: z.string(),
    bloomLevel: z.string()
  })).optional(),

  coPoMappings: z.array(z.object({
    coCode: z.string(),
    po: z.record(z.number().min(0).max(3))
  })).optional(),

  coPsoMappings: z.array(z.object({
    coCode: z.string(),
    pso: z.record(z.number().min(0).max(3))
  })).optional(),

  syllabusUnits: z.array(z.object({
    unitNumber: z.number().int().min(1).max(5),
    richTextContent: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    topics: z.array(z.string()).optional(),
    outcomes: z.string().optional(),
    hours: z.number().int().min(0).max(30).optional()
  })).optional(),

  labPracticals: z.array(z.object({
    experimentNo: z.string().optional(),
    title: z.string(),
    hours: z.number().optional(),
    description: z.string().optional(),
    toolsRequired: z.string().optional()
  })).optional(),

  miniProjects: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    outcomes: z.string().optional(),
    technologies: z.string().optional(),
    deliverables: z.string().optional()
  })).optional(),

  textbooks: z.array(z.object({
    title: z.string(),
    author: z.string().optional(),
    publisher: z.string().optional(),
    edition: z.string().optional()
  })).optional(),

  referenceMaterials: z.array(z.object({
    title: z.string(),
    author: z.string().optional(),
    publisher: z.string().optional(),
    edition: z.string().optional()
  })).optional(),

  journals: z.array(z.string()).optional(),

  onlineResources: z.array(z.object({
    url: z.string(),
    description: z.string().optional()
  })).optional(),

  cieSee: z.object({
    cieMaxMarks: z.number().int().min(0).max(100),
    seeMaxMarks: z.number().int().min(0).max(100),
    cieBreakup: z.string().optional(),
    seeBreakup: z.string().optional(),
    midExams: z.number().optional(),
    assignments: z.number().optional(),
    quiz: z.number().optional(),
    lab: z.number().optional()
  }).optional()
});

// Update Workflow Status Schema
export const updateWorkflowSchema = z.object({
  status: z.enum(['Draft', 'Pending HOD', 'Pending Admin', 'Approved', 'Returned']),
  comments: z.string().optional()
});

// Change Password Validation Schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
  newPassword: z.string().min(8, { message: 'New password must contain at least 8 characters.' })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    })
});
