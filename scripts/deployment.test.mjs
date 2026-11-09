import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

// Exercise the actual assembled production app without connecting to any database.
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/deployment-test';
process.env.JWT_SECRET = 'a'.repeat(64);
process.env.JOB_SECRET = 'b'.repeat(64);
process.env.ENABLE_IN_PROCESS_CRON = 'false';
process.env.CLIENT_ORIGIN = 'https://loandesk.example';
const { default: app } = await import('../build/appsail/src/app.js');
const require = createRequire(new URL('../build/appsail/package.json', import.meta.url));
const mongoose = require('mongoose');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => { mongoose.connection.readyState = 0; server.close(resolve); }));

test('health responds before MongoDB; readiness and APIs fail safely', async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/ready`)).status, 503);
  const response = await fetch(`${base}/api/loans`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '5');
});
test('the backend does not serve frontend pages', async () => {
  for (const route of ['/', '/login', '/loans/abc', '/register/lender', '/portal']) {
    const response = await fetch(base + route, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404, route);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  }
});
test('frontend assets and private server files are not available from the API', async () => {
  for (const route of ['/assets/missing.js', '/.env', '/.env.production', '/src/server.js']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});
test('CORS has one owner: the local app or the Catalyst gateway', async () => {
  if (process.env.CORS_MANAGED_BY_PLATFORM === 'true') {
    for (const route of ['/api/health', '/api/loans', '/missing']) {
      const response = await fetch(base + route, { headers: { Origin: process.env.CLIENT_ORIGIN } });
      assert.equal(response.headers.get('access-control-allow-origin'), null, route);
    }
    const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(denied.status, 403);
    return;
  }
  const response = await fetch(`${base}/api/auth/login`, { method: 'OPTIONS', headers: {
    Origin: process.env.CLIENT_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization',
  } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), process.env.CLIENT_ORIGIN);
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
  const other = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.notEqual(other.headers.get('access-control-allow-origin'), 'https://untrusted.example');
});
test('authentication, validation and scheduler authorization remain enforced', async () => {
  // Stub only readiness; the requests below must reject before touching MongoDB.
  app.locals.ready = true;
  mongoose.connection.readyState = 1;
  try {
    assert.equal((await fetch(`${base}/api/loans`)).status, 401);
    const invalid = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'invalid' }),
    });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).details.length);
    for (const authorization of ['', 'Bearer incorrect', `Bearer ${process.env.JWT_SECRET}`]) {
      const response = await fetch(`${base}/api/jobs/due-notifications`, { method: 'POST', headers: { authorization } });
      assert.equal(response.status, 401);
    }
    const unknown = await fetch(`${base}/api/not-a-route`);
    assert.match(unknown.headers.get('content-type'), /application\/json/);
  } finally {
    app.locals.ready = false;
    mongoose.connection.readyState = 0;
  }
});

test('scheduler accepts its own secret without using a user session', async () => {
  const { requireJobSecret } = await import('../build/appsail/src/middleware/jobAuth.js');
  let accepted = false;
  requireJobSecret({ get: () => `Bearer ${process.env.JOB_SECRET}` }, {}, () => { accepted = true; });
  assert.equal(accepted, true);
  const { startDailyNotificationJob } = await import('../build/appsail/src/jobs/dailyNotificationJob.js');
  assert.equal(startDailyNotificationJob(), null);
});

test('real startup opens the Catalyst port while the database is unavailable', { timeout: 10000 }, async () => {
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('../build/appsail/', import.meta.url),
    env: { ...process.env, X_ZOHO_CATALYST_LISTEN_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('App did not listen within 5 seconds')), 5000);
      child.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on')) { clearTimeout(timer); resolve(); } });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('App exited before the startup check')); });
    });
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/ready`)).status, 503);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
