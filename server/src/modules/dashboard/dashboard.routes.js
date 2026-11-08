import { Router } from 'express';
import { Loan } from '../loans/loan.model.js';
import { Payment } from '../payments/payment.model.js';
import { InterestPeriod } from '../interest/interestPeriod.model.js';
import { rollAllActiveLoans } from '../interest/interest.service.js';
import { asyncHandler } from '../../utils/httpError.js';
import { scopeFilter } from '../../middleware/auth.js';
import { addDays, todayIST } from '../../utils/dates.js';

const router = Router();

// Net amount collected by type, treating reversals as negative.
function netByType(rows) {
  const out = { interest: 0, principal: 0 };
  for (const r of rows) {
    if (r.type === 'reversal') out[r.reversedType] -= r.amountPaise;
    else out[r.type] += r.amountPaise;
  }
  return out;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = todayIST();
    const scope = scopeFilter(req);
    await rollAllActiveLoans(today, scope);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [activeLoans, allPayments, monthPayments, dueSoon, overdue] = await Promise.all([
      Loan.find({ status: 'active', ...scope }).lean(),
      Payment.find({ ...scope }).lean(),
      Payment.find({ ...scope, paymentDate: { $gte: monthStart } }).lean(),
      InterestPeriod.find({ ...scope, status: { $ne: 'paid' }, periodEnd: { $gte: today, $lte: addDays(today, 7) } }).sort({ periodEnd: 1 }).lean(),
      InterestPeriod.find({ ...scope, status: { $ne: 'paid' }, periodEnd: { $lt: today } }).sort({ periodEnd: 1 }).lean(),
    ]);

    const loanIds = [...new Set([...dueSoon, ...overdue].map((p) => String(p.loanId)))];
    const loans = await Loan.find({ _id: { $in: loanIds } }).populate('borrowerId', 'name phone').lean();
    const loanMap = new Map(loans.map((l) => [String(l._id), l]));
    const shape = (p) => ({
      periodId: p._id,
      loanId: p.loanId,
      borrower: loanMap.get(String(p.loanId))?.borrowerId?.name,
      dueDate: p.periodEnd,
      owingPaise: p.interestDuePaise - p.interestPaidPaise,
      status: p.status,
    });

    const all = netByType(allPayments);
    const month = netByType(monthPayments);
    res.json({
      outstandingPrincipalPaise: activeLoans.reduce((s, l) => s + l.outstandingPrincipalPaise, 0),
      activeLoans: activeLoans.length,
      interestCollectedAllTimePaise: all.interest,
      interestCollectedThisMonthPaise: month.interest,
      principalCollectedThisMonthPaise: month.principal,
      overduePaise: overdue.reduce((s, p) => s + p.interestDuePaise - p.interestPaidPaise, 0),
      upcoming: dueSoon.map(shape),
      overdue: overdue.map(shape),
    });
  })
);

export default router;
