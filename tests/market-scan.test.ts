import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDirectory, stockUniverse } from '../lib/universe.ts';
import { advanceScan, type ScanState } from '../lib/market-scan.ts';
import type { Series } from '../lib/engine.ts';
const now=new Date('2026-09-09T12:00:00Z');
test('old completed scans restart from zero under the new rules',async()=>{
  const old={...state(4),status:'complete' as const,cursor:4,analyzed:4,long:[series('OLD')]};
  const listings=['AAA','BBB','CCC','DDD'].map(symbol=>({symbol,name:symbol,exchange:'N'}));
  const result=await advanceScan(old,listings,async symbol=>series(symbol),now);
  assert.equal(result.cursor,3);assert.equal(result.analyzed,3);assert.equal(result.long.length,0);
  assert.equal(result.ruleVersion,'retest-reversal-v2');assert.equal(result.status,'running');
});
function state(total=4):ScanState{return {date:'2026-09-08',startedAt:now.toISOString(),updatedAt:now.toISOString(),status:'running',total,cursor:0,analyzed:0,ineligible:0,failed:0,excluded:0,directoryStamps:[],errors:[],long:[],short:[]};}
function series(symbol:string):Series{const bars=Array.from({length:100},(_,i)=>{const c=100+.06*i+3*Math.sin(i*.7+1.2);return {date:new Date(Date.UTC(2026,5,1+i)).toISOString().slice(0,10),open:c-.4,high:c+.5,low:c-.5,close:c,volume:i===99?2000000:1000000};});return {symbol,bars,source:'test fixture',asOf:'2026-09-08',adjustment:'qfqday',warnings:[]};}
test('directory parsing excludes ETFs, test issues and warrants but preserves ordinary shares',()=>{
  const r=parseDirectory('Symbol|Security Name|Test Issue|ETF\nAAA|AAA Common Stock|N|N\nETF|Fund|N|Y\nTEST|Test Stock|Y|N\nAAAW|AAA Warrants|N|N\nFile Creation Time: 0909202606:00|||',true);
  assert.deepEqual(r.listings.map(x=>x.symbol),['AAA']);assert.equal(r.excluded,3);
  assert.throws(()=>parseDirectory('Symbol|Security Name|Test Issue\nA|Stock|N',true),/生成时间/);
});
test('truncated directory cannot silently become an all-market universe',async()=>{
  await assert.rejects(stockUniverse(async()=>Response.json({error:'unavailable'})),/格式/);
});
test('batch progression persists failures and does not stop at the first two matches',async()=>{
  const listings=['AAA','BBB','CCC','DDD'].map(symbol=>({symbol,name:symbol,exchange:'N'}));
  const load=async(symbol:string)=>{if(symbol==='BBB')throw Error('missing history');return series(symbol);};
  const first=await advanceScan(state(),listings,load,now);
  assert.equal(first.cursor,3);assert.equal(first.status,'running');assert.equal(first.failed,1);assert.equal(first.analyzed,2);
  const last=await advanceScan(first,listings,load,now);
  assert.equal(last.cursor,4);assert.equal(last.status,'complete');assert.equal(last.long.length,0);assert.equal(last.analyzed,3);
  assert.equal(first.cursor,3);
});
test('low-liquidity symbols are counted but cannot become recommendations',async()=>{
  const r=await advanceScan(state(1),[{symbol:'AAA',name:'AAA',exchange:'N'}],async symbol=>{const s=series(symbol);s.bars=s.bars.map(b=>({...b,volume:10}));return s;},now);
  assert.equal(r.ineligible,1);assert.equal(r.long.length,0);assert.equal(r.analyzed,1);
});
test('rate limiting aborts without advancing the persisted cursor',async()=>{
  const s=state(1);await assert.rejects(advanceScan(s,[{symbol:'AAA',name:'AAA',exchange:'N'}],async()=>{throw Error('HTTP 429');},now),/限流/);assert.equal(s.cursor,0);
});
