import { Router } from 'express';
import { z } from 'zod';
import { Borrower } from './borrower.model.js';
import { Loan } from '../loans/loan.model.js';
import { validate } from '../../middleware/validate.js';
import { scopeFilter, meId } from '../../middleware/auth.js';
import { phoneSchema as phone } from '../../utils/validators.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { audit } from '../auditLog.js';

const router = Router();

const borrowerBody = z.object({
  name: z.string().trim().min(1).max(100),
  phone,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, status } = req.query;
    const filter = { ...scopeFilter(req) };
    if (status) filter.status = String(status);
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }
    const borrowers = await Borrower.find(filter).sort({ name: 1 }).lean();
    const counts = await Loan.aggregate([
      { $match: { status: 'active', ...scopeFilter(req) } },
      { $group: { _id: '$borrowerId', activeLoans: { $sum: 1 }, outstandingPaise: { $sum: '$outstandingPrincipalPaise' } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    res.json(borrowers.map((b) => ({ ...b, activeLoans: byId.get(String(b._id))?.activeLoans || 0, outstandingPaise: byId.get(String(b._id))?.outstandingPaise || 0 })));
  })
);

router.post(
  '/',
  validate(borrowerBody),
  asyncHandler(async (req, res) => {
    const b = await Borrower.create({ ...req.body, lenderId: meId(req) });
    await audit(req, 'create', 'borrower', b._id, { name: b.name });
    res.status(201).json(b);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const borrower = await Borrower.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!borrower) throw new HttpError(404, 'Borrower not found');
    const loans = await Loan.find({ borrowerId: borrower._id }).sort({ createdAt: -1 });
    res.json({ borrower, loans });
  })
);

router.put(
  '/:id',
  validate(borrowerBody),
  asyncHandler(async (req, res) => {
    const b = await Borrower.findOneAndUpdate({ _id: req.params.id, ...scopeFilter(req) }, req.body, { new: true, runValidators: true });
    if (!b) throw new HttpError(404, 'Borrower not found');
    await audit(req, 'update', 'borrower', b._id, req.body);
    res.json(b);
  })
);

export default router;
