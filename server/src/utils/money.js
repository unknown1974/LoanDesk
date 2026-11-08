export const rupeesToPaise = (r) => Math.round(Number(r) * 100);
export const formatINR = (paise) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });
