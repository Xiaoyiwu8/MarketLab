import type { Series } from './engine.ts';
import { tradeGuidance } from './trade-guidance.ts';

export const SIGNAL_VERSION = 'retest-v1';

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
    if (after.some(b=>b.low<edge)) return {...base,state:'invalid' as const,confirmed:false,reason:'突破后重新进入原区间，本次结构失效'};
    if (!after.length) return {...base,state:'waiting' as const,confirmed:false,reason:'只有突破，等待后续回踩'};
    const retest = after.findIndex(b=>b.low<=edge+0.5*atr && b.close<=bars[i].close);
    if (retest<0) return {...base,state:'waiting' as const,confirmed:false,reason:'尚未回踩原区间边界'};
    const r = i+1+retest;
    const trigger = (k:number) => bars[k].close>Math.max(...bars.slice(r,k).map(b=>b.high)) && bars[k].close>bars[k].open;
    // A separate later bar must confirm. Do not reissue an old trigger every day.
    const earlier = bars.slice(r+1,-1).some((_,k)=>trigger(r+1+k));
    if (r>=bars.length-1 || !trigger(bars.length-1) || earlier)
      return {...base,state:'waiting' as const,confirmed:false,reason:earlier?'确认信号已过去，不重复追价':'回踩后尚未再次转强/转弱确认'};
    if (last.close-edge>atr) return {...base,state:'waiting' as const,confirmed:false,reason:'价格距原边界超过1个区间ATR，不追价'};
    const stopN = Math.min(...bars.slice(r).map(b=>b.low))-0.25*atr;
    // Only pre-breakout, already-confirmed swing levels may supply a target.
    const history = bars.slice(Math.max(0,i-120),i);
    const targets = history.filter((b,k)=>k>=2 && k<history.length-2 && b.high>last.close &&
      history.slice(k-2,k+3).every(x=>x.high<=b.high)).map(b=>b.high);
    const targetN = targets.length ? Math.min(...targets) : null;
    const risk = last.close-stopN;
    const rr = targetN!==null && risk>0 ? (targetN-last.close)/risk : null;
    return {...base,state:'confirmed' as const,confirmed:true,reason:'突破、独立回踩和后续确认均成立',
      retestDate:bars[r].date,confirmationDate:last.date,stop:sign*stopN,
      target:targetN===null?null:sign*targetN,rr};
  }
  return {state:'waiting' as const,confirmed:false,boundary:undefined,breakoutDate:undefined,reason:'近期未形成可验证的区间突破结构'};
}
