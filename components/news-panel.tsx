'use client';
import { useEffect, useState } from 'react';
export default function NewsPanel({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<any>(null);
  useEffect(() => {
    const c = new AbortController();
    setResult(null);
    fetch('/api/news?symbol=' + encodeURIComponent(symbol), {
      signal: c.signal,
    })
      .then((r) => r.json())
      .then(setResult)
      .catch((e) => {
        if (e.name !== 'AbortError') setResult({ error: '新闻获取失败' });
      });
    return () => c.abort();
  }, [symbol]);
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>{symbol} · 近期新闻与事件</h2>
        <a
          href={`https://stockanalysis.com/stocks/${symbol.toLowerCase().replaceAll('.', '-')}/`}
          target="_blank"
          rel="noreferrer"
        >
          公司消息原页 ↗
        </a>
      </div>
      {result?.items?.length ? (
        result.items.map((n: any) => (
          <article
            key={n.url}
            style={{ padding: '14px 0', borderBottom: '1px solid #2a3a4b' }}
          >
            <a href={n.url} target="_blank" rel="noreferrer">
              {n.title}
            </a>
            <p className="fineprint">
              {n.publisher} · {n.date}
            </p>
          </article>
        ))
      ) : (
        <p>
          {result?.error ?? (result ? '暂无匹配新闻' : '正在获取新闻索引…')}
        </p>
      )}
      <p className="fineprint">
        {result?.source} ·
        聚合标题未经全文事实核查，不自动转化为买卖信号。阅读原文核对事件发生日期，区分已发生财报与未来预期。
      </p>
    </section>
  );
}
