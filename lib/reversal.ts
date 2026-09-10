import type { Series } from './engine.ts';
import { tradeGuidance } from './trade-guidance.ts';
import { rangeCenter } from './range-center.ts';
import { isCryptoSymbol } from './assets.ts';

// Observable daily price/volume evidence only: no inference about investor identity.
export function reversalSetup(series:Series, side:'long'|'short', now=new Date()) {
  if(series.assetClass==='crypto'||isCryptoSymbol(series.symbol))return null;
  const g=tradeGuidance(series,now);
  if(!g?.eligible||g.bars.length<122)return null;
  const prior=g.bars.slice(0,-1), setup=prior.at(-1)!, last=g.last;
  // Range excludes both the sweep/rejection day and the confirmation day.
  const range=rangeCenter({...series,bars:prior},40,now);
  if(!range?.qualified)return null;
  const history=g.bars.slice(-122,-2), high=Math.max(...history.map(b=>b.high)),low=Math.min(...history.map(b=>b.low));
  const span=high-low;if(!(span>0))return null;
  const isLong=side==='long', boundary=isLong?range.low:range.high;
  const baseline=prior.slice(-21,-1).reduce((sum,b)=>sum+b.volume,0)/20;
  const ratio=baseline>0?setup.volume/baseline:0;
  const location=(range.center-low)/span;
  const sweep=isLong
    ? setup.low<range.low && setup.low>=range.low-0.75*g.atr && setup.close>range.low && setup.close<=range.lowerZone
    : setup.high>range.high && setup.high<=range.high+0.75*g.atr && setup.close<range.high && setup.close>=range.upperZone;
  const confirm=isLong
    ? last.close>setup.high && last.close>last.open && last.low>=setup.low && last.close<range.center
    : last.close<setup.low && last.close<last.open && last.high<=setup.high && last.close>range.center;
  const stop=isLong?setup.low-0.25*g.atr:setup.high+0.25*g.atr;
  const target=range.center, risk=isLong?last.close-stop:stop-last.close;
  const rr=risk>0?(isLong?target-last.close:last.close-target)/risk:null;
  const checks=[
    {label:'40日横盘区间，上下沿分别多次测试',pass:range.qualified},
    {label:isLong?'处于此前120日价格范围的低位':'处于此前120日价格范围的高位',pass:isLong?location<=0.35:location>=0.65},
    {label:isLong?'跌破支撑后收回区间（黄金坑形态候选）':'冲过压力后收回区间（假突破形态候选）',pass:sweep},
    {label:isLong?'次日收盘超过试探日高点，未继续破底':'次日收盘跌破试探日低点，未继续创新高',pass:confirm},
    {label:'试探日或确认日量比至少1.2',pass:ratio>=1.2||(g.ratio??0)>=1.2},
    {label:'以原区间中位价为第一目标，收益风险比至少2',pass:stop>0&&rr!==null&&rr>=2},
  ];
  return {strategy:isLong?'左侧 · 黄金坑反转':'左侧 · 高位压力反转做空',boundary,setupDate:setup.date,confirmationDate:last.date,
    stop,target,rr,checks,confirmed:checks.every(c=>c.pass)};
}
