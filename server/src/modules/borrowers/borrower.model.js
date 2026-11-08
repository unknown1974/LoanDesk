import mongoose from 'mongoose';

const borrowerSchema = new mongoose.Schema(
  {
    lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }, // 10-digit Indian mobile
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);
borrowerSchema.index({ name: 'text', phone: 'text' });

export const Borrower = mongoose.model('Borrower', borrowerSchema);
