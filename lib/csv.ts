import { clean, type Bar, type Series } from './engine.ts';
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('CSV引号没有闭合');
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export function importCsv(symbol: string, text: string): Series {
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))
    throw Error('请提供股票代码；文件名可为 AAPL.csv');
  if (text.length > 5e6) throw Error('CSV不得超过5MB');
  const rows = parseCsv(text.replace(/^\uFEFF/, '')),
    header = (rows.shift() ?? []).map((x) =>
      x.trim().toLowerCase().replace(/[ ._]/g, ''),
    );
  const fields = ['date', 'open', 'high', 'low', 'close', 'volume'];
  if (fields.some((x) => !header.includes(x)))
    throw Error(
      '缺少 date,open,high,low,close,volume 列；兼容 Yahoo 和 Stock Analysis 导出的英文行情CSV',
    );
  const number = (s: string | undefined) =>
      s?.trim() ? Number(s.replaceAll(',', '')) : NaN,
    adj = header.indexOf('adjclose');
  const data: Bar[] = rows.map((c) => {
    const value = (k: string) => number(c[header.indexOf(k)]),
      close = value('close'),
      factor = adj >= 0 ? number(c[adj]) / close : 1;
    return {
      date: c[header.indexOf('date')]?.trim() ?? '',
      open: value('open') * factor,
      high: value('high') * factor,
      low: value('low') * factor,
      close: close * factor,
      volume: value('volume'),
    };
  });
  const result = clean(data);
  if (result.bars.length < 55) throw Error('清洗后需要至少55根有效日线');
  return {
    symbol,
    bars: result.bars,
    source: '用户导入 CSV',
    asOf: result.bars.at(-1)!.date,
    adjustment:
      adj >= 0
        ? '按CSV Adj Close / Close比例调整OHLC；原始成交量'
        : '用户提供的OHLC口径，文件无Adj Close',
    warnings: [
      `导入${result.bars.length}行；删除无效${result.invalid}行；合并重复${result.duplicates}行。请核对日期和复权。`,
    ],
  };
}
