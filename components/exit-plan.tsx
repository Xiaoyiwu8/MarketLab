'use client';
import { useEffect, useState } from 'react';
import type { Series } from '@/lib/engine';
import { tradeGuidance } from '@/lib/trade-guidance';
import { shortGuidance } from '@/lib/short-guidance';
export default function ExitPlan({ series }: { series: Series }) {
  const [side, setSide] = useState('long'),
    [entry, setEntry] = useState(0),
    [stop, setStop] = useState(0),
    [target, setTarget] = useState(0),
    [qty, setQty] = useState(0);
  const g = tradeGuidance(series),
    short = shortGuidance(series);
  useEffect(() => {
    const a = tradeGuidance(series),
      s = shortGuidance(series);
    setEntry(a?.last.close ?? 0);
    setStop(side === 'long' ? (a?.stop ?? 0) : (s?.stop ?? 0));
    setTarget(side === 'long' ? (a?.target ?? 0) : (s?.target ?? 0));
    setQty(0);
  }, [series.symbol, series.asOf, series.source, side]);
  const sign = side === 'long' ? 1 : -1,
    risk = (entry - stop) * sign,
    reward = (target - entry) * sign;
  const valid =
    [entry, stop, target, qty].every(Number.isFinite) &&
    entry > 0 &&
    stop > 0 &&
    target > 0 &&
    risk > 0 &&
    reward > 0 &&
    qty >= 0 &&
    Number.isInteger(qty);
  const price = g?.last.close ?? 0,
    stopHit = g?.eligible && valid && (price - stop) * sign <= 0,
    targetHit = g?.eligible && valid && (price - target) * sign >= 0;
  const f = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
  return (
    <section className="panel" style={{ border: '2px solid #e8bb66' }}>
      <div className="sectionTitle">
        <h2>{series.symbol} · 止盈 / 止损计划</h2>
        <strong>
          {!g?.eligible
            ? '仅供观察'
            : stopHit
              ? '收盘已越过止损：优先退出评估'
              : targetHit
                ? '收盘已到止盈：评估分批兑现'
                : '跟踪止盈与止损条件'}
        </strong>
      </div>
      <p>
        默认以最新完整日收盘作新开仓预案。已有仓位请填写真实平均成本和股数，并核对原先止损；切换股票或方向会重置为新预案。
      </p>
      <div className="formgrid">
        <label>
          持仓方向
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="long">多头：卖出止损 / 止盈</option>
            <option value="short">空头：买入回补止损 / 止盈</option>
          </select>
        </label>
        {[
          ['成本 / 参考入场 USD', entry, setEntry],
          ['止损价 USD', stop, setStop],
          ['止盈价 USD', target, setTarget],
          ['实际股数（0=仅每股预案）', qty, setQty],
        ].map(([label, v, setter]) => (
          <label key={String(label)}>
            {String(label)}
            <input
              type="number"
              min="0"
              step="0.01"
              value={Number(v)}
              onChange={(e) =>
                (setter as (v: number) => void)(e.target.valueAsNumber)
              }
            />
          </label>
        ))}
      </div>
      {!valid ? (
        <p role="alert">
          请填写有效参数：多头止损&lt;成本&lt;止盈；空头止盈&lt;成本&lt;止损；股数须为非负整数。
        </p>
      ) : (
        <>
          <div className="metrics">
            {[
              ['止损建议', '$' + f(stop), `每股风险 $${f(risk)}`],
              ['止盈建议', '$' + f(target), `每股潜在收益 $${f(reward)}`],
              [
                '收益 / 风险',
                f(reward / risk) + ' : 1',
                reward / risk < 2
                  ? '低于2:1，不满足本工具新仓收益风险筛选'
                  : '达到2:1参考门槛',
              ],
              [
                '按填写股数估算',
                qty > 0 ? `风险 $${f(qty * risk)}` : '请填实际股数',
                qty > 0 ? `目标收益 $${f(qty * reward)}` : '尚未计算总金额',
              ],
            ].map(([a, b, c]) => (
              <div className="metric" key={a}>
                <small>{a}</small>
                <strong style={{ fontSize: 23 }}>{b}</strong>
                <small>{c}</small>
              </div>
            ))}
          </div>
          <p>
            跟踪节点：1R价位 ${f(entry + sign * risk)}；2R价位 $
            {f(entry + sign * 2 * risk)}
            （仅在价格为正时有意义）。接近预设止盈可评估分批兑现；是否移动止损需重新评估波动与费用，不能假设移到成本就保证不亏。
          </p>
        </>
      )}
      <details>
        <summary>默认价位依据与执行方式</summary>
        <p>
          多头：最近下方历史价位减0.5
          ATR作止损，最近上方压力作目标；空头：最近上方价位加0.5
          ATR作止损，最近下方支撑作目标。无对应历史价位时采用2
          ATR止损距离、2R目标情景（目标保持正数），不是价格预测。手动改成本后不会擅自放宽止损。
        </p>
        <p>
          多头跌至止损时卖出平仓；空头涨至止损时买入回补。状态提示只比较最新完整日收盘，不代表盘中触发记录或已成交。止损价不保证成交，跳空、滑点、费用会改变实际损益；空头还涉及借券费用与逼空风险。
        </p>
      </details>
      <p className="fineprint">
        {series.source} · {g?.last.date ?? '缺少日线'} ·
        计划不会自动提交券商订单，也不会自动改动模拟持仓的止损。填写参数只保留在当前页面会话。
      </p>
    </section>
  );
}
