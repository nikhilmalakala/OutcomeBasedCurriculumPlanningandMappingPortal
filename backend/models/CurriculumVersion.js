import mongoose from 'mongoose';

const curriculumVersionSchema = new mongoose.Schema({
  curriculumBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CurriculumBook',
    required: true,
  },
  versionNumber: {
    type: Number,
    required: true,
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  editedContent: {
    type: mongoose.Schema.Types.Mixed,
  },
  pdfPath: {
    type: String,
  },
  generatedPdfPath: {
    type: String,
  },
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  changeSummary: {
    type: String,
    default: 'Saved curriculum version',
  },
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Archived'],
    default: 'Draft',
  }
}, {
  timestamps: true,
});

curriculumVersionSchema.index({ curriculumBookId: 1, versionNumber: 1 }, { unique: true });
curriculumVersionSchema.index({ curriculumBookId: 1, createdAt: -1 });

const CurriculumVersion = mongoose.model('CurriculumVersion', curriculumVersionSchema);

export default CurriculumVersion;
