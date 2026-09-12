import test from 'node:test';
import assert from 'node:assert/strict';
import {chainStatus,logicGate,validateEvidence,type Evidence} from '../lib/logic.ts';
import {parseFeed,feedSources,loadLogicFeed} from '../lib/logic-feed.ts';
import {sourceText,sourceDigest,watchableSource} from '../lib/source-watch.ts';
import {logicOwner} from '../lib/logic-auth.ts';
const now=new Date('2026-09-12T10:00:00Z');
const base:Evidence={id:'one',thesisId:'thesis-one',revision:1,chain:'ai',symbols:['ORCL'],fact:'季度现金流需要复核',interpretation:'等待确认',source:'https://example.com/report',publishedAt:'2026-09-10T10:00:00Z',recordedAt:'2026-09-11T10:00:00Z',expiresAt:'2026-09-13T10:00:00Z',stance:'contradicts',action:'block-long'};
test('negative evidence blocks only its assigned symbols and direction',()=>{
  const state={rows:[base],available:true};
  assert.equal(logicGate(state,'ORCL','long',+now).blocked,true);
  assert.equal(logicGate(state,'ORCL','short',+now).blocked,false);
  assert.equal(logicGate(state,'NVDA','long',+now).blocked,false);
  assert.equal(logicGate({...state,rows:[{...base,symbols:['*']}]},'NVDA','long',+now).blocked,true);
});
test('expired restrictions and unavailable database fail closed',()=>{
  assert.match(logicGate({rows:[{...base,expiresAt:'2026-09-12T09:00:00Z'}],available:true},'ORCL','long',+now).reasons[0],/已过期/);
  assert.equal(logicGate(undefined,'ORCL','long',+now).blocked,true);
  assert.equal(chainStatus([{...base,expiresAt:'2026-09-12T09:00:00Z'}],'ai',+now),'证据过期 · 待复核');
});
test('append-only revision releases only its own restriction, not unrelated risks or future evidence',()=>{
  const clear:Evidence={...base,id:'two',revision:2,action:'clear',recordedAt:'2026-09-12T09:00:00Z'};
  const original=structuredClone(base);
  assert.equal(logicGate({available:true,rows:[base,clear]},'ORCL','long',+now).blocked,false);
  assert.equal(logicGate({available:true,rows:[base,clear,{...base,thesisId:'other'}]},'ORCL','long',+now).blocked,true);
  assert.equal(logicGate({available:true,rows:[base,{...clear,recordedAt:'2026-09-13T00:00:00Z'}]},'ORCL','long',+now).blocked,true);
  assert.deepEqual(base,original);
});
test('mixed evidence is reported without manufacturing a probability or causal proof',()=>{
  assert.equal(chainStatus([base,{...base,thesisId:'support',stance:'supports'}],'ai',+now),'支持与反证并存');
  assert.equal(chainStatus([],'ai',+now),'待验证假设');
});
test('evidence validates dates, source links, scopes, versions and fact/interpretation separately',()=>{
  const input={...base,expectedRevision:1};
  assert.equal(validateEvidence(input,now).expectedRevision,1);
  for(const update of [{publishedAt:'2026-09-13T00:00:00Z'},{expiresAt:'2026-09-11T00:00:00Z'},{source:'javascript:alert(1)'},{symbols:['*','ORCL']},{expectedRevision:-1},{interpretation:''}])assert.throws(()=>validateEvidence({...input,...update},now));
});
test('feed validates official source domains, normalizes duplicate URLs and retains unknown publication dates',()=>{
  const xml='<rss><channel><item><title>A &amp; B</title><link>https://www.federalreserve.gov/a?utm_source=rss</link></item><item><title>same</title><link>https://www.federalreserve.gov/a</link></item><item><title>fake</title><link>https://evil.com/a</link></item></channel></rss>';
  const items=parseFeed(xml,feedSources[0]);assert.equal(items.length,1);assert.equal(items[0].publishedAt,null);assert.equal(items[0].url,'https://www.federalreserve.gov/a');
  assert.throws(()=>parseFeed('<html>Error</html>',feedSources[0]));
});
test('partial source failure remains distinct from valid empty RSS',async()=>{
  const result=await loadLogicFeed(async input=>String(input).includes('eia.gov')?new Response('down',{status:503}):new Response('<rss><channel></channel></rss>'));
  assert.equal(result.sources[0].error,null);assert.match(result.sources[1].error!,/503/);assert.equal(result.sources[2].items.length,0);
});
test('changed, unavailable or stale source checks automatically suspend both entry directions',()=>{
  const row={...base,sourceDigest:'abc',action:'review' as const};
  for(const status of ['changed','unavailable'] as const){
    const state={rows:[row],available:true,checks:[{evidenceId:row.id,checkedAt:now.toISOString(),status,reason:'review'}]};
    assert.equal(logicGate(state,'ORCL','short',+now).blocked,true);
    assert.equal(logicGate(state,'ORCL','long',+now).blocked,true);
  }
  const checks=[{evidenceId:row.id,checkedAt:now.toISOString(),status:'unchanged' as const,reason:'same'}];
  assert.equal(logicGate({rows:[row],available:true,checks},'ORCL','long',+now).blocked,false);
  assert.equal(logicGate({rows:[row],available:true,checks},'ORCL','long',+now+16*60000).blocked,true);
});
test('source watcher rejects arbitrary hosts, credentials, redirects and challenge pages',async()=>{
  assert.equal(watchableSource('https://www.eia.gov/report'),true);
  for(const url of ['http://www.eia.gov/a','https://127.0.0.1/','https://www.eia.gov.evil.com/','https://x:y@www.eia.gov/a','https://www.eia.gov:444/a'])assert.equal(watchableSource(url),false);
  assert.equal(sourceText('<nav>changed nav</nav><main>Actual <b>fact</b></main>'),'Actual fact');
  await assert.rejects(sourceDigest('https://www.eia.gov/a',async()=>new Response('<main>Access denied captcha</main>',{headers:{'Content-Type':'text/html'}})));
  const load=async()=>new Response('<main>'+('Stable source text. '.repeat(20))+'</main>',{headers:{'Content-Type':'text/html'}});
  assert.equal(await sourceDigest('https://www.eia.gov/a',load),await sourceDigest('https://www.eia.gov/a',load));
});
test('local read identity matches write identity and production requires authenticated ownership',()=>{
  const get=new Request('http://localhost:3000/api/logic',{headers:{'sec-fetch-site':'same-origin','oai-authenticated-user-id':'owner-a'}});
  const post=new Request('http://localhost:3000/api/logic',{method:'POST',headers:{Origin:'http://localhost:3000','oai-authenticated-user-id':'owner-a'}});
  assert.equal(logicOwner(get,true),logicOwner(post,true));
  assert.throws(()=>logicOwner(new Request('http://localhost:3000/api/logic',{headers:{'sec-fetch-site':'same-origin'}}),false));
  assert.notEqual(logicOwner(get,true),logicOwner(new Request('http://localhost:3000/api/logic',{headers:{'sec-fetch-site':'same-origin','oai-authenticated-user-id':'owner-b'}}),true));
});
