import test from 'node:test';
import assert from 'node:assert/strict';
import type { Series } from '../lib/engine.ts';
import { matureSetup } from '../lib/maturity.ts';
import { stockCandidates } from '../lib/candidates.ts';

const now=new Date('2026-09-10T12:00:00Z');
function sample(side:'long'|'short'='long', phase=3):Series {
  const rows=Array.from({length:80},(_,i)=>({open:100,close:100+Math.sin(i*Math.PI/2),high:102,low:98,volume:1000}));
  rows.push(...[
    {open:102,close:103,high:103.3,low:101.8,volume:1800},
    {open:103,close:102.6,high:102.9,low:102.1,volume:700},
    {open:102.6,close:103.2,high:103.4,low:102.3,volume:2000},
  ].slice(0,phase));
  const bars=rows.map((b,i)=>({...b,date:new Date(Date.UTC(2026,5,18+i)).toISOString().slice(0,10)}));
  return {symbol:'TEST',source:'test fixture',adjustment:'qfqday',asOf:bars.at(-1)!.date,warnings:[],bars:side==='long'?bars:bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}))};
}
test('confirmed structures with a real target fill at most two slots per side',()=>{
  const stocks:Series[]=[];
  for(const side of ['long','short'] as const){
    for(let n=0;n<3;n++){
      const s=sample();s.symbol=side+n;
      for(let i=0;i<40;i++)s.bars[i]={...s.bars[i],open:96,close:96,high:98,low:94};
      s.bars[20].high=115;
      if(side==='short')s.bars=s.bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}));
      stocks.push(s);
    }
  }
  const r=stockCandidates(stocks,now);
  assert.equal(r.long.length,2);assert.equal(r.short.length,2);
  assert.ok(r.long.every(x=>x.long!.checks.every(c=>c.pass)));
  assert.ok(r.short.every(x=>x.short!.checks.every(c=>c.pass)));
});
for(const side of ['long','short'] as const){
  test(`${side}: breakout alone and retest alone are not confirmed`,()=>{
    assert.equal(matureSetup(sample(side,1),side,now)?.confirmed,false);
    assert.equal(matureSetup(sample(side,2),side,now)?.confirmed,false);
  });
  test(`${side}: separate retest and confirmation pass; missing target stays missing`,()=>{
    const r=matureSetup(sample(side),side,now);
    assert.equal(r?.confirmed,true);assert.ok(r && 'rr' in r);assert.equal(r.rr,null);
  });
  test(`${side}: return inside the original box invalidates the attempt`,()=>{
    const s=sample(side);if(side==='long')s.bars.at(-2)!.low=101.9;else s.bars.at(-2)!.high=98.1;
    assert.equal(matureSetup(s,side,now)?.state,'invalid');
  });
  test(`${side}: unfinished confirmation and stale history cannot qualify`,()=>{
    const s=sample(side);assert.notEqual(matureSetup(s,side,new Date(s.asOf+'T12:00:00Z'))?.confirmed,true);
    assert.equal(matureSetup(s,side,new Date('2026-10-10')),null);
  });
}
