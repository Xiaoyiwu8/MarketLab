import test from 'node:test';
import assert from 'node:assert/strict';
import { stockCandidates } from '../lib/candidates.ts';
import type { Series } from '../lib/engine.ts';
const now=new Date('2026-09-09T12:00:00Z');
function fixture(symbol:string,dir:number):Series {
  const phase=dir===1?1.2:4.2;
  const bars=Array.from({length:100},(_,i)=>{
    const c=100+dir*.06*i+3*Math.sin(i*.7+phase);
    return {date:new Date(Date.UTC(2026,5,1+i)).toISOString().slice(0,10),open:c-dir*.4,high:c+.5,low:c-.5,close:c,volume:i===99?2000:1000};
  });
  return {symbol,bars,source:'test fixture',asOf:bars.at(-1)!.date,adjustment:'none',warnings:[]};
}
test('both directions produce at most two unique candidates with all checks passing',()=>{
  const stocks=[fixture('AAA',1),fixture('BBB',1),fixture('CCC',1),fixture('DDD',-1),fixture('EEE',-1),fixture('FFF',-1)];
  const r=stockCandidates([...stocks,stocks[0]],now);
  assert.equal(r.count,6); assert.equal(r.long.length,2); assert.equal(r.short.length,2);
  assert.ok(r.long.every(x=>x.long!.checks.every(c=>c.pass)));
  assert.ok(r.short.every(x=>x.short!.checks.every(c=>c.pass)));
  assert.ok(r.short.every(x=>x.short!.stop>x.short!.g.last.close));
});
test('demo, stale and crypto data cannot fill equity recommendation slots',()=>{
  const s=fixture('AAA',1);
  assert.equal(stockCandidates([{...s,source:'合成演示数据'}],now).long.length,0);
  assert.equal(stockCandidates([s],new Date('2026-10-01')).long.length,0);
  assert.equal(stockCandidates([{...s,symbol:'BTC'},{...s,assetClass:'crypto'}],now).count,0);
});
