import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { User } from './user.model.js';
import { generateLenderCode } from './lenderCode.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, HttpError } from '../../utils/httpError.js';
import { phoneSchema, passwordSchema } from '../../utils/validators.js';
import { notifyUser } from '../../services/notification/index.js';
import { audit } from '../auditLog.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Try again later.' } });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const STATUS_MESSAGE = {
  pending: 'Your account is waiting for approval. You can log in once it is approved.',
  rejected: 'Your request was not approved.',
  disabled: 'Your account has been disabled.',
};

router.post(
  '/login',
  loginLimiter,
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    const ok = await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
    if (user.role !== 'superadmin' && user.status !== 'approved') throw new HttpError(403, STATUS_MESSAGE[user.status] || 'Account not active');
    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    req.user = { email: user.email };
    await audit(req, 'login', 'user', user._id);
    res.json({ token, user: { email: user.email, name: user.name, role: user.role } });
  })
);

// A lender asks for an account; the super admin approves it.
router.post(
  '/register-lender',
  registerLimiter,
  validate(z.object({ name: z.string().trim().min(1).max(100), email: z.string().email(), phone: phoneSchema, password: passwordSchema })),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) throw new HttpError(409, 'This email is already registered');
    const user = await User.create({
      email, name: req.body.name, phone: req.body.phone, role: 'lender', status: 'pending',
      passwordHash: await bcrypt.hash(req.body.password, 12),
      lenderCode: await generateLenderCode(),
    });
    for (const admin of await User.find({ role: 'superadmin' })) {
      await notifyUser({ userId: admin._id, title: `New lender request: ${user.name}`, message: user.email, link: '/accounts' });
    }
    res.status(201).json({ ok: true });
  })
);

// A borrower asks for a login under a lender (identified by the lender's code).
router.post(
  '/register-borrower',
  registerLimiter,
  validate(z.object({ name: z.string().trim().min(1).max(100), email: z.string().email(), phone: phoneSchema, password: passwordSchema, lenderCode: z.string().trim().min(4).max(20) })),
  asyncHandler(async (req, res) => {
    const lender = await User.findOne({ lenderCode: req.body.lenderCode.toUpperCase(), role: { $in: ['lender', 'superadmin'] } });
    if (!lender || (lender.role !== 'superadmin' && lender.status !== 'approved')) throw new HttpError(400, 'Lender code not recognised');
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) throw new HttpError(409, 'This email is already registered');
    const user = await User.create({
      email, name: req.body.name, phone: req.body.phone, role: 'borrower', status: 'pending', lenderId: lender._id,
      passwordHash: await bcrypt.hash(req.body.password, 12),
    });
    await notifyUser({ userId: lender._id, title: `New borrower login request: ${user.name}`, message: `${user.email} · ${user.phone}`, link: '/accounts' });
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user.sub);
    res.json({ user: { email: u.email, name: u.name, phone: u.phone, role: u.role, lenderCode: u.lenderCode } });
  })
);

router.post(
  '/change-password',
  requireAuth,
  validate(z.object({ currentPassword: z.string(), newPassword: passwordSchema })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.sub);
    if (!user || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    await audit(req, 'change_password', 'user', user._id);
    res.json({ ok: true });
  })
);

export default router;
