import test from 'node:test';
import assert from 'node:assert/strict';
import { tencent } from '../lib/tencent.ts';
test('BE day-only response remains usable and never claims adjusted prices', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const id = String(url).includes('usBE.N') ? 'usBE.N' : 'usBE';
    return new Response(
      JSON.stringify({
        data: {
          [id]: {
            qt: { [id]: ['', '', 'BE.N'] },
            day: [
              [
                '2026-09-04',
                '236.82',
                '252.87',
                '253.30',
                '235.55',
                '16469097',
              ],
            ],
          },
        },
      }),
    );
  };
  try {
    const r = await tencent('BE');
    assert.equal(r.rows[0].close, 252.87);
    assert.match(r.adjustment, /未确认复权/);
  } finally {
    globalThis.fetch = original;
  }
});
test('APPL missing mapping returns actionable AAPL correction without substituting a stock', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ data: {} }));
  };
  try {
    await assert.rejects(tencent('APPL'), /AAPL/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('bare BTC cannot reach Tencent equity lookup', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({data: {}})); };
  try {
    await assert.rejects(tencent('BTC'), /数字货币/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
