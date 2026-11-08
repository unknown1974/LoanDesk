import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing required env var: ${k}`);
}
if (process.env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be at least 16 characters');

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * *',
  cronTimezone: process.env.CRON_TIMEZONE || 'Asia/Kolkata',
  notifyDaysBefore: (process.env.NOTIFY_DAYS_BEFORE || '3,0').split(',').map((n) => Number(n.trim())).filter((n) => Number.isInteger(n) && n >= 0),
};
