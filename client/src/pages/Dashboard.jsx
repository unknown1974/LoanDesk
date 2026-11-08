import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { inr, fmtDate } from '../format.js';
import { ErrorMsg, Loading, PageTitle, Stat, Table, Badge, useLoad } from '../components/ui.jsx';

function DueTable({ rows, empty }) {
  return (
    <Table head={['Borrower', 'Due date', 'Owing', 'Status']} empty={rows.length === 0 ? empty : null}>
      {rows.map((r) => (
        <tr key={r.periodId}>
          <td className="td"><Link className="text-brand-600 hover:underline" to={`/loans/${r.loanId}`}>{r.borrower}</Link></td>
          <td className="td">{fmtDate(r.dueDate)}</td>
          <td className="td font-medium">{inr(r.owingPaise)}</td>
          <td className="td"><Badge status={r.status} /></td>
        </tr>
      ))}
    </Table>
  );
}

export default function Dashboard() {
  const { data, error, loading } = useLoad(() => api('/dashboard'));
  if (loading) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  return (
    <div>
      <PageTitle>Dashboard</PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding principal" value={inr(data.outstandingPrincipalPaise)} />
        <Stat label="Interest this month" value={inr(data.interestCollectedThisMonthPaise)} />
        <Stat label="Interest all time" value={inr(data.interestCollectedAllTimePaise)} />
        <Stat label="Overdue interest" value={inr(data.overduePaise)} tone={data.overduePaise ? 'red' : undefined} />
      </div>
      <h2 className="mb-2 mt-6 font-semibold text-red-700">Overdue</h2>
      <DueTable rows={data.overdue} empty="Nothing overdue." />
      <h2 className="mb-2 mt-6 font-semibold">Due in the next 7 days</h2>
      <DueTable rows={data.upcoming} empty="No interest falling due this week." />
    </div>
  );
}
