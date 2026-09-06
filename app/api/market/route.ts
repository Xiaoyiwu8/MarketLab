import { tencent } from '@/lib/tencent';
import { clean, type Bar } from '@/lib/engine';
const headers = { 'Cache-Control': 'no-store' };
async function request(url: string, key?: string, secret?: string) {
  const r = await fetch(url, {
    headers: key
      ? { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret! }
      : { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(18000),
  });
  if (!r.ok)
    throw Error(`行情源返回 ${r.status}，请检查代码、订阅权限或稍后重试。`);
  return r.json() as Promise<any>;
}
export async function POST(req: Request) {
  try {
    const { symbols, provider, key, secret, mode, expiry } =
      (await req.json()) as any;
    if (
      !Array.isArray(symbols) ||
      !symbols.length ||
      symbols.length > 12 ||
      symbols.some(
        (s: unknown) =>
          typeof s !== 'string' || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(s),
      )
    )
      throw Error('输入1至12个有效美股代码，以逗号分隔。');
    if (!['yahoo', 'alpaca', 'tencent'].includes(provider))
      throw Error('请选择有效行情源');
    if (provider === 'alpaca' && (!key || !secret))
      throw Error('请先在数据连接中填写 Alpaca Key 和 Secret。');
    if (mode === 'options') {
      if (provider !== 'alpaca')
        throw Error('真实期权链需要 Alpaca 数据连接。');
      if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
        throw Error('到期日格式无效');
      let token = '',
        snapshots: Record<string, unknown> = {},
        pages = 0;
      do {
        const u = new URL(
          `https://data.alpaca.markets/v1beta1/options/snapshots/${symbols[0]}`,
        );
        u.searchParams.set('feed', 'indicative');
        u.searchParams.set('limit', '100');
        if (expiry) u.searchParams.set('expiration_date', expiry);
        if (token) u.searchParams.set('page_token', token);
        const d = await request(u.toString(), key, secret);
        Object.assign(snapshots, d.snapshots ?? {});
        token = d.next_page_token ?? '';
        pages++;
      } while (token && pages < 5);
      return Response.json(
        {
          snapshots,
          truncated: !!token,
          source:
            'Alpaca indicative：延迟成交、修改后的指示性报价，并非实时 OPRA',
        },
        { headers },
      );
    }
    const results = await Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          let rows: Bar[] = [],
            quote,
            source = '',
            adjustment = '',
            warnings: string[] = [];
          if (provider === 'tencent') {
            const t = await tencent(symbol, mode === 'quote');
            if (mode === 'quote')
              return { symbol, quote: t.quote, warnings: [] };
            rows = t.rows;
            quote = t.quote;
            source = '腾讯公共美股行情（延迟）';
            adjustment = t.adjustment;
            warnings.push(
              '公开接口无服务承诺；行情可能延迟，不用于判断真实可成交价格。',
            );
          } else if (provider === 'alpaca') {
            let token = '',
              pages = 0;
            do {
              const u = new URL(
                `https://data.alpaca.markets/v2/stocks/${symbol}/bars`,
              );
              Object.entries({
                timeframe: '1Day',
                start: new Date(Date.now() - 4 * 366 * 864e5).toISOString(),
                end: new Date(Date.now() - 864e5).toISOString(),
                limit: '1000',
                adjustment: 'all',
                feed: 'iex',
                sort: 'asc',
              }).forEach(([k, v]) => u.searchParams.set(k, v));
              if (token) u.searchParams.set('page_token', token);
              const d = await request(u.toString(), key, secret);
              rows.push(
                ...(d.bars ?? []).map((b: any) => ({
                  date: b.t.slice(0, 10),
                  open: b.o,
                  high: b.h,
                  low: b.l,
                  close: b.c,
                  volume: b.v,
                })),
              );
              token = d.next_page_token ?? '';
              pages++;
            } while (token && pages < 5);
            if (token) warnings.push('历史数据分页截断');
            try {
              const d = await request(
                `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest?feed=iex`,
                key,
                secret,
              );
              quote = { price: d.trade.p, time: d.trade.t };
            } catch {
              warnings.push('最新成交暂不可用');
            }
            source = 'Alpaca IEX（单交易所）';
            adjustment = 'all：拆股 / 分红调整';
          } else {
            const d = await request(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div%2Csplits`,
            );
            const v = d.chart?.result?.[0];
            if (!v) throw Error('未找到该股票行情');
            const q = v.indicators.quote[0],
              adj = v.indicators.adjclose?.[0]?.adjclose;
            rows = v.timestamp.map((t: number, i: number) => {
              const factor = adj?.[i] && q.close[i] ? adj[i] / q.close[i] : 1;
              return {
                date: new Date(t * 1000).toISOString().slice(0, 10),
                open: q.open[i] == null ? NaN : q.open[i] * factor,
                high: q.high[i] == null ? NaN : q.high[i] * factor,
                low: q.low[i] == null ? NaN : q.low[i] * factor,
                close: q.close[i] == null ? NaN : q.close[i] * factor,
                volume: q.volume[i] == null ? NaN : q.volume[i],
              };
            });
            quote = {
              price: v.meta.regularMarketPrice,
              time: new Date(v.meta.regularMarketTime * 1000).toISOString(),
            };
            source = 'Yahoo Finance 公共行情（可能延迟）';
            adjustment = 'OHLC 按 Adj Close 比例调整；原始成交量';
            warnings.push('公共接口无可用性保证；信号仅使用已完成日线。');
          }
          const ny = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());
          const report = clean(rows.filter((b) => b.date < ny));
          if (report.bars.length < 55)
            throw Error('有效日线不足55根，无法进行完整分析。');
          if (report.invalid || report.duplicates)
            warnings.push(
              `清理无效行 ${report.invalid}，重复日期 ${report.duplicates}`,
            );
          return {
            symbol,
            bars: report.bars,
            quote,
            source,
            adjustment,
            asOf: report.bars.at(-1)!.date,
            warnings,
          };
        } catch (e) {
          return {
            symbol,
            error: e instanceof Error ? e.message : '行情获取失败',
          };
        }
      }),
    );
    return Response.json({ results }, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : '请求无效' },
      { status: 400, headers },
    );
  }
}
