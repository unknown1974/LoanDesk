import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorMsg, Field } from '../components/ui.jsx';

export default function Register({ kind }) {
  const isBorrower = kind === 'borrower';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', lenderCode: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { name, email, phone, password, lenderCode } = form;
      await api(isBorrower ? '/auth/register-borrower' : '/auth/register-lender', { method: 'POST', body: isBorrower ? { name, email, phone, password, lenderCode } : { name, email, phone, password } });
      setDone(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-3 text-center">
          <div className="text-lg font-semibold">Request sent</div>
          <p className="text-sm text-slate-600">{isBorrower ? 'Your lender (or the super admin) will review it. You can sign in once it is approved.' : 'The super admin will review your request. You can sign in once it is approved.'}</p>
          <Link className="btn w-full" to="/login">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <div>
          <div className="text-xl font-bold text-brand-700">{isBorrower ? 'Request a borrower login' : 'Request a lender account'}</div>
          <div className="text-sm text-slate-500">{isBorrower ? 'You will be able to view your loan amount, dues and status.' : 'You will be able to manage your own borrowers and loans.'}</div>
        </div>
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Full name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Mobile number" hint={isBorrower ? 'Use the number your lender has for you. It helps match your loan record.' : '10-digit Indian mobile'}><input className="input" required inputMode="numeric" value={form.phone} onChange={set('phone')} /></Field>
        {isBorrower && <Field label="Lender code" hint="Ask the person who lent you money for their code."><input className="input uppercase" required value={form.lenderCode} onChange={set('lenderCode')} /></Field>}
        <Field label="Password" hint="At least 10 characters"><input className="input" type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={set('password')} /></Field>
        <button className="btn w-full" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
        <Link className="block text-center text-sm text-brand-600 hover:underline" to="/login">Back to sign in</Link>
      </form>
    </div>
  );
}
