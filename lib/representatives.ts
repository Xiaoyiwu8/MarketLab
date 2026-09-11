import type { Series } from './engine.ts';
import { stockCandidates } from './candidates.ts';

export type Representative = {
  series:Series; group:'left'|'right'; side:'long'|'short'; strategy:string;
  checks:{label:string;pass:boolean}[]; passed:number; total:number; completion:number;
  status:'条件已满足'|'接近条件'|'条件不足'; ready:boolean;
  date?:string; confirmationDate?:string; boundary?:number;
  stop:number|null; target:number|null; rr:number|null; liquidity:number;
};
const leftLabels=['40日横盘区间合格','处于120日价格范围的相应高低位','支撑或压力附近出现反转形态','独立确认且结构仍有效','试探日或确认日量比至少1.2','原区间目标收益风险比至少2'];
export function representatives(data:Series[],now=new Date()) {
  const items:Representative[]=[];
  for(const item of stockCandidates(data,now).evaluated){
    const g=item.long;
    if(!g?.eligible || !item.series.adjustment.includes('qfqday') || g.last.close<5)continue;
    const liquidity=g.bars.slice(-20).reduce((s,b)=>s+b.close*b.volume,0)/20;
    if(liquidity<5_000_000)continue;
    for(const group of ['left','right'] as const)for(const side of ['long','short'] as const){
      if(group==='left'&&g.bars.length<122)continue;
      const left=side==='long'?item.leftLong:item.leftShort;
      const right=side==='long'?item.longSetup:item.shortSetup;
      const checks=group==='left'?(left?.checks??leftLabels.map(label=>({label,pass:false}))):(side==='long'?item.rightLongChecks:item.rightShortChecks);
      if(!checks.length)continue;
      const passed=checks.filter(c=>c.pass).length,total=checks.length,ready=passed===total;
      // Near-ready requires a confirmed structure. A high count cannot bypass it.
      const structure=group==='left'?!!left?.checks.slice(0,4).every(c=>c.pass):!!right?.confirmed;
      const status=ready?'条件已满足':structure&&total-passed===1?'接近条件':'条件不足';
      const plan=group==='left'?left:right?.confirmed&&'stop'in right?right:null;
      items.push({series:item.series,group,side,strategy:group==='left'?(left?.strategy??(side==='long'?'左侧 · 支撑反转观察':'左侧 · 压力反转观察')):(side==='long'?'右侧 · 突破回踩观察':'右侧 · 跌破回抽观察'),checks,passed,total,completion:Math.round(passed/total*100),ready,status,
        date:group==='left'?left?.setupDate:right?.breakoutDate,confirmationDate:plan?.confirmationDate,boundary:plan?.boundary,
        stop:plan?.stop??null,target:plan?.target??null,rr:plan?.rr??null,liquidity});
    }
  }
  const rank=(a:Representative,b:Representative)=>Number(b.ready)-Number(a.ready)||(b.status==='接近条件'?1:0)-(a.status==='接近条件'?1:0)||b.passed/b.total-a.passed/a.total||(b.rr??-Infinity)-(a.rr??-Infinity)||b.liquidity-a.liquidity||a.series.symbol.localeCompare(b.series.symbol)||a.group.localeCompare(b.group);
  const sorted=items.sort(rank);
  const left={long:[] as Representative[],short:[] as Representative[]},right={long:[] as Representative[],short:[] as Representative[]};
  const used={long:new Set<string>(),short:new Set<string>()};
  for(const item of sorted){const bucket=(item.group==='left'?left:right)[item.side];if(bucket.length<2&&!used[item.side].has(item.series.symbol)){bucket.push(item);used[item.side].add(item.series.symbol);}}
  // Retain four per group: the other strategy can occupy at most two symbols.
  // Keeping only displayed winners loses future alternatives across scan batches.
  const pool=new Map<string,Series>();
  for(const group of ['left','right'] as const)for(const side of ['long','short'] as const)
    for(const item of sorted.filter(x=>x.group===group&&x.side===side).slice(0,4))pool.set(item.series.symbol,item.series);
  return {left,right,pool:[...pool.values()]};
}
