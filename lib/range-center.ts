import type { Series } from './engine.ts';
import { volumeSummary } from './volume.ts';
export function rangeCenter(series: Series, window = 40, now = new Date()) {
  if (![20, 40, 60].includes(window)) return null;
  const { completed: bars, ratio } = volumeSummary(series.bars, now);
  if (bars.length < window + 1) return null;
  const prior = bars.slice(-window - 1, -1),
    last = bars.at(-1)!,
    previous = bars.at(-2)!;
  const low = Math.min(...prior.map((b) => b.low)),
    high = Math.max(...prior.map((b) => b.high)),
    width = high - low;
  if (width <= 0) return null;
  const sorted = prior.map((b) => b.close).sort((a, b) => a - b),
    center = (sorted[window / 2 - 1] + sorted[window / 2]) / 2;
  const path = prior
    .slice(1)
    .reduce((s, b, i) => s + Math.abs(b.close - prior[i].close), 0);
  const efficiency =
    path > 0 ? Math.abs(prior.at(-1)!.close - prior[0].close) / path : 0;
  const average = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
  const drift =
    Math.abs(
      average(prior.slice(-10).map((b) => b.close)) -
        average(prior.slice(0, 10).map((b) => b.close)),
    ) / width;
  const lowerZone = low + 0.2 * width,
    upperZone = high - 0.2 * width;
  // Count separated visits, rather than treating consecutive bars as independent tests.
  function visits(test: (b: typeof last) => boolean) {
    let n = 0,
      inside = false;
    for (const b of prior) {
      const hit = test(b);
      if (hit && !inside) n++;
      inside = hit;
    }
    return n;
  }
  const lowerVisits = visits((b) => b.low <= lowerZone),
    upperVisits = visits((b) => b.high >= upperZone);
  const checks = [
    { label: '方向效率≤0.35（越低越反复）', pass: efficiency <= 0.35 },
    { label: '前后10日均价偏移≤区间宽度30%', pass: drift <= 0.3 },
    {
      label: '上下沿各至少2次分开的接近',
      pass: lowerVisits >= 2 && upperVisits >= 2,
    },
    { label: '区间宽度≤中枢价格20%', pass: width / center <= 0.2 },
  ];
  const qualified = checks.every((c) => c.pass),
    above = last.close > high,
    below = last.close < low;
  const fresh =
    now.getTime() - Date.parse(last.date) < 7 * 86400000 &&
    !/合成|演示/.test(series.source);
  const active = qualified && !above && !below && fresh;
  const trs = bars.slice(-14).map((b, i) => {
    const p = bars[bars.length - 15 + i]?.close ?? b.open;
    return Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p));
  });
  const atr = average(trs),
    stop = Math.max(0.01, low - 0.5 * atr);
  const zone =
    last.close <= lowerZone
      ? '靠近下沿'
      : last.close >= upperZone
        ? '靠近上沿'
        : '中枢附近';
  const rebound = last.close > previous.close && last.close > last.open;
  const status = !fresh
    ? '历史观察，需更新真实行情'
    : !qualified
      ? '尚未确认震荡区间'
      : above
        ? '向上突破，原区间失效'
        : below
          ? '向下跌破，原区间失效'
          : '震荡区间候选';
  const advice = !active
    ? '暂停按区间低买高卖判断'
    : zone === '靠近下沿'
      ? rebound
        ? '下沿出现反弹，进入买点观察；仍需策略与风控确认'
        : '下沿买点观察：等待收阳并高于前收盘'
      : zone === '靠近上沿'
        ? '上沿止盈观察：已有多仓可评估分批兑现，避免追涨'
        : '价格接近中枢，等待靠近边界或有效突破';
  return {
    prior,
    last,
    low,
    high,
    width,
    center,
    efficiency,
    drift,
    lowerVisits,
    upperVisits,
    checks,
    qualified,
    active,
    above,
    below,
    lowerZone,
    upperZone,
    atr,
    stop,
    zone,
    rebound,
    status,
    advice,
    ratio,
    position: (last.close - low) / width,
    window,
  };
}
