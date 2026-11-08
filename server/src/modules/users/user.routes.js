import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../auth/user.model.js';
import { generateLenderCode } from '../auth/lenderCode.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { requireRole, meId } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { phoneSchema, passwordSchema } from '../../utils/validators.js';
import { audit } from '../auditLog.js';

const router = Router();

const shape = (u) => ({
  id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, lenderCode: u.lenderCode,
  lenderId: u.lenderId?._id || u.lenderId, lenderName: u.lenderId?.name, borrowerId: u.borrowerId, createdAt: u.createdAt,
});

// Super admin manages lenders and borrowers; a lender manages only their own borrowers' logins.
function canManage(req, target) {
  if (target.role === 'superadmin') return false;
  if (req.user.role === 'superadmin') return true;
  return target.role === 'borrower' && String(target.lenderId) === req.user.sub;
}
async function loadManaged(req) {
  const target = await User.findById(req.params.id);
  if (!target) throw new HttpError(404, 'Account not found');
  if (!canManage(req, target)) throw new HttpError(403, 'You cannot manage this account');
  return target;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'superadmin' ? { role: { $ne: 'superadmin' } } : { role: 'borrower', lenderId: meId(req) };
    const users = await User.find(filter).sort({ createdAt: -1 }).populate('lenderId', 'name').lean();
    res.json(users.map(shape));
  })
);

// Super admin creates a lender directly (already approved).
router.post(
  '/lenders',
  requireRole('superadmin'),
  validate(z.object({ name: z.string().trim().min(1).max(100), email: z.string().email(), phone: phoneSchema, password: passwordSchema })),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) throw new HttpError(409, 'This email is already registered');
    const u = await User.create({
      email, name: req.body.name, phone: req.body.phone, role: 'lender', status: 'approved',
      passwordHash: await bcrypt.hash(req.body.password, 12),
      lenderCode: await generateLenderCode(),
      approvedBy: req.user.email, approvedAt: new Date(),
    });
    await audit(req, 'create_lender', 'user', u._id, { email });
    res.status(201).json(shape(u));
  })
);

router.post(
  '/:id/approve',
  validate(z.object({ borrowerId: z.string().length(24).optional() })),
  asyncHandler(async (req, res) => {
    const target = await loadManaged(req);
    if (!['pending', 'rejected'].includes(target.status)) throw new HttpError(400, 'This request is not pending');

    if (target.role === 'borrower') {
      // Link the login to a borrower record owned by the same lender.
      let borrower;
      if (req.body.borrowerId) {
        borrower = await Borrower.findOne({ _id: req.body.borrowerId, lenderId: target.lenderId });
        if (!borrower) throw new HttpError(404, 'Borrower record not found for this lender');
        if (await User.exists({ borrowerId: borrower._id })) throw new HttpError(409, 'That borrower record already has a login');
      } else {
        const match = await Borrower.findOne({ lenderId: target.lenderId, phone: target.phone });
        if (match && !(await User.exists({ borrowerId: match._id }))) borrower = match;
        else borrower = await Borrower.create({ name: target.name, phone: target.phone, lenderId: target.lenderId });
      }
      target.borrowerId = borrower._id;
    }
    target.status = 'approved';
    target.approvedBy = req.user.email;
    target.approvedAt = new Date();
    await target.save();
    await audit(req, 'approve_account', 'user', target._id, { role: target.role });
    res.json(shape(target));
  })
);

router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const target = await loadManaged(req);
    if (target.status !== 'pending') throw new HttpError(400, 'This request is not pending');
    target.status = 'rejected';
    await target.save();
    await audit(req, 'reject_account', 'user', target._id);
    res.json(shape(target));
  })
);

router.post(
  '/:id/status',
  validate(z.object({ status: z.enum(['approved', 'disabled']) })),
  asyncHandler(async (req, res) => {
    const target = await loadManaged(req);
    const ok = (target.status === 'approved' && req.body.status === 'disabled') || (target.status === 'disabled' && req.body.status === 'approved');
    if (!ok) throw new HttpError(400, 'Only approved accounts can be disabled, and disabled accounts re-enabled');
    target.status = req.body.status;
    await target.save();
    await audit(req, `${req.body.status}_account`, 'user', target._id);
    res.json(shape(target));
  })
);

export default router;
