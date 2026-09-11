import type { Series } from './engine.ts';
import { tradeGuidance } from './trade-guidance.ts';

export const SIGNAL_VERSION = 'signal-window-v4';

// A daily breakout/retest approximation, NOT a Chan-theory third buy/sell point.
// Freeze the box at the first qualifying breakout; never move it to rescue a failure.
export function matureSetup(series: Series, side: 'long' | 'short', now = new Date()) {
  const g = tradeGuidance(series, now);
  if (!g?.eligible) return null;
  const sign = side === 'long' ? 1 : -1;
  const bars = g.bars.map(b => ({...b, open: sign*b.open, close: sign*b.close,
    high: sign === 1 ? b.high : -b.low, low: sign === 1 ? b.low : -b.high}));
  const last = bars.at(-1)!;
  for (let i = Math.max(40, bars.length - 15); i < bars.length; i++) {
    const box = bars.slice(i-20, i);
    const edge = Math.max(...box.map(b=>b.high));
    const floor = Math.min(...box.map(b=>b.low));
    const width = edge-floor;
    const path = box.slice(1).reduce((sum,b,k)=>sum+Math.abs(b.close-box[k].close),0);
    const efficiency = path ? Math.abs(box.at(-1)!.close-box[0].close)/path : 0;
    // Reject directional runs masquerading as a consolidation.
    if (!(width > 0) || width/Math.abs((edge+floor)/2)>0.2 || efficiency>0.35) continue;
    const tr = box.slice(1).map((b,k)=>Math.max(b.high-b.low,Math.abs(b.high-box[k].close),Math.abs(b.low-box[k].close)));
    const atr = tr.reduce((a,b)=>a+b,0)/tr.length;
    if (!(atr>0) || bars[i].close <= edge+0.1*atr) continue;
    const after = bars.slice(i+1);
    const base = {boundary:sign*edge, breakoutDate:bars[i].date, atr};
    // Strict rule: returning inside the frozen box invalidates this attempt.
    if (after.some(b=>b.low<edge)) continue;
    if (!after.length) continue;
    const retest = after.findIndex(b=>b.low<=edge+0.5*atr && b.close<=bars[i].close);
    if (retest<0) continue;
    const r = i+1+retest;
    const trigger = (k:number) => bars[k].close>Math.max(...bars.slice(r,k).map(b=>b.high)) && bars[k].close>bars[k].open;
    // A separate later bar must confirm. Do not reissue an old trigger every day.
    const confirmation=bars.findIndex((_,k)=>k>r && trigger(k));
    if(confirmation<0 || bars.length-1-confirmation>2) continue;
    if (last.close-edge>atr) continue;
    const stopN = Math.min(...bars.slice(r,confirmation+1).map(b=>b.low))-0.25*atr;
    // Only pre-breakout, already-confirmed swing levels may supply a target.
    const history = bars.slice(Math.max(0,i-120),i);
    const targets = history.filter((b,k)=>k>=2 && k<history.length-2 && b.high>bars[confirmation].close &&
      history.slice(k-2,k+3).every(x=>x.high<=b.high)).map(b=>b.high);
    const targetN = targets.length ? Math.min(...targets) : null;
    if(bars.slice(confirmation+1).some(b=>b.low<=stopN || (targetN!==null && b.high>=targetN))) continue;
    const baseline=bars.slice(confirmation-20,confirmation).reduce((s,b)=>s+b.volume,0)/20;
    const risk = last.close-stopN;
    const rr = targetN!==null && risk>0 ? (targetN-last.close)/risk : null;
    return {...base,state:'confirmed' as const,confirmed:true,reason:'突破、独立回踩和后续确认均成立',
      retestDate:bars[r].date,confirmationDate:bars[confirmation].date,age:bars.length-1-confirmation,volumeConfirmed:baseline>0&&bars[confirmation].volume/baseline>=1.2,stop:sign*stopN,
      target:targetN===null?null:sign*targetN,rr};
  }
  return {state:'waiting' as const,confirmed:false,boundary:undefined,breakoutDate:undefined,reason:'未找到仍有效的突破回踩结构（含失效、未确认或超出入场范围）'};
}
