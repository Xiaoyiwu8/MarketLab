# Market Lab — 美股与期权研究台

第一版将需求整理为：行情 → 清洗和指标 → 策略回测 → 信号 → 模拟交易 → 风控。入口支持输入一只或多只股票，最多12只，逗号分隔，例如 `AAPL, MSFT, NVDA, SPY`。

## 使用方式

1. 在首页输入代码；默认使用腾讯真实公共延迟行情，首次打开自动查询GOOGL。数据成功返回后才展示价格，失败不回退到演示价格。演示模式必须主动选择。
2. 切换到“腾讯 · 公共延迟行情”，点击“分析股票”获取真实美股历史日线和延迟参考价，不需账户。
3. 点击股票标签，查看股票分析、策略回测、期权策略和模拟账户。切换股票后相关计算跟随当前标的。
4. 回测页调整日期、策略、仓位、交易成本、止损与熔断，再点击运行。修改参数不会自动覆盖旧结果；结果显示参数快照。
5. 期权页选择策略、行权价、到期天数和IV，查看各腿、Greeks、到期损益、最大收益/亏损、盈亏平衡点，或记录组合模拟交易。
6. 分析可导出JSON，股票回测成交可导出CSV，模拟账户可导出JSON备份。账户保存在当前浏览器，换设备或清除站点数据会丢失。

## 已实现

- 数据：腾讯公开延迟行情、Yahoo公共行情、Alpaca IEX数据接入、CSV导入、排序、日期去重、非法OHLCV校验、剔除未完成日线。腾讯最多1000根前复权日线；Yahoo最多5年；Alpaca约4年。
- 技术分析：MA20/50、Wilder RSI14、MACD12/26/9、布林带20/2σ、成交量比、OBV、MFI14、90根K线、回测买卖标记、多股对比。
- 四种股票策略：均线趋势、RSI均值回归、20日突破/10日退出、量价多因子。多因子为量价指标，不是财务基本面模型。
- 回测：50根预热、信号次日开盘成交、费用、滑点、跳空止损、收盘回撤熔断后次日开盘退出；总收益、年化、夏普、最大回撤、胜率、盈亏比、利润因子、交易记录。
- 期权：10种模板——买入看涨、买入看跌、备兑看涨、现金担保看跌、牛市看涨价差、熊市看跌价差、牛市看跌价差、熊市看涨价差、买入跨式、铁鹰。
- 期权数据：Alpaca指示性期权链、到期日及Call/Put筛选。默认理论权利金，支持手动输入；期权链不会自动覆盖理论定价。
- 模拟账户：10万美元、股票整股买卖、期权组合开平仓、持仓估值、流水、累计单标的风险限制、资金预留、股票止损、回撤锁定。
- 提醒：页面保持打开时每60秒扫描，站内日志、浏览器通知、邮件草稿；可填写自有Resend凭证启用邮件发送。

## 口径与当前边界

- 这是第一阶段研究与模拟工具，没有真实下单接口；所有操作不连接真实资金。
- 免费公共行情可能延迟、限流或中断。腾讯公开接口无SLA；Yahoo在当前开发环境返回403，因此提供显式备用来源；不会在失败时偷偷替换为演示数据。
- MFI/OBV只反映量价关系，不代表真实“主力资金”。美股机构持仓、逐笔大单等数据尚未接入。
- 回测仅单标的，不构成多股票组合回测；多股对比与模拟账户支持多个标的。未处理历史退市样本、税、融资、借券和逐笔流动性。
- 采用日线，止损执行是OHLC模型；回测期末未平仓持仓计入权益，不计入胜率。胜率按所有平仓交易计算，盈亏比仅在同时有盈利和亏损交易时定义。
- 夏普按日收益、零无风险收益与252交易日年化；基准为100%买入持有且不计费用，与策略仓位可能不同。
- Black–Scholes是欧式模型，输入连续股息率。Greeks按每股单腿报告。未模拟美式提前行权、指派、公司行动或合约乘数调整。标准合约按100股计算。
- 期权账户是理论/手动权利金情景账本，不是基于真实Bid/Ask的撮合模拟。到期仅按内在价值估值后手动平仓，没有实物交割。备兑模板同时购买100股，不复用已持有股票。
- **期权历史回测未启用**：需要历史合约链、双边报价、公司行动和到期处理数据。不能用股票历史价格或当日期权链替代。
- Alpaca IEX仅单交易所；免费期权 indicative 是修改后的指示报价与延迟成交，不是实时OPRA。没有账户时使用理论情景功能。
- 止损与熔断在刷新行情时运行；股票可自动关闭，期权需手动关闭。未被刷新或数据源不同的持仓沿用之前估值。页面关闭后停止扫描、通知和自动风控。
- 默认不发送邮件；需填写自己的Resend发送权限密钥、验证的发件地址和收件地址后主动启用。凭证只在页面内存，传给本站API后仅转发到指定数据/邮件服务，不写入localStorage或源文件。
- 本地账户无多设备同步，也未解决多标签页同时交易的写入冲突，请只在一个标签页操作账户。

