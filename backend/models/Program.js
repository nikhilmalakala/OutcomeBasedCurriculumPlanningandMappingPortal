import mongoose from 'mongoose';

const ProgramSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "Engineering" or "B.Tech"
  code: { type: String, required: true, unique: true, index: true }, // e.g., "BTECH", "MBA"
  description: { type: String },
  degree: { type: String, default: '' },
  duration: { type: Number, default: 4 },
  numberOfSemesters: { type: Number, default: 8 },
  totalCredits: { type: Number, default: 160 },
  vision: { type: String, default: '' },
  mission: { type: String, default: '' },
  // CODEx-added start: Stores program-wide curriculum book branding applied to every regulation under this program.
  curriculumBookTemplate: {
    coverTitle: { type: String, default: '' },
    coverSubtitle: { type: String, default: '' },
    coverNote: { type: String, default: '' },
    headerText: { type: String, default: '' },
    footerText: { type: String, default: '' },
    watermarkText: { type: String, default: '' }
  },
  // CODEx-added end
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Program', ProgramSchema);