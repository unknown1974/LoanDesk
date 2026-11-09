import { Loan } from '../loans/loan.model.js';
import { InterestPeriod, statusFor } from './interestPeriod.model.js';
import { calculateInterestPaise, periodBounds } from './interest.engine.js';
import { todayIST } from '../../utils/dates.js';

async function createPeriod(loan, index, openingPrincipalPaise) {
  const { periodStart, periodEnd } = periodBounds(loan.startDate, index);
  const interestDuePaise = calculateInterestPaise({
    principalPaise: openingPrincipalPaise,
    rateBps: loan.monthlyRateBps,
    periodStart,
    periodEnd,
    method: loan.interestMethod,
  });
  const values = {
    lenderId: loan.lenderId,
    loanId: loan._id,
    index,
    periodStart,
    periodEnd,
    openingPrincipalPaise,
    rateBps: loan.monthlyRateBps,
    method: loan.interestMethod,
    interestDuePaise,
    status: interestDuePaise === 0 ? 'paid' : 'open',
  };
  try {
    // Concurrent cold starts/requests may reach the same period together.
    // Never replace the snapshot that the first writer committed.
    return await InterestPeriod.findOneAndUpdate(
      { loanId: loan._id, index }, { $setOnInsert: values },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await InterestPeriod.findOne({ loanId: loan._id, index });
    if (!existing) throw error;
    return existing;
  }
}

// Makes sure every billing period up to "today" exists, then refreshes the loan summary.
export async function rollLoan(loan, today = todayIST()) {
  if (loan.status === 'active') {
    let last = await InterestPeriod.findOne({ loanId: loan._id }).sort({ index: -1 });
    if (!last) last = await createPeriod(loan, 0, loan.outstandingPrincipalPaise);
    // A new period starts once the previous one has ended and principal is still outstanding.
    while (last.periodEnd <= today && loan.outstandingPrincipalPaise > 0) {
      last = await createPeriod(loan, last.index + 1, loan.outstandingPrincipalPaise);
    }
  }
  return refreshLoan(loan);
}

// Recomputes nextDueDate and open/closed status from the periods.
export async function refreshLoan(loan) {
  const unpaid = await InterestPeriod.find({ loanId: loan._id, status: { $ne: 'paid' } }).sort({ index: 1 }).limit(1);
  loan.nextDueDate = unpaid[0]?.periodEnd ?? null;
  loan.status = loan.outstandingPrincipalPaise === 0 && unpaid.length === 0 ? 'closed' : 'active';
  await loan.save();
  return loan;
}

export async function rollAllActiveLoans(today = todayIST(), scope = {}) {
  const loans = await Loan.find({ status: 'active', ...scope });
  for (const loan of loans) await rollLoan(loan, today);
  return loans.length;
}

export async function unpaidInterestPaise(loanId) {
  const periods = await InterestPeriod.find({ loanId, status: { $ne: 'paid' } });
  return periods.reduce((s, p) => s + (p.interestDuePaise - p.interestPaidPaise), 0);
}

export { statusFor };
