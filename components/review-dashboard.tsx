'use client';
import { useEffect, useState } from 'react';
import type { Series } from '@/lib/engine';
import { volumeSummary } from '@/lib/volume';
import {
  bullBear,
  trend,
  weeks,
  relative,
  positionSize,
  volumeRead,
  technicalLevels,
} from '@/lib/review';
import { tradeGuidance } from '@/lib/trade-guidance';
import { LineChart } from './lab-charts';
const f = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2));
const benchmarks = [
  ['QQQ', '纳斯达克100'],
  ['SPY', '标普500'],
  ['DIA', '道琼斯工业'],
  ['SOXQ', '费城半导体'],
];
const choices: Record<string, string> = {
  SMH: '半导体',
  AIQ: 'AI主题',
  IGV: '软件',
  XLE: '能源',
  XLF: '金融',
  XLU: '公用事业',
  XOP: '油气开采',
};
const known: Record<string, string> = {
  NVDA: 'SMH',
  AMD: 'SMH',
  MU: 'SMH',
  AVGO: 'SMH',
  TSM: 'SMH',
  INTC: 'SMH',
  MSFT: 'IGV',
  CRM: 'IGV',
  ORCL: 'IGV',
  PLTR: 'IGV',
  ADBE: 'IGV',
  XOM: 'XLE',
  CVX: 'XLE',
  JPM: 'XLF',
  BAC: 'XLF',
};
export default function ReviewDashboard({
  series,
  onRisk,
}: {
  series: Series;
  onRisk: (state: { symbol: string; reason: string }) => void;
}) {
  const [data, setData] = useState<Series[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [sector, setSector] = useState(known[series.symbol] ?? '');
  useEffect(() => setSector(known[series.symbol] ?? ''), [series.symbol]);
  async function refresh(signal?: AbortSignal) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'tencent',
          symbols: [...benchmarks.map((x) => x[0]), ...Object.keys(choices)],
        }),
        signal,
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error ?? '市场行情失败');
      setData(d.results.filter((s: any) => !s.error));
      const failed = d.results.filter((s: any) => s.error);
      if (failed.length)
        setError('缺失行情：' + failed.map((s: any) => s.symbol).join('、'));
    } catch (e) {
      if (!signal?.aborted) {
        setData([]);
        setError((e as Error).message);
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const c = new AbortController();
    void refresh(c.signal);
    return () => c.abort();
  }, []);
  const bars = volumeSummary(series.bars).completed,
    vol = volumeRead(bars),
    g = tradeGuidance(series),
    levels = technicalLevels(bars);
  const weekly = weeks(bars),
    dt = trend(bars, 20),
    wt = trend(weekly, 10);
  const macro = benchmarks.map(([symbol, name]) => {
    const s = data.find((x) => x.symbol === symbol),
      b = s ? volumeSummary(s.bars).completed : [];
    const last = b.at(-1);
    const stale = !last || Date.now() - Date.parse(last.date) > 7 * 86400000;
    return {
      symbol,
      name,
      b,
      last,
      trend: trend(b, 50),
      regime: bullBear(b),
      five: b.length >= 6 ? b.at(-1)!.close / b.at(-6)!.close - 1 : null,
      valid: !stale && b.length >= 55,
    };
  });
  const all =
    macro.every((m) => m.valid) &&
    new Set(macro.map((m) => m.last!.date)).size === 1;
  const marketRegime =
    !all || macro.some((m) => m.regime.score === null)
      ? '数据不足'
      : macro.filter((m) => m.regime.label === '牛市倾向').length >= 3
        ? '牛市倾向'
        : macro.filter((m) => m.regime.label === '熊市倾向').length >= 3
          ? '熊市倾向'
          : '震荡 / 牛熊过渡';
  const individualRegime = bullBear(bars);
  const up = macro.filter((m) => m.valid && m.trend.label === '上升').length,
    down = macro.filter((m) => m.valid && m.trend.label === '下降').length;
  const marketState = !all
    ? '数据不足 / 日期不齐'
    : up >= 3
      ? '偏强'
      : down >= 3
        ? '偏弱'
        : '分化';
  const [capital, setCapital] = useState(100000),
    [cash, setCash] = useState(100000),
    [risk, setRisk] = useState(0.5),
    [cap, setCap] = useState(10),
    [dd, setDd] = useState(0),
    [limit, setLimit] = useState(10),
    [stop, setStop] = useState(g?.stop ?? 0);
  useEffect(
    () => setStop(tradeGuidance(series)?.stop ?? 0),
    [series.symbol, series.source, series.asOf],
  );
  const plan = positionSize(
    capital,
    bars.at(-1)?.close ?? 0,
    stop,
    risk,
    cap,
    cash,
    dd,
    limit,
  );
  const disabled =
    !g?.eligible || g.sell || plan?.halted || !all || marketState === '偏弱';
  const gate = !plan
    ? '仓位参数无效'
    : !g?.eligible
      ? '个股数据不足、过期或为演示'
      : g.sell
        ? '个股触发退出信号'
        : plan.halted
          ? '账户回撤触及限制'
          : !all
            ? '大盘数据缺失、过期或日期不齐'
            : marketState === '偏弱'
              ? '大盘趋势偏弱'
              : plan.shares === 0
                ? '风险预算或现金不足1股'
                : '';
  useEffect(() => {
    onRisk({ symbol: series.symbol, reason: gate });
  }, [onRisk, series.symbol, gate]);
  return (
    <>
      <section className="panel">
        <div className="sectionTitle">
          <h2>
            大盘牛熊：{marketRegime} · 近期趋势：{marketState}
          </h2>
          <button
            className="secondary"
            onClick={() => void refresh()}
            disabled={busy}
          >
            {busy ? '更新中…' : '刷新大盘'}
          </button>
        </div>
        {error && <p role="status">{error}</p>}
        <div className="metrics">
          {macro.map((m) => (
            <div className="metric" key={m.symbol}>
              <small>
                {m.name} · {m.symbol} ETF代理
              </small>
              <strong style={{ fontSize: 20 }}>
                {m.valid ? m.regime.label : '暂无有效判断'}
              </strong>
              <small>
                多头条件 {m.regime.score ?? '—'}/5 · MA50 {m.trend.label}
              </small>
              <small>
                5日 {f(m.five === null ? null : m.five * 100)}% ·{' '}
                {m.last?.date ?? '缺失'}
              </small>
            </div>
          ))}
        </div>
        <p>
          牛熊规则：4只代理ETF至少3只判为牛市倾向或熊市倾向，才给出同向大盘指示，否则为过渡。近期趋势另按MA50判断。这是技术状态分类，不是上涨概率、全市场情绪或期权PCR。
        </p>
        <details>
          <summary>走势与数据口径</summary>
          {macro
            .filter((m) => m.valid)
            .map((m) => (
              <div key={m.symbol}>
                <h3>
                  {m.name} · {m.symbol} 最近60日归一化走势
                </h3>
                <LineChart
                  series={[
                    {
                      name: m.symbol,
                      color: '#8da3ff',
                      values: m.b
                        .slice(-60)
                        .map((b) => (b.close / m.b.slice(-60)[0].close) * 100),
                    },
                  ]}
                  labels={m.b.slice(-60).map((b) => b.date)}
                />
              </div>
            ))}
          <p>
            QQQ代理纳斯达克100，并非纳斯达克综合指数；SPY/DIA/SOXQ分别代理标普500、道指和费城半导体。展示ETF价格变化，非指数点位或含分红总回报。
            <a
              href="https://www.invesco.com/us/en/financial-products/etfs/invesco-phlx-semiconductor-etf.html"
              target="_blank"
              rel="noreferrer"
            >
              SOXQ说明
            </a>
          </p>
        </details>
      </section>
      <section className="panel">
        <h2>{series.symbol} · 个股趋势与量价体检</h2>
        <h3>
          个股牛熊：{g?.eligible ? individualRegime.label : '仅供历史观察'} ·
          多头条件 {individualRegime.score ?? '—'}/5
        </h3>
        <details>
          <summary>牛熊判定依据与失效条件</summary>
          {individualRegime.checks.map((c) => (
            <p key={c.label}>
              {c.pass ? '✓' : '○'} {c.label}
            </p>
          ))}
          <p>
            MA200上升且多头条件≥4项：牛市倾向；MA200下降且多头条件≤1项：熊市倾向。长期下降但≥3项转强：反弹观察；长期上升但≤2项：回调观察；其余为震荡过渡。MA200方向或评分离开对应阈值时，该状态失效。至少需要205根完整日线，状态按日线更新，不是官方牛熊定义或未来收益预测。
          </p>
          <p>
            不以此替代入场信号：牛市也可能过热，熊市反弹也可能失败。交易仍须通过首页风控和买入条件。
          </p>
        </details>
        <p className="fineprint">
          {series.source} · {series.adjustment} · {bars.at(-1)?.date}
          。日线距今超过7天或演示数据只作历史观察。
        </p>
        <div className="metrics">
          {[
            [20, '短期'],
            [60, '中期'],
            [200, '长期'],
          ].map(([n, label]) => {
            const t = trend(bars, Number(n));
            return (
              <div className="metric" key={n}>
                <small>
                  {label} · MA{n}
                </small>
                <strong>{t.label}</strong>
                <small>均线 ${f(t.ma)} · 比较5根前均线斜率</small>
              </div>
            );
          })}
          <div className="metric">
            <small>量能状态</small>
            <strong style={{ fontSize: 20 }}>{vol?.state ?? '样本不足'}</strong>
            <small>{vol?.pairing}</small>
          </div>
        </div>
        <p>
          成交量均线：VMA5 {f(vol?.ma5)} 股 · VMA10 {f(vol?.ma10)} 股 · VMA20{' '}
          {f(vol?.ma20)}{' '}
          股（均包含最新完整日）。量比使用不含最新日的前20日均量：≥1.2放量、≤0.8缩量、≥2量能异动。
        </p>
        <h3>多周期共振</h3>
        <p>
          日线 MA20：{dt.label} · 已完成周线 MA10：{wt.label} ·
          60分钟：未接入可靠数据，不作判断。
        </p>
        <p>
          {dt.label === wt.label && ['上升', '下降'].includes(dt.label)
            ? '日线与周线方向一致（仅双周期）'
            : '日线与周线未形成同向趋势'}
          。周线排除当前纽约自然周，节假日周也按实际交易日聚合。
        </p>
        {levels && (
          <details>
            <summary>关键技术位：斐波那契与缺口</summary>
            <p>
              60日区间高点 ${f(levels.high)} / 低点 ${f(levels.low)}
              。以下为从区间高点向下的静态回撤参考，不能单独判定买卖：
            </p>
            <p>
              {levels.fib
                .map((x) => `${(x.ratio * 100).toFixed(1)}%：$${f(x.price)}`)
                .join(' · ')}
            </p>
            <h4>近60日尚未完全回补的缺口</h4>
            {levels.gaps.length ? (
              levels.gaps.map((x) => (
                <p key={x.date}>
                  {x.date} {x.side} · 剩余区域 ${f(x.low)}–${f(x.high)}
                </p>
              ))
            ) : (
              <p>未发现符合“相邻日高低区间不重叠”的未回补缺口。</p>
            )}
          </details>
        )}
      </section>
      <section className="panel">
        <h2>所属板块、相关板块与相对强弱</h2>
        <label>
          行业 / 主题代理（常见代码采用预设映射，可手动修正）
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">未确认所属板块，请选择</option>
            {Object.entries(choices).map(([s, n]) => (
              <option key={s} value={s}>
                {n} · {s}
              </option>
            ))}
          </select>
        </label>
        <p>
          当前：{sector ? choices[sector] : '未分类'}
          ；相关性不等于行业归属。下表用共同交易日计算20日收益差和60日日收益相关系数。
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>对照</th>
                <th>20日相对收益（百分点）</th>
                <th>60日相关性</th>
                <th>共同日期</th>
              </tr>
            </thead>
            <tbody>
              {['SPY', ...Object.keys(choices)].map((symbol) => {
                const d = data.find((s) => s.symbol === symbol),
                  r = d
                    ? relative(bars, volumeSummary(d.bars).completed)
                    : null;
                return (
                  <tr key={symbol}>
                    <td>
                      {symbol === 'SPY' ? '标普500代理' : choices[symbol]}{' '}
                      {symbol === sector ? '★所属/选定' : ''}
                    </td>
                    <td>{f(r ? r.excess * 100 : null)}</td>
                    <td>{f(r?.corr)}</td>
                    <td>{r?.asOf ?? '数据不足'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fineprint">
          正相对收益表示跑赢对照。AI与软件为主题代理，成分会重叠；不同复权口径、拆股和分红可能影响比较，请结合数据源说明。
        </p>
      </section>
      <section className="panel" style={{ border: '2px solid #e8bb66' }}>
        <h2>风控优先 · 本次最多买多少</h2>
        <p>
          这是人工填写的仓位计算器，不读取真实券商资产，不会替代模拟账户自身的下单限制。
        </p>
        <div className="formgrid">
          {[
            ['账户净值 USD', capital, setCapital],
            ['可用现金 USD', cash, setCash],
            ['单笔风险 %（≤5）', risk, setRisk],
            ['单股仓位上限 %', cap, setCap],
            ['止损参考 USD', stop, setStop],
            ['账户当前回撤 %', dd, setDd],
            ['回撤熔断阈值 %', limit, setLimit],
          ].map(([label, value, setter]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                type="number"
                min="0"
                step="0.01"
                value={Number(value)}
                onChange={(e) =>
                  (setter as (v: number) => void)(e.target.valueAsNumber)
                }
              />
            </label>
          ))}
        </div>
        <h3>
          {!plan
            ? '参数无效：止损须低于参考入场价，金额和比例须有效'
            : disabled
              ? '暂停新增仓位'
              : g?.buy
                ? '信号通过，可评估以下仓位上限'
                : '等待信号；以下只是预案'}
        </h3>
        {plan && (
          <p>
            计算上限：{disabled ? 0 : plan.shares} 股 · 仓位{' '}
            {disabled ? '0' : f(plan.weight)}% · 投入 $
            {disabled ? '0' : f(plan.value)} · 按止损成交的预计亏损 $
            {disabled ? '0' : f(plan.loss)}。
          </p>
        )}
        <p>
          {plan?.halted
            ? '账户回撤触及设定阈值。'
            : !g?.eligible
              ? '当前个股数据不可用于行动。'
              : g.sell
                ? '个股已出现退出信号。'
                : !all
                  ? '大盘行情缺失或日期不同，暂停新仓预案。'
                  : marketState === '偏弱'
                    ? '大盘偏弱，本计算器暂停新仓。'
                    : '持有上限取单笔风险预算、仓位上限、可用现金三者中的最小值。'}{' '}
          股数按整数向下取整，以最新完整日收盘为假设入场价；跳空、手续费和滑点可能使实际损失更大。
        </p>
      </section>
      <section className="panel">
        <h2>功能覆盖与数据缺口</h2>
        <p>
          已接通：公共日线、量价/趋势/支撑压力、ETF大盘代理、板块与RS、历史回测、新闻/基本面、纸面交易、页面开启期间的信号监控与邮件设置。
        </p>
        <p>
          尚缺可靠自动数据：60分钟共振、实际指数点位、期权PCR/资金净流入、下一次财报日期、分析师评级与机构持仓变化。请勿将缺失理解为没有风险事件。
        </p>
        <p>
          策略与回测页已有夏普、回撤、胜率、盈亏比、资金曲线；首页组合筛选和上述大盘风控尚未整套回测。提醒需保持页面开启，Telegram与服务器无人值守监控尚未接通。
        </p>
      </section>
    </>
  );
}
