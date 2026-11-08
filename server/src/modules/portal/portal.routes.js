import { Router } from 'express';
import { User } from '../auth/user.model.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { Loan } from '../loans/loan.model.js';
import { InterestPeriod } from '../interest/interestPeriod.model.js';
import { Payment } from '../payments/payment.model.js';
import { rollLoan } from '../interest/interest.service.js';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { todayIST } from '../../utils/dates.js';

const router = Router();
router.use(requireRole('borrower'));

// Read-only view for a borrower: only their own loans, nothing editable, no lender-private notes.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user.borrowerId) throw new HttpError(404, 'Your login is not linked to a loan record yet');
    const [borrower, lender] = await Promise.all([
      Borrower.findById(req.user.borrowerId).select('name').lean(),
      User.findById(req.user.lenderId).select('name phone').lean(),
    ]);
    const loans = await Loan.find({ borrowerId: req.user.borrowerId, lenderId: req.user.lenderId }).sort({ createdAt: -1 }).select('-notes');
    const today = todayIST();

    const out = [];
    for (const loan of loans) {
      await rollLoan(loan, today);
      const [periods, payments] = await Promise.all([
        InterestPeriod.find({ loanId: loan._id }).sort({ index: -1 }).lean(),
        Payment.find({ loanId: loan._id }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
      ]);
      const reversed = new Set(payments.filter((p) => p.type === 'reversal').map((p) => String(p.reversalOf)));
      const unpaid = periods.filter((p) => p.status !== 'paid');
      out.push({
        id: loan._id,
        status: loan.status,
        startDate: loan.startDate,
        monthsRunning: periods.length, // loans have no fixed end date, so tenure is shown as time so far
        originalPrincipalPaise: loan.originalPrincipalPaise,
        outstandingPrincipalPaise: loan.outstandingPrincipalPaise,
        monthlyRateBps: loan.monthlyRateBps,
        interestMethod: loan.interestMethod,
        nextDueDate: loan.nextDueDate,
        unpaidInterestPaise: unpaid.reduce((s, p) => s + p.interestDuePaise - p.interestPaidPaise, 0),
        overdueInterestPaise: unpaid.filter((p) => p.periodEnd < today).reduce((s, p) => s + p.interestDuePaise - p.interestPaidPaise, 0),
        periods: periods.map((p) => ({ periodStart: p.periodStart, periodEnd: p.periodEnd, openingPrincipalPaise: p.openingPrincipalPaise, interestDuePaise: p.interestDuePaise, interestPaidPaise: p.interestPaidPaise, status: p.status })),
        payments: payments.filter((p) => p.type !== 'reversal').map((p) => ({ id: p._id, type: p.type, amountPaise: p.amountPaise, paymentDate: p.paymentDate, method: p.method, reference: p.reference, reversed: reversed.has(String(p._id)) })),
      });
    }
    res.json({
      borrower: { name: borrower?.name },
      lender: { name: lender?.name, phone: lender?.phone },
      totals: {
        outstandingPrincipalPaise: out.filter((l) => l.status === 'active').reduce((s, l) => s + l.outstandingPrincipalPaise, 0),
        unpaidInterestPaise: out.reduce((s, l) => s + l.unpaidInterestPaise, 0),
        nextDueDate: out.map((l) => l.nextDueDate).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null,
      },
      loans: out,
    });
  })
);

export default router;
