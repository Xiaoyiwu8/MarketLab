import type { Series } from './engine.ts';
import { isCryptoSymbol } from './assets.ts';
import { tradeGuidance } from './trade-guidance.ts';
import { shortGuidance } from './short-guidance.ts';

export function stockCandidates(data: Series[], now = new Date()) {
  const stocks = [...new Map(data.filter(s => s.assetClass !== 'crypto' && !isCryptoSymbol(s.symbol)).map(s => [s.symbol, s])).values()];
  const ranked = stocks.map(series => ({ series, long: tradeGuidance(series, now), short: shortGuidance(series, now) }));
  return {
    count: stocks.length,
    long: ranked.filter(x => x.long?.buy).sort((a,b) => (b.long!.rewardRisk! - a.long!.rewardRisk!) || a.series.symbol.localeCompare(b.series.symbol)).slice(0,2),
    short: ranked.filter(x => x.short?.enter).sort((a,b) => (b.short!.rr! - a.short!.rr!) || a.series.symbol.localeCompare(b.series.symbol)).slice(0,2),
  };
}
