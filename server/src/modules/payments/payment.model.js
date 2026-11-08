import mongoose from 'mongoose';

// Payments are immutable financial records. Mistakes are fixed with a "reversal" entry.
const paymentSchema = new mongoose.Schema(
  {
    lenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    type: { type: String, enum: ['interest', 'principal', 'reversal'], required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    paymentDate: { type: Date, required: true, index: true },
    method: { type: String, enum: ['cash', 'upi', 'bank', 'cheque', 'other'], default: 'cash' },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    // which interest periods an interest payment was applied to
    allocations: [{ _id: false, periodId: mongoose.Schema.Types.ObjectId, amountPaise: Number }],
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', unique: true, sparse: true },
    reversedType: { type: String, enum: ['interest', 'principal'] },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const block = () => {
  throw new Error('Payments are immutable. Create a reversal entry instead.');
};
paymentSchema.pre('save', function () {
  if (!this.isNew) block();
});
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace']) {
  paymentSchema.pre(op, block);
}

export const Payment = mongoose.model('Payment', paymentSchema);
