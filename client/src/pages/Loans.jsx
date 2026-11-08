import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getUser } from '../api.js';
import { inr, fmtDate, bpsToPct, toPaise, pctToBps, todayInputValue } from '../format.js';
import { ErrorMsg, Field, Loading, PageTitle, Table, Badge, useLoad } from '../components/ui.jsx';

function NewLoanForm({ borrowers, onCancel }) {
  const nav = useNavigate();
  const [form, setForm] = useState({ borrowerId: '', principal: '', ratePct: '', interestMethod: 'monthly', startDate: todayInputValue(), notes: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const loan = await api('/loans', {
        method: 'POST',
        body: { borrowerId: form.borrowerId, principalPaise: toPaise(form.principal), monthlyRateBps: pctToBps(form.ratePct), interestMethod: form.interestMethod, startDate: form.startDate, notes: form.notes },
      });
      nav(`/loans/${loan._id}`);
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg>{error}</ErrorMsg></div>
      <Field label="Borrower">
        <select className="input" required value={form.borrowerId} onChange={set('borrowerId')}>
          <option value="">Select…</option>
          {borrowers.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.phone})</option>)}
        </select>
      </Field>
      <Field label="Principal (₹)"><input className="input" required type="number" min="1" step="0.01" value={form.principal} onChange={set('principal')} /></Field>
      <Field label="Interest rate (% per month)"><input className="input" required type="number" min="0" max="100" step="0.01" value={form.ratePct} onChange={set('ratePct')} /></Field>
      <Field label="Calculation method" hint="Monthly: fixed amount each month. Daily: pro-rated by days in the period (30-day basis).">
        <select className="input" value={form.interestMethod} onChange={set('interestMethod')}><option value="monthly">Monthly</option><option value="daily">Daily</option></select>
      </Field>
      <Field label="Start date" hint="For a loan already running, use the date its current unpaid cycle began."><input className="input" required type="date" value={form.startDate} onChange={set('startDate')} /></Field>
      <Field label="Notes"><input className="input" value={form.notes} onChange={set('notes')} /></Field>
      <div className="flex gap-2 sm:col-span-2"><button className="btn">Create loan</button><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function Loans() {
  const [status, setStatus] = useState('active');
  const [adding, setAdding] = useState(false);
  const isSuper = getUser()?.role === 'superadmin';
  const { data, error, loading } = useLoad(() => api(`/loans?status=${status}`), [status]);
  const borrowers = useLoad(() => api('/borrowers?status=active'));
  return (
    <div>
      <PageTitle action={<button className="btn" onClick={() => setAdding(true)}>+ New loan</button>}>Loans</PageTitle>
      {adding && borrowers.data && <NewLoanForm borrowers={borrowers.data} onCancel={() => setAdding(false)} />}
      <div className="mb-3 flex gap-2">
        {['active', 'closed'].map((s) => <button key={s} onClick={() => setStatus(s)} className={status === s ? 'btn' : 'btn-secondary'}>{s[0].toUpperCase() + s.slice(1)}</button>)}
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {loading && !data ? <Loading /> : (
        <Table head={['Borrower', ...(isSuper ? ['Lender'] : []), 'Outstanding', 'Rate / month', 'Interest unpaid', 'Next due']} empty={data?.length === 0 ? 'No loans here yet.' : null}>
          {data?.map((l) => (
            <tr key={l._id}>
              <td className="td"><Link className="font-medium text-brand-600 hover:underline" to={`/loans/${l._id}`}>{l.borrowerId?.name}</Link></td>
              {isSuper && <td className="td">{l.lenderId?.name}</td>}
              <td className="td">{inr(l.outstandingPrincipalPaise)}</td>
              <td className="td">{bpsToPct(l.monthlyRateBps)}</td>
              <td className="td">{inr(l.unpaidInterestPaise)} {l.overdueInterestPaise > 0 && <Badge status="failed">overdue</Badge>}</td>
              <td className="td">{fmtDate(l.nextDueDate)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
