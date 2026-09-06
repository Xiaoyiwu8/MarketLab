export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Series = {
  symbol: string;
  bars: Bar[];
  source: string;
  asOf: string;
  adjustment: string;
  quote?: { price: number; time: string };
  warnings: string[];
};
export const strategies = {
  trend: '趋势跟踪 · MA20 / MA50',
  reversion: '均值回归 · RSI / MA20',
  breakout: '突破 · 前20日高低点',
  factor: '量价多因子 · 趋势 / 动量 / 成交量',
};
export type Strategy = keyof typeof strategies;
export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
export const std = (a: number[]) =>
  a.length < 2 ? 0 : Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
export function clean(rows: Bar[]) {
  const dates = new Map<string, Bar>();
  let invalid = 0,
    duplicates = 0;
  for (const b of rows) {
    const d = new Date(b.date);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 10) !== b.date ||
      ![b.open, b.high, b.low, b.close, b.volume].every(Number.isFinite) ||
      Math.min(b.open, b.high, b.low, b.close) <= 0 ||
      b.volume < 0 ||
      b.high < Math.max(b.open, b.close, b.low) ||
      b.low > Math.min(b.open, b.close)
    ) {
      invalid++;
      continue;
    }
    if (dates.has(b.date)) duplicates++;
    dates.set(b.date, b);
  }
  return {
    bars: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    invalid,
    duplicates,
  };
}
export function demo(symbol: string): Series {
  let seed = [...symbol].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let p = 50 + rand() * 180;
  const bars: Bar[] = [];
  for (
    let d = new Date('2024-09-02T00:00:00Z');
    d <= new Date('2026-09-04T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if ([0, 6].includes(d.getUTCDay())) continue;
    const o = p * (1 + (rand() - 0.5) * 0.013);
    p = Math.max(5, o * (1 + (rand() - 0.48) * 0.049));
    bars.push({
      date: d.toISOString().slice(0, 10),
      open: o,
      high: Math.max(o, p) * (1 + rand() * 0.016),
      low: Math.min(o, p) * (1 - rand() * 0.016),
      close: p,
      volume: Math.round(1e6 + rand() * 2e7),
    });
  }
  return {
    symbol,
    bars,
    source: '合成演示数据',
    asOf: bars.at(-1)!.date,
    adjustment: '无公司行动',
    warnings: ['完全合成的价格，不代表该股票真实表现；仅用于体验功能。'],
  };
}
function ema(a: number[], n: number) {
  let e = a[0];
  return a.map(
    (x, i) => (e = i ? (x * 2) / (n + 1) + e * (1 - 2 / (n + 1)) : x),
  );
}
export function indicators(b: Bar[]) {
  const c = b.map((x) => x.close),
    e12 = ema(c, 12),
    e26 = ema(c, 26),
    macd = c.map((_, i) => e12[i] - e26[i]),
    signal = ema(macd, 9);
  let g = 0,
    l = 0,
    obv = 0;
  return b.map((x, i) => {
    const change = i ? c[i] - c[i - 1] : 0;
    if (i && i <= 14) {
      g += Math.max(0, change) / 14;
      l += Math.max(0, -change) / 14;
    } else if (i > 14) {
      g = (g * 13 + Math.max(0, change)) / 14;
      l = (l * 13 + Math.max(0, -change)) / 14;
    }
    if (i) obv += Math.sign(change) * x.volume;
    const avg = (n: number) =>
      i >= n - 1 ? mean(c.slice(i - n + 1, i + 1)) : null;
    const ma20 = avg(20),
      s = i >= 19 ? std(c.slice(i - 19, i + 1)) : null;
    return {
      ...x,
      ma20,
      ma50: avg(50),
      rsi:
        i < 14
          ? null
          : l === 0
            ? g === 0
              ? 50
              : 100
            : 100 - 100 / (1 + g / l),
      macd: i < 25 ? null : macd[i],
      signal: i < 33 ? null : signal[i],
      hist: i < 33 ? null : macd[i] - signal[i],
      upper: ma20 === null ? null : ma20 + 2 * s!,
      lower: ma20 === null ? null : ma20 - 2 * s!,
      obv,
      volumeRatio:
        i < 20
          ? null
          : x.volume /
            Math.max(1, mean(b.slice(i - 20, i).map((x) => x.volume))),
      mfi:
        i < 14
          ? null
          : (() => {
              let pos = 0,
                neg = 0;
              for (let j = i - 13; j <= i; j++) {
                const tp = (b[j].high + b[j].low + b[j].close) / 3,
                  prev = (b[j - 1].high + b[j - 1].low + b[j - 1].close) / 3;
                if (tp > prev) pos += tp * b[j].volume;
                else if (tp < prev) neg += tp * b[j].volume;
              }
              return neg === 0
                ? pos === 0
                  ? 50
                  : 100
                : 100 - 100 / (1 + pos / neg);
            })(),
    };
  });
}
export type StrategyParams = {
  fast: number;
  slow: number;
  rsiBuy: number;
  rsiSell: number;
  breakout: number;
  exit: number;
  volumeRatio: number;
};
export const defaultParams: StrategyParams = {
  fast: 20,
  slow: 50,
  rsiBuy: 30,
  rsiSell: 60,
  breakout: 20,
  exit: 10,
  volumeRatio: 1.2,
};
export function action(
  b: ReturnType<typeof indicators>,
  i: number,
  strategy: Strategy,
  params: StrategyParams = defaultParams,
): 'BUY' | 'SELL' | 'HOLD' {
  if (i < Math.max(50, params.slow, params.breakout, params.exit))
    return 'HOLD';
  const x = b[i];
  const fast = mean(b.slice(i - params.fast + 1, i + 1).map((x) => x.close)),
    slow = mean(b.slice(i - params.slow + 1, i + 1).map((x) => x.close));
  switch (strategy) {
    case 'trend':
      return fast > slow ? 'BUY' : 'SELL';
    case 'reversion':
      return x.rsi! < params.rsiBuy
        ? 'BUY'
        : x.rsi! > params.rsiSell || x.close > fast
          ? 'SELL'
          : 'HOLD';
    case 'breakout':
      return x.close >
        Math.max(...b.slice(i - params.breakout, i).map((x) => x.high))
        ? 'BUY'
        : x.close < Math.min(...b.slice(i - params.exit, i).map((x) => x.low))
          ? 'SELL'
          : 'HOLD';
    case 'factor': {
      const score =
        Number(x.close > slow) +
        Number(x.close > b[i - 20].close) +
        Number(x.volumeRatio! > params.volumeRatio);
      return score === 3 ? 'BUY' : score <= 1 ? 'SELL' : 'HOLD';
    }
  }
}
export type BacktestConfig = {
  initial: number;
  allocation: number;
  feeBps: number;
  slippageBps: number;
  stop: number;
  maxDrawdown: number;
  start: string;
  end: string;
};
export type Fill = {
  date: string;
  side: string;
  price: number;
  qty: number;
  fee: number;
  reason: string;
  pnl?: number;
};
export function backtest(
  raw: Bar[],
  strategy: Strategy,
  cfg: BacktestConfig,
  params: StrategyParams = defaultParams,
) {
  if (
    !(strategy in strategies) ||
    ![cfg.start, cfg.end].every(
      (s) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s,
    )
  )
    throw Error('策略或日期无效');
  if (
    !Object.values(params).every(Number.isFinite) ||
    ![params.fast, params.slow, params.breakout, params.exit].every(
      (x) => Number.isInteger(x) && x >= 2 && x <= 500,
    ) ||
    params.fast >= params.slow ||
    params.rsiBuy < 1 ||
    params.rsiSell > 99 ||
    params.rsiBuy >= params.rsiSell ||
    params.volumeRatio <= 0
  )
    throw Error('策略参数无效：均线2–500日且快线小于慢线，RSI阈值须升序。');
  if (
    ![
      cfg.initial,
      cfg.allocation,
      cfg.feeBps,
      cfg.slippageBps,
      cfg.stop,
      cfg.maxDrawdown,
    ].every(Number.isFinite) ||
    cfg.initial <= 0 ||
    cfg.allocation <= 0 ||
    cfg.allocation > 1 ||
    cfg.stop <= 0 ||
    cfg.stop >= 1 ||
    cfg.maxDrawdown <= 0 ||
    cfg.maxDrawdown >= 1 ||
    cfg.feeBps < 0 ||
    cfg.slippageBps < 0 ||
    cfg.slippageBps > 100 ||
    cfg.feeBps > 100 ||
    cfg.start > cfg.end
  )
    throw Error('请检查回测参数范围和日期。');
  const b = indicators(clean(raw).bars);
  let cash = cfg.initial,
    qty = 0,
    cost = 0,
    peak = cfg.initial,
    halt = false,
    pending: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  const fills: Fill[] = [],
    curve: { date: string; equity: number; benchmark: number }[] = [];
  let base = 0;
  for (
    let i = Math.max(50, params.slow, params.breakout, params.exit);
    i < b.length;
    i++
  ) {
    const x = b[i];
    if (x.date < cfg.start || x.date > cfg.end) continue;
    if (!base) base = x.open;
    const sell = (px: number, reason: string) => {
      const price = px * (1 - cfg.slippageBps / 10000),
        fee = (qty * price * cfg.feeBps) / 10000,
        pnl = qty * price - fee - cost;
      cash += qty * price - fee;
      fills.push({ date: x.date, side: 'SELL', price, qty, fee, reason, pnl });
      qty = 0;
      cost = 0;
    };
    if (qty && (pending === 'SELL' || halt))
      sell(x.open, halt ? '回撤熔断' : '策略退出');
    else if (!qty && !halt && pending === 'BUY') {
      const price = x.open * (1 + cfg.slippageBps / 10000),
        n = Math.floor(
          (cash * cfg.allocation) / (price * (1 + cfg.feeBps / 10000)),
        );
      if (n > 0) {
        qty = n;
        const fee = (n * price * cfg.feeBps) / 10000;
        cost = n * price + fee;
        cash -= cost;
        fills.push({
          date: x.date,
          side: 'BUY',
          price,
          qty,
          fee,
          reason: '前日信号',
        });
      }
    }
    if (qty && x.low <= (cost / qty) * (1 - cfg.stop))
      sell(
        Math.min(x.open, (cost / qty) * (1 - cfg.stop)),
        '止损（跳空按开盘价）',
      );
    const equity = cash + qty * x.close;
    peak = Math.max(peak, equity);
    if (1 - equity / peak >= cfg.maxDrawdown) halt = true;
    curve.push({
      date: x.date,
      equity,
      benchmark: (cfg.initial * x.close) / base,
    });
    pending = action(b, i, strategy, params);
  }
  if (curve.length < 2)
    throw Error('有效回测区间不足；需要至少50根预热日线及2个回测交易日。');
  const rets = curve.map(
      (x, i) => x.equity / (i ? curve[i - 1].equity : cfg.initial) - 1,
    ),
    trades = fills.filter((x) => x.side === 'SELL'),
    wins = trades.filter((x) => x.pnl! > 0),
    losses = trades.filter((x) => x.pnl! < 0);
  let high = cfg.initial,
    dd = 0;
  for (const x of curve) {
    high = Math.max(high, x.equity);
    dd = Math.max(dd, 1 - x.equity / high);
  }
  const total = curve.at(-1)!.equity / cfg.initial - 1;
  const entryBar = b.find((x) => x.date === curve[0].date)!;
  const benchmarkPrice = entryBar.open * (1 + cfg.slippageBps / 10000),
    benchmarkQty = Math.floor(
      (cfg.initial * cfg.allocation) /
        (benchmarkPrice * (1 + cfg.feeBps / 10000)),
    ),
    benchmarkCash =
      cfg.initial - benchmarkQty * benchmarkPrice * (1 + cfg.feeBps / 10000);
  const matchedBenchmark = curve.map((x) => ({
    date: x.date,
    equity:
      benchmarkCash + benchmarkQty * b.find((v) => v.date === x.date)!.close,
  }));
  const journal: {
    entryDate: string;
    exitDate: string;
    qty: number;
    entryPrice: number;
    exitPrice: number;
    fees: number;
    pnl: number;
    returnPct: number;
  }[] = [];
  let entry: Fill | undefined;
  for (const f of fills) {
    if (f.side === 'BUY') entry = f;
    else if (entry) {
      journal.push({
        entryDate: entry.date,
        exitDate: f.date,
        qty: f.qty,
        entryPrice: entry.price,
        exitPrice: f.price,
        fees: entry.fee + f.fee,
        pnl: f.pnl!,
        returnPct: f.pnl! / (entry.price * entry.qty + entry.fee),
      });
      entry = undefined;
    }
  }
  return {
    engine: 'Market Lab Event Engine 2.0',
    params: { ...params },
    config: { ...cfg },
    matchedBenchmark,
    journal,
    actualStart: curve[0].date,
    actualEnd: curve.at(-1)!.date,
    totalFees: fills.reduce((s, f) => s + f.fee, 0),
    barsUsed: curve.length,
    curve,
    fills,
    total,
    annual: (1 + total) ** (252 / curve.length) - 1,
    sharpe: std(rets) > 0 ? (mean(rets) / std(rets)) * Math.sqrt(252) : null,
    maxDrawdown: dd,
    winRate: trades.length ? wins.length / trades.length : null,
    payoff:
      wins.length && losses.length
        ? mean(wins.map((x) => x.pnl!)) / -mean(losses.map((x) => x.pnl!))
        : null,
    profitFactor: losses.length
      ? wins.reduce((s, x) => s + x.pnl!, 0) /
        -losses.reduce((s, x) => s + x.pnl!, 0)
      : null,
    closedTrades: trades.length,
    openQty: qty,
    halt,
  };
}
export type Leg = {
  type: 'call' | 'put' | 'stock';
  strike: number;
  qty: number;
  premium: number;
};
export function payoff(legs: Leg[], s: number) {
  return legs.reduce(
    (v, l) =>
      v +
      (l.type === 'stock'
        ? s - l.premium
        : ((l.type === 'call'
            ? Math.max(0, s - l.strike)
            : Math.max(0, l.strike - s)) -
            l.premium) *
          100) *
        l.qty,
    0,
  );
}
export function optionRisk(legs: Leg[]) {
  const knots = [
    0,
    ...new Set(legs.filter((x) => x.type !== 'stock').map((x) => x.strike)),
  ].sort((a, b) => a - b);
  const slope = legs.reduce(
      (s, l) =>
        s + (l.type === 'stock' ? l.qty : l.type === 'call' ? l.qty * 100 : 0),
      0,
    ),
    values = knots.map((x) => payoff(legs, x)),
    roots: number[] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const a = values[i],
      z = values[i + 1];
    if (a === 0) roots.push(knots[i]);
    if (a * z < 0)
      roots.push(knots[i] - (a * (knots[i + 1] - knots[i])) / (z - a));
  }
  const last = knots.at(-1)!,
    v = values.at(-1)!;
  if (v === 0) roots.push(last);
  if (slope !== 0 && last - v / slope > last) roots.push(last - v / slope);
  return {
    maxProfit: slope > 0 ? Infinity : Math.max(...values),
    maxLoss: slope < 0 ? Infinity : Math.max(0, -Math.min(...values)),
    breakevens: [...new Set(roots)],
  };
}
const cdf = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x)),
    p =
      0.3989422804014327 *
      Math.exp((-x * x) / 2) *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
};
export function bs(
  s: number,
  k: number,
  days: number,
  iv: number,
  type: 'call' | 'put',
  r = 0.04,
  q = 0,
) {
  if (
    ![s, k, days, iv, r, q].every(Number.isFinite) ||
    s <= 0 ||
    k <= 0 ||
    days < 0 ||
    iv <= 0
  )
    throw Error('理论定价参数不合法');
  if (days === 0) return Math.max(0, type === 'call' ? s - k : k - s);
  const t = days / 365,
    d1 = (Math.log(s / k) + (r - q + (iv * iv) / 2) * t) / (iv * Math.sqrt(t)),
    d2 = d1 - iv * Math.sqrt(t);
  return type === 'call'
    ? s * Math.exp(-q * t) * cdf(d1) - k * Math.exp(-r * t) * cdf(d2)
    : k * Math.exp(-r * t) * cdf(-d2) - s * Math.exp(-q * t) * cdf(-d1);
}
export function greeks(
  s: number,
  k: number,
  d: number,
  iv: number,
  type: 'call' | 'put',
  r = 0.04,
  q = 0,
) {
  const h = s * 0.001,
    v = bs(s, k, d, iv, type, r, q);
  return {
    price: v,
    delta:
      (bs(s + h, k, d, iv, type, r, q) - bs(s - h, k, d, iv, type, r, q)) /
      (2 * h),
    gamma:
      (bs(s + h, k, d, iv, type, r, q) -
        2 * v +
        bs(s - h, k, d, iv, type, r, q)) /
      (h * h),
    theta: bs(s, k, Math.max(0, d - 1), iv, type, r, q) - v,
    vega:
      bs(s, k, d, iv + 0.005, type, r, q) -
      bs(s, k, d, Math.max(0.001, iv - 0.005), type, r, q),
  };
}
export const optionStrategies = {
  longCall: '买入看涨',
  longPut: '买入看跌',
  coveredCall: '备兑看涨（含100股）',
  cashPut: '现金担保看跌',
  bullCall: '牛市看涨价差',
  bearPut: '熊市看跌价差',
  bullPut: '牛市看跌价差',
  bearCall: '熊市看涨价差',
  straddle: '买入跨式',
  ironCondor: '铁鹰',
};
export function makeLegs(
  kind: keyof typeof optionStrategies,
  s: number,
  k: number,
  width: number,
  days: number,
  iv: number,
  r = 0.04,
  q = 0,
): Leg[] {
  const leg = (type: 'call' | 'put', strike: number, qty: number): Leg => ({
    type,
    strike,
    qty,
    premium: bs(s, strike, days, iv, type, r, q),
  });
  switch (kind) {
    case 'longCall':
      return [leg('call', k, 1)];
    case 'longPut':
      return [leg('put', k, 1)];
    case 'coveredCall':
      return [
        { type: 'stock', strike: 0, qty: 100, premium: s },
        leg('call', k, -1),
      ];
    case 'cashPut':
      return [leg('put', k, -1)];
    case 'bullCall':
      return [leg('call', k, 1), leg('call', k + width, -1)];
    case 'bearPut':
      return [leg('put', k, 1), leg('put', k - width, -1)];
    case 'bullPut':
      return [leg('put', k, -1), leg('put', k - width, 1)];
    case 'bearCall':
      return [leg('call', k, -1), leg('call', k + width, 1)];
    case 'straddle':
      return [leg('call', k, 1), leg('put', k, 1)];
    case 'ironCondor':
      return [
        leg('put', k - width, 1),
        leg('put', k, -1),
        leg('call', k + width, -1),
        leg('call', k + 2 * width, 1),
      ];
  }
}
export type Position = {
  id: string;
  symbol: string;
  kind: 'stock' | 'option';
  qty: number;
  entry: number;
  mark: number;
  reserve: number;
  opened: string;
  source: string;
  legs?: Leg[];
  expiry?: string;
  iv?: number;
  r?: number;
  q?: number;
  label: string;
};
export type Account = {
  cash: number;
  initial: number;
  peak: number;
  halted: boolean;
  positions: Position[];
  ledger: { time: string; description: string; amount: number }[];
};
export const newAccount = (): Account => ({
  cash: 100000,
  initial: 100000,
  peak: 100000,
  halted: false,
  positions: [],
  ledger: [],
});
export const equity = (a: Account) =>
  a.cash + a.positions.reduce((s, p) => s + p.mark * p.qty, 0);
