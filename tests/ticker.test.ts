import test from 'node:test';
import assert from 'node:assert/strict';
import { tencent } from '../lib/tencent.ts';
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
