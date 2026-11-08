import { api } from '../api.js';
import { inr, fmtDate, bpsToPct } from '../format.js';
import { ErrorMsg, Loading, Stat, Table, Badge, useLoad } from '../components/ui.jsx';

function LoanCard({ loan }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Loan of {inr(loan.originalPrincipalPaise)}</div>
        <Badge status={loan.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-slate-500">Principal outstanding</div><div className="font-semibold">{inr(loan.outstandingPrincipalPaise)}</div></div>
        <div><div className="text-xs text-slate-500">Interest rate</div><div className="font-semibold">{bpsToPct(loan.monthlyRateBps)} per month</div></div>
        <div><div className="text-xs text-slate-500">Time so far</div><div className="font-semibold">{loan.monthsRunning} month{loan.monthsRunning === 1 ? '' : 's'}</div><div className="text-xs text-slate-500">since {fmtDate(loan.startDate)}</div></div>
        <div><div className="text-xs text-slate-500">Next interest due</div><div className="font-semibold">{fmtDate(loan.nextDueDate)}</div></div>
      </div>
      {loan.unpaidInterestPaise > 0 && (
        <div className={`rounded-lg px-3 py-2 text-sm ${loan.overdueInterestPaise ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
          Interest unpaid: <b>{inr(loan.unpaidInterestPaise)}</b>{loan.overdueInterestPaise > 0 && <> (of which {inr(loan.overdueInterestPaise)} is overdue)</>}
        </div>
      )}
      <div>
        <div className="mb-2 text-sm font-semibold">Interest by month</div>
        <Table head={['Period', 'Interest', 'Paid', 'Status']}>
          {loan.periods.map((p, i) => (
            <tr key={i}>
              <td className="td">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</td>
              <td className="td">{inr(p.interestDuePaise)}</td>
              <td className="td">{inr(p.interestPaidPaise)}</td>
              <td className="td"><Badge status={p.status} /></td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">Payments</div>
        <Table head={['Date', 'Type', 'Amount', 'Method']} empty={loan.payments.length === 0 ? 'No payments recorded yet.' : null}>
          {loan.payments.map((p) => (
            <tr key={p.id} className={p.reversed ? 'text-slate-400 line-through' : ''}>
              <td className="td">{fmtDate(p.paymentDate)}</td>
              <td className="td"><Badge status={p.type} /></td>
              <td className="td font-medium">{inr(p.amountPaise)}</td>
              <td className="td">{p.method}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

export default function Portal() {
  const { data, error, loading } = useLoad(() => api('/portal'));
  if (loading) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Hello, {data.borrower.name}</h1>
        <div className="text-sm text-slate-500">Lender: {data.lender.name}{data.lender.phone && ` · ${data.lender.phone}`}</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Principal outstanding" value={inr(data.totals.outstandingPrincipalPaise)} />
        <Stat label="Interest unpaid" value={inr(data.totals.unpaidInterestPaise)} />
        <Stat label="Next due" value={fmtDate(data.totals.nextDueDate)} />
      </div>
      {data.loans.length === 0 && <div className="card text-sm text-slate-500">No loans recorded for you yet.</div>}
      {data.loans.map((l) => <LoanCard key={l.id} loan={l} />)}
      <p className="text-xs text-slate-500">This page is read-only. Please contact your lender about any difference.</p>
    </div>
  );
}
