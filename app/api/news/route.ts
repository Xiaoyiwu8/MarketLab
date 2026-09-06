export async function GET(req: Request) {
  const symbol =
    new URL(req.url).searchParams.get('symbol')?.toUpperCase() ?? '';
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))
    return Response.json({ error: '股票代码无效' }, { status: 400 });
  try {
    try {
      const page = await fetch(
        `https://stockanalysis.com/stocks/${symbol.toLowerCase().replaceAll('.', '-')}/`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (page.ok) {
        const html = await page.text();
        const items = (html.match(/<h3\b[\s\S]*?<\/h3>/g) ?? [])
          .flatMap((h) => {
            const a = h.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            if (!a) return [];
            try {
              const url = new URL(a[1].replaceAll('&amp;', '&'));
              if (url.protocol !== 'https:') return [];
              return [
                {
                  title: a[2]
                    .replace(/<[^>]*>/g, '')
                    .replaceAll('&amp;', '&')
                    .replaceAll('&#39;', "'"),
                  url: url.toString(),
                  publisher: url.hostname,
                  date: '发布时间见新闻原文',
                },
              ];
            } catch {
              return [];
            }
          })
          .slice(0, 10);
        if (items.length)
          return Response.json(
            {
              symbol,
              items,
              fetchedAt: new Date().toISOString(),
              source: 'Stock Analysis 公开新闻索引；不保证覆盖全部消息',
            },
            { headers: { 'Cache-Control': 'private, max-age=300' } },
          );
      }
    } catch {
      /* Google RSS is a separately labelled fallback. */
    }
    const r = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent('"' + symbol + '" stock when:7d')}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) throw Error(`新闻源返回 ${r.status}`);
    const xml = await r.text();
    const decode = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .trim();
    const items = (xml.match(/<item>[\s\S]*?<\/item>/g) ?? [])
      .slice(0, 10)
      .map((s) => {
        const value = (tag: string) =>
          decode(
            s.match(
              new RegExp(
                '<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>',
              ),
            )?.[1] ?? '',
          );
        return {
          title: value('title'),
          url: value('link'),
          publisher: value('source'),
          date: value('pubDate'),
        };
      })
      .filter((n) => n.title && n.url.startsWith('https://news.google.com/'));
    return Response.json(
      {
        symbol,
        items,
        fetchedAt: new Date().toISOString(),
        source: 'Google News RSS：按股票代码检索最近7天；非穷尽性新闻清单',
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
