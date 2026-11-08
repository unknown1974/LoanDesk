import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { inr, fmtDate, bpsToPct, toPaise, pctToBps, todayInputValue } from '../format.js';
import { openReceipt } from '../receipt.js';
import { ErrorMsg, Field, Loading, PageTitle, Stat, Table, Badge, useLoad } from '../components/ui.jsx';

function PaymentForm({ loanId, onDone }) {
  const [form, setForm] = useState({ type: 'interest', amount: '', paymentDate: todayInputValue(), method: 'cash', reference: '', note: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api('/payments', { method: 'POST', body: { loanId, type: form.type, amountPaise: toPaise(form.amount), paymentDate: form.paymentDate, method: form.method, reference: form.reference, note: form.note } });
      setForm({ ...form, amount: '', reference: '', note: '' });
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={submit} className="card grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3 font-semibold">Record a payment</div>
      <div className="sm:col-span-3"><ErrorMsg>{error}</ErrorMsg></div>
      <Field label="Type"><select className="input" value={form.type} onChange={set('type')}><option value="interest">Interest</option><option value="principal">Principal repayment</option></select></Field>
      <Field label="Amount (₹)"><input className="input" required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} /></Field>
      <Field label="Date"><input className="input" required type="date" max={todayInputValue()} value={form.paymentDate} onChange={set('paymentDate')} /></Field>
      <Field label="Method"><select className="input" value={form.method} onChange={set('method')}>{['cash', 'upi', 'bank', 'cheque', 'other'].map((m) => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Reference"><input className="input" value={form.reference} onChange={set('reference')} placeholder="UPI ref / cheque no." /></Field>
      <Field label="Note"><input className="input" value={form.note} onChange={set('note')} /></Field>
      <div className="sm:col-span-3"><button className="btn">Save payment</button></div>
    </form>
  );
}

export default function LoanDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useLoad(() => api(`/loans/${id}`), [id]);
  const [actionError, setActionError] = useState('');
  const [newRate, setNewRate] = useState('');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  const { loan, borrower, periods, payments } = data;

  const reverse = async (p) => {
    const reason = window.prompt(`Reverse this ${p.type} payment of ${inr(p.amountPaise)}? Enter a reason:`);
    if (!reason) return;
    setActionError('');
    try { await api(`/payments/${p._id}/reverse`, { method: 'POST', body: { reason } }); reload(); } catch (e) { setActionError(e.message); }
  };
  const changeRate = async (e) => {
    e.preventDefault(); setActionError('');
    try { await api(`/loans/${id}/rate`, { method: 'PATCH', body: { monthlyRateBps: pctToBps(newRate) } }); setNewRate(''); reload(); } catch (err) { setActionError(err.message); }
  };

  return (
    <div className="space-y-4">
      <PageTitle action={<Badge status={loan.status} />}>
        <Link className="text-brand-600 hover:underline" to={`/borrowers/${borrower._id}`}>{borrower.name}</Link> · loan
      </PageTitle>
      <ErrorMsg>{actionError}</ErrorMsg>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Principal outstanding" value={inr(loan.outstandingPrincipalPaise)} />
        <Stat label="Interest unpaid" value={inr(loan.unpaidInterestPaise)} tone={loan.overdueInterestPaise ? 'red' : undefined} />
        <Stat label="Rate / month" value={bpsToPct(loan.monthlyRateBps)} />
        <Stat label="Next due" value={fmtDate(loan.nextDueDate)} />
      </div>
      <div className="card text-sm text-slate-600">
        Started {fmtDate(loan.startDate)} · original {inr(loan.originalPrincipalPaise)} · {loan.interestMethod} calculation
        {loan.rateHistory?.length > 1 && <div className="mt-1">Rate history: {loan.rateHistory.map((r) => `${bpsToPct(r.rateBps)} from ${fmtDate(r.effectiveFrom)}`).join(' → ')}</div>}
      </div>

      {loan.status === 'active' && <PaymentForm loanId={id} onDone={reload} />}

      <div>
        <h2 className="mb-2 font-semibold">Interest periods</h2>
        <Table head={['Period', 'Due', 'On principal', 'Rate', 'Interest', 'Paid', 'Status']}>
          {periods.map((p) => (
            <tr key={p._id}>
              <td className="td">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</td>
              <td className="td">{fmtDate(p.periodEnd)}</td>
              <td className="td">{inr(p.openingPrincipalPaise)}</td>
              <td className="td">{bpsToPct(p.rateBps)}</td>
              <td className="td">{inr(p.interestDuePaise)}</td>
              <td className="td">{inr(p.interestPaidPaise)}</td>
              <td className="td"><Badge status={p.status} /></td>
            </tr>
          ))}
        </Table>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Payment history</h2>
        <Table head={['Date', 'Type', 'Amount', 'Method', 'Note', '']} empty={payments.length === 0 ? 'No payments recorded.' : null}>
          {payments.map((p) => (
            <tr key={p._id} className={p.reversed ? 'text-slate-400 line-through' : ''}>
              <td className="td">{fmtDate(p.paymentDate)}</td>
              <td className="td"><Badge status={p.type} /></td>
              <td className="td font-medium">{p.type === 'reversal' ? '−' : ''}{inr(p.amountPaise)}</td>
              <td className="td">{p.method || ''}</td>
              <td className="td">{p.note || p.reference}</td>
              <td className="td whitespace-nowrap no-underline">
                <button className="text-brand-600 hover:underline" onClick={() => openReceipt(p._id)}>Receipt</button>
                {p.type !== 'reversal' && !p.reversed && <button className="ml-3 text-red-600 hover:underline" onClick={() => reverse(p)}>Reverse</button>}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {loan.status === 'active' && (
        <form onSubmit={changeRate} className="card flex flex-wrap items-end gap-3">
          <Field label="Change interest rate (% per month)" hint="Applies to future periods only. Interest already calculated is not changed.">
            <input className="input" type="number" min="0" max="100" step="0.01" required value={newRate} onChange={(e) => setNewRate(e.target.value)} />
          </Field>
          <button className="btn-secondary">Update rate</button>
        </form>
      )}
    </div>
  );
}
