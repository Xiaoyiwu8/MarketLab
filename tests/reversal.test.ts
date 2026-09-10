import test from 'node:test';
import assert from 'node:assert/strict';
import { reversalSetup } from '../lib/reversal.ts';
import { stockCandidates } from '../lib/candidates.ts';
import type { Series } from '../lib/engine.ts';
const now=new Date('2026-09-10T12:00:00Z');
function sample(side:'long'|'short'):Series {
  const bars=Array.from({length:122},(_,i)=>{
    const c=i<80?120:100+4.8*Math.sin((i-80)*Math.PI/5);
    return {date:new Date(Date.UTC(2026,4,10+i)).toISOString().slice(0,10),open:c,close:c,high:c+.1,low:c-.1,volume:1000};
  });
  const edge=Math.min(...bars.slice(80,120).map(b=>b.low));
  bars[120]={...bars[120],open:edge+.1,close:edge+.2,high:edge+.3,low:edge-.1,volume:1500};
  bars[121]={...bars[121],open:edge+.2,close:edge+.5,high:edge+.6,low:edge+.1,volume:1800};
  return {symbol:side,source:'test fixture',warnings:[],adjustment:'qfqday',asOf:bars.at(-1)!.date,bars:side==='long'?bars:bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}))};
}
for(const side of ['long','short'] as const){
  test(`${side}: range sweep and independent reversal qualify`,()=>{
    const r=reversalSetup(sample(side),side,now);assert.ok(r);assert.equal(r.confirmed,true,JSON.stringify(r.checks));
  });
  test(`${side}: no sweep or continuing breakout cannot qualify`,()=>{
    const s=sample(side);s.bars.at(-2)!.close=side==='long'?90:110;
    assert.notEqual(reversalSetup(s,side,now)?.confirmed,true);
  });
  test(`${side}: only cheap or expensive without confirmation is not enough`,()=>{
    const s=sample(side);s.bars.at(-1)!.close=s.bars.at(-2)!.close;
    assert.notEqual(reversalSetup(s,side,now)?.confirmed,true);
  });
  test(`${side}: incomplete, demo, stale and crypto are excluded`,()=>{
    const s=sample(side);
    assert.notEqual(reversalSetup(s,side,new Date(s.asOf+'T12:00:00Z'))?.confirmed,true);
    assert.equal(reversalSetup({...s,source:'合成演示'},side,now),null);
    assert.equal(reversalSetup(s,side,new Date('2026-10-10')),null);
    assert.equal(reversalSetup({...s,symbol:'BTC'},side,now),null);
  });
}
test('combined list deduplicates and caps each side at two; labels reversal strategy',()=>{
  const data=['long','short'].flatMap(side=>Array.from({length:4},(_,i)=>({...sample(side as 'long'|'short'),symbol:side+i})));
  const r=stockCandidates([...data,data[0]],now);
  assert.equal(r.count,8);assert.equal(r.long.length,2);assert.equal(r.short.length,2);
  assert.ok(r.long.every(x=>x.longStrategy==='左侧 · 黄金坑反转'));
  assert.ok(r.short.every(x=>x.shortStrategy==='左侧 · 高位压力反转做空'));
});
