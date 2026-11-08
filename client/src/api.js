const TOKEN_KEY = 'loandesk_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
};
const USER_KEY = 'loandesk_user';
export const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    setToken(null);
    window.location.href = '/login';
  }
  if (!res.ok) {
    const err = new Error(data.details?.length ? `${data.error}: ${data.details.join('; ')}` : data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}
