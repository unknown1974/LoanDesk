import { useState } from 'react';
import { api, getUser } from '../api.js';
import { fmtDate } from '../format.js';
import { ErrorMsg, Field, Loading, PageTitle, Table, Badge, useLoad } from '../components/ui.jsx';

function CreateLender({ onDone }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/users/lenders', { method: 'POST', body: form }); setForm({ name: '', email: '', phone: '', password: '' }); onDone(); } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={submit} className="card mb-6 grid gap-3 sm:grid-cols-2">
      <div className="font-semibold sm:col-span-2">Create a lender account</div>
      <div className="sm:col-span-2"><ErrorMsg>{error}</ErrorMsg></div>
      <Field label="Name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
      <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
      <Field label="Mobile number"><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')} /></Field>
      <Field label="Temporary password" hint="At least 10 characters. Ask them to change it after first login."><input className="input" type="text" required minLength={10} value={form.password} onChange={set('password')} /></Field>
      <div className="sm:col-span-2"><button className="btn">Create lender</button></div>
    </form>
  );
}

export default function Accounts() {
  const isSuper = getUser()?.role === 'superadmin';
  const users = useLoad(() => api('/users'));
  const borrowers = useLoad(() => api('/borrowers'));
  const [choice, setChoice] = useState({});
  const [error, setError] = useState('');

  const act = async (path, body) => {
    setError('');
    try { await api(path, { method: 'POST', body }); users.reload(); borrowers.reload(); } catch (e) { setError(e.message); }
  };

  if (users.loading && !users.data) return <Loading />;
  const all = users.data || [];
  const pending = all.filter((u) => u.status === 'pending');
  const rest = all.filter((u) => u.status !== 'pending');
  const linked = new Set(all.filter((u) => u.borrowerId).map((u) => String(u.borrowerId)));
  const candidates = (u) => (borrowers.data || []).filter((b) => String(b.lenderId) === String(u.lenderId) && !linked.has(String(b._id)));

  return (
    <div>
      <PageTitle>Accounts</PageTitle>
      <ErrorMsg>{error || users.error}</ErrorMsg>
      {isSuper && <CreateLender onDone={users.reload} />}

      <h2 className="mb-2 font-semibold">Pending requests</h2>
      <Table head={['Name', 'Contact', 'Type', ...(isSuper ? ['Lender'] : []), 'Requested', 'Action']} empty={pending.length === 0 ? 'No pending requests.' : null}>
        {pending.map((u) => (
          <tr key={u.id}>
            <td className="td font-medium">{u.name}</td>
            <td className="td text-xs">{u.email}<br />{u.phone}</td>
            <td className="td"><Badge status={u.role} /></td>
            {isSuper && <td className="td">{u.role === 'borrower' ? u.lenderName : '—'}</td>}
            <td className="td">{fmtDate(u.createdAt)}</td>
            <td className="td">
              <div className="flex flex-wrap items-center gap-2">
                {u.role === 'borrower' && (
                  <select className="input max-w-[14rem] py-1" value={choice[u.id] || ''} onChange={(e) => setChoice({ ...choice, [u.id]: e.target.value })}>
                    <option value="">Auto: match by phone or create new</option>
                    {candidates(u).map((b) => <option key={b._id} value={b._id}>Link to {b.name} ({b.phone})</option>)}
                  </select>
                )}
                <button className="btn py-1" onClick={() => act(`/users/${u.id}/approve`, choice[u.id] ? { borrowerId: choice[u.id] } : {})}>Approve</button>
                <button className="btn-secondary py-1" onClick={() => act(`/users/${u.id}/reject`)}>Reject</button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-6 font-semibold">{isSuper ? 'All accounts' : 'Your borrowers’ logins'}</h2>
      <Table head={['Name', 'Email', 'Type', ...(isSuper ? ['Lender', 'Lender code'] : []), 'Status', '']} empty={rest.length === 0 ? 'Nothing here yet.' : null}>
        {rest.map((u) => (
          <tr key={u.id}>
            <td className="td font-medium">{u.name}</td>
            <td className="td">{u.email}</td>
            <td className="td"><Badge status={u.role} /></td>
            {isSuper && <td className="td">{u.role === 'borrower' ? u.lenderName : '—'}</td>}
            {isSuper && <td className="td font-mono text-xs">{u.lenderCode || ''}</td>}
            <td className="td"><Badge status={u.status} /></td>
            <td className="td">
              {u.status === 'approved' && <button className="text-red-600 hover:underline" onClick={() => act(`/users/${u.id}/status`, { status: 'disabled' })}>Disable</button>}
              {u.status === 'disabled' && <button className="text-brand-600 hover:underline" onClick={() => act(`/users/${u.id}/status`, { status: 'approved' })}>Enable</button>}
              {u.status === 'rejected' && <button className="text-brand-600 hover:underline" onClick={() => act(`/users/${u.id}/approve`, {})}>Approve</button>}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
