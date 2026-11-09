import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';
import { startDailyNotificationJob } from './jobs/dailyNotificationJob.js';
import mongoose from 'mongoose';

// Bind immediately: AppSail requires a listening process within its cold-start window.
const server = app.listen(env.port, '0.0.0.0', () => console.log(`LoanDesk listening on :${env.port}`));
let task;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  app.locals.ready = false;
  task?.stop();
  const deadline = setTimeout(() => process.exit(code || 1), 10000);
  deadline.unref();
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(code);
  });
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
server.on('error', (error) => {
  console.error('HTTP listener failed:', error.code);
  shutdown(1);
});
try {
  app.locals.initialization = connectDatabase();
  await app.locals.initialization;
  if (!stopping) {
    app.locals.ready = true;
    task = startDailyNotificationJob();
  }
} catch (error) {
  // Avoid logging connection strings or credentials from driver error details.
  console.error('Database startup failed. Check MONGODB_URI, network access and indexes.', error.name);
  shutdown(1);
}
