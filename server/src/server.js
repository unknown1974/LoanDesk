import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';
import { startDailyNotificationJob } from './jobs/dailyNotificationJob.js';
import { rollAllActiveLoans } from './modules/interest/interest.service.js';

await connectDatabase();
await rollAllActiveLoans(); // catch up on any periods missed while the server was down
startDailyNotificationJob();
app.listen(env.port, () => console.log(`LoanDesk API listening on :${env.port}`));
