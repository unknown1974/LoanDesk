import { Outlet, useNavigate } from 'react-router-dom';
import { getUser, setToken } from '../api.js';

export default function PortalLayout() {
  const nav = useNavigate();
  const user = getUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-bold text-brand-700">LoanDesk</div>
            <div className="text-xs text-slate-500">{user?.name || user?.email}</div>
          </div>
          <button className="btn-secondary" onClick={() => { setToken(null); nav('/login'); }}>Log out</button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4"><Outlet /></main>
    </div>
  );
}
