import test from 'node:test';
import assert from 'node:assert/strict';
import { cryptoSeries } from '../lib/crypto.ts';
import { cryptoProduct, isCryptoSymbol } from '../lib/assets.ts';
import { newAccount, openPosition, closePosition, type Position } from '../lib/engine.ts';
import { stockCandidates } from '../lib/candidates.ts';
const now = new Date('2026-09-09T01:00:00Z');
const candles = Array.from({length:90}, (_,i)=>[Date.UTC(2026,5,12+i)/1000,90,110,100,101,1000]);
test('crypto aliases use USD products and never USDT or equity substitution', () => {
  assert.equal(cryptoProduct('BTC'),'BTC-USD'); assert.equal(cryptoProduct('ETH-USD'),'ETH-USD');
  assert.equal(isCryptoSymbol('XRP'),true); assert.equal(isCryptoSymbol('AAPL'),false);
  assert.throws(()=>cryptoProduct('BTC-USDT')); assert.throws(()=>cryptoProduct('FAKE-USD'));
});
test('crypto uses UTC completed candles and independent ticker, excluding today', async () => {
  const urls:string[]=[];
  const fetcher:typeof fetch = async input => { const url=String(input); urls.push(url); return Response.json(url.endsWith('/ticker') ? {price:'91234.5',time:now.toISOString()} : [...candles,[Date.UTC(2026,8,9)/1000,1,999,10,100,10]]); };
  const s=await cryptoSeries('BTC',fetcher,now);
  assert.equal(s.symbol,'BTC-USD'); assert.equal(s.assetClass,'crypto'); assert.equal(s.quote?.price,91234.5);
  assert.ok(s.bars.every(b=>b.date<'2026-09-09')); assert.equal(urls.length,2);
  assert.ok(urls.every(u=>u.startsWith('https://api.exchange.coinbase.com/products/BTC-USD/')));
  assert.equal(stockCandidates([s],now).count,0);
});
test('crypto outage surfaces an error with no fallback provider', async () => {
  const urls:string[]=[]; const fetcher:typeof fetch=async input=>{urls.push(String(input));return new Response('',{status:503});};
  await assert.rejects(cryptoSeries('BTC',fetcher,now),/未使用股票行情替代/);
  assert.ok(urls.every(u=>u.includes('coinbase.com')));
});
test('fractional crypto positions preserve cash on close; equities remain integral', () => {
  const p:Position={id:'crypto-test',symbol:'BTC-USD',assetClass:'crypto',kind:'stock',qty:0.01,entry:90000,mark:90000,reserve:0,opened:now.toISOString(),source:'coinbase',label:'数字货币现货'};
  const a=openPosition(newAccount(),p,0.25,1); assert.equal(a.cash,99099);
  assert.equal(closePosition(a,p.id).cash,99999);
  assert.throws(()=>openPosition(newAccount(),{...p,assetClass:'equity'},0.25,1));
  assert.throws(()=>openPosition(newAccount(),{...p,qty:NaN},0.25,1));
});
