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
