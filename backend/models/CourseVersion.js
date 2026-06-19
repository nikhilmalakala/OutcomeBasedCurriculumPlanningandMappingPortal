import mongoose from 'mongoose';

const SyllabusUnitSchema = new mongoose.Schema({
  unitNumber: { type: Number, required: true },
  htmlContent: { type: String, default: '' },
  richTextContent: { type: String, default: '' },
  plainText: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  topics: [{ type: String }],
  outcomes: { type: String, default: '' },
  hours: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const CourseOutcomeSchema = new mongoose.Schema({
  coCode: { type: String, required: true }, // CO1, CO2, CO3, CO4, CO5
  description: { type: String, required: true },
  bloomLevel: { type: String, required: true } // e.g. "K3 - Apply"
});

const TextbookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, default: '' },
  publisher: { type: String, default: '' },
  edition: { type: String, default: '' }
}, { _id: false });

const ReferenceMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, default: '' },
  publisher: { type: String, default: '' },
  edition: { type: String, default: '' }
}, { _id: false });

const OnlineResourceSchema = new mongoose.Schema({
  url: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const CourseVersionSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  regulationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Regulation', required: true },
  semester: { type: Number, required: true, default: 1 },
  credits: {
    L: { type: Number, default: 3 }, // Lecture
    T: { type: Number, default: 0 }, // Tutorial
    P: { type: Number, default: 0 }, // Practical
    S: { type: Number, default: 0 }, // Skill/Session
    C: { type: Number, default: 3 }  // Total Credits
  },
  category: { 
    type: String, 
    enum: ['PC', 'PE', 'OE', 'BS', 'ES', 'HS', 'MC', 'MCC', 'MDC', 'AEC', 'SEC', 'VAC', 'MSC', 'UEC', 'SI', 'PROJ'], 
    default: 'PC' 
  }, // PC = Professional Core, etc.
  level: { 
    type: String, 
    enum: ['Foundation', 'Intermediate', 'Advanced'], 
    default: 'Foundation' 
  },
  knowledgeLevel: { type: String, default: '' },
  objectives: [{ type: String }],
  prerequisites: [{ type: String }],
  description: { type: String, default: '' },
  offeredFor: [{ type: String }],
  status: { 
    type: String, 
    enum: ['Draft', 'Pending HOD', 'Pending Admin', 'Approved', 'Returned'], 
    default: 'Draft' 
  },
  assignedCoordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  courseOutcomes: [CourseOutcomeSchema],
  
  // Matrix Mappings: Keys will be PO1..PO12 and PSO1..PSO3 with value 0, 1, 2, 3
  coPoMappings: [{
    coCode: { type: String, required: true },
    po: {
      type: Map,
      of: Number,
      default: {}
    }
  }],
  coPsoMappings: [{
    coCode: { type: String, required: true },
    pso: {
      type: Map,
      of: Number,
      default: {}
    }
  }],

  syllabusUnits: [SyllabusUnitSchema],
  
  labPracticals: [{
    experimentNo: { type: String },
    title: { type: String },
    hours: { type: Number },
    description: { type: String },
    toolsRequired: { type: String }
  }],
  
  miniProjects: [{
    title: { type: String },
    description: { type: String },
    outcomes: { type: String },
    technologies: { type: String },
    deliverables: { type: String }
  }],
  
  textbooks: [TextbookSchema],
  referenceMaterials: [ReferenceMaterialSchema],
  journals: [{ type: String }],
  onlineResources: [OnlineResourceSchema],
  
  cieSee: {
    cieMaxMarks: { type: Number, default: 40 },
    seeMaxMarks: { type: Number, default: 60 },
    cieBreakup: { type: String },
    seeBreakup: { type: String },
    midExams: { type: Number, default: 0 },
    assignments: { type: Number, default: 0 },
    quiz: { type: Number, default: 0 },
    lab: { type: Number, default: 0 }
  },

  comments: { type: String, default: '' } // Review/Return comments from HOD/Admin
}, { timestamps: true });

// A course version should be unique per course and regulation
CourseVersionSchema.index({ courseId: 1, regulationId: 1 }, { unique: true });

export default mongoose.model('CourseVersion', CourseVersionSchema);
