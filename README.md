# Market Lab

**PAPER ONLY — Equity and Options Research Workspace**

[Open the online platform](https://equity-options-lab-wxy.yeetmayas.chatgpt.site/)

Market Lab brings stock data, technical analysis, strategy backtesting, options modeling, and paper trading into a Chinese-language research interface.

## Features

- Single-stock analysis and multi-stock comparisons.
- Technical indicators, volume analysis, trend evaluation, and support/resistance observations.
- Moving-average trend, RSI mean-reversion, breakout, and price-volume strategy backtests.
- Options strategy templates, theoretical pricing, Greeks, and expiration payoff analysis.
- Paper portfolios, position sizing, and risk controls.
- Trading-range centers, exit plans, macro-event timestamps, and manually recorded interest-rate probabilities.
- CSV imports, data exports, and command-line backtest reproduction.

## Repository Status

This repository currently stores browser-uploaded backups of the original project at commit `513f937`. The original project branches have not yet been pushed to this GitHub repository.

| File | Purpose |
| --- | --- |
| `MarketLab-source.zip` | Complete source snapshot, configuration, tests, historical samples, and project documentation |
| `MarketLab.git.bundle` | Complete original Git history for restoring a standalone repository |
| `AGENTS.md` | Instructions for future development and validation with Codex |

Cloning this GitHub repository gives you these backup files. Extract the source archive or restore the bundle before running the application.

## Quick Start

Install Node.js 22.13 or later and npm. Download and extract `MarketLab-source.zip`, then open a terminal in the extracted folder containing `package.json`:

```sh
npm ci
npm run dev
```

Open the local URL printed by the development server.

## Restore the Original Git History

Download `MarketLab.git.bundle` and run these commands from its containing directory:

```sh
git clone MarketLab.git.bundle MarketLab-restored
cd MarketLab-restored
git log --oneline -5
npm ci
npm run dev
```

The restored repository points its `origin` to the local bundle, not to GitHub. Inspect both histories before configuring future synchronization; do not force-push over existing GitHub commits.

## Development and Validation

Read `AGENTS.md` and the detailed `README.md` inside the restored project before making changes.

```sh
npm test
npm run typecheck
npm run build
```

Technology: React, TypeScript, vinext / Vite, Tailwind CSS, Cloudflare, and Sites.

## Data and Limitations

- Research and paper trading only; no real-money order execution.
- Public market data may be delayed, rate-limited, or unavailable. Check the source and timestamp displayed in the interface. Historical samples are not live prices.
- Some providers require your own API access. Macro events and interest-rate probabilities currently require manual input.
- Paper-account and other browser records are stored in the original site's localStorage and are not included in the code backup. Export account JSON separately from that site.
- Backtests and theoretical options valuations have modeling limitations and do not guarantee future performance.
- Keep API keys, personal account exports, and local environment files out of Git.
## Disclaimer

Market Lab is provided for educational, informational, and research purposes only. It is a paper-trading platform and does not execute real-money trades. Nothing in this project, including stock rankings, long or short candidates, entry or exit signals, backtests, or options and cryptocurrency analysis, constitutes personalized investment, financial, legal, or tax advice, or an offer or solicitation to buy or sell any asset.

Market data may be delayed, incomplete, inaccurate, or unavailable. Models and signals can be wrong, and historical, hypothetical, or simulated results do not guarantee future performance. Paper trading may not reflect actual liquidity, spreads, slippage, fees, borrowing costs, or execution conditions. Independently verify prices, timestamps, assumptions, and any information before making a decision.

Trading and investing involve the risk of losing capital. Options, leverage, short selling, and cryptocurrencies carry additional risks; some leveraged or short positions can lose more than the initial investment, and short-selling losses can be theoretically unlimited. A displayed candidate or signal is not a guarantee of profit or a determination that a trade is suitable for you.

You are responsible for your own decisions and for complying with applicable laws and regulations. Consult a qualified professional when appropriate. To the extent permitted by applicable law, this software and its content are provided "as is," without warranties, and the authors and contributors disclaim liability for losses arising from their use. Nothing in this disclaimer excludes rights or liabilities that cannot lawfully be excluded.

