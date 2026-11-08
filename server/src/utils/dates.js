// All dates are stored as UTC midnight representing a calendar day (IST day for "today").
export function startOfDayUTC(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

// Today's calendar date in India, as UTC midnight.
export function todayIST(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

// Adds months and clamps to month end (31 Jan + 1 month = 28/29 Feb).
// `anchorDay` keeps the original billing day, so 31 Jan -> 28 Feb -> 31 Mar.
export function addMonths(date, months, anchorDay = date.getUTCDate()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, lastDay)));
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

export function daysBetween(a, b) {
  return Math.round((startOfDayUTC(b) - startOfDayUTC(a)) / 86400000);
}

export function formatDateLong(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
