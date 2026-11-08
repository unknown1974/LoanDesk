import mongoose from 'mongoose';

const rateHistorySchema = new mongoose.Schema(
  { rateBps: Number, effectiveFrom: Date, changedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrower', required: true, index: true },
    originalPrincipalPaise: { type: Number, required: true, min: 1 },
    outstandingPrincipalPaise: { type: Number, required: true, min: 0 },
    monthlyRateBps: { type: Number, required: true, min: 0 }, // 200 = 2% per month
    interestMethod: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
    rateHistory: [rateHistorySchema],
    startDate: { type: Date, required: true },
    nextDueDate: { type: Date, default: null }, // earliest unpaid interest due date
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Loan = mongoose.model('Loan', loanSchema);
