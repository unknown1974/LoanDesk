import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInterestPaise, periodBounds } from '../src/modules/interest/interest.engine.js';
import { addMonths } from '../src/utils/dates.js';

const d = (s) => new Date(s + 'T00:00:00Z');
const iso = (x) => x.toISOString().slice(0, 10);

test('monthly interest: ₹50,000 at 2% = ₹1,000', () => {
  const r = calculateInterestPaise({ principalPaise: 5_000_000, rateBps: 200, periodStart: d('2026-11-10'), periodEnd: d('2026-12-10') });
  assert.equal(r, 100_000);
});

test('different rates per loan (table from the architecture doc)', () => {
  const cases = [[5_000_000, 200, 100_000], [8_000_000, 150, 120_000], [10_000_000, 250, 250_000], [3_000_000, 300, 90_000]];
  for (const [principalPaise, rateBps, expected] of cases) {
    assert.equal(calculateInterestPaise({ principalPaise, rateBps, periodStart: d('2026-01-01'), periodEnd: d('2026-02-01') }), expected);
  }
});

test('daily method scales with period length (30-day basis)', () => {
  const feb = calculateInterestPaise({ principalPaise: 5_000_000, rateBps: 200, periodStart: d('2026-02-01'), periodEnd: d('2026-03-01'), method: 'daily' });
  const mar = calculateInterestPaise({ principalPaise: 5_000_000, rateBps: 200, periodStart: d('2026-03-01'), periodEnd: d('2026-04-01'), method: 'daily' });
  assert.equal(feb, Math.round((5_000_000 * 200 * 28) / 300000));
  assert.equal(mar, Math.round((5_000_000 * 200 * 31) / 300000));
});

test('zero principal or zero rate gives zero interest', () => {
  assert.equal(calculateInterestPaise({ principalPaise: 0, rateBps: 200, periodStart: d('2026-01-01'), periodEnd: d('2026-02-01') }), 0);
  assert.equal(calculateInterestPaise({ principalPaise: 100, rateBps: 0, periodStart: d('2026-01-01'), periodEnd: d('2026-02-01') }), 0);
});

test('month-end start dates keep their billing day after short months', () => {
  const start = d('2026-01-31');
  assert.equal(iso(periodBounds(start, 0).periodEnd), '2026-02-28');
  assert.equal(iso(periodBounds(start, 1).periodEnd), '2026-03-31');
  assert.equal(iso(periodBounds(start, 2).periodEnd), '2026-04-30');
});

test('addMonths crosses year boundary', () => {
  assert.equal(iso(addMonths(d('2026-11-10'), 2)), '2027-01-10');
});

test('periods are contiguous: end of one is start of next', () => {
  const start = d('2026-05-15');
  for (let i = 0; i < 24; i++) assert.equal(iso(periodBounds(start, i).periodEnd), iso(periodBounds(start, i + 1).periodStart));
});
