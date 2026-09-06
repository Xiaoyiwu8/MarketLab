import type { Series } from './engine.ts';
import { tradeGuidance } from './trade-guidance.ts';
export function shortGuidance(series: Series, now = new Date()) {
  const g = tradeGuidance(series, now);
  if (!g) return null;
  const price = g.last.close,
    resistance = g.resistances[0]?.price;
  const reject =
    resistance !== undefined &&
    g.last.high >= resistance - 0.5 * g.atr &&
    g.last.high <= resistance + 0.5 * g.atr &&
    price < g.last.open &&
    price < g.bars.at(-2)!.close;
  const stop = (resistance ?? price + 1.5 * g.atr) + 0.5 * g.atr;
  const risk = stop - price,
    target = g.supports[0]?.price ?? Math.max(0.01, price - 2 * risk),
    rr = risk > 0 ? (price - target) / risk : null;
  const checks = [
    {
      label: '收盘价 < MA20 < MA50，空头趋势',
      pass: price < g.ind.ma20! && g.ind.ma20! < g.ind.ma50!,
    },
    {
      label: '跌破前20日低点，或反弹至压力区后收阴回落',
      pass: g.breakdown || reject,
    },
    {
      label: '成交量至少为前20日均量1.2倍',
      pass: g.ratio !== null && g.ratio >= 1.2,
    },
    {
      label: 'RSI14 > 30，避免超卖区追空',
      pass: g.ind.rsi !== null && g.ind.rsi > 30,
    },
    { label: 'MACD柱为负', pass: g.ind.hist !== null && g.ind.hist < 0 },
    { label: '参考收益 / 风险 ≥ 2', pass: rr !== null && rr >= 2 - 1e-9 },
  ];
  const cover =
    g.eligible &&
    (price > g.high20 || (price > g.ind.ma50! && g.ind.hist! > 0));
  const enter = g.eligible && !cover && checks.every((c) => c.pass);
  return {
    g,
    checks,
    stop,
    target,
    rr,
    cover,
    enter,
    label: !g.eligible
      ? '暂无有效判断'
      : cover
        ? '回补观察'
        : enter
          ? '做空观察条件成立'
          : '等待，不追空',
  };
}
