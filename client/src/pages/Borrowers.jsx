import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { inr } from '../format.js';
import { ErrorMsg, Field, Loading, PageTitle, Table, Badge, useLoad } from '../components/ui.jsx';

const empty = { name: '', phone: '', address: '', notes: '' };

export function BorrowerForm({ initial = empty, onSaved, onCancel, id }) {
  const [form, setForm] = useState({ ...empty, ...initial });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const { name, phone, address, notes, status } = form;
      await api(id ? `/borrowers/${id}` : '/borrowers', { method: id ? 'PUT' : 'POST', body: { name, phone, address, notes, ...(id ? { status } : {}) } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={submit} className="card mb-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg>{error}</ErrorMsg></div>
      <Field label="Name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
      <Field label="Phone" hint="10-digit Indian mobile"><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')} /></Field>
      <Field label="Address"><input className="input" value={form.address} onChange={set('address')} /></Field>
      <Field label="Notes"><input className="input" value={form.notes} onChange={set('notes')} /></Field>
      {id && (
        <Field label="Status">
          <select className="input" value={form.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </Field>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn">Save</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Borrowers() {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useLoad(() => api(`/borrowers?q=${encodeURIComponent(q)}`), [q]);
  return (
    <div>
      <PageTitle action={<button className="btn" onClick={() => setAdding(true)}>+ Add borrower</button>}>Borrowers</PageTitle>
      {adding && <BorrowerForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
      <input className="input mb-3" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorMsg>{error}</ErrorMsg>
      {loading && !data ? <Loading /> : (
        <Table head={['Name', 'Phone', 'Active loans', 'Principal outstanding', 'Status']} empty={data?.length === 0 ? 'No borrowers found.' : null}>
          {data?.map((b) => (
            <tr key={b._id}>
              <td className="td"><Link className="font-medium text-brand-600 hover:underline" to={`/borrowers/${b._id}`}>{b.name}</Link></td>
              <td className="td">{b.phone}</td>
              <td className="td">{b.activeLoans}</td>
              <td className="td">{inr(b.outstandingPaise)}</td>
              <td className="td"><Badge status={b.status} /></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