## 后续阶段

1. 数据层：授权股票SIP/期权OPRA、历史期权快照、数据缓存、持仓公司行动处理。
2. 服务层：账户数据库、独立定时扫描、后台邮件队列、凭证加密和审计、组合回测与样本外验证。
3. 交易层：独立券商模拟盘、订单状态/撤单/重试/幂等、多腿撮合、到期与指派处理。
4. 实盘阶段：在独立模拟盘验证后再明确授权接入真实订单，并增加成交对账、风险服务和紧急停机。

## 本地开发

需要 Node.js >=22.13，推荐Node 24，npm。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

主要模块：`lib/engine.ts` 纯计算/账户；`lib/tencent.ts` 公共行情；`app/api/market/route.ts` 行情适配；`app/api/email/route.ts` 邮件转发；`components/lab.tsx` 操作台。

## 验证记录

- 10项计算与账务测试通过，覆盖无效数据、指标预热、次日成交、未来数据不影响历史交易、跳空止损、期权平价、价差收益上下限、风险敞口、保证金/现金预留与损益。
- TypeScript类型检查和生产构建通过。新增启动回归验证确保默认页无虚构价格，并实测GOOGL 2026-09-04收盘338.46。
- 本地API实测AAPL/MSFT/SPY/BRK.B返回1000根历史日线，截至2026-09-04；公共报价时间显示在界面。
- 无Alpaca和Resend账户，因此没有验证授权后的期权链返回或实际邮件送达；未发送任何测试邮件。
- 未进行浏览器UI自动测试；WebMCP使用能力检测注册，无可用验证上下文，因此未声称验证其运行。

## 参考

