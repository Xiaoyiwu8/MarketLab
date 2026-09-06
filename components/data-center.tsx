'use client';
import { useEffect, useRef, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { LineChart } from './lab-charts';
import { importCsv } from '@/lib/csv';
import {
  backtest,
  defaultParams,
  strategies,
  type StrategyParams,
  type Series,
  type BacktestConfig,
  type Strategy,
} from '@/lib/engine';
const number = (n: number | null | undefined) =>
  n == null ? '—' : Number.isFinite(n) ? n.toFixed(2) : '—';
const percent = (n: number | null) => (n == null ? '—' : number(n * 100) + '%');
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <label>
      {label}
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ height: 43 }}
      >
        {Object.entries(options).map(([k, v]) => (
          <NativeSelectOption key={k} value={k}>
            {v}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
function N({
  label,
  value,
  onChange,
  min = 0,
  max = 1000000,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step="any"
        onChange={(e) =>
          onChange(e.target.value === '' ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
}
function Grid({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((v, j) => (
              <TableCell key={j}>{v}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
const save = (name: string, data: unknown) => {
  const url = URL.createObjectURL(
    new Blob(
      [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
      {
        type:
          typeof data === 'string'
            ? 'text/csv;charset=utf-8'
            : 'application/json',
      },
    ),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function StockResearch({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<any>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    fetch('/api/research?symbol=' + encodeURIComponent(symbol), {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(setResult)
      .catch((e) => {
        if (e.name !== 'AbortError')
          setResult({ error: '读取失败，请打开来源页面核对' });
      });
    return () => controller.abort();
  }, [symbol]);
  const base = `https://stockanalysis.com/stocks/${symbol.toLowerCase().replaceAll('.', '-')}/`;
  const finance = result?.financials,
    fy = finance?.periods?.findIndex((x: string) => x.startsWith('FY')) ?? -1;
  const val = (label: string, i: number) => {
    const s = finance?.rows?.find((x: any) => x.label === label)?.values?.[i];
    return s && /^-?[\d,.]+$/.test(s) ? Number(s.replaceAll(',', '')) : NaN;
  };
  const revenue = val('Revenue', fy),
    previousRevenue = val('Revenue', fy + 1),
    income = val('Net Income', fy),
    growth = previousRevenue > 0 ? revenue / previousRevenue - 1 : NaN,
    margin = revenue > 0 ? income / revenue : NaN;
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>{symbol} · Stock Analysis 基本面</h2>
        <a href={base} target="_blank" rel="noreferrer">
          核对来源 ↗
        </a>
      </div>
      <div className="row">
        {[
          ['financials/', '财务报表'],
          ['statistics/', '估值统计'],
          ['forecast/', '分析师预期'],
          ['history/', '历史价格'],
          ['dividend/', '分红'],
        ].map(([path, label]) => (
          <a key={path} href={base + path} target="_blank" rel="noreferrer">
            {label} ↗
          </a>
        ))}
      </div>
      {result?.fields ? (
        <>
          <Grid
            headers={['指标（源页面口径）', '数值']}
            rows={result.fields.map((f: any) => [f.label, f.value])}
          />
          <p className="fineprint">
            抓取时间 {result.fetchedAt} · {result.scope}
          </p>
          {!!finance?.rows?.length && (
            <>
              <h3 style={{ marginTop: 20 }}>多年财务对比</h3>
              <p className="fineprint">
                {finance.unit} · EPS按每股口径 · TTM截至 {finance.ttmEnd} ·
                源页面更新 {finance.sourceUpdated}
              </p>
              <Grid
                headers={['指标', ...finance.periods]}
                rows={finance.rows.map((r: any) => [r.label, ...r.values])}
              />
              <div className="message">
                <h3>基于财务数据的解读</h3>
                <p>
                  {Number.isFinite(growth)
                    ? `${finance.periods[fy]} 收入同比 ${percent(growth)}。`
                    : '年度收入增长数据不足。'}
                  {Number.isFinite(margin)
                    ? `同年度净利润率 ${percent(margin)}。`
                    : '净利润率数据不足。'}{' '}
                  对照营业利润、净利润和EPS的变化检查盈利质量；估值高低还需结合增长、一次性损益及同行数据，不能仅凭单个PE定性。
                </p>
              </div>
              {finance.supplemental?.map((group: any, i: number) => (
                <div key={i} style={{ marginTop: 20 }}>
                  <h3>
                    {group.rows.some((r: any) => r.label === 'Total Debt')
                      ? '资产负债与现金'
                      : group.rows.some(
                            (r: any) => r.label === 'Free Cash Flow',
                          )
                        ? '现金流与资本开支'
                        : '历史估值'}
                  </h3>
                  <Grid
                    headers={['指标', ...group.periods]}
                    rows={group.rows.map((r: any) => [r.label, ...r.values])}
                  />
                </div>
              ))}
            </>
          )}
          {result.financialError && (
            <p className="notice">
              多年财务读取不完整：{result.financialError}
            </p>
          )}
        </>
      ) : (
        <p className="message">{result?.error ?? '正在读取公开概况…'}</p>
      )}
      <p className="fineprint">
        以原站标注的TTM、报告期间与时间为准。当前快照不参与历史回测，避免将今天的财务信息带入过去。
      </p>
    </section>
  );
}
type Run = {
  symbol: string;
  strategy: Strategy;
  source: string;
  full: ReturnType<typeof backtest>;
  out: ReturnType<typeof backtest> | null;
  testStart: string;
  warnings: string[];
};
export default function DataCenter({
  data,
  onData,
  onQuotes,
}: {
  data: Series[];
  onData: (d: Series[]) => void;
  onQuotes: (quotes: any[], provider: string) => void;
}) {
  const [symbols, setSymbols] = useState(data.map((x) => x.symbol).join(', ')),
    [provider, setProvider] = useState('tencent'),
    [key, setKey] = useState(''),
    [from, setFrom] = useState('2020-01-01'),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [adjusted, setAdjusted] = useState('yes'),
    [entitlement, setEntitlement] = useState('historical'),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [poll, setPoll] = useState(false),
    [seconds, setSeconds] = useState('60'),
    [quotes, setQuotes] = useState<any[]>([]),
    [runs, setRuns] = useState<Run[]>([]),
    [index, setIndex] = useState('0'),
    [dataset, setDataset] = useState<Series[]>(data),
    [manifest, setManifest] = useState('');
  const [cfg, setCfg] = useState<BacktestConfig>({
      initial: 100000,
      allocation: 0.5,
      feeBps: 1,
      slippageBps: 5,
      stop: 0.08,
      maxDrawdown: 0.2,
      start: '2023-01-01',
      end: new Date().toISOString().slice(0, 10),
    }),
    [params, setParams] = useState<StrategyParams>({ ...defaultParams }),
    [split, setSplit] = useState(70),
    [strategy, setStrategy] = useState('all');
  const lock = useRef(false),
    current = runs[Number(index)] ?? runs[0];
  useEffect(() => {
    const changed =
      data.length !== dataset.length ||
      data.some((s, i) => s.bars !== dataset[i]?.bars);
    if (changed) {
      setDataset(data);
      setRuns([]);
      setSymbols(data.map((s) => s.symbol).join(', '));
    }
    if (changed || !manifest) {
      let active = true;
      crypto.subtle
        .digest(
          'SHA-256',
          new TextEncoder().encode(
            JSON.stringify(
              data.map((s) => ({
                symbol: s.symbol,
                bars: s.bars,
                source: s.source,
                adjustment: s.adjustment,
              })),
            ),
          ),
        )
        .then((hash) => {
          if (active)
            setManifest(
              [...new Uint8Array(hash)]
                .map((x) => x.toString(16).padStart(2, '0'))
                .join(''),
            );
        });
      return () => {
        active = false;
      };
    }
  }, [data]);
  const parseSymbols = () => {
    const s = [
      ...new Set(
        symbols
          .toUpperCase()
          .split(/[,，\s]+/)
          .filter(Boolean),
      ),
    ];
    if (
      !s.length ||
      s.length > 12 ||
      s.some((x) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(x))
    )
      throw Error('请输入1–12个有效代码');
    return s;
  };
  async function install(next: Series[]) {
    if (next.some((x) => x.bars.length < 55))
      throw Error('至少需要55根日线才能进入分析与回测');
    const bytes = new TextEncoder().encode(
      JSON.stringify(
        next.map((s) => ({
          symbol: s.symbol,
          bars: s.bars,
          source: s.source,
          adjustment: s.adjustment,
        })),
      ),
    );
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    setManifest(
      [...new Uint8Array(hash)]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join(''),
    );
    setDataset(next);
    setRuns([]);
    onData(next);
  }
  async function pull(quoteOnly = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const list = parseSymbols();
      if (provider === 'csv')
        throw Error('CSV为本地历史数据，请使用文件导入；不提供实时行情');
      const isTencent = provider === 'tencent';
      const r = await fetch(isTencent ? '/api/market' : '/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: list,
          provider,
          key,
          start: from,
          end: to,
          quoteOnly,
          entitlement,
          adjusted: adjusted === 'yes',
          mode: quoteOnly ? 'quote' : undefined,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      const failures = d.results.filter((x: any) => x.error),
        ok = d.results.filter((x: any) => !x.error);
      if (!ok.length)
        throw Error(
          failures.map((x: any) => x.symbol + ': ' + x.error).join('；'),
        );
      if (quoteOnly) {
        onQuotes(ok, provider);
        setQuotes(
          ok.map((x: any) => ({
            symbol: x.symbol,
            ...x.quote,
            warnings: x.warnings ?? [],
          })),
        );
      } else {
        const next: Series[] = ok.map((x: any) =>
          isTencent
            ? {
                ...x,
                bars: x.bars.filter((b: any) => b.date >= from && b.date <= to),
                asOf:
                  x.bars
                    .filter((b: any) => b.date >= from && b.date <= to)
                    .at(-1)?.date ?? '',
              }
            : x.series,
        );
        await install(next);
        setQuotes(
          ok
            .filter((x: any) => x.quote)
            .map((x: any) => ({ symbol: x.symbol, ...x.quote })),
        );
      }
      setStatus(
        `${quoteOnly ? '报价已更新' : '历史数据已载入'}：${ok.length}只。${failures.map((x: any) => x.symbol + ': ' + x.error).join('；')}`,
      );
      if (failures.length) setPoll(false);
    } catch (e) {
      setStatus((e as Error).message);
      setPoll(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!poll) return;
    const timer = setInterval(() => void pull(true), Number(seconds) * 1000);
    return () => clearInterval(timer);
  }, [poll, seconds, provider, key, symbols, from, to, entitlement, adjusted]);
  function run() {
    try {
      if (!Number.isFinite(split) || split < 50 || split > 90)
        throw Error('样本划分应在50%–90%之间');
      const kinds = (
          strategy === 'all' ? Object.keys(strategies) : [strategy]
        ) as Strategy[],
        results: Run[] = [];
      for (const s of dataset) {
        for (const k of kinds) {
          const full = backtest(s.bars, k, cfg, params),
            eligible = s.bars.filter(
              (b) => b.date >= full.actualStart && b.date <= full.actualEnd,
            ),
            testStart =
              eligible[Math.floor((eligible.length * split) / 100)]?.date;
          let out = null;
          const warnings: string[] = [];
          if (
            testStart &&
            eligible.length - Math.floor((eligible.length * split) / 100) >= 20
          )
            out = backtest(s.bars, k, { ...cfg, start: testStart }, params);
          else warnings.push('样本外区间少于20根日线，不报告样本外绩效');
          if (full.actualStart > cfg.start)
            warnings.push('实际起点受交易日 / 预热 / 数据覆盖限制');
          if (s.adjustment.includes('未复权'))
            warnings.push('未复权序列可能因拆股产生虚假收益');
          results.push({
            symbol: s.symbol,
            strategy: k,
            source: s.source,
            full,
            out,
            testStart,
            warnings,
          });
        }
      }
      setRuns(results);
      setIndex('0');
      setStatus(
        `完成 ${results.length} 组历史回测；使用固定参数评估末段样本，未自动选优。`,
      );
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="sectionTitle">
          <h2>数据中心 · 历史下载与独立报价刷新</h2>
          <span className="badge">V2 · 可追溯输入</span>
        </div>
        <div className="formgrid">
          <label>
            股票代码
            <input
              value={symbols}
              onChange={(e) => {
                setSymbols(e.target.value);
                setPoll(false);
              }}
            />
          </label>
          <Choice
            label="数据源"
            value={provider}
            onChange={(v) => {
              setProvider(v);
              setPoll(false);
              setQuotes([]);
            }}
            options={{
              tencent: '腾讯公共行情（免费 / 延迟）',
              yahoo: 'Yahoo Finance',
              polygon: 'Polygon / Massive',
              alpha: 'Alpha Vantage',
              csv: '本地 CSV',
            }}
          />
          <label>
            API Key（仅本次页面会话）
            <input
              type="password"
              autoComplete="off"
              disabled={!['polygon', 'alpha'].includes(provider)}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setPoll(false);
              }}
            />
          </label>
          <Choice
            label="价格口径"
            value={adjusted}
            onChange={setAdjusted}
            options={{
              yes: '调整价格（具体口径见结果）',
              no: '原始未复权价格',
            }}
          />
          <label>
            历史开始
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            历史结束
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Choice
            label="Alpha Vantage 报价权限"
            value={entitlement}
            onChange={(v) => {
              setEntitlement(v);
              setPoll(false);
            }}
            options={{
              historical: '历史 / 日终（默认）',
              delayed: '15分钟延迟（需权限）',
              realtime: '实时权限（需订阅）',
            }}
          />
          <button
            disabled={busy || provider === 'csv'}
            onClick={() => void pull(false)}
            style={{ alignSelf: 'end' }}
          >
            下载历史并进入分析
          </button>
        </div>
        <p className="fineprint">
          腾讯最多1000根前复权日线，价格口径开关仅适用于其他接口。Yahoo可能因地区或网络不可用。Polygon现使用Massive官方API。Alpha全量及复权历史可能需要付费权限。数据不足会报错，绝不用演示数据补齐。
        </p>
        <div className="row">
          <button
            className="secondary"
            disabled={busy || provider === 'csv'}
            onClick={() => void pull(true)}
          >
            仅刷新最新报价
          </button>
          <label className="row" style={{ flexDirection: 'row' }}>
            <Switch
              checked={poll}
              disabled={provider === 'csv'}
              onCheckedChange={setPoll}
            />{' '}
            自动报价轮询
          </label>
          <Choice
            label="轮询间隔"
            value={seconds}
            onChange={setSeconds}
            options={{
              '15': '15秒',
              '60': '60秒',
              '300': '5分钟',
              '900': '15分钟',
            }}
          />
        </div>
        <p className="fineprint">
          轮询仅查询报价，不重下历史。刷新频率不等于行情实时性，依账户权限与交易时间戳判断。Alpha只返回交易日期；腾讯为延迟。休市时报价不变属正常。限流或错误暂停轮询，关闭页面停止。
        </p>
        <Grid
          headers={['股票', '价格 USD', '原始时间戳', '行情口径']}
          rows={quotes.map((q) => [
            q.symbol,
            number(q.price),
            q.time ?? '无报价',
            q.freshness ?? '腾讯延迟行情',
          ])}
        />
      </section>
      <section className="panel">
        <h2>本地 CSV · 多文件导入</h2>
        <p>
          支持 AAPL.csv、MSFT.csv 同时导入；兼容英文
          Date/Open/High/Low/Close/Volume，带引号和千位分隔；有 Adj Close
          时统一调整OHLC。
        </p>
        <input
          type="file"
          multiple
          accept=".csv"
          aria-label="导入多个历史行情CSV"
          onChange={async (e) => {
            try {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              if (files.length > 12) throw Error('最多12个CSV');
              const next = [];
              for (const f of files) {
                if (f.size > 5e6) throw Error(f.name + ' 超过5MB');
                next.push(
                  importCsv(
                    f.name.replace(/\.csv$/i, '').toUpperCase(),
                    await f.text(),
                  ),
                );
              }
              if (new Set(next.map((x) => x.symbol)).size !== next.length)
                throw Error('文件名股票代码重复');
              await install(next);
              setProvider('csv');
              setPoll(false);
              setStatus('CSV已清洗并载入分析与回测。');
            } catch (e) {
              setStatus((e as Error).message);
            }
            e.target.value = '';
          }}
        />
        <div className="sectionTitle" style={{ marginTop: 20 }}>
          <h3>当前回测数据集</h3>
          <button
            className="secondary"
            onClick={() =>
              save('market-data.json', {
                sha256: manifest,
                exportedAt: new Date().toISOString(),
                data: dataset,
              })
            }
          >
            导出数据与来源
          </button>
        </div>
        <Grid
          headers={[
            '代码',
            '实际首日',
            '实际末日',
            '有效日线数',
            '复权口径',
            '来源',
            '导出',
          ]}
          rows={dataset.map((s) => [
            s.symbol,
            s.bars[0].date,
            s.asOf,
            s.bars.length,
            s.adjustment,
            s.source,
            <button
              className="secondary"
              onClick={() =>
                save(
                  s.symbol + '.csv',
                  'date,open,high,low,close,volume\n' +
                    s.bars
                      .map((b) =>
                        [b.date, b.open, b.high, b.low, b.close, b.volume].join(
                          ',',
                        ),
                      )
                      .join('\n'),
                )
              }
            >
              CSV
            </button>,
          ])}
        />
        {dataset.flatMap((s) =>
          s.warnings.map((w) => (
            <p key={s.symbol + w} className="fineprint">
              {s.symbol}：{w}
            </p>
          )),
        )}
        <small>
          数据指纹 SHA-256：
          {manifest || '使用当前初始数据；下载 / 导入后生成指纹'}
        </small>
      </section>
      <section className="panel">
        <div className="sectionTitle">
          <h2>历史回测实验室 · 自研事件驱动引擎 2.0</h2>
          <button onClick={run}>运行全部选定实验</button>
        </div>
        <div className="formgrid">
          <Choice
            label="策略范围"
            value={strategy}
            onChange={setStrategy}
            options={{ all: '四种策略批量比较', ...strategies }}
          />
          <label>
            回测开始
            <input
              type="date"
              value={cfg.start}
              onChange={(e) => setCfg({ ...cfg, start: e.target.value })}
            />
          </label>
          <label>
            回测结束
            <input
              type="date"
              value={cfg.end}
              onChange={(e) => setCfg({ ...cfg, end: e.target.value })}
            />
          </label>
          <N
            label="初始资金 USD / 标的"
            value={cfg.initial}
            onChange={(v) => setCfg({ ...cfg, initial: v })}
            min={100}
          />
          <N
            label="投入仓位 %"
            value={cfg.allocation * 100}
            onChange={(v) => setCfg({ ...cfg, allocation: v / 100 })}
            min={1}
            max={100}
          />
          <N
            label="单边费率 bp"
            value={cfg.feeBps}
            onChange={(v) => setCfg({ ...cfg, feeBps: v })}
            max={100}
          />
          <N
            label="单边滑点 bp"
            value={cfg.slippageBps}
            onChange={(v) => setCfg({ ...cfg, slippageBps: v })}
            max={100}
          />
          <N
            label="止损 %"
            value={cfg.stop * 100}
            onChange={(v) => setCfg({ ...cfg, stop: v / 100 })}
            min={1}
            max={99}
          />
          <N
            label="账户回撤熔断 %"
            value={cfg.maxDrawdown * 100}
            onChange={(v) => setCfg({ ...cfg, maxDrawdown: v / 100 })}
            min={1}
            max={99}
          />
          <N
            label="前段 / 样本内占比 %"
            value={split}
            onChange={setSplit}
            min={50}
            max={90}
          />
          {Object.entries({
            fast: '快均线（日）',
            slow: '慢均线（日）',
            rsiBuy: 'RSI入场阈值',
            rsiSell: 'RSI离场阈值',
            breakout: '突破窗口（日）',
            exit: '突破退出窗口（日）',
            volumeRatio: '量比阈值',
          }).map(([k, label]) => (
            <N
              key={k}
              label={label}
              value={params[k as keyof StrategyParams]}
              onChange={(v) => setParams({ ...params, [k]: v })}
            />
          ))}
        </div>
        <p className="fineprint">
          逐日事件循环：已完成收盘 → 生成信号 → 次日开盘下单 → 交易成本 →
          日内止损 →
          收盘估值与熔断。参数可配置，成交和完整输入可导出复现。每只股票独立账户，结果不是多资产组合回测。末段为固定参数的时间留出检验，不自动调参；反复据样本外结果调参将失去样本外意义。
        </p>
      </section>
      {status && (
        <div className="message" role="status">
          {status}
        </div>
      )}
      {!!runs.length && (
        <>
          <section className="panel">
            <div className="sectionTitle">
              <h2>实验对比 · 保存的参数快照</h2>
              <button
                className="secondary"
                onClick={() =>
                  save('backtest-reproducible.json', {
                    engine: 'Market Lab Event Engine 2.0',
                    generatedAt: new Date().toISOString(),
                    dataSha256: manifest,
                    dataset,
                    runs,
                  })
                }
              >
                导出完整输入与回测 JSON
              </button>
            </div>
            <Grid
              headers={[
                '股票',
                '策略',
                '实际区间',
                '收益',
                '年化',
                '夏普',
                '最大回撤',
                '胜率',
                '盈亏比',
                '交易数',
                '留出区间收益',
              ]}
              rows={runs.map((r) => [
                r.symbol,
                r.strategy,
                `${r.full.actualStart} / ${r.full.actualEnd}`,
                percent(r.full.total),
                percent(r.full.annual),
                number(r.full.sharpe),
                percent(r.full.maxDrawdown),
                percent(r.full.winRate),
                number(r.full.payoff),
                r.full.closedTrades,
                r.out ? percent(r.out.total) : '不足20日',
              ])}
            />
            <p className="fineprint">
              修改输入不会改动已生成快照；请重新运行。成交手续费计入收益，无风险利率在夏普中设0；日频252日年化。
            </p>
          </section>
          <section className="panel">
            <Choice
              label="查看实验明细"
              value={index}
              onChange={setIndex}
              options={Object.fromEntries(
                runs.map((r, i) => [String(i), r.symbol + ' / ' + r.strategy]),
              )}
            />
            <h3 style={{ marginTop: 18 }}>
              权益曲线 · 相同仓位和成本的买入持有基准
            </h3>
            <LineChart
              series={[
                {
                  name: '策略',
                  color: '#58dfb0',
                  values: current.full.curve.map((x) => x.equity),
                },
                {
                  name: '同仓位基准',
                  color: '#8295bf',
                  values: current.full.matchedBenchmark.map((x) => x.equity),
                },
              ]}
              labels={current.full.curve.map((x) => x.date)}
            />
            <p>
              总手续费 ${number(current.full.totalFees)} · 期末持股{' '}
              {current.full.openQty} · 有效交易日 {current.full.barsUsed} ·
              留出起点 {current.testStart}
            </p>
            {current.warnings.map((w) => (
              <p key={w} className="notice">
                {w}
              </p>
            ))}
            <div className="sectionTitle">
              <h3>完整往返交易（最近50笔）</h3>
              <button
                className="secondary"
                onClick={() =>
                  save(
                    current.symbol + '-trades.csv',
                    'entryDate,exitDate,quantity,entryPrice,exitPrice,fees,pnl,return\n' +
                      current.full.journal
                        .map((j) =>
                          [
                            j.entryDate,
                            j.exitDate,
                            j.qty,
                            j.entryPrice,
                            j.exitPrice,
                            j.fees,
                            j.pnl,
                            j.returnPct,
                          ].join(','),
                        )
                        .join('\n'),
                  )
                }
              >
                导出全部交易 CSV
              </button>
            </div>
            <Grid
              headers={[
                '开仓日期',
                '平仓日期',
                '数量',
                '开仓价',
                '平仓价',
                '费用',
                '净损益',
                '收益率',
              ]}
              rows={current.full.journal
                .slice(-50)
                .map((j) => [
                  j.entryDate,
                  j.exitDate,
                  j.qty,
                  number(j.entryPrice),
                  number(j.exitPrice),
                  number(j.fees),
                  number(j.pnl),
                  percent(j.returnPct),
                ])}
            />
          </section>
        </>
      )}
    </>
  );
}
