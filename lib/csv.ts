import { clean, type Bar, type Series } from './engine';
export function importCsv(symbol: string, text: string): Series {
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))
    throw Error('导入前请选择有效股票代码');
  if (text.length > 5e6) throw Error('CSV不得超过5MB');
  const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/),
    header = lines
      .shift()!
      .toLowerCase()
      .split(',')
      .map((x) => x.trim());
  const fields = ['date', 'open', 'high', 'low', 'close', 'volume'];
  if (fields.some((x) => !header.includes(x)))
    throw Error(
      'CSV必须包含 date,open,high,low,close,volume 列；价格应使用一致的复权口径',
    );
  const rows: Bar[] = lines
    .filter((x) => x.trim())
    .map((line) => {
      const cells = line.split(',');
      return Object.fromEntries(
        fields.map((k) => [
          k,
          k === 'date'
            ? cells[header.indexOf(k)]?.trim()
            : cells[header.indexOf(k)]?.trim()
              ? Number(cells[header.indexOf(k)])
              : NaN,
        ]),
      ) as Bar;
    });
  const result = clean(rows);
  if (result.bars.length < 55) throw Error('清洗后需要至少55根有效日线');
  return {
    symbol,
    bars: result.bars,
    source: '用户导入 CSV',
    asOf: result.bars.at(-1)!.date,
    adjustment: '用户提供的价格口径（导入前请确认复权）',
    warnings: [
      `导入${result.bars.length}行，丢弃无效行${result.invalid}，合并重复日期${result.duplicates}。CSV只支持无引号的标准数字列。`,
    ],
  };
}
