import cron from 'node-cron';
import { env } from '../config/env.js';
import { runDueNotifications } from '../modules/notifications/notification.service.js';

async function run(label) {
  try {
    console.log(`[job] due notifications (${label})`, await runDueNotifications());
  } catch (e) {
    console.error('[job] due notifications failed', e);
  }
}

export function startDailyNotificationJob() {
  if (!env.enableInProcessCron) return null;
  if (!cron.validate(env.cronSchedule)) throw new Error(`Invalid CRON_SCHEDULE: ${env.cronSchedule}`);
  const task = cron.schedule(env.cronSchedule, () => run('scheduled'), { timezone: env.cronTimezone, noOverlap: true });
  console.log(`Due-date notification job scheduled: "${env.cronSchedule}" (${env.cronTimezone})`);
  run('startup'); // covers a restart on the day itself
  return task;
}
