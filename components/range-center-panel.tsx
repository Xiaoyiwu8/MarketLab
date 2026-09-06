'use client';
import { useState } from 'react';
import type { Series } from '@/lib/engine';
import { rangeCenter } from '@/lib/range-center';
const price = (n: number) => '$' + n.toFixed(2);
export default function RangeCenterPanel({ series }: { series: Series }) {
  const [window, setWindow] = useState(40),
    r = rangeCenter(series, window);
  const points = r ? [...r.prior, r.last] : [];
  const min = r ? Math.min(r.low, r.last.low) * 0.995 : 0,
    max = r ? Math.max(r.high, r.last.high) * 1.005 : 1,
    y = (p: number) => 200 - ((p - min) / (max - min)) * 170;
  return (
    <section className="panel" style={{ border: '2px solid #8da3ff' }}>
      <div className="sectionTitle">
        <h2>{series.symbol} · 震荡价格中枢</h2>
        <label>
          观察窗口
          <select
            value={window}
            onChange={(e) => setWindow(Number(e.target.value))}
          >
            {[20, 40, 60].map((n) => (
              <option key={n} value={n}>
                前{n}个交易日
              </option>
            ))}
          </select>
        </label>
      </div>
      {!r ? (
        <p>完整日线不足{window + 1}根或区间无有效宽度，暂不计算中枢。</p>
      ) : (
        <>
          <h3>{r.status}</h3>
          <div className="metrics">
            {[
              ['价格中枢', price(r.center), '窗口内收盘价中位数'],
              [
                '下沿买点观察带',
                `${price(r.low)}–${price(r.lowerZone)}`,
                '区间底部20%',
              ],
              [
                '上沿止盈观察带',
                `${price(r.upperZone)}–${price(r.high)}`,
                '区间顶部20%',
              ],
              [
                '当前区间位置',
                `${(r.position * 100).toFixed(1)}%`,
                r.position < 0
                  ? '已在下沿之外'
                  : r.position > 1
                    ? '已在上沿之外'
                    : r.zone,
              ],
            ].map(([a, b, c]) => (
              <div className="metric" key={a}>
                <small>{a}</small>
                <strong style={{ fontSize: 20 }}>{b}</strong>
                <small>{c}</small>
              </div>
            ))}
          </div>
          <p>
            <b>{r.advice}</b>
          </p>
          <svg
            viewBox="0 0 960 240"
            role="img"
            aria-label="历史收盘轨迹、震荡上下沿与收盘中位数中枢"
            style={{ width: '100%' }}
          >
            <rect
              x="55"
              width="680"
              y={y(r.lowerZone)}
              height={y(r.low) - y(r.lowerZone)}
              fill="#54d6a0"
              opacity=".16"
            />
            <rect
              x="55"
              width="680"
              y={y(r.high)}
              height={y(r.upperZone) - y(r.high)}
              fill="#f27991"
              opacity=".16"
            />
            {[
              { name: '上沿', p: r.high, color: '#f27991' },
              { name: '中枢', p: r.center, color: '#e8bb66' },
              { name: '下沿', p: r.low, color: '#54d6a0' },
            ].map((l) => (
              <g key={l.name}>
                <line
                  x1="55"
                  x2="735"
                  y1={y(l.p)}
                  y2={y(l.p)}
                  stroke={l.color}
                  strokeDasharray="5 4"
                />
                <text x="748" y={y(l.p) + 4} fill={l.color} fontSize="13">
                  {l.name} {price(l.p)}
                </text>
              </g>
            ))}
            <polyline
              points={points
                .map(
                  (b, i) =>
                    `${55 + (i * 680) / (points.length - 1)},${y(b.close)}`,
                )
                .join(' ')}
              fill="none"
              stroke="#8da3ff"
              strokeWidth="2"
            />
            <circle cx="735" cy={y(r.last.close)} r="4" fill="#fff" />
            <text x="55" y="228" fill="#a0b0c5" fontSize="12">
              {r.prior[0].date}
            </text>
            <text x="735" y="228" textAnchor="end" fill="#a0b0c5" fontSize="12">
              {r.last.date} 收盘 {price(r.last.close)}
            </text>
          </svg>
          {r.active && (
            <p>
              下沿新开多仓预案：保护止损参考 <b>{price(r.stop)}</b>
              （下沿减0.5倍14日平均真实波幅）；第一观察目标为中枢{' '}
              <b>{price(r.center)}</b>，再观察上沿 <b>{price(r.high)}</b>
              。仅当入场价低于目标、收益风险比达标且首页风控通过时才进一步评估，不是自动买入建议。
            </p>
          )}
          <p>
            失效条件：完整日线收盘高于 {price(r.high)} 或低于 {price(r.low)}
            ，立即停止按旧区间操作；最新量比{' '}
            {r.ratio === null ? '未知' : r.ratio.toFixed(2) + '×'}
            ，放量可辅助观察突破，但缩量突破也不会被视为仍在区间内。
          </p>
          <details>
            <summary>震荡识别依据、样本与限制</summary>
            {r.checks.map((c) => (
              <p key={c.label}>
                {c.pass ? '✓' : '○'} {c.label}
              </p>
            ))}
            <p>
              方向效率 {r.efficiency.toFixed(2)}；均价漂移占区间宽度{' '}
              {(r.drift * 100).toFixed(1)}%；下沿/上沿分开接近次数{' '}
              {r.lowerVisits}/{r.upperVisits}。上下沿取前{window}
              日最低/最高价，中枢取收盘中位数，均不含最新分析日，因此可检测最新收盘突破。
            </p>
            <p>
              本功能是滚动箱体观察，不是缠论中枢、成交密集区或逐笔成交量分布。图上水平线按当前窗口计算，不能倒推为历史上已知的信号；调整窗口会改变结果。这组区间规则尚未完整回测，不能保证低买高卖有效。
            </p>
          </details>
          <p className="fineprint">
            {series.source} · {series.adjustment} · 窗口 {r.prior[0].date} 至{' '}
            {r.prior.at(-1)!.date} · 分析日 {r.last.date}
            。演示/过期数据只作历史观察。本面板不会覆盖首页风控、止盈止损或自动下单。
          </p>
        </>
      )}
    </section>
  );
}
