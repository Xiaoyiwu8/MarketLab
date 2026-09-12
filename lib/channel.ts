import type {Bar} from './engine.ts';
// Fit the previous 20 completed bars (daily or weekly); test the latest separately.
export function channelReading(completed:Bar[]){
  if(completed.length<21)return null;
  const prior=completed.slice(-21,-1),last=completed.at(-1)!;
  if([...prior,last].some(b=>![b.close,b.high,b.low].every(Number.isFinite)||b.close<=0))return null;
  const mean=prior.reduce((s,b)=>s+b.close,0)/20;
  const xx=prior.reduce((s,_,i)=>s+(i-9.5)**2,0);
  const slope=prior.reduce((s,b,i)=>s+(i-9.5)*(b.close-mean),0)/xx;
  const intercept=mean-slope*9.5;
  const residual=prior.reduce((s,b,i)=>s+(b.close-(intercept+slope*i))**2,0);
  const total=prior.reduce((s,b)=>s+(b.close-mean)**2,0);
  const r2=total>0?Math.max(0,1-residual/total):0;
  const halfWidth=Math.max(2*Math.sqrt(residual/20),prior.reduce((s,b)=>s+b.high-b.low,0)/40);
  const center=intercept+slope*20,upper=center+halfWidth,lower=center-halfWidth;
  const directional=r2>=0.35&&Math.abs(slope/mean)>=0.001;
  const direction=directional?(slope>0?'上升通道':'下降通道'):'横盘 / 方向不明确';
  const position=last.close>upper?'收盘上破原统计通道':last.close<lower?'收盘下破原统计通道':'收盘仍在统计通道内';
  return {direction,position,lower,upper,intercept,slope,halfWidth,closes:[...prior,last].map(b=>b.close),slopePct:slope/mean*100,r2,start:prior[0].date,end:prior.at(-1)!.date,date:last.date};
}
