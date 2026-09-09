import { clean, type Series, type Bar } from './engine.ts';
import { cryptoProduct } from './assets.ts';

export async function cryptoSeries(symbol: string, fetcher: typeof fetch = fetch, now = new Date()): Promise<Series> {
  const product = cryptoProduct(symbol);
  async function json(path: string) {
    const response = await fetcher(`https://api.exchange.coinbase.com/products/${product}/${path}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) throw Error(`Coinbase 数字货币行情返回 ${response.status}；未使用股票行情替代。`);
    return response.json() as Promise<any>;
  }
  const [rows, ticker] = await Promise.all([json('candles?granularity=86400'), json('ticker')]);
  if (!Array.isArray(rows)) throw Error('数字货币日线格式无效');
  const today = now.toISOString().slice(0, 10);
  const bars: Bar[] = rows.filter((r: unknown) => Array.isArray(r) && r.length >= 6 && Number.isFinite(r[0])).map((r: number[]) => ({
    date: new Date(r[0] * 1000).toISOString().slice(0, 10), low: r[1], high: r[2], open: r[3], close: r[4], volume: r[5],
  })).filter((bar) => bar.date < today);
  const report = clean(bars);
  const price = Number(ticker.price), time = Date.parse(ticker.time);
  if (!(price > 0) || !Number.isFinite(price) || !Number.isFinite(time) || time > now.getTime() + 60000) throw Error('数字货币最新成交价格或时间无效');
  if (report.bars.length < 61) throw Error('数字货币完整日线不足61根');
  return { symbol: product, assetClass: 'crypto', bars: report.bars,
    quote: { price, time: new Date(time).toISOString() }, asOf: report.bars.at(-1)!.date,
    source: 'Coinbase Exchange 数字货币现货（USD，单交易所）', adjustment: 'UTC 日线 · 24/7 · 不复权 · 最多300根',
    warnings: ['单交易所最近成交，不代表可成交报价；仅使用已完成 UTC 日线。', ...(report.invalid ? ['已剔除无效日线'] : [])],
  };
}
