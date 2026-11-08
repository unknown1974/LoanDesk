import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
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

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
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

app.use(notFound);
app.use(errorHandler);

export default app;
