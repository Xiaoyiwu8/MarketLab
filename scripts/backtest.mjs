import { readFile, writeFile } from 'node:fs/promises';
import { importCsv } from '../lib/csv.ts';
import { backtest, defaultParams } from '../lib/engine.ts';
const [
  input,
  symbol = 'GOOGL',
  strategy = 'trend',
  output = 'backtest-result.json',
  start = '2023-01-01',
  end = new Date().toISOString().slice(0, 10),
] = process.argv.slice(2);
if (!input)
  throw Error(
    'Usage: node --experimental-strip-types scripts/backtest.mjs INPUT.csv SYMBOL trend|reversion|breakout|factor OUTPUT.json START END',
  );
if (!['trend', 'reversion', 'breakout', 'factor'].includes(strategy))
  throw Error('Unknown strategy');
const series = importCsv(symbol, await readFile(input, 'utf8'));
const result = backtest(
  series.bars,
  strategy,
  {
    initial: 100000,
    allocation: 0.5,
    feeBps: 1,
    slippageBps: 5,
    stop: 0.08,
    maxDrawdown: 0.2,
    start,
    end,
  },
  defaultParams,
);
await writeFile(
  output,
  JSON.stringify({ input, symbol, data: series, result }, null, 2),
);
console.log(
  JSON.stringify(
    {
      engine: result.engine,
      symbol,
      start: result.actualStart,
      end: result.actualEnd,
      return: result.total,
      sharpe: result.sharpe,
      maxDrawdown: result.maxDrawdown,
      trades: result.closedTrades,
      output,
    },
    null,
    2,
  ),
);
