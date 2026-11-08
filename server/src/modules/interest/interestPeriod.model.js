import mongoose from 'mongoose';

// One row per billing period. rateBps/method/openingPrincipal are snapshots, so later
// rate changes never alter interest that has already been calculated.
const interestPeriodSchema = new mongoose.Schema(
  {
    lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
    index: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true }, // also the due date
    openingPrincipalPaise: { type: Number, required: true },
    rateBps: { type: Number, required: true },
    method: { type: String, enum: ['monthly', 'daily'], required: true },
    interestDuePaise: { type: Number, required: true },
    interestPaidPaise: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'partial', 'paid'], default: 'open', index: true },
  },
  { timestamps: true }
);
interestPeriodSchema.index({ loanId: 1, index: 1 }, { unique: true });
interestPeriodSchema.index({ periodEnd: 1, status: 1 });

export const InterestPeriod = mongoose.model('InterestPeriod', interestPeriodSchema);

export function statusFor(duePaise, paidPaise) {
  if (paidPaise <= 0) return 'open';
  return paidPaise >= duePaise ? 'paid' : 'partial';
}
