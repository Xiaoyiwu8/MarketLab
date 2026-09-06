import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchProvider } from '../lib/providers.ts';
import { importCsv, parseCsv } from '../lib/csv.ts';
import { demo, backtest, defaultParams } from '../lib/engine.ts';
import { financialTable } from '../lib/research.ts';
const input = {
  symbol: 'AAPL',
  provider: 'alpha' as const,
  key: 'not-a-real-key',
  start: '2024-01-01',
  end: '2024-12-31',
};
test('Alpha adjusted OHLC normalized; quote date never labelled tick realtime', async () => {
  const mock = (async (url: string) =>
    new Response(
      JSON.stringify(
        url.includes('GLOBAL_QUOTE')
          ? {
              'Global Quote': {
                '05. price': '110',
                '07. latest trading day': '2024-12-31',
              },
            }
          : {
              'Time Series (Daily)': {
                '2024-01-02': {
                  '1. open': '100',
                  '2. high': '104',
                  '3. low': '98',
                  '4. close': '102',
                  '5. adjusted close': '51',
                  '6. volume': '1000',
                },
              },
            },
      ),
    )) as typeof fetch;
  const r = await fetchProvider(input, mock);
  assert.equal(r.series!.bars[0].open, 50);
  assert.equal(r.series!.bars[0].close, 51);
  assert.match(r.quote!.freshness, /仅提供交易日期/);
});
test('quote-only makes no full history request', async () => {
  const urls: string[] = [];
  await fetchProvider({ ...input, quoteOnly: true }, (async (u: string) => {
    urls.push(u);
    return new Response(
      JSON.stringify({
        'Global Quote': {
          '05. price': '110',
          '07. latest trading day': '2024-12-31',
        },
      }),
    );
  }) as typeof fetch);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /GLOBAL_QUOTE/);
});
test('rate limit is explicit error not synthetic data', async () => {
  await assert.rejects(
    () =>
      fetchProvider(
        input,
        (async () =>
          new Response(
            JSON.stringify({ Information: 'API rate limit exceeded' }),
          )) as typeof fetch,
      ),
    /rate limit/,
  );
});
test('paid adapters reject missing credentials before networking', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchProvider({ ...input, key: '' }, (async () => {
        calls++;
        return new Response('{}');
      }) as typeof fetch),
    /API Key/,
  );
  assert.equal(calls, 0);
});
test('Polygon rejects pagination to arbitrary hosts', async () => {
  await assert.rejects(
    () =>
      fetchProvider(
        { ...input, provider: 'polygon' },
        (async () =>
          new Response(
            JSON.stringify({
              results: [],
              next_url: 'https://evil.example/steal',
            }),
          )) as typeof fetch,
      ),
    /未知/,
  );
});
test('CSV handles quoted thousands, BOM, CRLF and Adj Close', () => {
  assert.deepEqual(parseCsv('Date,Volume\r\n2024-01-01,"1,000"'), [
    ['Date', 'Volume'],
    ['2024-01-01', '1,000'],
  ]);
  const text =
    '\uFEFFDate,Open,High,Low,Close,Adj Close,Volume\r\n' +
    demo('A')
      .bars.slice(0, 60)
      .map((x) => `${x.date},100,102,98,100,50,"1,000"`)
      .join('\r\n');
  const r = importCsv('AAPL', text);
  assert.equal(r.bars.length, 60);
  assert.equal(r.bars[0].open, 50);
  assert.equal(r.bars[0].volume, 1000);
});
test('custom strategy parameters and benchmark accounting recorded', () => {
  const bars = demo('AAPL').bars,
    r = backtest(
      bars,
      'trend',
      {
        initial: 10000,
        allocation: 0.5,
        feeBps: 10,
        slippageBps: 10,
        stop: 0.08,
        maxDrawdown: 0.2,
        start: '2025-01-01',
        end: '2026-09-04',
      },
      { ...defaultParams, fast: 5, slow: 100 },
    );
  assert.equal(r.params.fast, 5);
  assert.equal(r.params.slow, 100);
  assert.equal(r.matchedBenchmark.length, r.curve.length);
  assert.equal(r.journal.length, r.closedTrades);
  assert.equal(
    r.totalFees,
    r.fills.reduce((s, x) => s + x.fee, 0),
  );
  assert.throws(
    () =>
      backtest(bars, 'trend', r.config, {
        ...defaultParams,
        fast: 100,
        slow: 50,
      }),
    /参数无效/,
  );
});
test('financial table preserves periods and reported units', () => {
  const f = financialTable(
    '<div>Financials in millions USD.</div><thead><tr><th>Fiscal Year</th><th>TTM</th><th>FY 2025</th></tr></thead><tr><td>Revenue</td><td>100</td><td>80</td></tr>',
  );
  assert.deepEqual(f.periods, ['TTM', 'FY 2025']);
  assert.equal(f.rows[0].values[1], '80');
  assert.match(f.unit, /millions USD/);
});
