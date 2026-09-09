import { indicators, type Series } from './engine.ts';
import { volumeSummary } from './volume.ts';
export function tradeGuidance(series: Series, now = new Date()) {
  const { completed: bars, ratio } = volumeSummary(series.bars, now, series.assetClass === 'crypto' ? 'UTC' : 'America/New_York');
  if (bars.length < 61) return null;
  const last = bars.at(-1)!;
  const prior = bars.slice(-61, -1);
  const high20 = Math.max(...prior.slice(-20).map((b) => b.high));
  const low20 = Math.min(...prior.slice(-20).map((b) => b.low));
  const high60 = Math.max(...prior.map((b) => b.high));
  const low60 = Math.min(...prior.map((b) => b.low));
  const raw = [
    { price: low20, label: '前20日低点' },
    { price: low60, label: '前60日低点' },
    { price: high20, label: '前20日高点' },
    { price: high60, label: '前60日高点' },
  ];
  const levels = raw.filter(
    (l, i) => raw.findIndex((x) => x.price === l.price) === i,
  );
  const supports = levels
    .filter((l) => l.price < last.close)
    .sort((a, b) => b.price - a.price);
  const resistances = levels
    .filter((l) => l.price > last.close)
    .sort((a, b) => a.price - b.price);
  const trs = bars
    .slice(1)
    .map((b, i) =>
      Math.max(
        b.high - b.low,
        Math.abs(b.high - bars[i].close),
        Math.abs(b.low - bars[i].close),
      ),
    );
  let atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (const tr of trs.slice(14)) atr = (atr * 13 + tr) / 14;
  const ind = indicators(bars).at(-1)!;
  const uptrend = last.close > ind.ma20! && ind.ma20! > ind.ma50!;
  const breakdown = last.close < low20;
  const breakout = last.close > high20;
  const bounce =
    !!supports[0] &&
    last.low >= supports[0].price - 0.5 * atr &&
    last.low <= supports[0].price + 0.5 * atr &&
    last.close > bars.at(-2)!.close &&
    last.close > last.open;
  const stop = Math.max(
    0.01,
    (supports[0]?.price ?? last.close - 1.5 * atr) - 0.5 * atr,
  );
  const risk = last.close - stop;
  const target = resistances[0]?.price ?? last.close + 2 * risk;
  const rewardRisk = risk > 0 ? (target - last.close) / risk : null;
  const stale =
    (now.getTime() - new Date(last.date + 'T00:00:00Z').getTime()) / 86400000 >
    (series.assetClass === 'crypto' ? 2 : 7);
  const demo = /合成|演示/.test(series.source);
  const eligible = !stale && !demo && atr > 0;
  const checks = [
    { label: '收盘价 > MA20 > MA50', pass: uptrend },
    { label: '突破前20日高点，或支撑附近反弹收阳', pass: breakout || bounce },
    {
      label: '成交量 ≥ 前20日均量的1.2倍',
      pass: ratio !== null && ratio >= 1.2,
    },
    {
      label: 'RSI14 < 70，避免过热追价',
      pass: ind.rsi !== null && ind.rsi < 70,
    },
    {
      label: '参考目标收益 / 止损风险 ≥ 2',
      pass: rewardRisk !== null && rewardRisk >= 2 - 1e-9,
    },
  ];
  const buy = eligible && !breakdown && checks.every((c) => c.pass);
  const sell =
    eligible && (breakdown || (last.close < ind.ma50! && ind.hist! < 0));
  const state = !eligible
    ? '仅供观察'
    : sell
      ? '持仓减仓 / 退出观察'
      : buy
        ? '买入观察条件成立'
        : '等待，不追价';
  const reason = demo
    ? '合成演示数据，不生成真实交易建议。'
    : stale
      ? '日线已过期，请更新行情。'
      : atr === 0
        ? '无波动样本，无法建立风险计划。'
        : breakdown
          ? '收盘跌破前20日低点，原支撑失效。'
          : sell
            ? '收盘低于MA50且MACD柱为负，趋势转弱。'
            : buy
              ? '筛选条件同时满足；下一交易时段仍需重新核对成交价。'
              : '买入条件尚未全部满足；持仓结合止损线与压力位管理。';
  return {
    bars,
    last,
    high20,
    low20,
    high60,
    low60,
    supports,
    resistances,
    atr,
    ind,
    ratio,
    stop,
    target,
    rewardRisk,
    checks,
    state,
    reason,
    eligible,
    buy,
    sell,
    breakout,
    breakdown,
  };
}
