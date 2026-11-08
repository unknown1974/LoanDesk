import { Router } from 'express';
import { z } from 'zod';
import { Loan } from './loan.model.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { InterestPeriod } from '../interest/interestPeriod.model.js';
import { Payment } from '../payments/payment.model.js';
import { rollLoan } from '../interest/interest.service.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { audit } from '../auditLog.js';
import { scopeFilter } from '../../middleware/auth.js';
import { startOfDayUTC, todayIST } from '../../utils/dates.js';

const router = Router();

const dateField = z.coerce.date().transform(startOfDayUTC);
const createBody = z.object({
  borrowerId: z.string().length(24),
  principalPaise: z.number().int().positive(),
  monthlyRateBps: z.number().int().min(0).max(10000),
  interestMethod: z.enum(['monthly', 'daily']).default('monthly'),
  startDate: dateField,
  notes: z.string().max(1000).optional(),
});

async function withUnpaid(loans) {
  const ids = loans.map((l) => l._id);
  const sums = await InterestPeriod.aggregate([
    { $match: { loanId: { $in: ids }, status: { $ne: 'paid' } } },
    { $group: { _id: '$loanId', unpaid: { $sum: { $subtract: ['$interestDuePaise', '$interestPaidPaise'] } }, overdue: { $sum: { $cond: [{ $lt: ['$periodEnd', todayIST()] }, { $subtract: ['$interestDuePaise', '$interestPaidPaise'] }, 0] } } } },
  ]);
  const m = new Map(sums.map((s) => [String(s._id), s]));
  return loans.map((l) => ({ ...l, unpaidInterestPaise: m.get(String(l._id))?.unpaid || 0, overdueInterestPaise: m.get(String(l._id))?.overdue || 0 }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { ...scopeFilter(req) };
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.borrowerId) filter.borrowerId = String(req.query.borrowerId);
    const loans = await Loan.find(filter).sort({ createdAt: -1 }).populate('borrowerId', 'name phone').populate('lenderId', 'name').lean();
    res.json(await withUnpaid(loans));
  })
);

router.post(
  '/',
  validate(createBody),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const borrower = await Borrower.findOne({ _id: b.borrowerId, ...scopeFilter(req) });
    if (!borrower) throw new HttpError(404, 'Borrower not found');
    const loan = await Loan.create({
      lenderId: borrower.lenderId,
      borrowerId: b.borrowerId,
      originalPrincipalPaise: b.principalPaise,
      outstandingPrincipalPaise: b.principalPaise,
      monthlyRateBps: b.monthlyRateBps,
      interestMethod: b.interestMethod,
      startDate: b.startDate,
      notes: b.notes,
      rateHistory: [{ rateBps: b.monthlyRateBps, effectiveFrom: b.startDate }],
    });
    await rollLoan(loan);
    await audit(req, 'create', 'loan', loan._id, { principalPaise: b.principalPaise, rateBps: b.monthlyRateBps });
    res.status(201).json(loan);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    let loan = await Loan.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!loan) throw new HttpError(404, 'Loan not found');
    loan = await rollLoan(loan);
    const [borrower, periods, payments] = await Promise.all([
      Borrower.findById(loan.borrowerId).lean(),
      InterestPeriod.find({ loanId: loan._id }).sort({ index: -1 }).lean(),
      Payment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
    ]);
    const reversed = new Set(payments.filter((p) => p.type === 'reversal').map((p) => String(p.reversalOf)));
    const [withSums] = await withUnpaid([loan.toObject()]);
    res.json({
      loan: withSums,
      borrower,
      periods,
      payments: payments.map((p) => ({ ...p, reversed: reversed.has(String(p._id)) })),
    });
  })
);

// Rate changes apply to FUTURE periods only; calculated periods keep their snapshot.
router.patch(
  '/:id/rate',
  validate(z.object({ monthlyRateBps: z.number().int().min(0).max(10000) })),
  asyncHandler(async (req, res) => {
    const loan = await Loan.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!loan) throw new HttpError(404, 'Loan not found');
    if (loan.status !== 'active') throw new HttpError(400, 'Loan is closed');
    await rollLoan(loan); // bring periods up to date at the OLD rate first
    loan.monthlyRateBps = req.body.monthlyRateBps;
    loan.rateHistory.push({ rateBps: req.body.monthlyRateBps, effectiveFrom: todayIST() });
    await loan.save();
    await audit(req, 'change_rate', 'loan', loan._id, { rateBps: req.body.monthlyRateBps });
    res.json(loan);
  })
);

router.patch(
  '/:id',
  validate(z.object({ notes: z.string().max(1000) })),
  asyncHandler(async (req, res) => {
    const loan = await Loan.findOneAndUpdate({ _id: req.params.id, ...scopeFilter(req) }, { notes: req.body.notes }, { new: true });
    if (!loan) throw new HttpError(404, 'Loan not found');
    res.json(loan);
  })
);

export default router;
