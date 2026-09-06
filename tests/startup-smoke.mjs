import assert from 'node:assert/strict';
const origin = process.env.LAB_URL ?? 'http://localhost:3000';
const response = await fetch(origin);
assert.equal(response.status, 200);
const html = await response.text();
assert.ok(
  html.includes('输入股票代码，获取真实行情'),
  'Initial screen must use real-data startup',
);
assert.ok(
  !html.includes('合成演示数据'),
  'Initial screen must not render synthetic stock prices',
);
assert.ok(
  !html.includes('$177.01'),
  'Reported fake GOOGL price must not appear at startup',
);
assert.equal(
  (html.match(/&amp;#x[0-9a-f]+;/gi) ?? []).length,
  0,
  'No double-escaped numeric entities',
);
console.log(
  'PASS: real-data startup; no synthetic prices or double-escaped labels',
);
const r = await fetch(origin + '/api/market', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbols: ['GOOGL'], provider: 'tencent' }),
});
assert.equal(r.status, 200);
const d = await r.json(),
  s = d.results[0];
assert.ok(!s.error, s.error);
assert.equal(s.symbol, 'GOOGL');
assert.ok(s.source.startsWith('腾讯'));
assert.ok(s.bars.length >= 55);
if (s.asOf === '2026-09-04') assert.equal(s.bars.at(-1).close, 338.46);
console.log('PASS:', s.symbol, s.source, s.asOf, 'close', s.bars.at(-1).close);
