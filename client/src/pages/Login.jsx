import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api.js';
import { ErrorMsg, Field } from '../components/ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: form });
      setToken(token);
      setUser(user);
      nav(user.role === 'borrower' ? '/portal' : '/');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <div className="text-2xl font-bold text-brand-700">LoanDesk</div>
            <div className="text-sm text-slate-500">Sign in to continue</div>
          </div>
          <ErrorMsg>{error}</ErrorMsg>
          <Field label="Email"><input className="input" type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="card space-y-1 text-center text-sm">
          <div className="text-slate-500">New here?</div>
          <Link className="block text-brand-600 hover:underline" to="/register/borrower">Request a borrower login</Link>
          <Link className="block text-brand-600 hover:underline" to="/register/lender">Request a lender account</Link>
        </div>
      </div>
    </div>
  );
}
