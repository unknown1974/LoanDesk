// Creates (or resets) the super admin login and, if you already have data from the
// single-user version, assigns that data to the super admin. Safe to run more than once.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/modules/auth/user.model.js';
import { generateLenderCode } from '../src/modules/auth/lenderCode.js';
import { Borrower } from '../src/modules/borrowers/borrower.model.js';
import { Loan } from '../src/modules/loans/loan.model.js';
import { InterestPeriod } from '../src/modules/interest/interestPeriod.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';

const { MONGODB_URI, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!MONGODB_URI || !OWNER_EMAIL || !OWNER_PASSWORD) throw new Error('Set MONGODB_URI, OWNER_EMAIL and OWNER_PASSWORD in .env');
if (OWNER_PASSWORD.length < 10) throw new Error('OWNER_PASSWORD must be at least 10 characters');

await mongoose.connect(MONGODB_URI);
const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
await User.findOneAndUpdate(
  { email: OWNER_EMAIL.toLowerCase() },
  { $set: { passwordHash, role: 'superadmin', status: 'approved' }, $setOnInsert: { name: 'Super Admin' } },
  { upsert: true }
);
const owner = await User.findOne({ email: OWNER_EMAIL.toLowerCase() });
if (!owner.lenderCode) { owner.lenderCode = await generateLenderCode(); await owner.save(); }

// Data created before roles existed has no owner: give it to the super admin.
const noOwner = { lenderId: { $exists: false } };
const b = await Borrower.updateMany(noOwner, { lenderId: owner._id });
const l = await Loan.updateMany(noOwner, { lenderId: owner._id });
await Notification.updateMany({ userId: { $exists: false } }, { userId: owner._id });
for (const loan of await Loan.find({}, '_id lenderId')) {
  await InterestPeriod.updateMany({ loanId: loan._id, ...noOwner }, { lenderId: loan.lenderId });
  // Payments are immutable in the app; this one-time backfill goes straight to the collection.
  await Payment.collection.updateMany({ loanId: loan._id, ...noOwner }, { $set: { lenderId: loan.lenderId } });
}

console.log(`Super admin ready: ${OWNER_EMAIL}`);
console.log(`Your lender code (give to borrowers who lend through you): ${owner.lenderCode}`);
if (b.modifiedCount || l.modifiedCount) console.log(`Existing data assigned to the super admin: ${b.modifiedCount} borrowers, ${l.modifiedCount} loans.`);
await mongoose.disconnect();
