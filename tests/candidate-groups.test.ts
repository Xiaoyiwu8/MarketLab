import test from 'node:test';
import assert from 'node:assert/strict';
import { leftFixture,rightFixture } from './candidate-fixtures.ts';
import { stockCandidates } from '../lib/candidates.ts';
import { advanceScan,type ScanState } from '../lib/market-scan.ts';
import { SIGNAL_VERSION } from '../lib/maturity.ts';
const now=new Date('2026-09-10T12:00:00Z');
function universe(){
  return (['long','short'] as const).flatMap(side=>Array.from({length:3},(_,i)=>{
    const l=leftFixture(side);l.symbol='L'+side+i;
    const r=rightFixture();r.symbol='R'+side+i;
    for(let k=0;k<40;k++)r.bars[k]={...r.bars[k],open:96,close:96,high:98,low:94};
    r.bars[20].high=115;
    if(side==='short')r.bars=r.bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}));
    for(const s of [l,r])s.bars=s.bars.map(b=>({...b,volume:b.volume*1000}));
    return [l,r];
  }).flat());
}
test('four independent groups preserve 2 left long, 2 left short, 2 right long, 2 right short',()=>{
  const data=universe(),r=stockCandidates([...data,data[0]],now);
  for(const group of [r.left,r.right]){assert.equal(group.long.length,2);assert.equal(group.short.length,2);}
  assert.equal(r.long.length+r.short.length,8);
  assert.equal(new Set([...r.long,...r.short].map(x=>x.series.symbol)).size,8);
  const leftOnly=stockCandidates(data.filter(s=>s.symbol.startsWith('L')),now);
  assert.equal(leftOnly.right.long.length+leftOnly.right.short.length,0);
});
test('incremental scan retains all four groups, including later batches',async()=>{
  const data=universe(),listings=data.map(s=>({symbol:s.symbol,name:s.symbol,exchange:'N'}));
  let state:ScanState={ruleVersion:SIGNAL_VERSION,date:'2026-09-09',startedAt:now.toISOString(),updatedAt:now.toISOString(),status:'running',total:data.length,cursor:0,analyzed:0,ineligible:0,failed:0,excluded:0,directoryStamps:[],errors:[],long:[],short:[]};
  while(state.status!=='complete')state=await advanceScan(state,listings,async symbol=>data.find(s=>s.symbol===symbol)!,now);
  const r=stockCandidates([...state.long,...state.short],now);
  assert.equal(state.long.length,4);assert.equal(state.short.length,4);
  for(const reasons of Object.values(state.rejections!))assert.equal(Object.values(reasons).reduce((a,b)=>a+b,0),data.length);
  for(const group of [r.left,r.right]){assert.equal(group.long.length,2);assert.equal(group.short.length,2);}
});
