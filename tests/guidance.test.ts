import test from 'node:test';
import assert from 'node:assert/strict';
import { tradeGuidance } from '../lib/trade-guidance.ts';
import type { Series } from '../lib/engine.ts';
const now = new Date('2026-09-06T12:00:00Z');
function fixture(): Series {
  return {
    symbol: 'TEST',
    source: '公开测试夹具',
    asOf: '2026-09-04',
    adjustment: 'none',
    warnings: [],
    bars: Array.from({ length: 61 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 6, 6 + i)).toISOString().slice(0, 10),
      open: 100,
      high: 102,
      low: 98,
      close: 100,
      volume: 1000,
    })),
  };
}
test('prior levels exclude current bar and detect support failure', () => {
  const s = fixture();
  Object.assign(s.bars.at(-1)!, { open: 97, high: 98, low: 89, close: 90 });
  const g = tradeGuidance(s, now)!;
  assert.equal(g.low20, 98);
  assert.equal(g.high20, 102);
  assert.equal(g.breakdown, true);
  assert.equal(g.sell, true);
  assert.equal(g.buy, false);
  assert.equal(g.supports.length, 0);
  assert.equal(g.resistances[0].price, 98);
  assert.ok(g.atr > 4); // gap is included in true range
});
test('breakout has no fabricated overhead resistance and RSI blocks hot entry', () => {
  const s = fixture();
  Object.assign(s.bars.at(-1)!, {
    open: 101,
    high: 112,
    low: 101,
    close: 110,
    volume: 2000,
  });
  const g = tradeGuidance(s, now)!;
  assert.equal(g.breakout, true);
  assert.equal(g.high60, 102);
  assert.equal(g.resistances.length, 0);
  assert.equal(g.supports[0].price, 102);
  assert.ok(Math.abs(g.rewardRisk! - 2) < 1e-9);
  assert.equal(g.buy, false);
  assert.equal(g.checks[3].pass, false);
});
test('demo, stale and incomplete histories cannot trigger actionable guidance', () => {
  const s = fixture();
  s.source = '合成演示数据';
  assert.equal(tradeGuidance(s, now)!.eligible, false);
  s.source = '公共行情';
  assert.equal(tradeGuidance(s, new Date('2026-10-01'))!.eligible, false);
  assert.equal(tradeGuidance({ ...s, bars: s.bars.slice(1) }, now), null);
  const before = tradeGuidance(s, now)!;
  s.bars.push({ ...s.bars.at(-1)!, date: '2026-09-06', close: 1, low: 1 });
  assert.equal(tradeGuidance(s, now)!.state, before.state);
  assert.equal(tradeGuidance(s, now)!.last.date, before.last.date);
});
