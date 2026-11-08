import { useEffect, useState } from 'react';

export function PageTitle({ children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">{children}</h1>
      {action}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const badgeColors = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-100 text-blue-800',
};
const statusColor = { paid: 'green', delivered: 'green', closed: 'slate', active: 'blue', open: 'amber', partial: 'amber', scheduled: 'slate', sent: 'blue', failed: 'red', cancelled: 'slate', reversed: 'red', reversal: 'red', approved: 'green', pending: 'amber', rejected: 'red', disabled: 'slate', lender: 'blue', borrower: 'slate', superadmin: 'blue', interest: 'slate', principal: 'slate' };
export function Badge({ status, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[statusColor[status] || 'slate']}`}>{children || status}</span>;
}

export function Stat({ label, value, tone }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-600' : ''}`}>{value}</div>
    </div>
  );
}

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <div className="p-6 text-center text-sm text-slate-500">{empty}</div>}
    </div>
  );
}

// Loads data on mount / when deps change and exposes reload().
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => live && setState({ data, error: '', loading: false })).catch((e) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export const ErrorMsg = ({ children }) => (children ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div> : null);
export const Loading = () => <div className="p-6 text-center text-sm text-slate-500">Loading…</div>;
