import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/auth/user.model.js';
import { HttpError } from '../utils/httpError.js';

// Checks the token AND the account's current status, so disabling someone takes effect immediately.
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Invalid or expired session');
    }
    const user = await User.findById(payload.sub).select('email name role status lenderId borrowerId');
    if (!user) throw new HttpError(401, 'Invalid or expired session');
    if (user.role !== 'superadmin' && user.status !== 'approved') throw new HttpError(401, 'Your account is not active');
    req.user = { sub: String(user._id), email: user.email, name: user.name, role: user.role, lenderId: user.lenderId, borrowerId: user.borrowerId };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'You do not have access to this'));

export const staff = requireRole('superadmin', 'lender');

// Which records this user may see: a lender sees only their own, the super admin sees all.
export function scopeFilter(req) {
  return req.user.role === 'superadmin' ? {} : { lenderId: new mongoose.Types.ObjectId(req.user.sub) };
}

export const meId = (req) => new mongoose.Types.ObjectId(req.user.sub);
