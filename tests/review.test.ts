import test from 'node:test';
import assert from 'node:assert/strict';
import { shortGuidance } from '../lib/short-guidance.ts';
import {
  bullBear,
  positionSize,
  relative,
  weeks,
  volumeRead,
  technicalLevels,
  trend,
} from '../lib/review.ts';
const bar = (date: string, close: number, volume = 100) => ({
  date,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume,
});
test('bull bear regimes require long-trend agreement and sufficient history', () => {
  const make = (direction: number) =>
    Array.from({ length: 230 }, (_, i) =>
      bar(
        new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
        1000 + (direction * i * i) / 100,
      ),
    );
  assert.equal(bullBear(make(1)).label, '牛市倾向');
  assert.equal(bullBear(make(-1)).label, '熊市倾向');
  assert.equal(bullBear(make(0)).label, '震荡过渡');
  assert.equal(bullBear(make(1).slice(-100)).score, null);
});
test('short signals use stop above entry, block oversold chasing and cover upward breaks', () => {
  const bars = Array.from({ length: 61 }, (_, i) =>
    bar(new Date(Date.UTC(2026, 6, 6 + i)).toISOString().slice(0, 10), 100),
  );
  bars[60] = {
    ...bars[60],
    open: 95,
    high: 96,
    low: 89,
    close: 90,
    volume: 300,
  };
  const series = {
    symbol: 'TEST',
    bars,
    source: 'test fixture',
    asOf: bars[60].date,
    adjustment: 'none',
    warnings: [],
  };
  const now = new Date('2026-09-06');
  const s = shortGuidance(series, now)!;
  assert.ok(s.stop > 90);
  assert.ok(s.target < 90 && s.target > 0);
  assert.equal(s.enter, false);
  assert.equal(s.checks[3].pass, false);
  bars[60] = { ...bars[60], open: 105, high: 111, low: 104, close: 110 };
  assert.equal(shortGuidance(series, now)!.cover, true);
  assert.equal(
    shortGuidance({ ...series, source: '合成演示' }, now)!.cover,
    false,
  );
});
test('position budget obeys risk, exposure, cash and drawdown guardrails', () => {
  assert.equal(positionSize(10000, 100, 95, 1, 50, 10000, 0, 10)?.shares, 20);
  assert.equal(positionSize(10000, 100, 95, 1, 5, 10000, 0, 10)?.shares, 5);
  assert.equal(positionSize(10000, 100, 95, 1, 50, 250, 0, 10)?.shares, 2);
  assert.equal(positionSize(10000, 100, 95, 1, 50, 10000, 10, 10)?.shares, 0);
  assert.equal(positionSize(10000, 100, 100, 1, 50, 10000, 0, 10), null);
});
test('weekly bars exclude current incomplete week and aggregate OHLCV', () => {
  const r = weeks(
    [bar('2026-08-24', 10), bar('2026-08-28', 12), bar('2026-09-01', 15)],
    new Date('2026-09-06'),
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].open, 10);
  assert.equal(r[0].close, 12);
  assert.equal(r[0].volume, 200);
});
test('RS aligns dates and does not manufacture correlation for flat series', () => {
  const a = Array.from({ length: 65 }, (_, i) =>
    bar(new Date(Date.UTC(2026, 5, i + 1)).toISOString().slice(0, 10), 100 + i),
  );
  const b = a.map((x) => ({ ...x, close: 100 }));
  const r = relative(a, b)!;
  assert.equal(r.corr, null);
  assert.ok(Math.abs(r.excess - (164 / 144 - 1)) < 1e-9);
  assert.equal(relative(a.slice(0, 10), b), null);
  assert.equal(trend(a, 20).label, '上升');
});
test('volume spike excludes latest day from baseline; filled gaps disappear', () => {
  const a = Array.from({ length: 21 }, (_, i) =>
    bar(`2026-08-${String(i + 1).padStart(2, '0')}`, 100, i === 20 ? 300 : 100),
  );
  assert.equal(volumeRead(a)?.ratio, 3);
  assert.match(volumeRead(a)!.state, /异动/);
  const gaps = [
    bar('2026-08-01', 10),
    bar('2026-08-02', 15),
    bar('2026-08-03', 10),
  ];
  assert.ok(!technicalLevels(gaps)!.gaps.some((g) => g.date === '2026-08-02'));
});
