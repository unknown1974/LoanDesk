import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { inr, fmtDate, bpsToPct } from '../format.js';
import { BorrowerForm } from './Borrowers.jsx';
import { ErrorMsg, Loading, PageTitle, Stat, Table, Badge, useLoad } from '../components/ui.jsx';

export default function BorrowerDetail() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const { data, error, loading, reload } = useLoad(() => api(`/reports/statement/${id}`), [id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  const { borrower: b, loans, payments, totals } = data;
  const loanLabel = Object.fromEntries(loans.map((l, i) => [l._id, `Loan ${i + 1}`]));

  return (
    <div>
      <PageTitle action={<div className="flex gap-2 print:hidden"><button className="btn-secondary" onClick={() => window.print()}>Print statement</button><button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button></div>}>{b.name}</PageTitle>
      {editing && <BorrowerForm id={id} initial={b} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      <div className="card mb-4 text-sm">
        <div>📞 {b.phone} {b.address && <>· {b.address}</>}</div>
        <div className="mt-1"><Badge status={b.status} /></div>
        {b.notes && <div className="mt-1">{b.notes}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Principal outstanding" value={inr(totals.outstandingPrincipalPaise)} />
        <Stat label="Interest unpaid" value={inr(totals.interestUnpaidPaise)} />
        <Stat label="Interest paid" value={inr(totals.interestPaidPaise)} />
        <Stat label="Principal repaid" value={inr(totals.principalRepaidPaise)} />
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Loans</h2>
      <Table head={['Loan', 'Started', 'Original', 'Outstanding', 'Rate / month', 'Status']}>
        {loans.map((l) => (
          <tr key={l._id}>
            <td className="td"><Link className="text-brand-600 hover:underline" to={`/loans/${l._id}`}>{loanLabel[l._id]}</Link></td>
            <td className="td">{fmtDate(l.startDate)}</td>
            <td className="td">{inr(l.originalPrincipalPaise)}</td>
            <td className="td">{inr(l.outstandingPrincipalPaise)}</td>
            <td className="td">{bpsToPct(l.monthlyRateBps)}</td>
            <td className="td"><Badge status={l.status} /></td>
          </tr>
        ))}
      </Table>
      <h2 className="mb-2 mt-6 font-semibold">Statement</h2>
      <Table head={['Date', 'Loan', 'Type', 'Amount', 'Note']} empty={payments.length === 0 ? 'No payments yet.' : null}>
        {payments.map((p) => (
          <tr key={p._id}>
            <td className="td">{fmtDate(p.paymentDate)}</td>
            <td className="td">{loanLabel[p.loanId]}</td>
            <td className="td"><Badge status={p.type} /></td>
            <td className="td font-medium">{p.type === 'reversal' ? '−' : ''}{inr(p.amountPaise)}</td>
            <td className="td text-slate-500">{p.note || p.reference}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
