import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken, getUser } from './api.js';
import Layout from './components/Layout.jsx';
import PortalLayout from './components/PortalLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Borrowers from './pages/Borrowers.jsx';
import BorrowerDetail from './pages/BorrowerDetail.jsx';
import Loans from './pages/Loans.jsx';
import LoanDetail from './pages/LoanDetail.jsx';
import Calculator from './pages/Calculator.jsx';
import Reports from './pages/Reports.jsx';
import Accounts from './pages/Accounts.jsx';
import Settings from './pages/Settings.jsx';
import Portal from './pages/Portal.jsx';

const home = (user) => (user?.role === 'borrower' ? '/portal' : '/');

function Protected({ roles, children }) {
  const user = getUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={home(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register/lender" element={<Register kind="lender" />} />
      <Route path="/register/borrower" element={<Register kind="borrower" />} />

      <Route element={<Protected roles={['superadmin', 'lender']}><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="borrowers" element={<Borrowers />} />
        <Route path="borrowers/:id" element={<BorrowerDetail />} />
        <Route path="loans" element={<Loans />} />
        <Route path="loans/:id" element={<LoanDetail />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="reports" element={<Reports />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route element={<Protected roles={['borrower']}><PortalLayout /></Protected>}>
        <Route path="portal" element={<Portal />} />
      </Route>

      <Route path="*" element={<Navigate to={home(getUser())} replace />} />
    </Routes>
  );
}
