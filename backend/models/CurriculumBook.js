import mongoose from 'mongoose';

const curriculumBookSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  regulation: {
    type: String,
    required: true,
  },
  academicYear: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
  },
  uploadedFile: {
    type: String,
  },
  originalFileName: {
    type: String,
  },
  fileType: {
    type: String,
    enum: ['PDF', 'DOCX'],
  },
  mimeType: {
    type: String,
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  currentVersion: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Archived'],
    default: 'Draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true,
});

curriculumBookSchema.index({ departmentId: 1, status: 1 });
curriculumBookSchema.index({ departmentId: 1, regulation: 1, academicYear: 1 });
curriculumBookSchema.index({ createdBy: 1, createdAt: -1 });

const CurriculumBook = mongoose.model('CurriculumBook', curriculumBookSchema);

export default CurriculumBook;
