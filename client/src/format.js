export const inr = (paise = 0) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const bpsToPct = (bps) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0).replace(/\.?0+$/, '')}%`;
export const pctToBps = (pct) => Math.round(Number(pct) * 100);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
export const isoDate = (d = new Date()) => new Date(d).toISOString().slice(0, 10);
export const todayInputValue = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST date
