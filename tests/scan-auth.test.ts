import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeScan} from '../lib/scan-auth.ts';
const req=(url:string,origin?:string,user?:string)=>new Request(url,{headers:{...(origin?{Origin:origin}:{}),...(user?{'oai-authenticated-user-id':user}:{})}});
test('local development scan accepts same-origin browser without hosted login',()=>assert.doesNotThrow(()=>authorizeScan(req('http://localhost:3000/api/scan','http://localhost:3000'),true)));
test('production never treats loopback or development-looking headers as login',()=>{
  assert.throws(()=>authorizeScan(req('http://localhost:3000/api/scan','http://localhost:3000'),false),/登录/);
  assert.throws(()=>authorizeScan(req('https://example.com/api/scan','https://example.com'),true),/登录/);
});
test('local requests require exact origin and block cross-site access',()=>{
  assert.throws(()=>authorizeScan(req('http://localhost:3000/api/scan'),true),/登录/);
  assert.throws(()=>authorizeScan(req('http://localhost:3000/api/scan','https://evil.test'),true),/跨站/);
  assert.throws(()=>authorizeScan(req('https://site.test/api/scan','https://evil.test','owner'),false),/跨站/);
  assert.doesNotThrow(()=>authorizeScan(req('https://site.test/api/scan','https://site.test','owner'),false));
});
