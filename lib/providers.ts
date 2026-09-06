import { clean, type Bar, type Series } from './engine.ts';
export type DataRequest = {
  symbol: string;
  provider: 'yahoo' | 'polygon' | 'alpha';
  key?: string;
  start: string;
  end: string;
  quoteOnly?: boolean;
  entitlement?: 'historical' | 'delayed' | 'realtime';
  adjusted?: boolean;
};
export type Quote = {
  price: number;
  time: string;
  freshness: string;
  receivedAt: string;
};
export async function fetchProvider(
  input: DataRequest,
  fetcher: typeof fetch = fetch,
): Promise<{ series?: Series; quote?: Quote; warnings: string[] }> {
  const {
    symbol,
    provider,
    key,
    start,
    end,
    quoteOnly = false,
    entitlement = 'historical',
    adjusted = true,
  } = input;
  if (
    !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) ||
    !['yahoo', 'polygon', 'alpha'].includes(provider)
  )
    throw Error('股票代码或数据源无效');
  const validDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!validDate(start) || !validDate(end) || start > end)
    throw Error('历史开始 / 结束日期无效');
  if (provider !== 'yahoo' && !key)
    throw Error('此数据源需要 API Key；请在数据中心填写，不要在聊天中提供。');
  if (!['historical', 'delayed', 'realtime'].includes(entitlement))
    throw Error('行情权限无效');
  const warnings: string[] = [];
  let rows: Bar[] = [],
    quote: Quote | undefined,
    source = '',
    adjustment = '';
  async function json(url: string, auth = false) {
    const r = await fetcher(url, {
      headers: auth
        ? { Authorization: `Bearer ${key}` }
        : { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Error(
        `${provider} 返回 HTTP ${r.status}：请检查数据权限、频率限制或网络。`,
      );
    const d: any = await r.json();
    if (
      d['Error Message'] ||
      d.Note ||
      d.Information ||
      d.status === 'ERROR' ||
      d.status === 'NOT_AUTHORIZED'
    ) {
      const msg = String(
        d['Error Message'] ?? d.Note ?? d.Information ?? d.error ?? d.message,
      );
      throw Error(key ? msg.replaceAll(key, '[密钥已隐藏]') : msg);
    }
    return d;
  }
  const receivedAt = new Date().toISOString();
  const setQuote = (p: unknown, t: string, freshness: string) => {
    if (
      Number.isFinite(Number(p)) &&
      Number(p) > 0 &&
      Number.isFinite(Date.parse(t))
    )
      quote = { price: Number(p), time: t, freshness, receivedAt };
  };
  if (provider === 'yahoo') {
    const p1 = Math.floor(Date.parse(start) / 1000),
      p2 = Math.floor(Date.parse(end) / 1000) + 86400;
    let d: any;
    try {
      d = await json(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${quoteOnly ? 'range=1d' : `period1=${p1}&period2=${p2}`}&interval=1d&events=div%2Csplits`,
      );
    } catch {
      d = await json(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${quoteOnly ? 'range=1d' : `period1=${p1}&period2=${p2}`}&interval=1d&events=div%2Csplits`,
      );
    }
    const v = d.chart?.result?.[0];
    if (!v) throw Error(d.chart?.error?.description ?? 'Yahoo 未返回股票数据');
    setQuote(
      v.meta?.regularMarketPrice,
      new Date((v.meta?.regularMarketTime ?? 0) * 1000).toISOString(),
      'Yahoo 公共报价，延迟由交易所 / 数据源决定',
    );
    if (!quoteOnly) {
      const q = v.indicators?.quote?.[0],
        adj = v.indicators?.adjclose?.[0]?.adjclose;
      if (!q) throw Error('Yahoo OHLC 数据缺失');
      rows = (v.timestamp ?? []).map((t: number, i: number) => {
        const f =
          adjusted && adj?.[i] > 0 && q.close[i] > 0 ? adj[i] / q.close[i] : 1;
        return {
          date: new Date(t * 1000).toISOString().slice(0, 10),
          open: q.open[i] == null ? NaN : q.open[i] * f,
          high: q.high[i] == null ? NaN : q.high[i] * f,
          low: q.low[i] == null ? NaN : q.low[i] * f,
          close: q.close[i] == null ? NaN : q.close[i] * f,
          volume: q.volume[i] == null ? NaN : q.volume[i],
        };
      });
      if (adjusted && !adj)
        throw Error('Yahoo 未返回复权因子，拒绝将原始价格标为复权价格');
    }
    source = 'Yahoo Finance';
    adjustment = adjusted ? '拆股 / 分红调整 OHLC；成交量沿用源数据' : '未复权';
  } else if (provider === 'polygon') {
    source = 'Polygon / Massive';
    adjustment = adjusted ? '拆股调整，不含现金分红再投资' : '未复权';
    if (!quoteOnly) {
      let url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${start}/${end}?adjusted=${adjusted}&sort=asc&limit=50000`;
      let pages = 0;
      while (url) {
        const d = await json(url, true);
        rows.push(
          ...(d.results ?? []).map((b: any) => ({
            date: new Date(b.t).toISOString().slice(0, 10),
            open: b.o,
            high: b.h,
            low: b.l,
            close: b.c,
            volume: b.v,
          })),
        );
        pages++;
        if (d.next_url) {
          const u = new URL(d.next_url);
          if (
            !['api.massive.com', 'api.polygon.io'].includes(u.hostname) ||
            u.protocol !== 'https:'
          )
            throw Error('拒绝未知的分页地址');
          url = u.toString();
        } else url = '';
        if (pages >= 10 && url)
          throw Error('历史结果超过分页上限，请缩小日期范围');
      }
    }
    try {
      const d = await json(
          `https://api.massive.com/v2/last/trade/${encodeURIComponent(symbol)}`,
          true,
        ),
        v = d.results;
      if (v)
        setQuote(
          v.p,
          new Date(Number(v.t) / 1e6).toISOString(),
          '最新成交；是否实时由账户授权及原始时间戳确定',
        );
    } catch (e) {
      if (quoteOnly) throw e;
      warnings.push('最新成交不可用：' + (e as Error).message);
    }
  } else {
    source = 'Alpha Vantage';
    adjustment = adjusted ? '拆股 / 分红调整 OHLC；成交量沿用源数据' : '未复权';
    const query = (fn: string, extra = '') =>
      `https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key!)}${extra}`;
    if (!quoteOnly) {
      const d = await json(
        query(
          adjusted ? 'TIME_SERIES_DAILY_ADJUSTED' : 'TIME_SERIES_DAILY',
          '&outputsize=full',
        ),
      );
      const series = d['Time Series (Daily)'];
      if (!series)
        throw Error('Alpha Vantage 未返回完整日线；请检查套餐与调用额度。');
      rows = Object.entries(series).map(([date, v]: [string, any]) => {
        const c = Number(v['4. close']),
          adj = Number(v['5. adjusted close']);
        if (adjusted && (!Number.isFinite(adj) || c <= 0))
          throw Error('复权收盘价缺失');
        const f = adjusted ? adj / c : 1;
        return {
          date,
          open: Number(v['1. open']) * f,
          high: Number(v['2. high']) * f,
          low: Number(v['3. low']) * f,
          close: c * f,
          volume: Number(v[adjusted ? '6. volume' : '5. volume']),
        };
      });
    }
    try {
      const d = await json(
          query(
            'GLOBAL_QUOTE',
            entitlement === 'historical' ? '' : `&entitlement=${entitlement}`,
          ),
        ),
        v = d['Global Quote'];
      if (!v?.['05. price']) throw Error('Alpha Vantage 未返回报价');
      const date = v['07. latest trading day'];
      setQuote(
        v['05. price'],
        date,
        `${entitlement === 'realtime' ? '已请求实时权限' : entitlement === 'delayed' ? '已请求15分钟延迟权限' : '日终报价'}；接口仅提供交易日期，不宣称逐笔实时`,
      );
    } catch (e) {
      if (quoteOnly) throw e;
      warnings.push('报价不可用：' + (e as Error).message);
    }
  }
  if (quoteOnly) {
    if (!quote) throw Error('该数据源没有有效报价');
    return { quote, warnings };
  }
  const ny = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const report = clean(
    rows.filter((b) => b.date >= start && b.date <= end && b.date < ny),
  );
  if (!report.bars.length) throw Error('请求区间没有有效已完成日线');
  if (report.invalid || report.duplicates)
    warnings.push(`清洗：无效${report.invalid}行，重复${report.duplicates}行`);
  if (
    report.bars[0].date >
    new Date(Date.parse(start) + 7 * 864e5).toISOString().slice(0, 10)
  )
    warnings.push(
      '实际起始日期晚于请求范围：可能因上市时间 / 套餐 / 数据缺失，请检查覆盖范围',
    );
  return {
    series: {
      symbol,
      bars: report.bars,
      quote,
      source,
      asOf: report.bars.at(-1)!.date,
      adjustment,
      warnings,
    },
    quote,
    warnings,
  };
}
