// Pure interest engine. No database access, so it is easy to test and change safely.
// Money is integer paise. Rates are basis points per MONTH (200 bps = 2% per month).
import { addMonths, daysBetween } from '../../utils/dates.js';

export const METHODS = ['monthly', 'daily'];

// monthly: principal * monthly rate, regardless of days in the month.
// daily:   principal * monthly rate / 30 * actual days in the period.
export function calculateInterestPaise({ principalPaise, rateBps, periodStart, periodEnd, method = 'monthly' }) {
  if (principalPaise <= 0 || rateBps <= 0) return 0;
  if (method === 'daily') {
    const days = daysBetween(periodStart, periodEnd);
    return Math.round((principalPaise * rateBps * days) / (10000 * 30));
  }
  return Math.round((principalPaise * rateBps) / 10000);
}

// Billing periods are monthly, anchored to the loan start day.
export function periodBounds(loanStartDate, index) {
  const anchor = loanStartDate.getUTCDate();
  return {
    periodStart: addMonths(loanStartDate, index, anchor),
    periodEnd: addMonths(loanStartDate, index + 1, anchor),
  };
}
