import mongoose from 'mongoose';

const RegulationSchema = new mongoose.Schema({
  code: { type: String, required: true }, // e.g. "R23", "R25"
  academicYear: { type: Number, required: true }, // e.g. 2023, 2025
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  durationYears: { type: Number, required: true, default: 4 }, // Duration of course in years
  semesterCount: { type: Number, required: true, default: 8 }, // Number of semesters
  status: { type: String, enum: ['Draft', 'Published', 'Archived'], default: 'Draft' },
  version: { type: Number, default: 1 },
  // CODEx-added start: Stores regulation-specific curriculum book layout overrides.
  curriculumLayout: {
    coverTitle: { type: String, default: '' },
    coverSubtitle: { type: String, default: '' },
    headerText: { type: String, default: '' },
    footerText: { type: String, default: '' },
    watermarkText: { type: String, default: '' },
    pageBorderStyle: { type: String, enum: ['classic', 'minimal', 'none'], default: 'classic' },
    accentColor: { type: String, default: '#1d4ed8' }
  },
  // CODEx-added end
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique regulation code per program
RegulationSchema.index({ code: 1, programId: 1 }, { unique: true });

export default mongoose.model('Regulation', RegulationSchema);