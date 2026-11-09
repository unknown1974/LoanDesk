import { api } from './api.js';
import { inr, fmtDate } from './format.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function openReceipt(paymentId) {
  const { receiptNo, payment, borrower, loan } = await api(`/payments/${paymentId}/receipt`);
  const w = window.open('', '_blank');
  if (!w) return alert('Allow pop-ups to view the receipt.');
  const label = payment.type === 'reversal' ? `Reversal of ${payment.reversedType} payment` : `${payment.type[0].toUpperCase()}${payment.type.slice(1)} payment`;
  w.document.write(`<!doctype html><title>${esc(receiptNo)}</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:32px auto;padding:0 16px">
<h2 style="margin:0">LoanDesk</h2><div style="color:#64748b;margin-bottom:16px">Payment receipt</div>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td>Receipt no.</td><td align="right"><b>${esc(receiptNo)}</b></td></tr>
<tr><td>Date</td><td align="right">${esc(fmtDate(payment.paymentDate))}</td></tr>
<tr><td>Received from</td><td align="right">${esc(borrower.name)}</td></tr>
<tr><td>Type</td><td align="right">${esc(label)}</td></tr>
<tr><td>Method</td><td align="right">${esc(payment.method || '—')}${payment.reference ? ' · ' + esc(payment.reference) : ''}</td></tr>
<tr><td style="padding-top:12px;font-size:16px">Amount</td><td align="right" style="padding-top:12px;font-size:20px"><b>${esc(inr(payment.amountPaise))}</b></td></tr>
<tr><td style="color:#64748b">Principal outstanding now</td><td align="right" style="color:#64748b">${esc(inr(loan.outstandingPrincipalPaise))}</td></tr>
</table><p style="margin-top:24px"><button id="print-receipt">Print</button></p></body>`);
  w.document.close();
  // The receipt inherits the website's CSP, which blocks inline event handlers.
  w.document.getElementById('print-receipt').addEventListener('click', () => w.print());
}
