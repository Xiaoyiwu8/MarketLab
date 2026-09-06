import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeCenter } from '../lib/range-center.ts';
function fixture() {
  return {
    symbol: 'TEST',
    source: 'test fixture',
    adjustment: 'none',
    asOf: '2026-09-04',
    warnings: [],
    bars: Array.from({ length: 41 }, (_, i) => {
      const close = 100 + 5 * Math.sin((i * Math.PI) / 5);
      return {
        date: new Date(Date.UTC(2026, 6, 26 + i)).toISOString().slice(0, 10),
        open: close - 0.2,
        close,
        high: close + 0.5,
        low: close - 0.5,
        volume: 1000,
      };
    }),
  };
}
const now = new Date('2026-09-06T12:00:00Z');
test('repeated sideways movement produces median center and separated edge tests', () => {
  const r = rangeCenter(fixture(), 40, now)!;
  assert.equal(r.active, true);
  assert.ok(Math.abs(r.center - 100) < 1e-10);
  assert.ok(r.lowerVisits >= 2 && r.upperVisits >= 2);
});
test('latest breakout invalidates old range without widening it', () => {
  const s = fixture(),
    before = rangeCenter(s, 40, now)!;
  Object.assign(s.bars.at(-1)!, { open: 109, close: 110, high: 111, low: 108 });
  const after = rangeCenter(s, 40, now)!;
  assert.equal(after.high, before.high);
  assert.equal(after.center, before.center);
  assert.equal(after.active, false);
  assert.match(after.status, /向上突破/);
  assert.ok(after.position > 1);
});
test('trend, stale data and insufficient history do not produce range entry guidance', () => {
  const s = fixture();
  s.bars = s.bars.map((b, i) => ({
    ...b,
    close: 100 + i,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
  }));
  assert.equal(rangeCenter(s, 40, now)!.qualified, false);
  assert.equal(
    rangeCenter(fixture(), 40, new Date('2026-10-01'))!.active,
    false,
  );
  assert.equal(
    rangeCenter({ ...fixture(), source: '合成演示' }, 40, now)!.active,
    false,
  );
  assert.equal(rangeCenter(fixture(), 60, now), null);
});
