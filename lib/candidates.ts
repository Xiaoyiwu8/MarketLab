import type { Series } from './engine.ts';
import { isCryptoSymbol } from './assets.ts';
import { tradeGuidance } from './trade-guidance.ts';
import { shortGuidance } from './short-guidance.ts';
import { matureSetup } from './maturity.ts';

export function stockCandidates(data: Series[], now = new Date()) {
  const stocks = [...new Map(data.filter(s => s.assetClass !== 'crypto' && !isCryptoSymbol(s.symbol)).map(s => [s.symbol, s])).values()];
  const ranked = stocks.map(series => {
    const long = tradeGuidance(series, now), short = shortGuidance(series, now);
    const longSetup = matureSetup(series, 'long', now), shortSetup = matureSetup(series, 'short', now);
    function checks(setup: ReturnType<typeof matureSetup>) {
      return [{label:'突破后独立回踩守住，随后再次确认（非严格缠论三买/三卖）',pass:setup?.confirmed===true},
        {label:'已有历史拐点目标支持收益风险比 ≥ 2',pass:!!setup?.confirmed && 'rr' in setup && setup.rr!==null && setup.rr>=2}];
    }
    if (long) {
      long.checks = [long.checks[0],long.checks[2],long.checks[3],...checks(longSetup)];
      long.buy = long.eligible && long.checks.every(c=>c.pass);
      if (longSetup?.confirmed && 'stop' in longSetup) {
        long.stop=longSetup.stop; long.target=longSetup.target ?? long.last.close; long.rewardRisk=longSetup.rr;
      }
    }
    if (short) {
      short.checks = [short.checks[0],short.checks[2],short.checks[3],short.checks[4],...checks(shortSetup)];
      short.enter = short.g.eligible && short.checks.every(c=>c.pass);
      if (shortSetup?.confirmed && 'stop' in shortSetup) {
        short.stop=shortSetup.stop;short.target=shortSetup.target ?? short.g.last.close;short.rr=shortSetup.rr;
      }
    }
    return {series,long,short,longSetup,shortSetup};
  });
  return {
    count: stocks.length,
    long: ranked.filter(x => x.long?.buy).sort((a,b) => (b.long!.rewardRisk! - a.long!.rewardRisk!) || a.series.symbol.localeCompare(b.series.symbol)).slice(0,2),
    short: ranked.filter(x => x.short?.enter).sort((a,b) => (b.short!.rr! - a.short!.rr!) || a.series.symbol.localeCompare(b.series.symbol)).slice(0,2),
  };
}