- [Alpaca市场数据口径](https://docs.alpaca.markets/us/docs/market-data-faq)
- [Alpaca期权历史数据与indicative说明](https://docs.alpaca.markets/us/docs/historical-option-data)
- [OIC期权策略与行权风险](https://www.optionseducation.org/strategies/all-strategies)
- [Resend邮件API](https://resend.com/docs/api-reference/emails/send-email)

研究结果用于检验假设，回测与理论估值不保证未来收益。


## V2 更新（2026-09-06）

默认打开“数据与回测中心 V2”，原有股票分析、期权策略和模拟账户保留。

- 统一历史下载：Yahoo Finance、Polygon / Massive、Alpha Vantage，指定开始/结束日期和价格调整口径；腾讯公共延迟行情作为无需密钥的选项。
- 独立报价轮询：15秒、60秒、5分钟、15分钟可选。腾讯仅取最新报价，Yahoo只取当日摘要，Polygon取last-trade，Alpha取GLOBAL_QUOTE，不重复下载历史。轮询错误暂停，不伪造实时数据。
- Polygon / Massive需要自有API Key；Alpha完整/复权历史、延迟/实时报价受套餐限制。这里完成了接口实现和模拟响应测试，因没有用户授权密钥，没有声称付费数据端到端验证成功。
- CSV支持多文件、引号、千位分隔和Adj Close。导入/下载生成数据SHA-256指纹，显示实际区间、行数、复权口径，支持原始清洗数据CSV导出。
- 自研事件驱动回测引擎2.0：可设置快慢均线、RSI阈值、突破窗口、量比门槛；支持多股×四策略批量实验。每只股票为独立账户，不是组合回测。
- 使用相同仓位、整股和成本的买入持有基准；输出实际日期、费用、完整往返交易、期末未平仓持仓及原有绩效指标。
- 时间留出检验：按用户比例划分末段，用固定参数从空仓开始评估；少于20根日线时不报告样本外结果。这不是自动调参或滚动walk-forward优化。
- 完整回测导出包括输入数据、参数、来源、数据指纹、每日权益、成交和实验结果。可通过独立命令行复现，不依赖网页界面。
- Stock Analysis：自动读取公司概况、TTM与多年收入利润、资产负债、经营现金流/资本开支/自由现金流和历史估值；各表保留独立期间列与单位。显示源页面更新时间及TTM结束时间。指标解读基于已读取数字，历史因子回测不使用当前快照。
- 新闻：优先读取Stock Analysis公开新闻索引，Google News RSS为备用；新闻标题链接供核实，不将媒体观点直接当成交易信号。当前开发环境Google RSS超时，Stock Analysis新闻成功返回10条。

### 验证与复现

18项单元/模拟响应测试通过；GOOGL公共历史、最新报价、Stock Analysis财务和新闻均实际调用成功。Yahoo在此环境返回403，界面明确提示；未伪装为成功。授权Polygon/Alpha实测需用户配置密钥。未进行浏览器UI自动测试。

```sh
npm test
npm run typecheck
node --experimental-strip-types scripts/backtest.mjs GOOGL.csv GOOGL trend result.json 2023-01-01 2026-09-04
```

`outputs/GOOGL-回测验证.json`（交付目录）是公共真实历史数据经CLI运行的验证样例，不是未来收益预测。命令行默认参数在输出中完整保留。

来源文档：[Alpha Vantage](https://www.alphavantage.co/documentation/)、[Polygon / Massive](https://massive.com/docs/rest/stocks/overview)、[Stock Analysis 数据来源](https://stockanalysis.com/data-sources/)。

## 成交量面板
新增独立的成交量标签页，股票分析页顶部也可查看：最近完整日线成交股数、与前一日的绝对及百分比变化、相对前20日均量、最近5日总量与前5日比较、60日柱状图、20日明细。按纽约日期排除当日可能不完整的日线；零基准与不足样本显示缺失。成交量使用所选行情源口径，IEX不是全美市场成交总量。更新成交量需重新加载历史行情。


## 支撑压力与买卖提示
新增独立标签页及股票分析顶部面板：前20/60日高低点（不含最新日）、支撑压力图、ATR14、量价与趋势条件、条件式买入和持仓退出观察、参考止损和风险收益。日线不足61根、演示或过期数据不生成可用交易计划。完整组合规则尚未回测，提示不是盈利保证，也不直接用于期权下单。


## 完整检查后的功能补齐
首页新增大盘风险偏好、短中长期MA20/60/200趋势、量价配合、VMA5/10/20与异动判定、完成周线与日线共振、斐波那契区间回撤、未回补缺口、板块选择与RS/相关性、人工仓位计算器。QQQ/SPY/DIA/SOXQ为指数ETF代理，不是原始指数点位；QQQ代理纳斯达克100。板块榜增加AIQ和IGV。风控参数错误、大盘缺失/偏弱或回撤超限优先阻断首页新仓提示，计算器不替代模拟账户已有下单控制。
趋势参数敏感性可比较三组均线；提醒增加指定代码价格跨越和量比阈值，共用现有日志和邮件配置，仅页面开启时执行。60分钟数据、PCR/资金流、自动财报日历/评级/机构变动、Telegram和无人值守仍未接通，页面明确标记。首页组合规则及大盘风控未整套回测。


牛熊指示：至少205根完整日线；结合MA20/60/200方向、MACD柱和RSI50，显示0-5个多头条件及牛市倾向/熊市倾向/震荡/回调/反弹。大盘要求四只代理ETF至少三只同向。评分不是概率，牛熊分类不替代交易和风控条件。


做空指示：新增空头趋势、跌破/反弹失败、放量、RSI不过度超卖、MACD和2R筛选；显示空仓观察/等待与已有空仓回补条件，止损方向在入场上方。券源、借券成本和保证金未接入；该规则未完整回测，股票模拟账户仍仅支持多头，不会把卖出多仓当成开空。


止盈止损计划：独立首页面板支持多头/空头切换、实际成本与整数股数、手动止损止盈、每股和总风险收益、1R/2R跟踪节点及日线越界提示。默认仅为新仓情景，不读取券商持仓，不自动下单或更改模拟账户止损。


## 宏观事件警示时间
手动录入事件和原文链接，支持北京时间输入、美东时间展示、首次录入、本地更新时间、观察期到期时间和用户核验标记。未来24小时内/发生后6小时/观察期/过期分级，30秒刷新标签。原文更新时间未自动获取，事件未知时间不标记刚发生，过期须人工复核续期。记录存在本设备，不自动调整交易信号或推送通知。


利率概率跟踪：手动录入会议日期、基准利率、数据采样时间和加息/不变/降息百分比，校验合计100%，仅同会议/基准/来源跨采样计算百分点变化。24小时复核提示、本地录入时间与数据采样时间分离。CME官方自动API需要相应权限，目前未接通，不展示虚构的当前概率。


## 震荡价格中枢
新增首页面板：前20/40/60日高低箱体、收盘中位数中枢、底部和顶部20%观察带、当前区间位置、独立震荡筛选条件、下沿反弹观察及上沿止盈观察。最新日不参与区间构建，突破即停止区间操作提示。单边趋势、样本不足和过期演示数据不生成区间入场提示。属于滚动箱体统计，非缠论中枢或逐笔成交密集区，尚未完整回测，不覆盖已有风控。


## 独立项目目录（2026-09-06）

固定目录：`C:\Users\wuxiaoyi\Documents\Codex\Projects\MarketLab`。
保留原项目完整 Git 历史，新增独立整理提交。线上地址：https://equity-options-lab-wxy.yeetmayas.chatgpt.site/

### 本地启动

安装 Node.js 22.13 或更新版本，在此目录执行：

```sh
npm ci
npm run dev
```

使用终端输出的本地地址访问。验证命令：`npm test`、`npm run typecheck`、`npm run build`。
生产构建后可执行 `npm start` 通过 Wrangler 本地运行。
保留 `.openai/hosting.json` 和 Vite 配置，项目沿用 vinext / Cloudflare / Sites 技术栈。

### 文件与数据

- app、components、hooks、lib、public：应用代码及资源。
- scripts、tests：命令行工具和测试。
- data/examples/GOOGL-public.csv：已有的公共行情样本，非实时数据。
- data/examples/GOOGL-回测验证.json：此前导出的回测验证结果。
- package-lock.json：依赖锁定文件，用 npm ci 恢复依赖。
- node_modules、构建产物、缓存可重新生成，不纳入迁移或 Git。

模拟账户、宏观事件和利率概率记录保存在原站点的浏览器 localStorage 中，未包含在此仓库；模拟账户可在原站点导出 JSON 另行备份。本地地址不会自动共享原站点的浏览器记录。
.env 文件应仅本地保存，不提交 API 密钥。当前未配置 GitHub / Gitee 远程仓库。

## Stock candidates and cryptocurrency

The homepage shows at most two long and two short technical candidates from the loaded equity watchlist. Use the 12-stock scan button or enter up to 12 symbols. Candidates must satisfy all existing trend, price/volume, RSI and reward/risk rules; empty results are valid. Rankings use reward/risk, not predicted win rates. Signals use completed daily candles and require current-price, market and event checks. A long exit is not a short entry. Paper short selling is not supported.

BTC, ETH, XRP, SOL, DOGE, ADA, LTC, BCH, AVAX, LINK and DOT are reserved cryptocurrency aliases, also accepted with `-USD`. These use Coinbase Exchange USD spot candles and the latest trade, independent of the selected stock provider. A crypto request never falls back to an identically named equity. Candles follow UTC and trade every day; API failures remain errors. This is a single-exchange reference, not a consolidated or executable quote. Unsupported pairs and crypto in demo mode are rejected.

The paper account supports fractional crypto spot quantities, with the existing illustrative 5bp slippage and 1bp fee assumptions (not exchange fees). Crypto backtests and equity options are disabled; US market risk checks and company research do not apply. Local browser account storage and export remain unchanged. Legacy positions tagged as stocks are not reinterpreted as crypto.

## Daily whole-market scan

The fixed 12-stock scan has been replaced by a server-persisted scan of Nasdaq Trader's `nasdaqlisted.txt` and `otherlisted.txt` directories. Common-stock/ordinary-share and ADR candidates are screened after excluding ETF/test flags and instrument-name patterns for preferred shares, warrants, rights, units, notes and funds. Unsupported ticker formats are counted as exclusions; this is an explicit eligible universe, not every security or OTC stock.

`POST /api/scan` starts or resumes the latest completed US session (dated using SPY reference bars), then processes three symbols per step. D1 stores progress and the best two candidates on each side. A compare-and-set lease prevents concurrent windows from double advancing. The UI displays final candidates only after every eligible symbol has been attempted. Missing/insufficient/unadjusted data are counted as failures, never replaced with synthetic values. HTTP 429 pauses without losing progress. A completed scan with failures is not full data coverage.

Candidate filters: at least 61 completed adjusted bars, price >= USD 5, 20-day average close times volume >= USD 5 million, then the existing long/short technical checks. Only the latest 260 bars are used consistently. Technical short signals do not verify borrow availability. Source dates and failures remain visible. Public Tencent data has no availability commitment; this implementation is daily research, not a guaranteed realtime entry service.

The website persists results even after the browser closes. Continuing computation requires an active browser runner or the authenticated daily scheduler. `scripts/daily-scan.mjs` takes an ephemeral `MARKETLAB_SITE_TOKEN` environment variable from the Sites connection; never commit or log it. The Codex daily task requires its computer/runtime online and a working Sites connection. No GitHub synchronization is performed by scanning.

Public-source evaluation (2026-09-09):
- Nasdaq official symbol directory definitions: https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs
- TradingView supports screener filters and CSV export; no dependency on an undocumented scraping interface: https://www.tradingview.com/support/solutions/43000718866-tradingview-stock-screener-trade-smarter-not-harder/
- Alpaca historical SIP queries can use sufficiently delayed end times; account authorization is required: https://docs.alpaca.markets/us/docs/market-data-faq
- Massive provides a daily whole-US-market aggregate endpoint; access requires its API entitlement: https://massive.com/docs/rest/stocks/aggregates/daily-market-summary

Validation: directory endpoints and representative Tencent symbols tested live; local API start/resume, database persistence, candidate filters and failure handling tested. A full-universe completion and the hosted daily schedule require separate validation; unit tests alone do not establish market-data coverage.
