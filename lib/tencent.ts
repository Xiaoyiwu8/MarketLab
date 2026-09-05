import type { Bar } from './engine';
export async function tencent(symbol: string) {
  async function get(id: string, count: number) {
    const r = await fetch(
      `https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=${encodeURIComponent(id)},day,,,${count},qfq`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!r.ok) throw Error(`腾讯公共行情返回 ${r.status}`);
    const d: any = await r.json();
    return d.data?.[id];
  }
  const lookup = await get('us' + symbol, 2),
    qt = lookup?.qt?.['us' + symbol],
    ticker = qt?.[2];
  if (
    typeof ticker !== 'string' ||
    !new RegExp(
      '^' +
        symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\.(OQ|N|AM|PK|OB)$',
    ).test(ticker)
  )
    throw Error('该代码未找到可验证的美股市场映射，请尝试其他来源。');
  const v = await get('us' + ticker, 1000),
    rows: Bar[] = (v?.qfqday ?? []).map((b: any[]) => ({
      date: String(b[0]),
      open: Number(b[1]),
      close: Number(b[2]),
      high: Number(b[3]),
      low: Number(b[4]),
      volume: Number(b[5]),
    }));
  if (!rows.length) throw Error('未返回前复权历史日线');
  let quote;
  if (
    Number(qt[3]) > 0 &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(qt[30])
  ) {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date(qt[30].slice(0, 10) + 'T12:00:00Z'))
      .find((x) => x.type === 'timeZoneName')!.value;
    const h = Number(offset.replace('GMT', '')),
      zone = `${h < 0 ? '-' : '+'}${Math.abs(h).toString().padStart(2, '0')}:00`;
    quote = {
      price: Number(qt[3]),
      time: new Date(qt[30].replace(' ', 'T') + zone).toISOString(),
    };
  }
  return { rows, quote };
}
