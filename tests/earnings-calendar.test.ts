import test from 'node:test';
import assert from 'node:assert/strict';
import {nextEarningsWeek,parseEarnings,loadEarningsWeek} from '../lib/earnings-calendar.ts';
import {researchContext} from '../lib/research-context.ts';
import {leftFixture} from './candidate-fixtures.ts';
test('next week follows New York Monday-Sunday across year and timezone boundaries',()=>{
  assert.deepEqual(nextEarningsWeek(new Date('2026-09-12T02:00:00Z')).filter((_,i)=>i===0||i===6),['2026-09-14','2026-09-20']);
  assert.equal(nextEarningsWeek(new Date('2026-09-14T00:01:00Z'))[0],'2026-09-14');
  assert.equal(nextEarningsWeek(new Date('2026-09-14T14:00:00Z'))[0],'2026-09-21');
  assert.equal(nextEarningsWeek(new Date('2026-12-31T14:00:00Z'))[0],'2027-01-04');
});
test('market cap cutoff is inclusive; missing cap and unconfirmed time remain explicit',()=>{
  const rows=['$30,000,000','$29,999,999','N/A'].map((marketCap,i)=>({symbol:'S'+i,name:'Name',marketCap,time:'time-not-supplied'}));
  const p=parseEarnings({status:{rCode:200},data:{asOf:'Mon, Sep 14, 2026',rows}},'2026-09-14');
  assert.equal(p.rows.length,1);assert.equal(p.rows[0].time,'时间未提供');assert.equal(p.excluded,1);assert.equal(p.unknownCap,1);
  assert.throws(()=>parseEarnings({status:{rCode:200},data:{rows:null}},'2026-09-14'));
  assert.throws(()=>parseEarnings({status:{rCode:200},data:{asOf:'Tue, Sep 15, 2026',rows:[]}},'2026-09-14'),/日期不匹配/);
});
test('day failures are preserved separately from valid empty days',async()=>{
  const fake=async(input:RequestInfo|URL)=>{const date=new URL(String(input)).searchParams.get('date')!;if(date.endsWith('19'))throw Error('timeout');return Response.json({status:{rCode:200},data:{asOf:new Date(date+'T12:00Z').toUTCString().slice(0,16),rows:[]}});};
  const r=await loadEarningsWeek(new Date('2026-09-12T02:00Z'),fake);assert.equal(r.checked,6);assert.equal(r.failed.length,1);assert.equal(r.rows.length,0);
});
test('near-term earnings and recent official disclosures block entry independently of technical score',()=>{
  const s=leftFixture('long');s.symbol='ORCL';const now=new Date('2026-09-12T02:00Z');
  assert.equal(researchContext(s,now).eventBlocked,true);
  s.symbol='TEST';const week={start:'2026-09-14',end:'2026-09-20',updatedAt:now.toISOString(),rows:[{symbol:'TEST',name:'Test',date:'2026-09-15',time:'盘后',marketCap:40e6,source:'https://www.nasdaq.com/'}],failed:[],checked:7,excluded:0,unknownCap:0};
  assert.equal(researchContext(s,now,week).eventBlocked,true);
  assert.equal(researchContext(s,new Date('2026-09-14T02:00Z'),week).upcoming.length,0);
});
test('a breakout returning to its frozen range is reported as failed, not a new breakout',()=>{
  const s=leftFixture('long');s.bars=s.bars.map(b=>({...b,open:100,close:100,high:102,low:98}));
  s.bars[s.bars.length-2]={...s.bars.at(-2)!,open:101,close:104,high:105,low:101};
  assert.equal(researchContext(s,new Date('2026-09-12T02:00Z')).failures[0].side,'long');
});
