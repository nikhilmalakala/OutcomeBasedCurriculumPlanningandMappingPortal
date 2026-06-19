import mongoose from 'mongoose';

const syllabusUnitSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  courseVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseVersion',
    required: true,
    index: true,
  },
  unitNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  richTextContent: {
    type: String,
    default: '',
  },
  htmlContent: {
    type: String,
    default: '',
  },
  plainText: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  topics: [{ type: String }],
  outcomes: {
    type: String,
    default: '',
  },
  hours: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

syllabusUnitSchema.index({ courseId: 1, courseVersionId: 1, unitNumber: 1 }, { unique: true });

export default mongoose.model('SyllabusUnit', syllabusUnitSchema);
