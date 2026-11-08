import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, getUser, setToken } from '../api.js';

const links = [
  ['/', 'Dashboard'],
  ['/borrowers', 'Borrowers'],
  ['/loans', 'Loans'],
  ['/calculator', 'Calculator'],
  ['/reports', 'Reports'],
  ['/accounts', 'Accounts'],
  ['/settings', 'Settings'],
];

export default function Layout() {
  const nav = useNavigate();
  const user = getUser();
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);

  const load = () => api('/notifications').then(setNotes).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  const markAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };
  const checkNow = async () => { await api('/notifications/check', { method: 'POST' }); load(); };
  const logout = () => { setToken(null); nav('/login'); };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-bold text-brand-700">LoanDesk</div>
            <div className="hidden text-xs text-slate-500 sm:block">{user?.name || user?.email} · {user?.role === 'superadmin' ? 'Super admin' : 'Lender'}</div>
          </div>
          <div className="relative flex items-center gap-2">
            <button className="btn-secondary relative" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
              🔔{notes.unread > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{notes.unread}</span>}
            </button>
            <button className="btn-secondary" onClick={logout}>Log out</button>
            {open && (
              <div className="absolute right-0 top-12 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1 text-sm font-semibold">
                  Notifications
                  <span className="space-x-3"><button className="text-xs font-normal text-brand-600" onClick={checkNow}>Check now</button><button className="text-xs font-normal text-brand-600" onClick={markAll}>Mark all read</button></span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notes.items.length === 0 && <div className="p-3 text-sm text-slate-500">Nothing yet.</div>}
                  {notes.items.map((n) => (
                    <Link key={n._id} to={n.link || (n.relatedLoanId ? `/loans/${n.relatedLoanId}` : '/')} onClick={() => { setOpen(false); api(`/notifications/${n._id}/read`, { method: 'POST' }).then(load); }} className={`block rounded-lg px-2 py-2 text-sm hover:bg-slate-50 ${n.readAt ? 'text-slate-500' : 'bg-brand-50'}`}>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs">{n.message}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4"><Outlet /></main>
    </div>
  );
}
