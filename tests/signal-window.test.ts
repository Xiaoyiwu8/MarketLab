import test from 'node:test';
import assert from 'node:assert/strict';
import {leftFixture,rightFixture} from './candidate-fixtures.ts';
import {matureSetup} from '../lib/maturity.ts';
import {reversalSetup} from '../lib/reversal.ts';
const now=new Date('2026-09-12T12:00:00Z');
test('earlier failed breakout cannot suppress a later valid independent setup',()=>{
  const s=rightFixture();
  s.bars[68]={...s.bars[68],open:102,close:103,high:103.05,low:101.9};
  s.bars[80]={...s.bars[80],open:103,close:104,high:104.3,low:102.8};
  s.bars[81]={...s.bars[81],open:104,close:103.6,high:103.9,low:103.1};
  s.bars[82]={...s.bars[82],open:103.6,close:104.2,high:104.4,low:103.3};
  const r=matureSetup(s,'long',now);assert.equal(r?.confirmed,true);assert.equal(r?.breakoutDate,s.bars[80].date);
});
test('right-side confirmation survives next session but expires after three sessions',()=>{
  const s=rightFixture();
  const append=()=>{const b=s.bars.at(-1)!;s.bars.push({...b,date:new Date(Date.parse(b.date)+864e5).toISOString().slice(0,10),open:103,close:103.1,high:103.3,low:102.4,volume:500});};
  append();const r=matureSetup(s,'long',now);assert.equal(r?.confirmed,true);assert.ok(r&&'age'in r);assert.equal(r.age,1);
  append();assert.equal(matureSetup(s,'long',now)?.confirmed,true);
  append();assert.equal(matureSetup(s,'long',now)?.confirmed,false);
});
for(const side of ['long','short'] as const)test(`${side}: repeated support/resistance touch need not sweep the boundary`,()=>{
  const s=leftFixture(side),setup=s.bars.at(-2)!;
  if(side==='long')setup.low+=0.1;else setup.high-=0.1;
  assert.equal(reversalSetup(s,side,now)?.confirmed,true);
  const b=s.bars.at(-1)!;s.bars.push({...b,date:new Date(Date.parse(b.date)+864e5).toISOString().slice(0,10),volume:500});
  assert.equal(reversalSetup(s,side,now)?.confirmed,true);
});
