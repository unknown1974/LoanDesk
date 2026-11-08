import mongoose from 'mongoose';

// Roles:
//   superadmin - created by `npm run seed`; sees everything, approves lenders
//   lender     - owns borrowers and loans; sees only their own
//   borrower   - read-only view of their own loans
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, enum: ['superadmin', 'lender', 'borrower'], required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'disabled'], default: 'pending' },
    // Borrowers type this code when requesting a login, to say which lender they belong to.
    lenderCode: { type: String, unique: true, sparse: true },
    // Borrower accounts only: the lender they belong to, and their borrower record.
    lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrower', unique: true, sparse: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
