import test from 'node:test';
import assert from 'node:assert/strict';
import { volumeSummary } from '../lib/volume.ts';
const bar = (date: string, volume: number) => ({
  date,
  volume,
  open: 10,
  high: 11,
  low: 9,
  close: 10,
});
test('volume excludes incomplete New York day and compares prior 20 without latest', () => {
  const bars = Array.from({ length: 21 }, (_, i) =>
    bar(`2026-08-${String(i + 1).padStart(2, '0')}`, i === 20 ? 300 : 100),
  );
  bars.push(bar('2026-09-04', 99999));
  const s = volumeSummary(bars, new Date('2026-09-05T00:00:00Z'));
  assert.equal(s.last?.volume, 300);
  assert.equal(s.average20, 100);
  assert.equal(s.ratio, 3);
  assert.equal(s.change, 200);
  assert.equal(s.changePct, 2);
  assert.equal(s.recent5, 700);
  assert.ok(Math.abs(s.fiveChange! - 0.4) < 1e-10);
});
test('zero baseline and insufficient history do not produce infinity or fabricated averages', () => {
  const s = volumeSummary(
    [bar('2026-08-01', 0), bar('2026-08-02', 10)],
    new Date('2026-09-06'),
  );
  assert.equal(s.changePct, null);
  assert.equal(s.average20, null);
  assert.equal(s.ratio, null);
  assert.equal(s.recent5, null);
  assert.equal(volumeSummary([], new Date()).last, undefined);
});
