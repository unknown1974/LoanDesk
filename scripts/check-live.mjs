import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import dotenv from '../server/node_modules/dotenv/lib/main.js';

const backend = process.env.VITE_API_URL || 'https://loandesk-api-50047454861.development.catalystappsail.in';
const frontend = process.env.CLIENT_ORIGIN || 'https://loandesk-60093268814.development.catalystserverless.in';
async function request(route, options = {}) {
  const response = await fetch(backend + route, {
    ...options, headers: { Origin: frontend, ...options.headers }, signal: AbortSignal.timeout(45000),
  });
  // Node does not enforce browser CORS: check exact equality, not just presence.
  assert.equal(response.headers.get('access-control-allow-origin'), frontend, `${route}: missing or duplicate browser access header`);
  console.log(`${options.method || 'GET'} ${route}: ${response.status}; exactly one allowed origin`);
  return response;
}

const preflight = await request('/api/auth/login', { method: 'OPTIONS', headers: {
  'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization',
} });
assert.ok(preflight.ok);
assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);
assert.equal((await request('/api/health')).status, 200);
assert.equal((await request('/api/auth/me')).status, 401);

if (process.argv.includes('--login')) {
  // Login writes only the app's normal audit entry. Never print credentials/tokens.
  const local = dotenv.parse(await readFile(new URL('../server/.env', import.meta.url)));
  const login = await request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: local.OWNER_EMAIL, password: local.OWNER_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const data = await login.json();
  assert.ok(data.token);
  const me = await request('/api/auth/me', { headers: { Authorization: `Bearer ${data.token}` } });
  assert.equal(me.status, 200);
  console.log('Existing administrator login and authenticated profile verified.');
}
