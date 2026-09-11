import type { Series } from './engine.ts';
import { tradeGuidance } from './trade-guidance.ts';
import { rangeCenter } from './range-center.ts';
import { isCryptoSymbol } from './assets.ts';

// Observable daily price/volume evidence only: no inference about investor identity.
function evaluateReversal(series:Series, side:'long'|'short', now:Date, lag:number) {
  if(series.assetClass==='crypto'||isCryptoSymbol(series.symbol))return null;
  const g=tradeGuidance(series,now);
  if(!g?.eligible||g.bars.length<122)return null;
  const prior=g.bars.slice(0,-lag), setup=prior.at(-1)!, last=g.last;
  if(prior.length<121)return null;
  const atr=tradeGuidance({...series,bars:prior},now)!.atr;
  // Range excludes both the sweep/rejection day and the confirmation day.
  const range=rangeCenter({...series,bars:prior},40,now);
  if(!range?.qualified)return null;
  const history=prior.slice(-121,-1), high=Math.max(...history.map(b=>b.high)),low=Math.min(...history.map(b=>b.low));
  const span=high-low;if(!(span>0))return null;
  const isLong=side==='long', boundary=isLong?range.low:range.high;
  const baseline=prior.slice(-21,-1).reduce((sum,b)=>sum+b.volume,0)/20;
  const ratio=baseline>0?setup.volume/baseline:0;
  const location=(range.center-low)/span;
  const sweep=isLong
    ? setup.low<range.low && setup.low>=range.low-0.75*atr && setup.close>range.low && setup.close<=range.lowerZone
    : setup.high>range.high && setup.high<=range.high+0.75*atr && setup.close<range.high && setup.close>=range.upperZone;
  const touch=isLong
    ? setup.low>=range.low && setup.low<=range.low+0.5*atr && setup.close<=range.lowerZone && setup.close>setup.open
    : setup.high<=range.high && setup.high>=range.high-0.5*atr && setup.close>=range.upperZone && setup.close<setup.open;
  const confirmationIndex=g.bars.findIndex((b,k)=>k>=prior.length && (isLong?b.close>setup.high&&b.close>b.open:b.close<setup.low&&b.close<b.open));
  const age=confirmationIndex<0?Infinity:g.bars.length-1-confirmationIndex;
  const confirmationVolume=confirmationIndex<20?0:g.bars[confirmationIndex].volume;
  const confirmationAverage=confirmationIndex<20?0:g.bars.slice(confirmationIndex-20,confirmationIndex).reduce((s,b)=>s+b.volume,0)/20;
  const intact=g.bars.slice(prior.length).every(b=>isLong?b.low>=setup.low&&b.high<range.center:b.high<=setup.high&&b.low>range.center);
  const confirm=age<=2 && intact && (isLong
    ? last.close>setup.high && last.close>last.open && last.low>=setup.low && last.close<range.center
    : last.close<setup.low && last.close<last.open && last.high<=setup.high && last.close>range.center);
  const stop=isLong?setup.low-0.25*atr:setup.high+0.25*atr;
  const target=range.center, risk=isLong?last.close-stop:stop-last.close;
  const rr=risk>0?(isLong?target-last.close:last.close-target)/risk:null;
  const checks=[
    {label:'40日横盘区间，上下沿分别多次测试',pass:range.qualified},
    {label:isLong?'处于此前120日价格范围的低位':'处于此前120日价格范围的高位',pass:isLong?location<=0.35:location>=0.65},
    {label:isLong?'低位假跌破收回，或支撑附近收阳企稳':'高位假突破收回，或压力附近收阴转弱',pass:sweep||touch},
    {label:isLong?'5日内转强确认，近3日仍有效且未触及目标':'5日内转弱确认，近3日仍有效且未触及目标',pass:confirm},
    {label:'试探日或确认日量比至少1.2',pass:ratio>=1.2||(confirmationAverage>0&&confirmationVolume/confirmationAverage>=1.2)},
    {label:'以原区间中位价为第一目标，收益风险比至少2',pass:stop>0&&rr!==null&&rr>=2},
  ];
  return {strategy:isLong?(sweep?'左侧 · 黄金坑反转':'左侧 · 支撑企稳'):'左侧 · 高位压力反转做空',boundary,setupDate:setup.date,confirmationDate:confirmationIndex<0?undefined:g.bars[confirmationIndex].date,age,
    stop,target,rr,checks,confirmed:checks.every(c=>c.pass)};
}

export function reversalSetup(series:Series,side:"long"|"short",now=new Date()){
  let fallback:ReturnType<typeof evaluateReversal>=null;
  for(let lag=1;lag<=5;lag++){const plan=evaluateReversal(series,side,now,lag);if(plan?.confirmed)return plan;if(!fallback&&plan)fallback=plan;}
  return fallback;
}
