import { clean, type Series } from './engine.ts';
import { tencent } from './tencent.ts';
import { stockCandidates } from './candidates.ts';
import type { Listing } from './universe.ts';
export type ScanState = {
  date:string; startedAt:string; updatedAt:string; status:'running'|'complete';
  total:number; cursor:number; analyzed:number; ineligible:number; failed:number;
  excluded:number; directoryStamps:string[]; errors:{symbol:string;reason:string}[];
  long:Series[]; short:Series[];
};
export async function scanSeries(symbol:string, date:string):Promise<Series> {
  const t=await tencent(symbol);
  const {bars}=clean(t.rows.filter(b=>b.date<=date));
  if(bars.at(-1)?.date!==date) throw Error('缺少本次交易日的日线');
  if(bars.length<61) throw Error('有效历史不足61根');
  if(!t.adjustment.includes('qfqday')) throw Error('未确认复权，暂不纳入推荐');
  return {symbol,assetClass:'equity',bars:bars.slice(-260),asOf:date,source:'腾讯公共美股行情（延迟）',adjustment:t.adjustment,quote:t.quote,warnings:['公共行情覆盖可能不完整；不代表实时可成交价格。']};
}
export async function advanceScan(state:ScanState, listings:Listing[], loader=scanSeries, now=new Date()):Promise<ScanState> {
  const next:ScanState={...state,errors:[...state.errors],long:[...state.long],short:[...state.short],updatedAt:now.toISOString()};
  const batch=listings.slice(state.cursor,state.cursor+3);
  const results=await Promise.all(batch.map(async listing=>{try{return {listing,series:await loader(listing.symbol,state.date)};}catch(e){return {listing,error:e instanceof Error?e.message:'行情失败'};}}));
  // Stop on upstream rate limiting instead of advancing past unexamined stocks.
  if(results.some(r=>/429|频率|限流/.test(r.error ?? ''))) throw Error('行情源限流，请稍后续跑；进度已保留。');
  const eligible:Series[]=[];
  for(const r of results){
    if(!r.series){next.failed++;if(next.errors.length<100)next.errors.push({symbol:r.listing.symbol,reason:r.error!});continue;}
    next.analyzed++;
    const b=r.series.bars, last=b.at(-1)!;
    const averageDollarVolume=b.slice(-20).reduce((n,x)=>n+x.close*x.volume,0)/20;
    if(last.close<5 || averageDollarVolume<5_000_000){next.ineligible++;continue;}
    eligible.push(r.series);
  }
  const ranked=stockCandidates([...next.long,...next.short,...eligible],now);
  next.long=ranked.long.map(x=>x.series);next.short=ranked.short.map(x=>x.series);
  next.cursor+=batch.length;next.status=next.cursor>=next.total?'complete':'running';
  return next;
}
