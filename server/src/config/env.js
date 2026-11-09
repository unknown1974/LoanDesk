import 'dotenv/config';
import cron from 'node-cron';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing required env var: ${k}`);
}
if (process.env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must be at least 16 characters');
const production = process.env.NODE_ENV === 'production';
const corsManagedByPlatform = process.env.CORS_MANAGED_BY_PLATFORM || 'false';
if (!['true', 'false'].includes(corsManagedByPlatform)) throw new Error('CORS_MANAGED_BY_PLATFORM must be true or false');
if (production && (process.env.JWT_SECRET.length < 32 || /change.me|example|secret123/i.test(process.env.JWT_SECRET))) {
  throw new Error('Production JWT_SECRET must be a random secret of at least 32 characters, not a sample value');
}
const port = Number(process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid listening port');
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || '1');
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error('Invalid TRUST_PROXY_HOPS');
const cronEnabled = process.env.ENABLE_IN_PROCESS_CRON ?? (process.env.X_ZOHO_CATALYST_LISTEN_PORT ? 'false' : 'true');
if (!['true', 'false'].includes(cronEnabled)) throw new Error('ENABLE_IN_PROCESS_CRON must be true or false');
const jobSecret = process.env.JOB_SECRET || '';
if ((jobSecret || (production && cronEnabled === 'false')) && (jobSecret.length < 32 || jobSecret === process.env.JWT_SECRET)) {
  throw new Error('JOB_SECRET must be a separate random secret of at least 32 characters');
}
const cronSchedule = process.env.CRON_SCHEDULE || '0 9 * * *';
if (!cron.validate(cronSchedule)) throw new Error('Invalid CRON_SCHEDULE');
const cronTimezone = process.env.CRON_TIMEZONE || 'Asia/Kolkata';
new Intl.DateTimeFormat('en', { timeZone: cronTimezone });
const notifyDaysBefore = (process.env.NOTIFY_DAYS_BEFORE || '3,0').split(',').map((n) => Number(n.trim()));
if (notifyDaysBefore.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Invalid NOTIFY_DAYS_BEFORE');

export const env = {
  port,
  production,
  corsManagedByPlatform: corsManagedByPlatform === 'true',
  trustProxyHops,
  enableInProcessCron: cronEnabled === 'true',
  jobSecret,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || (production ? false : 'http://localhost:5173'),
  cronSchedule,
  cronTimezone,
  notifyDaysBefore: [...new Set(notifyDaysBefore)],
};
