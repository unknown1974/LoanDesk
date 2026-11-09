import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { phoneSchema, passwordSchema } from '../src/utils/validators.js';

function config(overrides = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', "import { env } from './src/config/env.js'; console.log(JSON.stringify({ port: env.port, cron: env.enableInProcessCron }));"], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:1/test', JWT_SECRET: 'a'.repeat(64), JOB_SECRET: 'b'.repeat(64), ENABLE_IN_PROCESS_CRON: 'false', X_ZOHO_CATALYST_LISTEN_PORT: '9000', PORT: '5000', ...overrides },
  });
}
test('Catalyst port wins over local PORT and external scheduling is supported', () => {
  const result = config();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { port: 9000, cron: false });
});
test('unsafe production secrets and invalid settings fail early', () => {
  for (const overrides of [{ JWT_SECRET: 'change-me-to-a-long-random-string' }, { JOB_SECRET: '' }, { JOB_SECRET: 'a'.repeat(64) }, { X_ZOHO_CATALYST_LISTEN_PORT: 'NaN' }, { CRON_SCHEDULE: 'invalid' }, { ENABLE_IN_PROCESS_CRON: 'maybe' }, { CORS_MANAGED_BY_PLATFORM: 'maybe' }]) {
    assert.notEqual(config(overrides).status, 0);
  }
});
test('patched validation library preserves phone normalization and password rules', () => {
  assert.equal(phoneSchema.parse('+91 98765-43210'), '9876543210');
  assert.equal(phoneSchema.safeParse('123').success, false);
  assert.equal(passwordSchema.safeParse('short').success, false);
  assert.equal(passwordSchema.safeParse('LongPassword123').success, true);
});
