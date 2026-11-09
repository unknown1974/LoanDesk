import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { requireAuth, staff } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import portalRoutes from './modules/portal/portal.routes.js';
import borrowerRoutes from './modules/borrowers/borrower.routes.js';
import loanRoutes from './modules/loans/loan.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import interestRoutes from './modules/interest/interest.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { requireJobSecret } from './middleware/jobAuth.js';
import { runDueNotifications } from './modules/notifications/notification.service.js';
import { asyncHandler } from './utils/httpError.js';

const app = express();
app.set('trust proxy', env.trustProxyHops);
app.locals.ready = false;
app.use(helmet());
// Catalyst adds CORS headers at its gateway. Adding them again here creates an
// invalid comma-separated Access-Control-Allow-Origin value on real requests.
if (env.corsManagedByPlatform) {
  // Preserve the application's exact-origin restriction even if gateway rules change.
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== env.clientOrigin) return res.status(403).json({ error: 'Origin is not allowed' });
    next();
  });
} else {
  app.use(cors({ origin: env.clientOrigin }));
}
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ready', (_req, res) => {
  const ready = app.locals.ready && mongoose.connection.readyState === 1;
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ ok: ready });
});
app.use('/api', asyncHandler(async (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!app.locals.ready && app.locals.initialization) {
    let timer;
    try {
      // Give a request that wakes AppSail a bounded chance to finish connecting.
      await Promise.race([app.locals.initialization, new Promise((resolve) => { timer = setTimeout(resolve, 8000); })]);
    } catch { /* Return the safe 503 below when initialization fails. */ }
    finally { clearTimeout(timer); }
  }
  if (!app.locals.ready || mongoose.connection.readyState !== 1) {
    return res.set('Retry-After', '5').status(503).json({ error: 'Database is not ready. Please retry shortly.' });
  }
  next();
}));
// Catalyst Cron calls this endpoint independently of user JWTs and sleeping instances.
app.post('/api/jobs/due-notifications', requireJobSecret,
  asyncHandler(async (_req, res) => res.json(await runDueNotifications())));
app.use('/api/auth', authRoutes); // login and registration are public; /me and /change-password check the token themselves

app.use('/api', requireAuth);
app.use('/api/portal', portalRoutes); // borrowers only (checked inside)

// Everything below is for the super admin and lenders only.
app.use('/api/users', staff, userRoutes);
app.use('/api/dashboard', staff, dashboardRoutes);
app.use('/api/borrowers', staff, borrowerRoutes);
app.use('/api/loans', staff, loanRoutes);
app.use('/api/payments', staff, paymentRoutes);
app.use('/api/interest', staff, interestRoutes);
app.use('/api/notifications', staff, notificationRoutes);
app.use('/api/reports', staff, reportRoutes);
app.use('/api', notFound);

app.use(notFound);
app.use(errorHandler);

export default app;
