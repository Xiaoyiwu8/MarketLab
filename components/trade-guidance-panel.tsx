'use client';
import type { Series } from '@/lib/engine';
import { tradeGuidance } from '@/lib/trade-guidance';
const money = (v: number | undefined) =>
  v === undefined ? '暂无历史价位' : '$' + v.toFixed(2);
export default function TradeGuidancePanel({ series }: { series: Series }) {
  const g = tradeGuidance(series);
  if (!g)
    return (
      <section className="panel">
        <h2>支撑、压力与买卖提示</h2>
        <p>至少需要61根完整日线，请先加载更多历史行情。</p>
      </section>
    );
  const bars = g.bars.slice(-60);
  const lo = Math.min(...bars.map((b) => b.low), g.low60) * 0.995;
  const hi = Math.max(...bars.map((b) => b.high), g.high60) * 1.005;
  const y = (p: number) => 205 - ((p - lo) / (hi - lo)) * 175;
  const levels = [
    { label: '20日低点', price: g.low20, color: '#54d6a0' },
    { label: '20日高点', price: g.high20, color: '#f27991' },
  ];
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>{series.symbol} · 支撑、压力与买卖提示</h2>
        <small>日线波段 · 截至 {g.last.date}</small>
      </div>
      <p className="fineprint">
        {series.source} · {series.adjustment} · 以完整日线收盘{' '}
        {money(g.last.close)}{' '}
        判断，不混用盘中报价。历史价位是参考区域，突破后可能转为反向作用。
      </p>
      <div className="metrics">
        {[
          [
            '最近支撑',
            money(g.supports[0]?.price),
            g.supports[0]?.label ?? '当前收盘下方无所观察历史价位',
          ],
          [
            '最近压力',
            money(g.resistances[0]?.price),
            g.resistances[0]?.label ?? '当前收盘上方无所观察历史价位',
          ],
          ['ATR14 波动幅度', money(g.atr), '参考区域：价位上下各0.5 ATR'],
          ['当前提示', g.state, g.reason],
        ].map(([a, b, c]) => (
          <div className="metric" key={a}>
            <small>{a}</small>
            <strong style={{ fontSize: a === '当前提示' ? 19 : undefined }}>
              {b}
            </strong>
            <small>{c}</small>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 940 245"
        role="img"
        aria-label="最近60日收盘价与前20日高低点参考线"
        style={{ width: '100%' }}
      >
        <polyline
          points={bars
            .map(
              (b, i) => `${70 + (i * 670) / (bars.length - 1)},${y(b.close)}`,
            )
            .join(' ')}
          fill="none"
          stroke="#8da3ff"
          strokeWidth="2"
        />
        {levels.map((l) => (
          <g key={l.label}>
            <line
              x1="65"
              x2="750"
              y1={y(l.price)}
              y2={y(l.price)}
              stroke={l.color}
              strokeDasharray="5 4"
            />
            <text x="760" y={y(l.price)} fill={l.color} fontSize="12">
              {l.label} {money(l.price)}
            </text>
          </g>
        ))}
        <text x="65" y="233" fill="#a0b0c5" fontSize="12">
          {bars[0].date}
        </text>
        <text x="740" y="233" textAnchor="end" fill="#a0b0c5" fontSize="12">
          {g.last.date}
        </text>
      </svg>
      <p className="fineprint">
        水平线为截至分析日计算的参考线，并非历史各日已知的交易信号。60日低点{' '}
        {money(g.low60)}；60日高点 {money(g.high60)}。最新收盘
        {g.breakout
          ? '已突破20日高点'
          : g.breakdown
            ? '已跌破20日低点'
            : '仍在20日高低区间内'}
        。
      </p>
      <div className="grid2">
        <div>
          <h3>买入参考 · 先核对条件</h3>
          {g.checks.map((c) => (
            <p key={c.label}>
              {c.pass ? '✓' : '○'} {c.label}
            </p>
          ))}
          <p>
            突破观察价：收盘高于 {money(g.high20)}
            。支撑反弹要求当日最低价位于最近支撑上下0.5
            ATR内，收盘高于前收盘且收阳。
          </p>
        </div>
        <div>
          <h3>持仓卖出与风险计划</h3>
          <p>
            收盘跌破 {money(g.low20)}（前20日低点），或收盘低于MA50（
            {money(g.ind.ma50!)}
            ）且MACD柱为负，触发减仓／退出观察。“卖出”指平多仓。
          </p>
          {g.eligible && !g.sell ? (
            <>
              <p>
                以收盘价 {money(g.last.close)} 作假设入场：保护止损参考{' '}
                {money(g.stop)}；目标参考 {money(g.target)}；收益／风险{' '}
                {g.rewardRisk?.toFixed(2) ?? '—'} : 1。
              </p>
              <p>
                {g.resistances.length
                  ? '目标取最近上方历史压力位，可观察是否分批止盈。'
                  : '上方无所观察历史压力位；目标为2倍风险的算术情景，不是预测压力位。'}
              </p>
            </>
          ) : (
            <p>当前不展示新增长仓计划；先更新真实行情或等待风险信号解除。</p>
          )}
          <p>
            止损参考为最近下方价位减0.5 ATR；无下方价位时取收盘减2
            ATR。跳空可能越过止损，成交价格与费用会改变风险收益。
          </p>
        </div>
      </div>
      <details>
        <summary>方法与使用边界</summary>
        <p>
          前20/60日高低点不含最新分析日；ATR14采用Wilder平滑。1.2倍成交量、RSI70、2:1风险收益是固定筛选参数，尚未作为完整组合策略回测，不代表胜率或盈利保证。仅分析当前股票，不能直接用于期权合约买卖。
        </p>
        <p>
          方法参考：
          <a
            href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/support-and-resistance?print=true-0"
            target="_blank"
            rel="noreferrer"
          >
            Fidelity 支撑与压力说明
          </a>
          。提示未结合个人成本、期限与风险承受能力，不会自动下单。
        </p>
      </details>
    </section>
  );
}
