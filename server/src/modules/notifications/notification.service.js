import { env } from '../../config/env.js';
import { Loan } from '../loans/loan.model.js';
import { Borrower } from '../borrowers/borrower.model.js';
import { InterestPeriod } from '../interest/interestPeriod.model.js';
import { rollAllActiveLoans } from '../interest/interest.service.js';
import { Notification } from './notification.model.js';
import { addDays, todayIST, formatDateLong } from '../../utils/dates.js';
import { formatINR } from '../../utils/money.js';

let running = false;

// Creates in-app notifications for interest falling due in NOTIFY_DAYS_BEFORE days (default 3) and today.
// Safe to run many times a day: the unique index stops duplicates.
export async function runDueNotifications(today = todayIST()) {
  if (running) return { skipped: true };
  running = true;
  let created = 0;
  try {
    await rollAllActiveLoans(today);
    for (const offset of env.notifyDaysBefore) {
      const dueDate = addDays(today, offset);
      const periods = await InterestPeriod.find({ periodEnd: dueDate, status: { $ne: 'paid' } });
      for (const p of periods) {
        const loan = await Loan.findById(p.loanId);
        if (!loan || loan.status !== 'active') continue;
        const borrower = await Borrower.findById(loan.borrowerId);
        if (!borrower || borrower.status !== 'active') continue;
        const owing = p.interestDuePaise - p.interestPaidPaise;
        try {
          await Notification.create({
            userId: loan.lenderId,
            link: `/loans/${loan._id}`,
            title: offset === 0 ? `Interest due today: ${borrower.name}` : `Interest due in ${offset} day${offset === 1 ? '' : 's'}: ${borrower.name}`,
            message: `${formatINR(owing)} due on ${formatDateLong(dueDate)}`,
            relatedLoanId: loan._id,
            periodId: p._id,
            offsetDays: offset,
          });
          created++;
        } catch (e) {
          if (e.code !== 11000) throw e; // already notified
        }
      }
    }
    return { created };
  } finally {
    running = false;
  }
}
