import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { inr, fmtDate, bpsToPct } from '../format.js';
import { ErrorMsg, Loading, PageTitle, Table, useLoad } from '../components/ui.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const col = useLoad(() => api(`/reports/collections?year=${year}`), [year]);
  const out = useLoad(() => api('/reports/outstanding'));
  return (
    <div className="space-y-6">
      <PageTitle>Reports</PageTitle>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Collections {year}</h2>
          <div className="flex gap-2"><button className="btn-secondary" onClick={() => setYear(year - 1)}>←</button><button className="btn-secondary" onClick={() => setYear(year + 1)}>→</button></div>
        </div>
        <ErrorMsg>{col.error}</ErrorMsg>
        {col.loading && !col.data ? <Loading /> : col.data && (
          <Table head={['Month', 'Interest collected', 'Principal repaid']}>
            {col.data.months.map((m) => <tr key={m.month}><td className="td">{MONTHS[m.month - 1]}</td><td className="td">{inr(m.interestPaise)}</td><td className="td">{inr(m.principalPaise)}</td></tr>)}
            <tr className="bg-slate-50 font-semibold"><td className="td">Total</td><td className="td">{inr(col.data.totalInterestPaise)}</td><td className="td">{inr(col.data.totalPrincipalPaise)}</td></tr>
          </Table>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Outstanding balances</h2>
        <ErrorMsg>{out.error}</ErrorMsg>
        {out.loading && !out.data ? <Loading /> : out.data && (
          <Table head={['Borrower', 'Principal', 'Rate / month', 'Unpaid interest', 'Next due']} empty={out.data.rows.length === 0 ? 'No active loans.' : null}>
            {out.data.rows.map((r) => (
              <tr key={r.loanId}>
                <td className="td"><Link className="text-brand-600 hover:underline" to={`/loans/${r.loanId}`}>{r.borrower}</Link></td>
                <td className="td">{inr(r.principalPaise)}</td>
                <td className="td">{bpsToPct(r.monthlyRateBps)}</td>
                <td className="td">{inr(r.unpaidInterestPaise)}</td>
                <td className="td">{fmtDate(r.nextDueDate)}</td>
              </tr>
            ))}
            {out.data.rows.length > 0 && <tr className="bg-slate-50 font-semibold"><td className="td">Total</td><td className="td">{inr(out.data.totalPrincipalPaise)}</td><td className="td" /><td className="td">{inr(out.data.totalUnpaidInterestPaise)}</td><td className="td" /></tr>}
          </Table>
        )}
      </section>
      <p className="text-sm text-slate-500">Borrower statements: open a borrower and use “Print statement”.</p>
    </div>
  );
}
