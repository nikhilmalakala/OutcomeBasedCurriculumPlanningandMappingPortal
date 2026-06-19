export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'HOD' | 'Coordinator' | 'Faculty';
  department?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string } | null;
  isActive: boolean;
}

export interface Program {
  _id: string;
  name: string;
  code: string;
  description?: string;
  curriculumBookTemplate?: {
    coverTitle?: string;
    coverSubtitle?: string;
    coverNote?: string;
    headerText?: string;
    footerText?: string;
    watermarkText?: string;
  };
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  programId: string | Program;
  description?: string;
}

export interface Regulation {
  _id: string;
  code: string;
  academicYear: number;
  programId: string | Program;
  departmentId: string | Department;
  durationYears: number;
  semesterCount: number;
  isActive: boolean;
  curriculumLayout?: {
    coverTitle?: string;
    coverSubtitle?: string;
    headerText?: string;
    footerText?: string;
    watermarkText?: string;
    pageBorderStyle?: 'classic' | 'minimal' | 'none';
    accentColor?: string;
  };
}

export interface Course {
  _id: string;
  code: string;
  title: string;
  departmentId: string;
}

export interface SyllabusUnit {
  unitNumber: number;
  htmlContent?: string;
  plainText?: string;
  lastUpdated?: string;
  title?: string;
  description?: string;
  topics?: string[];
  outcomes?: string;
  hours?: number;
}

export interface CourseOutcome {
  coCode: string;
  description: string;
  bloomLevel: string;
}

export interface CoPoMapping {
  coCode: string;
  po: Record<string, number>;
}

export interface CoPsoMapping {
  coCode: string;
  pso: Record<string, number>;
}

export interface LabPractical {
  title: string;
  hours?: number;
  description?: string;
}

export interface MiniProject {
  title: string;
  description?: string;
}

export interface CourseVersion {
  _id: string;
  courseId: Course;
  regulationId: Regulation;
  semester: number;
  credits: {
    L: number;
    T: number;
    P: number;
    S: number;
    C: number;
  };
  category: 'PC' | 'PE' | 'OE' | 'BS' | 'ES' | 'HS' | 'MC';
  objectives: string[];
  prerequisites: string[];
  status: 'Draft' | 'Pending HOD' | 'Approved' | 'Returned';
  assignedCoordinator?: User | null;
  courseOutcomes: CourseOutcome[];
  coPoMappings: CoPoMapping[];
  coPsoMappings: CoPsoMapping[];
  syllabusUnits: SyllabusUnit[];
  labPracticals: LabPractical[];
  miniProjects: MiniProject[];
  textbooks: string[];
  referenceMaterials: string[];
  cieSee: {
    cieMaxMarks: number;
    seeMaxMarks: number;
    cieBreakup?: string;
    seeBreakup?: string;
  };
  comments?: string;
}

export interface ObjectiveOutcome {
  code: string;
  description: string;
}

export interface PeoPso {
  _id: string;
  regulationId: string;
  peos: ObjectiveOutcome[];
  psos: ObjectiveOutcome[];
  pos: ObjectiveOutcome[];
}
