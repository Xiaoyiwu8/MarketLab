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
