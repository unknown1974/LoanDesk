import { useState } from 'react';
import { api } from '../api.js';
import { ErrorMsg, Field, PageTitle, useLoad } from '../components/ui.jsx';

export default function Settings() {
  const me = useLoad(() => api('/auth/me'));
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try { await api('/auth/change-password', { method: 'POST', body: form }); setMsg('Password changed.'); setForm({ currentPassword: '', newPassword: '' }); } catch (err) { setError(err.message); }
  };
  const code = me.data?.user?.lenderCode;
  return (
    <div className="max-w-md space-y-4">
      <PageTitle>Settings</PageTitle>
      {code && (
        <div className="card">
          <div className="text-sm font-semibold">Your lender code</div>
          <div className="my-2 font-mono text-2xl tracking-widest">{code}</div>
          <p className="text-sm text-slate-500">Share this with your borrowers. They enter it when they request a login, and you approve them under Accounts.</p>
        </div>
      )}
      <form onSubmit={submit} className="card space-y-3">
        <div className="font-semibold">Change password</div>
        <ErrorMsg>{error}</ErrorMsg>
        {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div>}
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
        <Field label="New password" hint="At least 10 characters"><input className="input" type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
        <button className="btn">Update password</button>
      </form>
      <p className="text-sm text-slate-500">Due-date notifications (days before, check time) are set in the server <code>.env</code> file.</p>
    </div>
  );
}
