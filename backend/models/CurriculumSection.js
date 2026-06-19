import mongoose from 'mongoose';

const curriculumSectionSchema = new mongoose.Schema({
  curriculumBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CurriculumBook',
    required: true,
  },
  sectionType: {
    type: String,
    required: true, // e.g., 'ProgramInfo', 'DepartmentDetails', 'VisionMission', 'PEO', 'PO', 'PSO', 'CurriculumStructure', 'SemesterTables', 'CourseDetails', 'MappingTables'
  },
  sectionTitle: {
    type: String,
  },
  sectionContent: {
    type: mongoose.Schema.Types.Mixed,
  },
  orderNumber: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

// Create compound index for querying sections by book and ordering
curriculumSectionSchema.index({ curriculumBookId: 1, orderNumber: 1 });
curriculumSectionSchema.index({ curriculumBookId: 1, sectionType: 1 });

const CurriculumSection = mongoose.model('CurriculumSection', curriculumSectionSchema);

export default CurriculumSection;
