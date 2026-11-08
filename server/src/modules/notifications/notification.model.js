import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    link: { type: String }, // in-app path to open when clicked
    readAt: { type: Date, default: null },
    relatedLoanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    // Set for due-date notifications so the same period never notifies twice for the same offset.
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterestPeriod' },
    offsetDays: { type: Number },
  },
  { timestamps: true }
);
notificationSchema.index({ periodId: 1, offsetDays: 1 }, { unique: true, partialFilterExpression: { periodId: { $exists: true } } });

export const Notification = mongoose.model('Notification', notificationSchema);
