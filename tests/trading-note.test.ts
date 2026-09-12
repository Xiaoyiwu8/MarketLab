import test from 'node:test';
import assert from 'node:assert/strict';
import {volumeNarrative} from '../lib/volume.ts';
import {channelReading} from '../lib/channel.ts';
import {weeks} from '../lib/review.ts';
const now=new Date('2026-09-12T12:00:00Z');
const bars=Array.from({length:22},(_,i)=>({date:new Date(Date.UTC(2026,7,21+i)).toISOString().slice(0,10),open:10,close:10,high:12,low:9,volume:i===21?1350:1000}));
test('weekly channel excludes the unfinished week and respects asset timezone',()=>{
  const history=Array.from({length:23},(_,i)=>({...bars[0],date:new Date(Date.UTC(2026,3,6+i*7)).toISOString().slice(0,10),close:100+i,high:102+i,low:99+i}));
  const boundary=new Date('2026-09-07T01:00:00Z');
  const utc=weeks(history,boundary,'UTC'),ny=weeks(history,boundary,'America/New_York');
  assert.equal(utc.at(-1)?.date,'2026-08-31');
  assert.equal(ny.at(-1)?.date,'2026-08-24');
  assert.equal(channelReading(utc)?.direction,'上升通道');
  const changed=history.map(b=>b.date>='2026-09-07'?{...b,close:1}:b);
  assert.deepEqual(channelReading(weeks(changed,boundary,'UTC')),channelReading(utc));
});
test('channel distinguishes sustained rise, decline and flat series',()=>{
  const trend=(sign:number)=>bars.map((b,i)=>({...b,open:100+sign*i,close:100+sign*i,high:101+sign*i,low:99+sign*i}));
  assert.equal(channelReading(trend(1))?.direction,'上升通道');assert.equal(channelReading(trend(-1))?.direction,'下降通道');assert.equal(channelReading(trend(0))?.direction,'横盘 / 方向不明确');
  const broken=trend(1);broken[21]={...broken[21],close:90,low:89};assert.equal(channelReading(broken)?.position,'收盘下破原统计通道');assert.equal(channelReading(broken)?.upper,channelReading(trend(1))?.upper);
  assert.equal(channelReading(bars.slice(0,10)),null);
});
test('percentage expresses 135% of previous twenty sessions, not a 135% increase',()=>{const s=volumeNarrative(bars,now);assert.equal(s.average20,1000);assert.equal(s.ratioPct,135);assert.equal(s.volumeState,'放量');});
test('missing or zero baseline never manufactures completion percentages',()=>{assert.equal(volumeNarrative(bars.slice(0,10),now).ratioPct,null);assert.equal(volumeNarrative(bars.map(b=>({...b,volume:0})),now).ratioPct,null);});
test('current-day incomplete volume cannot replace the completed-session explanation',()=>{const s=volumeNarrative([...bars,{...bars.at(-1)!,date:'2026-09-12',volume:999999}],now);assert.equal(s.ratioPct,135);assert.notEqual(s.last?.date,'2026-09-12');});
