// Fills an EMPTY database with sample borrowers, loans and payments so you can explore the app.
// Phone numbers are fake.
import 'dotenv/config';
import mongoose from 'mongoose';
import { Borrower } from '../src/modules/borrowers/borrower.model.js';
import { Loan } from '../src/modules/loans/loan.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { InterestPeriod, statusFor } from '../src/modules/interest/interestPeriod.model.js';
import { rollLoan, refreshLoan } from '../src/modules/interest/interest.service.js';
import { User } from '../src/modules/auth/user.model.js';
import { addMonths, todayIST } from '../src/utils/dates.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env');
await mongoose.connect(process.env.MONGODB_URI);
const owner = await User.findOne({ role: 'superadmin' });
if (!owner) throw new Error('Run `npm run seed` first to create the super admin.');
if ((await Borrower.countDocuments()) > 0) {
  console.log('Database already has borrowers. Demo data skipped.');
  await mongoose.disconnect();
  process.exit(0);
}

const today = todayIST();
const rupees = (n) => n * 100;

async function payInterest(loan, periodIndex, amountPaise, date) {
  const p = await InterestPeriod.findOne({ loanId: loan._id, index: periodIndex });
  const amt = Math.min(amountPaise ?? p.interestDuePaise, p.interestDuePaise - p.interestPaidPaise);
  await Payment.create({ lenderId: loan.lenderId, loanId: loan._id, type: 'interest', amountPaise: amt, paymentDate: date, method: 'upi', allocations: [{ periodId: p._id, amountPaise: amt }], createdBy: 'demo' });
  p.interestPaidPaise += amt;
  p.status = statusFor(p.interestDuePaise, p.interestPaidPaise);
  await p.save();
}

const demo = [
  { name: 'Rahul Sharma', phone: '9000000001', principal: 50000, rate: 200, monthsAgo: 3 },
  { name: 'Amit Verma', phone: '9000000002', principal: 80000, rate: 150, monthsAgo: 2 },
  { name: 'Suresh Reddy', phone: '9000000003', principal: 100000, rate: 250, monthsAgo: 2 },
  { name: 'Ramesh Kumar', phone: '9000000004', principal: 30000, rate: 300, monthsAgo: 2 },
];

for (const d of demo) {
  const b = await Borrower.create({ lenderId: owner._id, name: d.name, phone: d.phone, address: 'Demo address' });
  const startDate = addMonths(today, -d.monthsAgo);
  const loan = await Loan.create({
    lenderId: owner._id,
    borrowerId: b._id,
    originalPrincipalPaise: rupees(d.principal),
    outstandingPrincipalPaise: rupees(d.principal),
    monthlyRateBps: d.rate,
    startDate,
    rateHistory: [{ rateBps: d.rate, effectiveFrom: startDate }],
  });
  await rollLoan(loan, today);

  if (d.name.startsWith('Rahul')) {            // fully paid up
    for (let i = 0; i < d.monthsAgo; i++) await payInterest(loan, i, null, addMonths(startDate, i + 1));
  } else if (d.name.startsWith('Amit')) {      // first month paid, second month partly paid
    await payInterest(loan, 0, null, addMonths(startDate, 1));
    await payInterest(loan, 1, rupees(500), today);
  } else if (d.name.startsWith('Ramesh')) {    // paid month one, then repaid some principal
    await payInterest(loan, 0, null, addMonths(startDate, 1));
    await Payment.create({ lenderId: loan.lenderId, loanId: loan._id, type: 'principal', amountPaise: rupees(10000), paymentDate: today, method: 'cash', createdBy: 'demo' });
    loan.outstandingPrincipalPaise -= rupees(10000);
  }                                             // Suresh: nothing paid, so shows as overdue
  await refreshLoan(loan);
}

console.log('Demo data added: 4 borrowers with loans and payments.');
await mongoose.disconnect();
