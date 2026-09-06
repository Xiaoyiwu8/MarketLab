import type { Series } from './engine.ts';
import { volumeSummary } from './volume.ts';
export const sectors = [
  {
    name: '存储',
    symbols: ['MU', 'STX', 'WDC'],
    note: '三只代表股等权观察篮子，非行业指数',
  },
  { name: '半导体', symbols: ['SMH'], note: '半导体ETF代理' },
  { name: '能源', symbols: ['XLE'], note: '能源ETF代理' },
  { name: '石油与天然气开采', symbols: ['XOP'], note: '油气勘探生产ETF代理' },
  { name: '金融', symbols: ['XLF'], note: '金融ETF代理' },
  { name: '公用事业', symbols: ['XLU'], note: '公用事业ETF代理' },
];
export function rankSectors(data: Series[], now = new Date()) {
  const usable = data
    .filter((s) => !/演示|合成/.test(s.source))
    .map((s) => ({ ...s, bars: volumeSummary(s.bars, now).completed }))
    .filter((s) => s.bars.length >= 21);
  const dates =
    usable[0]?.bars
      .map((b) => b.date)
      .filter((date) =>
        usable.every((s) => s.bars.some((b) => b.date === date)),
      ) ?? [];
  if (dates.length < 21) return { rows: [], asOf: null };
  const asOf = dates.at(-1)!;
  if (now.getTime() - new Date(asOf + 'T00:00:00Z').getTime() > 7 * 86400000)
    return { rows: [], asOf };
  const rows = sectors
    .flatMap((sector) => {
      const members = sector.symbols.map((symbol) =>
        usable.find((s) => s.symbol === symbol),
      );
      if (members.some((s) => !s)) return [];
      const metrics = members.map((s) => {
        const aligned = dates.map((d) => s!.bars.find((b) => b.date === d)!);
        const close = aligned.at(-1)!.close;
        const v = volumeSummary(
          s!.bars.filter((b) => b.date <= asOf),
          now,
        );
        return {
          five: close / aligned.at(-6)!.close - 1,
          twenty: close / aligned.at(-21)!.close - 1,
          volume: v.ratio,
        };
      });
      return [
        {
          ...sector,
          five: metrics.reduce((n, m) => n + m.five, 0) / metrics.length,
          twenty: metrics.reduce((n, m) => n + m.twenty, 0) / metrics.length,
          volume: metrics.every((m) => m.volume !== null)
            ? metrics.reduce((n, m) => n + m.volume!, 0) / metrics.length
            : null,
        },
      ];
    })
    .sort((a, b) => b.five - a.five);
  return { rows, asOf };
}
