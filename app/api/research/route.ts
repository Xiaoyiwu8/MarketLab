import { financialTable } from '@/lib/research';
const cache = new Map<string, { expires: number; value: unknown }>();
export async function GET(req: Request) {
  const symbol =
    new URL(req.url).searchParams.get('symbol')?.toUpperCase() ?? '';
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))
    return Response.json({ error: '股票代码无效' }, { status: 400 });
  const cached = cache.get(symbol);
  if (cached && cached.expires > Date.now()) return Response.json(cached.value);
  const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase().replaceAll('.', '-')}/`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (!r.ok) throw Error(`Stock Analysis 返回 ${r.status}`);
    const html = await r.text();
    const text = (s: string) =>
      s
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
    const allowed = [
      'Market Cap',
      'Revenue (ttm)',
      'Net Income',
      'EPS',
      'EPS (ttm)',
      'PE Ratio',
      'Forward PE',
      'Dividend',
      'Ex-Dividend Date',
      'Volume',
      'Average Volume',
      '52-Week Range',
      'Beta',
      'Earnings Date',
      'Shares Outstanding',
    ];
    const fields = (html.match(/<tr\b[\s\S]*?<\/tr>/g) ?? [])
      .map((row) => (row.match(/<td\b[\s\S]*?<\/td>/g) ?? []).map(text))
      .filter((c) => c.length === 2 && allowed.includes(c[0]))
      .map(([label, value]) => ({ label, value }));
    if (!fields.length)
      throw Error('页面结构变化或没有可识别的概况表，请打开来源原文核对');
    let financials: any = null,
      financialError = '';
    try {
      const f = await fetch(url + 'financials/', {
        signal: AbortSignal.timeout(15000),
      });
      if (!f.ok) throw Error('财务页返回' + f.status);
      financials = financialTable(await f.text());
    } catch (e) {
      financialError = (e as Error).message;
    }
    const result = {
      financials,
      financialError,
      symbol,
      url,
      fetchedAt: new Date().toISOString(),
      fields: fields.slice(0, 14),
      scope: '页面概况快照；提取时间不是财报发布日期，不用于历史因子回测',
    };
    if (cache.size >= 100) cache.clear();
    cache.set(symbol, { value: result, expires: Date.now() + 15 * 60e3 });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { symbol, url, error: (e as Error).message },
      { status: 502 },
    );
  }
}
