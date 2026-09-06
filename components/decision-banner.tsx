'use client';
import type { Series } from '@/lib/engine';
import { tradeGuidance } from '@/lib/trade-guidance';
const price = (n: number) => '$' + n.toFixed(2);

export default function DecisionBanner({
  series,
  onDetails,
  riskBlock = '',
}: {
  series: Series;
  onDetails: () => void;
  riskBlock?: string;
}) {
  const g = tradeGuidance(series);
  const valid = !!g?.eligible;
  const entry = riskBlock
    ? '暂停新仓'
    : !valid
      ? '暂时观察'
      : g.buy
        ? '可考虑买入'
        : '暂时观察';
  const holding = !valid
    ? '暂不判断'
    : g.sell
      ? g.breakdown
        ? '考虑卖出'
        : '考虑减仓'
      : '继续持有';
  return (
    <section
      className="decisionBanner"
      aria-label={`${series.symbol} 操作建议`}
    >
      <div className="sectionTitle">
        <div>
          <small>先看结论 · {series.symbol}</small>
          <h2>现在该怎么做？</h2>
        </div>
        <button className="secondary" onClick={onDetails}>
          查看支撑压力与完整依据 →
        </button>
      </div>
      <div className="decisionGrid">
        <article className="decisionCard">
          <small>还没买入 · 空仓</small>
          <h3
            style={{
              color: valid && g.buy && !riskBlock ? '#54d6a0' : '#e8bb66',
            }}
          >
            {entry}
          </h3>
          {riskBlock && (
            <p role="status">
              <b>风控优先：{riskBlock}。</b>{' '}
              下方技术条件即使满足，也先不新开仓。账户参数在“首页 ·
              大盘与风控”中的风控计算器调整。
            </p>
          )}
          <p>
            {!g
              ? '完整日线不足61根，先加载更多历史行情。'
              : !valid
                ? g.reason
                : riskBlock
                  ? '先解除上方风控阻断，再评估技术买入条件。'
                  : g.buy
                    ? '买入筛选条件全部满足，可考虑分批建立仓位；成交前重新核对价格与风险收益。'
                    : g.sell
                      ? '趋势出现退出信号，暂不新开多仓。'
                      : '买入条件未全部满足，等待量价确认。'}
          </p>
          {valid && g && (
            <>
              <h4>买入时机</h4>
              <p>
                收盘突破 <b>{price(g.high20)}</b>，或在支撑{' '}
                {g.supports[0] ? (
                  <b>{price(g.supports[0].price)}</b>
                ) : (
                  '（暂无下方历史价位）'
                )}{' '}
                附近反弹收阳；同时满足趋势、放量、RSI和收益风险条件。
              </p>
              <p className="fineprint">
                {g.buy
                  ? '技术筛选条件已满足（仍须通过风控）。'
                  : '尚未满足：' +
                    g.checks
                      .filter((c) => !c.pass)
                      .map((c) => c.label)
                      .join('；')}
                {g.buy
                  ? ` 假设按 ${price(g.last.close)} 入场，止损参考 ${price(g.stop)}，目标参考 ${price(g.target)}。`
                  : ''}
              </p>
            </>
          )}
        </article>
        <article className="decisionCard">
          <small>已经买入 · 持有多仓</small>
          <h3
            style={{
              color: !valid ? '#e8bb66' : g.sell ? '#f27991' : '#54d6a0',
            }}
          >
            {holding}
          </h3>
          <p>
            {!valid
              ? '当前数据不足、过期或为演示，无法据此判断持有或卖出。'
              : g.sell
                ? g.reason
                : '尚未触发本规则的退出条件，可继续持有并跟踪支撑；这不等于建议继续加仓。'}
          </p>
          {valid && g && (
            <>
              <h4>什么时候卖出</h4>
              <p>
                收盘跌破 <b>{price(g.low20)}</b>：考虑卖出；或收盘低于 MA50{' '}
                <b>{price(g.ind.ma50!)}</b> 且 MACD柱为负：考虑减仓。
              </p>
              <p>
                {g.resistances[0] ? (
                  <>
                    上方压力 <b>{price(g.resistances[0].price)}</b>
                    ：若上涨受阻，可评估分批止盈。
                  </>
                ) : (
                  '上方暂无所观察历史压力位，继续跟踪退出条件。'
                )}
              </p>
            </>
          )}
        </article>
      </div>
      <p className="fineprint">
        {series.source}
        {g
          ? ` · 日线截至 ${g.last.date} · 判断参考收盘 ${price(g.last.close)}`
          : ''}
        。以上分别回答空仓和持仓情景，不代表已读取你的真实持仓。日线规则提示未结合你的成本与期限，尚未作为完整组合策略回测；不保证收益、不自动下单。
      </p>
    </section>
  );
}
