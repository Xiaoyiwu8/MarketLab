import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clean,
  demo,
  indicators,
  backtest,
  bs,
  optionRisk,
  payoff,
  makeLegs,
  newAccount,
  openPosition,
  closePosition,
  available,
  equity,
  type Position,
} from '../lib/engine.ts';
test('clean rejects bad OHLC, empty / nonfinite, impossible dates and deduplicates', () => {
  const b = demo('TEST').bars[0];
  const r = clean([
    b,
    { ...b, close: b.open },
    { ...b, date: '2025-02-30' },
    { ...b, high: 0 },
    { ...b, volume: NaN },
  ]);
  assert.equal(r.bars.length, 1);
  assert.equal(r.duplicates, 1);
  assert.equal(r.invalid, 3);
});
test('indicators have warmup and flat RSI = 50', () => {
  const b = demo('TEST').bars.map((x) => ({
    ...x,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
  }));
  const a = indicators(b);
  assert.equal(a[13].rsi, null);
  assert.equal(a[14].rsi, 50);
  assert.equal(a[18].ma20, null);
  assert.equal(a[49].ma50, 100);
  assert.equal(a.at(-1)!.macd, 0);
});
test('backtest cannot use future signal; execution at next open', () => {
  const b = demo('TEST')
    .bars.slice(0, 120)
    .map((x, i) => ({
      ...x,
      open: 100 + i,
      close: 100 + i,
      high: 101 + i,
      low: 99 + i,
    }));
  const r = backtest(b, 'trend', {
    initial: 10000,
    allocation: 1,
    feeBps: 0,
    slippageBps: 0,
    stop: 0.5,
    maxDrawdown: 0.5,
    start: b[50].date,
    end: b.at(-1)!.date,
  });
  assert.equal(r.fills[0].date, b[51].date);
  assert.equal(r.fills[0].price, b[51].open);
  assert.equal(r.closedTrades, 0);
  assert.equal(r.winRate, null);
});
test('truncating future prices leaves historical trades unchanged', () => {
  const b = demo('TEST').bars,
    cfg = {
      initial: 10000,
      allocation: 0.5,
      feeBps: 2,
      slippageBps: 5,
      stop: 0.08,
      maxDrawdown: 0.5,
      start: b[50].date,
      end: b[250].date,
    };
  const a = backtest(b, 'breakout', cfg),
    z = backtest(b.slice(0, 251), 'breakout', cfg);
  assert.deepEqual(a.fills, z.fills);
  assert.deepEqual(a.curve, z.curve);
});
test('gap stop is filled at adverse open, not optimistic stop', () => {
  const b = demo('TEST')
    .bars.slice(0, 100)
    .map((x, i) => ({
      ...x,
      open: 100 + i,
      close: 100 + i,
      high: 101 + i,
      low: 99 + i,
    }));
  b[55] = { ...b[55], open: 50, close: 51, high: 52, low: 49 };
  const r = backtest(b, 'trend', {
    initial: 10000,
    allocation: 0.5,
    feeBps: 0,
    slippageBps: 0,
    stop: 0.08,
    maxDrawdown: 0.9,
    start: b[50].date,
    end: b[60].date,
  });
  const f = r.fills.find((x) => x.date === b[55].date && x.side === 'SELL');
  assert.equal(f?.price, 50);
});
test('Black Scholes put call parity and expiry', () => {
  assert.ok(
    Math.abs(
      bs(100, 100, 365, 0.2, 'call') -
        bs(100, 100, 365, 0.2, 'put') -
        (100 - 100 * Math.exp(-0.04)),
    ) < 1e-6,
  );
  assert.equal(bs(120, 100, 0, 0.2, 'call'), 20);
});
test('vertical payoff analytical caps and breakeven', () => {
  const legs = [
    { type: 'call' as const, strike: 100, qty: 1, premium: 8 },
    { type: 'call' as const, strike: 110, qty: -1, premium: 3 },
  ];
  const r = optionRisk(legs);
  assert.equal(r.maxLoss, 500);
  assert.equal(r.maxProfit, 500);
  assert.deepEqual(r.breakevens, [105]);
  assert.equal(payoff(legs, 120), 500);
});
test('covered call and cash secured put max loss include stock and premium', () => {
  assert.equal(
    optionRisk([
      { type: 'stock', strike: 0, qty: 100, premium: 100 },
      { type: 'call', strike: 110, qty: -1, premium: 3 },
    ]).maxLoss,
    9700,
  );
  assert.equal(
    optionRisk([{ type: 'put', strike: 100, qty: -1, premium: 3 }]).maxLoss,
    9700,
  );
  assert.equal(
    optionRisk([{ type: 'call', strike: 100, qty: -1, premium: 3 }]).maxLoss,
    Infinity,
  );
});
test('all 10 option templates have finite loss', () => {
  for (const kind of [
    'longCall',
    'longPut',
    'coveredCall',
    'cashPut',
    'bullCall',
    'bearPut',
    'bullPut',
    'bearCall',
    'straddle',
    'ironCondor',
  ] as const) {
    const ls = makeLegs(kind, 100, 100, 10, 30, 0.3);
    assert.ok(Number.isFinite(optionRisk(ls).maxLoss));
  }
});
test('paper cash, aggregate exposure, reserve and realized PnL accounting', () => {
  const a = newAccount(),
    p: Position = {
      id: '1',
      symbol: 'AAPL',
      kind: 'stock',
      qty: 100,
      entry: 100,
      mark: 100,
      reserve: 0,
      source: 'demo',
      opened: '2026-09-01',
      label: 'stock',
    };
  const b = openPosition(a, p, 0.2, 1);
  assert.equal(b.cash, 89999);
  assert.equal(equity(b), 99999);
  assert.throws(() => openPosition(b, { ...p, id: '2', qty: 101 }, 0.2, 1));
  const c = closePosition({ ...b, positions: [{ ...p, mark: 110 }] }, '1', 1);
  assert.equal(c.cash, 100998);
  assert.equal(c.positions.length, 0);
  const put = {
    ...p,
    kind: 'option' as const,
    qty: 1,
    entry: -300,
    mark: -300,
    reserve: 10000,
  };
  const z = openPosition(a, put, 0.2, 0.65);
  assert.equal(equity(z), 99999.35);
  assert.equal(available(z), 90299.35);
  assert.throws(() => openPosition({ ...a, halted: true }, p, 0.2, 0));
});
