import { useState } from 'react';
import { api } from '../api.js';
import { inr, fmtDate, toPaise, pctToBps, todayInputValue } from '../format.js';
import { ErrorMsg, Field, PageTitle, Table } from '../components/ui.jsx';

export default function Calculator() {
  const [form, setForm] = useState({ principal: '', ratePct: '', method: 'monthly', startDate: todayInputValue(), months: 12 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      setResult(await api('/interest/calculate', { method: 'POST', body: { principalPaise: toPaise(form.principal), monthlyRateBps: pctToBps(form.ratePct), method: form.method, startDate: form.startDate, months: Number(form.months) } }));
    } catch (err) { setError(err.message); setResult(null); }
  };
  return (
    <div>
      <PageTitle>Interest calculator</PageTitle>
      <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><ErrorMsg>{error}</ErrorMsg></div>
        <Field label="Principal (₹)"><input className="input" required type="number" min="1" step="0.01" value={form.principal} onChange={set('principal')} /></Field>
        <Field label="Rate (% per month)"><input className="input" required type="number" min="0" step="0.01" value={form.ratePct} onChange={set('ratePct')} /></Field>
        <Field label="Method"><select className="input" value={form.method} onChange={set('method')}><option value="monthly">Monthly</option><option value="daily">Daily (30-day basis)</option></select></Field>
        <Field label="Start date"><input className="input" required type="date" value={form.startDate} onChange={set('startDate')} /></Field>
        <Field label="Months"><input className="input" type="number" min="1" max="60" value={form.months} onChange={set('months')} /></Field>
        <div className="flex items-end"><button className="btn w-full">Calculate</button></div>
      </form>
      {result && (
        <>
          <Table head={['Period', 'Interest']}>
            {result.rows.map((r, i) => <tr key={i}><td className="td">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</td><td className="td">{inr(r.interestPaise)}</td></tr>)}
          </Table>
          <div className="mt-3 text-right text-sm font-semibold">Total over {result.rows.length} months: {inr(result.totalPaise)}</div>
        </>
      )}
    </div>
  );
}
