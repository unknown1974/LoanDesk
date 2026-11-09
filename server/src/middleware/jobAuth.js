import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export function requireJobSecret(req, res, next) {
  if (!env.jobSecret) return res.status(503).json({ error: 'Scheduled job is not configured' });
  const provided = req.get('authorization') || '';
  const digest = (s) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(provided), digest(`Bearer ${env.jobSecret}`))) {
    return res.status(401).json({ error: 'Invalid job credentials' });
  }
  next();
}
