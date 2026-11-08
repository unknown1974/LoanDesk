import { Router } from 'express';
import { Notification } from './notification.model.js';
import { runDueNotifications } from './notification.service.js';
import { meId } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/httpError.js';

const router = Router();

// Each user sees only their own notifications.
router.get('/', asyncHandler(async (req, res) => {
  const me = meId(req);
  const [items, unread] = await Promise.all([
    Notification.find({ userId: me }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ userId: me, readAt: null }),
  ]);
  res.json({ items, unread });
}));
router.post('/check', asyncHandler(async (_req, res) => res.json(await runDueNotifications())));
router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: meId(req), readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
}));
router.post('/:id/read', asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: meId(req) }, { readAt: new Date() });
  res.json({ ok: true });
}));

export default router;
