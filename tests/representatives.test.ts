import test from 'node:test';
import assert from 'node:assert/strict';
import { representatives } from '../lib/representatives.ts';
import { leftFixture } from './candidate-fixtures.ts';
import { advanceScan,type ScanState } from '../lib/market-scan.ts';
import { SIGNAL_VERSION } from '../lib/maturity.ts';
const now=new Date('2026-09-10T12:00:00Z');
function sample(symbol:string){const s=leftFixture('short');s.symbol=symbol;s.bars=s.bars.map(b=>({...b,volume:b.volume*10000}));return s;}
const all=(r:ReturnType<typeof representatives>)=>[...r.left.long,...r.left.short,...r.right.long,...r.right.short];
test('four groups fill with distinct same-direction observations without claiming entry or win probability',()=>{
  const r=representatives(['A','B','C','D','E','F'].map(sample),now);
  for(const group of [r.left,r.right])for(const bucket of [group.long,group.short])assert.equal(bucket.length,2);
  for(const side of ['long','short'] as const)assert.equal(new Set([...r.left[side],...r.right[side]].map(x=>x.series.symbol)).size,4);
  assert.ok(all(r).some(x=>!x.ready));
  for(const x of all(r)){assert.equal(x.completion,Math.round(x.passed/x.total*100));assert.equal(x.ready,x.checks.every(c=>c.pass));if(!x.ready)assert.notEqual(x.status,'条件已满足');assert.equal('cover' in x,false);assert.equal('winProbability' in x,false);}
});
test('invalid, stale, synthetic, crypto and illiquid data cannot fill slots',()=>{
  const stale=sample('STALE');stale.bars=stale.bars.slice(0,80);
  const fake={...sample('FAKE'),source:'演示'};
  const crypto={...sample('BTC'),assetClass:'crypto' as const};
  const low=sample('LOW');low.bars=low.bars.map(b=>({...b,volume:1}));
  const unadjusted={...sample('RAW'),adjustment:'day'};
  assert.equal(all(representatives([stale,fake,crypto,low,unadjusted],now)).length,0);
});
test('representative pool survives batches and matches one-shot selection',async()=>{
  const data=Array.from({length:15},(_,i)=>sample('S'+String(i).padStart(2,'0'))).reverse();
  const listings=data.map(s=>({symbol:s.symbol,name:s.symbol,exchange:'N'}));
  let state:ScanState={ruleVersion:SIGNAL_VERSION,date:'2026-09-08',startedAt:now.toISOString(),updatedAt:now.toISOString(),status:'running',total:data.length,cursor:0,analyzed:0,ineligible:0,failed:0,excluded:0,directoryStamps:[],errors:[],long:[],short:[]};
  while(state.status!=='complete')state=await advanceScan(state,listings,async symbol=>data.find(s=>s.symbol===symbol)!,now);
  const keys=(r:ReturnType<typeof representatives>)=>all(r).map(x=>`${x.group}/${x.side}/${x.series.symbol}`);
  assert.deepEqual(keys(representatives(state.representatives!,now)),keys(representatives(data,now)));
  assert.ok(state.representatives!.length<=16);
});
