'use client';
import { useState } from 'react';
import { backtest, defaultParams, type Series } from '@/lib/engine';
import { volumeSummary } from '@/lib/volume';
export default function SensitivityPanel({ series }: { series: Series }) {
  const [rows, setRows] = useState<
      { fast: number; slow: number; result: ReturnType<typeof backtest> }[]
    >([]),
    [error, setError] = useState('');
  function run() {
    try {
      setError('');
      const bars = volumeSummary(series.bars).completed;
      if (bars.length < 160) throw Error('至少需要160根完整日线');
      const cfg = {
        initial: 100000,
        allocation: 0.2,
        feeBps: 5,
        slippageBps: 5,
        stop: 0.08,
        maxDrawdown: 0.15,
        start: bars[Math.max(105, bars.length - 252)].date,
        end: bars.at(-1)!.date,
      };
      setRows(
        [
          [10, 30],
          [20, 50],
          [30, 100],
        ].map(([fast, slow]) => ({
          fast,
          slow,
          result: backtest(bars, 'trend', cfg, {
            ...defaultParams,
            fast,
            slow,
          }),
        })),
      );
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>趋势策略参数敏感性 · {series.symbol}</h2>
        <button onClick={run}>对比三组均线参数</button>
      </div>
      <p>
        相同样本（最多最近252日）、初始10万美元、仓位20%、手续费/滑点各5基点、止损8%、回撤熔断15%。以相同起始日比较10/30、20/50、30/100日均线，不自动选择最优参数。
      </p>
      {error && <p role="status">{error}</p>}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {[
                '均线',
                '收益',
                '夏普',
                '最大回撤',
                '胜率',
                '盈亏比',
                '已平仓交易',
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ fast, slow, result: r }) => (
              <tr key={fast}>
                <td>
                  {fast}/{slow}
                </td>
                <td>{(r.total * 100).toFixed(2)}%</td>
                <td>{r.sharpe?.toFixed(2) ?? '—'}</td>
                <td>{(r.maxDrawdown * 100).toFixed(2)}%</td>
                <td>
                  {r.winRate === null
                    ? '—'
                    : (r.winRate * 100).toFixed(2) + '%'}
                </td>
                <td>
                  {r.payoff === null
                    ? '—'
                    : Number.isFinite(r.payoff)
                      ? r.payoff.toFixed(2)
                      : '∞'}
                </td>
                <td>{r.closedTrades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fineprint">
        这是趋势策略的历史样本内对比，不是首页组合条件或大盘风控的完整回测。查看下方正式回测与数据中心可设置样本区间、导出交易和资金曲线。
      </p>
    </section>
  );
}
