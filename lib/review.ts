import { indicators, type Bar } from './engine.ts';
export function bullBear(b: Bar[]) {
  if (b.length < 205)
    return {
      label: '数据不足',
      score: null,
      checks: [] as { label: string; pass: boolean }[],
    };
  const i = indicators(b).at(-1)!;
  const long = trend(b, 200).label;
  const checks = [20, 60, 200].map((n) => ({
    label: `MA${n}上升且收盘在均线上方`,
    pass: trend(b, n).label === '上升',
  }));
  checks.push(
    { label: 'MACD柱为正', pass: i.hist !== null && i.hist > 0 },
    { label: 'RSI14高于50', pass: i.rsi !== null && i.rsi > 50 },
  );
  const score = checks.filter((c) => c.pass).length;
  const label =
    long === '上升' && score >= 4
      ? '牛市倾向'
      : long === '下降' && score <= 1
        ? '熊市倾向'
        : long === '下降' && score >= 3
          ? '熊市反弹观察'
          : long === '上升' && score <= 2
            ? '牛市回调观察'
            : '震荡过渡';
  return { label, score, checks };
}
export const avg = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
export function trend(b: Bar[], n: number) {
  if (b.length < n + 5) return { label: '样本不足', ma: null };
  const ma = avg(b.slice(-n).map((x) => x.close)),
    old = avg(b.slice(-n - 5, -5).map((x) => x.close)),
    close = b.at(-1)!.close;
  return {
    ma,
    label:
      close > ma && ma > old
        ? '上升'
        : close < ma && ma < old
          ? '下降'
          : '震荡',
  };
}
export function weeks(b: Bar[], now = new Date()) {
  const monday = (date: string) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const cutoff = monday(today),
    grouped = new Map<string, Bar>();
  for (const x of b) {
    const k = monday(x.date);
    if (k >= cutoff) continue;
    const prev = grouped.get(k);
    grouped.set(
      k,
      prev
        ? {
            ...prev,
            date: x.date,
            high: Math.max(prev.high, x.high),
            low: Math.min(prev.low, x.low),
            close: x.close,
            volume: prev.volume + x.volume,
          }
        : { ...x },
    );
  }
  return [...grouped.values()];
}
export function relative(a: Bar[], b: Bar[]) {
  const map = new Map(b.map((x) => [x.date, x]));
  const pairs = a
    .filter((x) => map.has(x.date))
    .map((x) => [x, map.get(x.date)!]);
  if (pairs.length < 21) return null;
  const last = pairs.at(-1)!,
    old = pairs.at(-21)!;
  const excess =
    last[0].close / old[0].close - 1 - (last[1].close / old[1].close - 1);
  const sample = pairs.slice(-61),
    x = sample.slice(1).map((p, i) => p[0].close / sample[i][0].close - 1),
    y = sample.slice(1).map((p, i) => p[1].close / sample[i][1].close - 1);
  const mx = avg(x),
    my = avg(y),
    den = Math.sqrt(
      x.reduce((s, v) => s + (v - mx) ** 2, 0) *
        y.reduce((s, v) => s + (v - my) ** 2, 0),
    );
  return {
    excess,
    corr:
      x.length >= 60 && den > 0
        ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / den
        : null,
    asOf: last[0].date,
    start: old[0].date,
  };
}
export function positionSize(
  equity: number,
  entry: number,
  stop: number,
  riskPct: number,
  capPct: number,
  cash: number,
  drawdown: number,
  maxDrawdown: number,
) {
  if (
    ![equity, entry, stop, riskPct, capPct, cash, drawdown, maxDrawdown].every(
      Number.isFinite,
    ) ||
    equity <= 0 ||
    entry <= 0 ||
    stop <= 0 ||
    stop >= entry ||
    riskPct <= 0 ||
    riskPct > 5 ||
    capPct <= 0 ||
    capPct > 100 ||
    cash < 0 ||
    drawdown < 0 ||
    maxDrawdown <= 0 ||
    maxDrawdown > 100
  )
    return null;
  const halted = drawdown >= maxDrawdown;
  const shares = halted
    ? 0
    : Math.max(
        0,
        Math.floor(
          Math.min(
            (equity * riskPct) / 100 / (entry - stop),
            (equity * capPct) / 100 / entry,
            cash / entry,
          ),
        ),
      );
  return {
    shares,
    value: shares * entry,
    loss: shares * (entry - stop),
    weight: ((shares * entry) / equity) * 100,
    halted,
  };
}
export function volumeRead(b: Bar[]) {
  if (b.length < 21) return null;
  const last = b.at(-1)!,
    baseline = avg(b.slice(-21, -1).map((x) => x.volume));
  const ratio = baseline > 0 ? last.volume / baseline : null,
    priceChange = last.close / b.at(-2)!.close - 1;
  const state =
    ratio === null
      ? '无法判断'
      : ratio >= 2
        ? '量能异动（≥2倍）'
        : ratio >= 1.2
          ? '放量'
          : ratio <= 0.8
            ? '缩量'
            : '正常量能';
  const pairing =
    ratio === null
      ? '无有效量能基准'
      : priceChange > 0
        ? ratio >= 1.2
          ? '价涨量增：上涨得到量能配合'
          : ratio <= 0.8
            ? '价涨量缩：上涨确认偏弱'
            : '价涨量平'
        : priceChange < 0
          ? ratio >= 1.2
            ? '价跌量增：抛压增强'
            : ratio <= 0.8
              ? '价跌量缩：回落时交易活跃度下降'
              : '价跌量平'
          : '价格持平';
  return {
    ratio,
    state,
    pairing,
    ma5: avg(b.slice(-5).map((x) => x.volume)),
    ma10: avg(b.slice(-10).map((x) => x.volume)),
    ma20: avg(b.slice(-20).map((x) => x.volume)),
  };
}
export function technicalLevels(b: Bar[]) {
  const tail = b.slice(-60);
  if (tail.length < 2) return null;
  const high = Math.max(...tail.map((x) => x.high)),
    low = Math.min(...tail.map((x) => x.low));
  const gaps = [];
  for (let i = Math.max(1, b.length - 60); i < b.length; i++) {
    const p = b[i - 1],
      c = b[i],
      after = b.slice(i);
    if (c.low > p.high && after.every((x) => x.low > p.high))
      gaps.push({
        date: c.date,
        side: '向上缺口',
        low: p.high,
        high: Math.min(...after.map((x) => x.low)),
      });
    if (c.high < p.low && after.every((x) => x.high < p.low))
      gaps.push({
        date: c.date,
        side: '向下缺口',
        low: Math.max(...after.map((x) => x.high)),
        high: p.low,
      });
  }
  return {
    high,
    low,
    fib: [0.236, 0.382, 0.5, 0.618, 0.786].map((r) => ({
      ratio: r,
      price: high - (high - low) * r,
    })),
    gaps: gaps.slice(-3),
  };
}
