'use client';
import { useEffect, useState } from 'react';
import { rankSectors, sectors } from '@/lib/sectors';
export default function SectorPanel({
  onAnalyze,
}: {
  onAnalyze: (symbols: string) => void;
}) {
  const [result, setResult] = useState<ReturnType<typeof rankSectors>>({
    rows: [],
    asOf: null,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function refresh(signal?: AbortSignal) {
    setBusy(true);
    setError('');
    setResult({ rows: [], asOf: null });
    try {
      const r = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: sectors.flatMap((s) => s.symbols),
          provider: 'tencent',
        }),
        signal,
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error ?? '板块行情获取失败');
      const failures = d.results.filter((s: any) => s.error);
      const ranked = rankSectors(d.results.filter((s: any) => !s.error));
      setResult(ranked);
      if (failures.length)
        setError(
          '部分行情缺失：' +
            failures.map((s: any) => s.symbol).join('、') +
            '，对应板块未参与排名。',
        );
      if (ranked.rows.length < 3)
        setError(
          '可用板块不足3个或数据过期，暂不发布热门前三榜单，请稍后刷新。',
        );
    } catch (e) {
      if (!signal?.aborted) setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);
  const pct = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
  return (
    <section className="panel">
      <div className="sectionTitle">
        <div>
          <h2>近期强势板块 · 热门观察前三</h2>
          <small>在6个预设板块中按近5个共同交易日价格涨幅排序</small>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? '获取板块行情…' : '刷新板块榜'}
        </button>
      </div>
      {error && <p role="status">{error}</p>}
      {result.rows.length >= 3 && (
        <>
          <div
            className="formgrid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            }}
          >
            {result.rows.slice(0, 3).map((s, i) => (
              <article className="decisionCard" key={s.name}>
                <small>相对强势 #{i + 1}</small>
                <h3 style={{ fontSize: 25 }}>{s.name}</h3>
                <strong
                  className={s.five >= 0 ? 'positive' : 'negative'}
                  style={{ fontSize: 30 }}
                >
                  {pct(s.five)}
                </strong>
                <p>
                  近20日 {pct(s.twenty)}
                  <br />
                  最新日量比{' '}
                  {s.volume === null ? '—' : s.volume.toFixed(2) + '×'}
                </p>
                <p>
                  {s.symbols.join(' / ')} · {s.note}
                </p>
                <button
                  className="secondary"
                  onClick={() => onAnalyze(s.symbols.join(', '))}
                >
                  分析代表标的 →
                </button>
              </article>
            ))}
          </div>
          <details>
            <summary>查看全部 {result.rows.length} 个板块</summary>
            {result.rows.map((s) => (
              <p key={s.name}>
                {s.name}（{s.symbols.join(' / ')}）：近5日 {pct(s.five)} ·
                近20日 {pct(s.twenty)}
              </p>
            ))}
          </details>
        </>
      )}
      <p className="fineprint">
        腾讯公共延迟日线 ·{' '}
        {result.asOf ? '共同数据截至 ' + result.asOf : '等待可用数据'}
        。存储为MU/STX/WDC区间收益的等权平均，量比为成员量比均值；其余为ETF表现，不是行业全部股票的成交总量。能源与油气有重叠。即使均下跌，前三也只表示相对抗跌，不表示值得买入。该榜衡量价格强弱，不衡量新闻热度或资金净流入。
      </p>
      <p className="fineprint">
        代理标的说明：
        <a
          href="https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/overview/"
          target="_blank"
          rel="noreferrer"
        >
          SMH
        </a>{' '}
        ·{' '}
        <a
          href="https://www.ssga.com/us/en/institutional/etfs/state-street-energy-select-sector-spdr-etf-xle"
          target="_blank"
          rel="noreferrer"
        >
          XLE
        </a>{' '}
        ·{' '}
        <a
          href="https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-oil-gas-exploration-production-etf-xop"
          target="_blank"
          rel="noreferrer"
        >
          XOP
        </a>
      </p>
    </section>
  );
}
