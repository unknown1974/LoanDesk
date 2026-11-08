import { Router } from 'express';
import { z } from 'zod';
import { Payment } from './payment.model.js';
import { Loan } from '../loans/loan.model.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { InterestPeriod, statusFor } from '../interest/interestPeriod.model.js';
import { rollLoan, refreshLoan } from '../interest/interest.service.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { audit } from '../auditLog.js';
import { scopeFilter } from '../../middleware/auth.js';
import { startOfDayUTC, todayIST } from '../../utils/dates.js';
import { formatINR } from '../../utils/money.js';

const router = Router();

const createBody = z.object({
  loanId: z.string().length(24),
  type: z.enum(['interest', 'principal']),
  amountPaise: z.number().int().positive(),
  paymentDate: z.coerce.date().transform(startOfDayUTC),
  method: z.enum(['cash', 'upi', 'bank', 'cheque', 'other']).default('cash'),
  reference: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { ...scopeFilter(req), ...(req.query.loanId ? { loanId: String(req.query.loanId) } : {}) };
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(limit).lean());
  })
);

router.post(
  '/',
  validate(createBody),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (b.paymentDate > todayIST()) throw new HttpError(400, 'Payment date cannot be in the future');
    const loan = await Loan.findOne({ _id: b.loanId, ...scopeFilter(req) });
    if (!loan) throw new HttpError(404, 'Loan not found');
    await rollLoan(loan);

    let allocations = [];
    if (b.type === 'interest') {
      // Apply to the oldest unpaid periods first. Partial payments are fine.
      const periods = await InterestPeriod.find({ loanId: loan._id, status: { $ne: 'paid' } }).sort({ index: 1 });
      const totalDue = periods.reduce((s, p) => s + (p.interestDuePaise - p.interestPaidPaise), 0);
      if (totalDue === 0) throw new HttpError(400, 'No interest is currently due on this loan');
      if (b.amountPaise > totalDue) throw new HttpError(400, `Amount exceeds interest outstanding (${formatINR(totalDue)})`);
      let left = b.amountPaise;
      for (const p of periods) {
        if (left <= 0) break;
        const take = Math.min(left, p.interestDuePaise - p.interestPaidPaise);
        allocations.push({ periodId: p._id, amountPaise: take, doc: p });
        left -= take;
      }
    } else if (b.amountPaise > loan.outstandingPrincipalPaise) {
      throw new HttpError(400, `Amount exceeds outstanding principal (${formatINR(loan.outstandingPrincipalPaise)})`);
    }

    // The immutable record is written first; balances are updated from it afterwards.
    const payment = await Payment.create({
      lenderId: loan.lenderId,
      loanId: loan._id,
      type: b.type,
      amountPaise: b.amountPaise,
      paymentDate: b.paymentDate,
      method: b.method,
      reference: b.reference,
      note: b.note,
      allocations: allocations.map(({ periodId, amountPaise }) => ({ periodId, amountPaise })),
      createdBy: req.user.email,
    });

    if (b.type === 'interest') {
      for (const a of allocations) {
        a.doc.interestPaidPaise += a.amountPaise;
        a.doc.status = statusFor(a.doc.interestDuePaise, a.doc.interestPaidPaise);
        await a.doc.save();
      }
    } else {
      loan.outstandingPrincipalPaise -= b.amountPaise;
    }
    await refreshLoan(loan);
    await audit(req, `payment_${b.type}`, 'payment', payment._id, { loanId: loan._id, amountPaise: b.amountPaise });
    res.status(201).json(payment);
  })
);

// Corrects a mistaken entry without altering history: adds a reversal record and undoes its effect.
router.post(
  '/:id/reverse',
  validate(z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(300) })),
  asyncHandler(async (req, res) => {
    const original = await Payment.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!original) throw new HttpError(404, 'Payment not found');
    if (original.type === 'reversal') throw new HttpError(400, 'A reversal cannot be reversed');
    if (await Payment.exists({ reversalOf: original._id })) throw new HttpError(400, 'This payment is already reversed');
    const loan = await Loan.findById(original.loanId);

    if (original.type === 'principal' && (await InterestPeriod.exists({ loanId: loan._id, createdAt: { $gt: original.createdAt } }))) {
      throw new HttpError(400, 'A new interest period has started since this principal payment, so reversing it would change interest already calculated. Record a manual adjustment instead.');
    }

    const reversal = await Payment.create({
      lenderId: loan.lenderId,
      loanId: loan._id,
      type: 'reversal',
      amountPaise: original.amountPaise,
      paymentDate: todayIST(),
      reversalOf: original._id,
      reversedType: original.type,
      note: req.body.reason,
      createdBy: req.user.email,
    });

    if (original.type === 'interest') {
      for (const a of original.allocations) {
        const p = await InterestPeriod.findById(a.periodId);
        if (!p) continue;
        p.interestPaidPaise = Math.max(0, p.interestPaidPaise - a.amountPaise);
        p.status = statusFor(p.interestDuePaise, p.interestPaidPaise);
        await p.save();
      }
    } else {
      loan.outstandingPrincipalPaise += original.amountPaise;
    }
    await refreshLoan(loan);
    await audit(req, 'payment_reversal', 'payment', original._id, { reason: req.body.reason });
    res.status(201).json(reversal);
  })
);

router.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({ _id: req.params.id, ...scopeFilter(req) }).lean();
    if (!payment) throw new HttpError(404, 'Payment not found');
    const loan = await Loan.findById(payment.loanId).lean();
    const borrower = await Borrower.findById(loan.borrowerId).lean();
    res.json({ receiptNo: `LD-${String(payment._id).slice(-8).toUpperCase()}`, payment, borrower, loan });
  })
);

export default router;
