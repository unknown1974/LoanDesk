import { Router } from 'express';
import { Loan } from '../loans/loan.model.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { Payment } from '../payments/payment.model.js';
import { InterestPeriod } from '../interest/interestPeriod.model.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { scopeFilter } from '../../middleware/auth.js';

const router = Router();

// Monthly collections: interest and principal received, net of reversals.
router.get(
  '/collections',
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const payments = await Payment.find({ ...scopeFilter(req), paymentDate: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }).lean();
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, interestPaise: 0, principalPaise: 0 }));
    for (const p of payments) {
      const row = months[new Date(p.paymentDate).getUTCMonth()];
      const sign = p.type === 'reversal' ? -1 : 1;
      const kind = p.type === 'reversal' ? p.reversedType : p.type;
      row[`${kind}Paise`] += sign * p.amountPaise;
    }
    res.json({
      year,
      months,
      totalInterestPaise: months.reduce((s, m) => s + m.interestPaise, 0),
      totalPrincipalPaise: months.reduce((s, m) => s + m.principalPaise, 0),
    });
  })
);

router.get(
  '/outstanding',
  asyncHandler(async (req, res) => {
    const loans = await Loan.find({ status: 'active', ...scopeFilter(req) }).populate('borrowerId', 'name phone').lean();
    const sums = await InterestPeriod.aggregate([
      { $match: { status: { $ne: 'paid' }, ...scopeFilter(req) } },
      { $group: { _id: '$loanId', unpaid: { $sum: { $subtract: ['$interestDuePaise', '$interestPaidPaise'] } } } },
    ]);
    const m = new Map(sums.map((s) => [String(s._id), s.unpaid]));
    const rows = loans.map((l) => ({
      loanId: l._id,
      borrower: l.borrowerId?.name,
      principalPaise: l.outstandingPrincipalPaise,
      monthlyRateBps: l.monthlyRateBps,
      unpaidInterestPaise: m.get(String(l._id)) || 0,
      nextDueDate: l.nextDueDate,
    }));
    res.json({
      rows,
      totalPrincipalPaise: rows.reduce((s, r) => s + r.principalPaise, 0),
      totalUnpaidInterestPaise: rows.reduce((s, r) => s + r.unpaidInterestPaise, 0),
    });
  })
);

router.get(
  '/statement/:borrowerId',
  asyncHandler(async (req, res) => {
    const borrower = await Borrower.findOne({ _id: req.params.borrowerId, ...scopeFilter(req) }).lean();
    if (!borrower) throw new HttpError(404, 'Borrower not found');
    const loans = await Loan.find({ borrowerId: borrower._id }).lean();
    const loanIds = loans.map((l) => l._id);
    const [payments, periods] = await Promise.all([
      Payment.find({ loanId: { $in: loanIds } }).sort({ paymentDate: 1, createdAt: 1 }).lean(),
      InterestPeriod.find({ loanId: { $in: loanIds } }).sort({ periodEnd: 1 }).lean(),
    ]);
    const net = { interest: 0, principal: 0 };
    for (const p of payments) {
      if (p.type === 'reversal') net[p.reversedType] -= p.amountPaise;
      else net[p.type] += p.amountPaise;
    }
    res.json({
      borrower,
      loans,
      periods,
      payments,
      totals: {
        interestPaidPaise: net.interest,
        principalRepaidPaise: net.principal,
        outstandingPrincipalPaise: loans.reduce((s, l) => s + l.outstandingPrincipalPaise, 0),
        interestUnpaidPaise: periods.reduce((s, p) => s + (p.interestDuePaise - p.interestPaidPaise), 0),
      },
    });
  })
);

export default router;
