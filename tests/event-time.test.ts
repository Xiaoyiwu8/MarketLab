import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRates,validRate} from '../lib/rate-probability.ts';
import { eventPhase, beijingInput, type RiskEvent } from '../lib/event-time.ts';
const now = Date.parse('2026-09-06T12:00:00Z');
test('rate changes compare same meeting and baseline and use percentage points',()=>{
 const a={meeting:'2026-09-16',baseline:'test range',sampledAt:'2026-09-06T10:00:00Z',recordedAt:'2026-09-06T10:00:00Z',hike:60,hold:30,cut:10,source:'https://example.com'};
 const b={...a,sampledAt:'2026-09-06T11:00:00Z',hike:65,hold:25};
 assert.equal(compareRates([a,b],'2026-09-16')?.delta,5);
 assert.equal(compareRates([{...a,baseline:'other'},b],'2026-09-16')?.delta,null);
 assert.equal(compareRates([{...a,meeting:'2026-10-01'},b],'2026-09-16')?.delta,null);
 assert.equal(validRate({...a,hike:90}),false);
 assert.equal(validRate({...a,cut:-10}),false);
});
const base: RiskEvent = {
  id: '1',
  title: 'test',
  kind: 'macro',
  source: 'https://example.com',
  occurredAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 86400000).toISOString(),
  recordedAt: new Date(now).toISOString(),
  updatedAt: new Date(now).toISOString(),
  verified: false,
  severity: '关注',
};
test('event labels respect upcoming, fresh, observation and exact expiry boundaries', () => {
  assert.equal(
    eventPhase(
      { ...base, occurredAt: new Date(now + 3600000).toISOString() },
      now,
    ).label,
    '24小时内即将发生',
  );
  assert.equal(eventPhase(base, now).label, '刚发生 · 6小时内');
  assert.equal(eventPhase(base, now + 6 * 3600000).label, '影响观察期');
  assert.equal(eventPhase(base, now + 86400000).active, false);
  assert.equal(
    eventPhase({ ...base, occurredAt: null }, now).label,
    '事件时间未知',
  );
  assert.equal(
    eventPhase(
      {
        ...base,
        occurredAt: new Date(now + 2 * 86400000).toISOString(),
        expiresAt: new Date(now + 3 * 86400000).toISOString(),
      },
      now,
    ).active,
    false,
  );
});
test('Beijing input converts deterministically and rejects impossible dates', () => {
  assert.equal(beijingInput('2026-09-06T20:00'), '2026-09-06T12:00:00.000Z');
  assert.throws(() => beijingInput('2026-02-30T10:00'));
});