export const available = (a: Account) =>
  a.cash - a.positions.reduce((s, p) => s + p.reserve * p.qty, 0);
export function openPosition(
  a: Account,
  p: Position,
  maxAllocation: number,
  fee: number,
) {
  if (a.halted) throw Error('账户已触发回撤熔断，禁止开仓。');
  if (
    !Number.isInteger(p.qty) ||
    p.qty <= 0 ||
    !Number.isFinite(p.entry) ||
    !Number.isFinite(p.reserve) ||
    p.reserve < 0 ||
    !Number.isFinite(fee) ||
    fee < 0 ||
    !Number.isFinite(maxAllocation) ||
    maxAllocation <= 0 ||
    maxAllocation > 1
  )
    throw Error('下单参数无效');
  const needed = (p.entry + p.reserve) * p.qty + fee,
    exposure = a.positions
      .filter((x) => x.symbol === p.symbol)
      .reduce((s, x) => s + Math.max(0, x.entry + x.reserve) * x.qty, 0);
  if (needed <= 0 || needed > available(a) + 1e-8)
    throw Error('可用资金不足或风险金额无效。');
  if (exposure + needed > equity(a) * maxAllocation)
    throw Error('超过单一标的的累计仓位 / 风险限额。');
  return {
    ...a,
    cash: a.cash - p.entry * p.qty - fee,
    positions: [...a.positions, p],
    ledger: [
      {
        time: new Date().toISOString(),
        description: `开仓 ${p.symbol} ${p.label} × ${p.qty}`,
        amount: -p.entry * p.qty - fee,
      },
      ...a.ledger,
    ],
  };
}
export function closePosition(a: Account, id: string, fee = 0) {
  const p = a.positions.find((x) => x.id === id);
  if (!p) throw Error('持仓不存在');
  return {
    ...a,
    cash: a.cash + p.mark * p.qty - fee,
    positions: a.positions.filter((x) => x.id !== id),
    ledger: [
      {
        time: new Date().toISOString(),
        description: `平仓 ${p.symbol} ${p.label}，损益 ${(p.mark * p.qty - p.entry * p.qty - fee).toFixed(2)}`,
        amount: p.mark * p.qty - fee,
      },
      ...a.ledger,
    ],
  };
}
