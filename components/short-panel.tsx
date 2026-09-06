'use client';
import type { Series } from '@/lib/engine';
import { shortGuidance } from '@/lib/short-guidance';
const p = (n: number) => '$' + n.toFixed(2);
export default function ShortPanel({ series }: { series: Series }) {
  const s = shortGuidance(series);
  return (
    <section className="panel" style={{ border: '1px solid #f27991' }}>
      <div className="sectionTitle">
        <h2>{series.symbol} · 做空与回补指示</h2>
        <strong style={{ color: '#f27991', fontSize: 23 }}>
          {s?.label ?? '历史样本不足'}
        </strong>
      </div>
      {!s ? (
        <p>至少需要61根完整日线。</p>
      ) : (
        <>
          <div className="decisionGrid">
            <div>
              <h3>尚未做空</h3>
              <p>
                {!s.g.eligible
                  ? s.g.reason
                  : s.enter
                    ? '空头技术筛选全部满足；仍须独立确认券源、保证金与账户风险，尚不代表可执行订单。'
                    : '当前不满足全部做空条件，不因股价下跌就追空。'}
              </p>
              <p>
                跌破观察价：收盘低于 <b>{p(s.g.low20)}</b>
                ；或在上方压力附近反弹失败。
              </p>
              <details>
                <summary>查看做空条件及理由</summary>
                {s.checks.map((c) => (
                  <p key={c.label}>
                    {c.pass ? '✓' : '○'} {c.label}
                  </p>
                ))}
              </details>
            </div>
            <div>
              <h3>已经持有空仓</h3>
              <p>
                {!s.g.eligible
                  ? '数据不可用，暂不判断。'
                  : s.cover
                    ? '出现回补信号，考虑买入回补空仓。'
                    : '尚未触发本规则回补条件；继续跟踪原开仓止损，不能据此扩大空仓。'}
              </p>
              <p>
                收盘突破前20日高点 <b>{p(s.g.high20)}</b>，或收盘高于MA50{' '}
                <b>{p(s.g.ind.ma50!)}</b>{' '}
                且MACD柱为正：回补观察。触及你原定止损时优先控制损失。
              </p>
            </div>
          </div>
          {s.g.eligible && !s.cover && (
            <p>
              新开空仓情景（不是已有仓位的止损）：以 {p(s.g.last.close)}{' '}
              为参考入场，保护买入止损 {p(s.stop)}，下方目标 {p(s.target)}
              ，参考收益风险比 {s.rr?.toFixed(2) ?? '—'} : 1。
              {s.g.supports.length
                ? '目标取下方最近历史支撑。'
                : '下方无历史支撑，目标是2R算术情景并以正价格为下限。'}
            </p>
          )}
          <p className="fineprint">
            {series.source} · 日线截至 {s.g.last.date} ·
            做空是借股卖出，回补是买入平空；“卖出多仓”不等于做空。止损取上方压力加0.5
            ATR，无上方压力时取入场加2
            ATR；未计借券费、保证金、滑点和强制回补。股价上涨会使做空损失超过投入资金，止损不能保证成交价。此规则尚未完整回测，现有股票模拟账户仍仅支持多头。
          </p>
        </>
      )}
    </section>
  );
}
