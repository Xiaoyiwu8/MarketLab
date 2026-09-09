'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import EmailSettings from './email-settings';
import DataCenter, { StockResearch } from './data-center';
import NewsPanel from './news-panel';
import VolumePanel from './volume-panel';
import TradeGuidancePanel from './trade-guidance-panel';
import DecisionBanner from './decision-banner';
import MarketScanPanel from './market-scan-panel';
import { isCryptoSymbol } from '@/lib/assets';
import SectorPanel from './sector-panel';
import ReviewDashboard from './review-dashboard';
import SensitivityPanel from './sensitivity-panel';
import ShortPanel from './short-panel';
import ExitPlan from './exit-plan';
import RangeCenterPanel from './range-center-panel';
import EventRadar from './event-radar';
import RateProbability from './rate-probability';
import { importCsv } from '@/lib/csv';
import { Candles, LineChart } from './lab-charts';
import {
  demo,
  indicators,
  strategies,
  action,
  backtest,
  optionStrategies,
  makeLegs,
  optionRisk,
  payoff,
  greeks,
  bs,
  newAccount,
  equity,
  available,
  openPosition,
  closePosition,
  type Series,
  type Strategy,
  type BacktestConfig,
  type Leg,
  type Account,
  type Position,
} from '@/lib/engine';
const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n)
    ? '—'
    : !Number.isFinite(n)
      ? '无限'
      : n.toLocaleString('en-US', {
          maximumFractionDigits: d,
          minimumFractionDigits: d,
        });
const pct = (n: number | null) => (n === null ? '—' : fmt(n * 100) + '%');
const signalNames = {
  BUY: '买入条件成立',
  SELL: '退出 / 空仓条件',
  HOLD: '观望',
};
function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger
          style={{ width: '100%', height: 43, color: '#eaf1f7' }}
          aria-label={label}
        >
          <SelectValue>{options[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 1e9,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === '' ? NaN : Number(e.target.value))
        }
      />
    </label>
  );
}
function Metrics({ items }: { items: [string, string, string?][] }) {
  return (
    <div className="metrics">
      {items.map(([label, value, note]) => (
        <div className="metric" key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
          {note && <small>{note}</small>}
        </div>
      ))}
    </div>
  );
}
function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="scroll">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((x) => (
              <TableHead key={x} style={{ color: '#9eb3c6' }}>
                {x}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((v, j) => (
                  <TableCell key={j}>{v}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="muted">
                暂无记录
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
function download(name: string, text: string, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
const defaults: BacktestConfig = {
  initial: 100000,
  allocation: 0.2,
  feeBps: 1,
  slippageBps: 5,
  stop: 0.08,
  maxDrawdown: 0.15,
  start: '2025-01-01',
  end: '2026-09-04',
};
function Workspace({
  initialData,
  initialInput,
  initialProvider,
}: {
  initialData: Series[];
  initialInput: string;
  initialProvider: string;
}) {
  const [input, setInput] = useState(initialInput),
    [provider, setProvider] = useState(initialProvider),
    [key, setKey] = useState(''),
    [secret, setSecret] = useState(''),
    [data, setData] = useState<Series[]>(initialData),
    [selected, setSelected] = useState(initialData[0].symbol),
    [tab, setTab] = useState('research'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [failedQuery, setFailedQuery] = useState(''),
    [riskGate, setRiskGate] = useState({
      symbol: '',
      reason: '正在核验大盘与风控',
    }),
    [strategy, setStrategy] = useState<Strategy>('trend'),
    [config, setConfig] = useState<BacktestConfig>(defaults),
    [result, setResult] = useState<{
      symbol: string;
      source: string;
      strategy: Strategy;
      config: BacktestConfig;
      result: ReturnType<typeof backtest>;
    } | null>(null),
    [account, setAccount] = useState<Account>(newAccount),
    [ready, setReady] = useState(false),
    [auto, setAuto] = useState(false),
    [alerts, setAlerts] = useState<{ time: string; text: string }[]>([]),
    [customAlert, setCustomAlert] = useState({
      symbol: '',
      above: '',
      below: '',
      volume: '2',
      enabled: false,
    }),
    [quantity, setQuantity] = useState(10),
    [maxPos, setMaxPos] = useState(0.25),
    [ddLimit, setDdLimit] = useState(0.15),
    [stop, setStop] = useState(0.08);
  const [optionKind, setOptionKind] =
      useState<keyof typeof optionStrategies>('bullCall'),
    [strike, setStrike] = useState(200),
    [width, setWidth] = useState(10),
    [days, setDays] = useState(30),
    [iv, setIv] = useState(0.3),
    [rate, setRate] = useState(0.04),
    [dividend, setDividend] = useState(0),
    [contracts, setContracts] = useState(1),
    [overrides, setOverrides] = useState<number[] | null>(null),
    [chain, setChain] = useState<any>(null),
    [chainExpiry, setChainExpiry] = useState(''),
    [chainType, setChainType] = useState('all');
  const locked = useRef(false),
    alertKeys = useRef(new Set<string>()),
    current = data.find((x) => x.symbol === selected) ?? data[0],
    bars = current.bars,
    ind = useMemo(() => indicators(bars), [bars]),
    last = ind.at(-1)!,
    spot = current.quote?.price ?? last.close,
    mode =
      current.assetClass === 'crypto' ? 'coinbase' : current.source === '合成演示数据'
        ? 'demo'
        : current.source.startsWith('Alpaca')
          ? 'alpaca'
          : current.source === '用户导入 CSV'
            ? 'csv'
            : current.source.startsWith('腾讯')
              ? 'tencent'
              : current.source.startsWith('Polygon')
                ? 'polygon'
                : current.source.startsWith('Alpha Vantage')
                  ? 'alpha'
                  : 'yahoo';
  const optValid =
    current.assetClass !== 'crypto' &&
    [strike, width, days, iv, rate, dividend].every(Number.isFinite) &&
    strike > width &&
    width > 0 &&
    days >= 1 &&
    days <= 730 &&
    iv >= 0.01 &&
    iv <= 3 &&
    rate >= 0 &&
    rate <= 0.3 &&
    dividend >= 0 &&
    dividend <= 0.3;
  const legs = useMemo(() => {
    if (!optValid) return [];
    const ls = makeLegs(
      optionKind,
      spot,
      strike,
      width,
      days,
      iv,
      rate,
      dividend,
    );
    return ls.map((l, i) => ({ ...l, premium: overrides?.[i] ?? l.premium }));
  }, [
    optionKind,
    spot,
    strike,
    width,
    days,
    iv,
    rate,
    dividend,
    optValid,
    overrides,
  ]);
  const risk = optionRisk(legs),
    optPrices = Array.from(
      { length: 121 },
      (_, i) => spot * 0.4 + (i * spot * 1.2) / 120,
    ),
    optPayoffs = optPrices.map((s) => payoff(legs, s)),
    premium = legs.reduce(
      (s, l) => s + l.premium * l.qty * (l.type === 'stock' ? 1 : 100),
      0,
    ),
    optionFee = legs.filter((l) => l.type !== 'stock').length * 0.65;
  useEffect(() => {
    try {
      const raw = localStorage.getItem('market-lab-account-v1');
      if (raw) {
        const a = JSON.parse(raw);
        if (
          typeof a.cash === 'number' &&
          Number.isFinite(a.cash) &&
          Array.isArray(a.positions) &&
          Array.isArray(a.ledger) &&
          a.initial === 100000 &&
          a.positions.every(
            (p: any) =>
              typeof p.symbol === 'string' &&
              Number.isFinite(p.qty) &&
              Number.isFinite(p.entry) &&
              Number.isFinite(p.mark) &&
              Number.isFinite(p.reserve),
          )
        )
          setAccount(a);
      }
    } catch {
      setMessage('本设备账户记录无法读取，已使用空模拟账户。');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('market-lab-account-v1', JSON.stringify(account));
      } catch {
        setMessage('浏览器存储不可用，账户仅在本次页面会话有效，请导出备份。');
      }
  }, [account, ready]);
  useEffect(() => {
    setStrike(Math.max(10, Math.round(spot / 5) * 5));
    setOverrides(null);
    setChain(null);
  }, [selected, mode]);
  useEffect(() => {
    setOverrides(null);
  }, [optionKind, strike, width, days, iv, rate, dividend]);
  function logSignal(d: Series, s: Strategy) {
    if (
      customAlert.enabled &&
      customAlert.symbol.toUpperCase() === d.symbol &&
      !/合成|演示/.test(d.source)
    ) {
      const last = d.bars.at(-1),
        prev = d.bars.at(-2);
      if (last && prev && Date.now() - Date.parse(last.date) < 7 * 86400000) {
        const ratio = indicators(d.bars).at(-1)?.volumeRatio;
        const matches = [
          [
            customAlert.above !== '' &&
              Number(customAlert.above) > 0 &&
              last.close > Number(customAlert.above) &&
              prev.close <= Number(customAlert.above),
            `收盘上穿 ${customAlert.above}`,
          ],
          [
            customAlert.below !== '' &&
              Number(customAlert.below) > 0 &&
              last.close < Number(customAlert.below) &&
              prev.close >= Number(customAlert.below),
            `收盘下穿 ${customAlert.below}`,
          ],
          [
            customAlert.volume !== '' &&
              Number(customAlert.volume) > 0 &&
              ratio != null &&
              ratio >= Number(customAlert.volume),
            `量比 ${ratio?.toFixed(2)}× ≥ ${customAlert.volume}×`,
          ],
        ] as const;
        for (const [matched, reason] of matches) {
          const alertId = `custom/${d.symbol}/${last.date}/${reason}`;
          if (!matched || alertKeys.current.has(alertId)) continue;
          alertKeys.current.add(alertId);
          const text = `${d.symbol} · 自定义提醒：${reason} · ${last.date} · ${d.source}`;
          setAlerts((old) =>
            [{ time: new Date().toISOString(), text }, ...old].slice(0, 200),
          );
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          )
            new Notification('Market Lab 自定义提醒', { body: text });
        }
      }
    }
    const a = indicators(d.bars),
      v = action(a, a.length - 1, s),
      id = `${d.source}/${d.symbol}/${d.asOf}/${s}/${v}`;
    if (v === 'HOLD' || alertKeys.current.has(id)) return;
    alertKeys.current.add(id);
    const text = `${d.symbol} · ${signalNames[v]} · ${strategies[s]} · ${d.asOf} · ${d.source}`;
    setAlerts((old) =>
      [{ time: new Date().toISOString(), text }, ...old].slice(0, 200),
    );
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    )
      new Notification('Market Lab 策略信号', { body: text });
  }
  function markAccount(next: Series[]) {
    setAccount((old) => {
      let a = {
        ...old,
        positions: old.positions.map((p) => {
          const d = next.find((x) => x.symbol === p.symbol);
          if (!d) return p;
          const src =
            d.assetClass === 'crypto' ? 'coinbase' : d.source === '合成演示数据'
              ? 'demo'
              : d.source.startsWith('Alpaca')
                ? 'alpaca'
                : d.source === '用户导入 CSV'
                  ? 'csv'
                  : d.source.startsWith('腾讯')
                    ? 'tencent'
                    : 'yahoo';
          if (src !== p.source) return p;
          const s = d.quote?.price ?? d.bars.at(-1)!.close;
          if (p.kind === 'stock') return { ...p, mark: s };
          const t = Math.max(
              0,
              (new Date(p.expiry!).getTime() - Date.now()) / 864e5,
            ),
            value = p.legs!.reduce(
              (sum, l) =>
                sum +
                l.qty *
                  (l.type === 'stock'
                    ? s
                    : bs(s, l.strike, t, p.iv!, l.type, p.r, p.q) * 100),
              0,
            );
          return { ...p, mark: value };
        }),
      };
      const value = equity(a),
        peak = Math.max(a.peak, value),
        halted = a.halted || 1 - value / peak >= ddLimit;
      a = { ...a, peak, halted };
      for (const p of [...a.positions])
        if (p.kind === 'stock' && (halted || p.mark <= p.entry * (1 - stop))) {
          const fee = p.qty * p.mark * 0.0006;
          a = closePosition(a, p.id, fee);
        }
      return a;
    });
  }
  async function load(symbolText = input) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    setFailedQuery('');
    try {
      const symbols = [
        ...new Set(
          symbolText
            .toUpperCase()
            .split(/[,，\s]+/)
            .filter(Boolean),
        ),
      ];
      if (
        !symbols.length ||
        symbols.length > 12 ||
        symbols.some((s) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(s))
      )
        throw Error('请输入1至12个有效股票代码，例如 AAPL, MSFT, NVDA。');
      let next: Series[];
      let errors: string[] = [];
      if (provider === 'demo') { if (symbols.some(isCryptoSymbol)) throw Error('数字货币请选择真实行情源，演示模式不生成币价'); next = symbols.map(demo); }
      else {
        const r = await fetch('/api/market', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols, provider, key, secret }),
        });
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error ?? '行情获取失败');
        next = d.results.filter((x: any) => !x.error);
        errors = d.results
          .filter((x: any) => x.error)
          .map((x: any) => `${x.symbol}: ${x.error}`);
      }
      if (!next.length) throw Error(errors.join('；'));
      setData(next);
      setSelected((s) =>
        next.some((d) => d.symbol === s) ? s : next[0].symbol,
      );
      setResult(null);
      setChain(null);
      markAccount(next);
      next.forEach((d) => logSignal(d, strategy));
      setMessage(
        errors.length
          ? `部分加载成功；${errors.join('；')}`
          : `已更新 ${next.length} 个资产 · ${next[0].source}`,
      );
      return next.map((x) => ({
        symbol: x.symbol,
        asOf: x.asOf,
        source: x.source,
      }));
    } catch (e) {
      setFailedQuery(symbolText.trim().toUpperCase() || '空代码');
      setAuto(false);
      setMessage((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      void load();
    }, 60000);
    return () => clearInterval(id);
  }, [
    auto,
    input,
    provider,
    key,
    secret,
    strategy,
    ddLimit,
    stop,
    customAlert,
  ]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: 'analyze_stock_symbols',
            description:
              '加载1至12只美股的行情并更新可见分析结果；使用界面选中的数据源。',
            inputSchema: {
              type: 'object',
              properties: { symbols: { type: 'string' } },
              required: ['symbols'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute: async (v: any) => {
              if (typeof v?.symbols !== 'string' || !v.symbols.trim())
                throw Error('symbols 必须是非空字符串');
              const s = v.symbols
                .toUpperCase()
                .split(/[,，\s]+/)
                .filter(Boolean);
              if (
                s.length > 12 ||
                s.some((x: string) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(x))
              )
                throw Error('股票代码格式无效');
              setInput(v.symbols);
              return { results: await load(v.symbols) };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [provider, key, secret, strategy]);
  function run() {
    try {
      if (current.assetClass === 'crypto') throw Error('数字货币回测暂未开放；可使用现货模拟账户');
      const r = backtest(bars, strategy, config);
      setResult({
        symbol: current.symbol,
        source: current.source,
        strategy,
        config: { ...config },
        result: r,
      });
      setMessage('回测完成；未平仓头寸按期末收盘价计入权益，不计入胜率。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function buyStock() {
    try {
      if (!ready) throw Error('账户尚未加载');
      const price = spot * 1.0005,
        p: Position = {
          id: crypto.randomUUID(),
          symbol: current.symbol,
          kind: 'stock',
          assetClass: current.assetClass,
          qty: quantity,
          entry: price,
          mark: spot,
          reserve: 0,
          opened: new Date().toISOString(),
          source: mode,
          label: current.assetClass === 'crypto' ? '数字货币现货' : '股票',
        };
      setAccount(openPosition(account, p, maxPos, price * quantity * 0.0001));
      setMessage(
        `模拟买入 ${current.symbol} ${quantity} ${current.assetClass === 'crypto' ? '枚' : '股'}，参考价 ${fmt(spot)}，含5bp滑点、1bp费用。`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function buyOption() {
    try {
      if (
        !optValid ||
        !legs.length ||
        legs.some((l) => !Number.isFinite(l.premium) || l.premium < 0)
      )
        throw Error('请检查期权参数与权利金');
      const r = optionRisk(legs);
      if (!Number.isFinite(r.maxLoss))
        throw Error('第一版禁止无限风险期权组合');
      let reserve = Math.max(0, r.maxLoss - premium);
      if (optionKind === 'cashPut') reserve = strike * 100;
      const p: Position = {
        id: crypto.randomUUID(),
        symbol: current.symbol,
        kind: 'option',
        qty: contracts,
        entry: premium,
        mark: premium,
        reserve,
        opened: new Date().toISOString(),
        source: mode,
        legs: legs.map((l) => ({ ...l })),
        expiry: new Date(Date.now() + days * 864e5).toISOString(),
        iv,
        r: rate,
        q: dividend,
        label: optionStrategies[optionKind],
      };
      setAccount(openPosition(account, p, maxPos, optionFee * contracts));
      setMessage(
        '期权组合已按理论 / 手动权利金记入情景模拟账户；不代表市场成交。',
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function loadChain() {
    setBusy(true);
    try {
      const r = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: [current.symbol],
          provider: 'alpaca',
          key,
          secret,
          mode: 'options',
          expiry: chainExpiry,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setChain({ ...d, symbol: current.symbol });
      setMessage(
        '期权链已加载。下方策略权利金仍为理论 / 手动输入，未自动采用期权链报价。',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chainRows = Object.entries(chain?.snapshots ?? {})
    .filter(
      ([symbol]) =>
        chainType === 'all' ||
        symbol.match(/\d{6}([CP])\d{8}$/)?.[1] === chainType,
    )
    .map(([symbol, s]: [string, any]) => {
      const m = symbol.match(/(\d{6})([CP])(\d{8})$/);
      return [
        symbol,
        m ? `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}-${m[1].slice(4)}` : '—',
        m?.[2],
        m ? fmt(Number(m[3]) / 1000) : '—',
        fmt(s.latestQuote?.bp),
        fmt(s.latestQuote?.ap),
        fmt(s.impliedVolatility * 100) + '%',
        fmt(s.greeks?.delta),
        s.latestQuote?.t?.slice(0, 19) ?? '—',
      ];
    });
  const visibleResult =
    result?.symbol === current.symbol && result.source === current.source
      ? result
      : null;
  function exportReport() {
    download(
      `${current.symbol}-analysis.json`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          market: current,
          indicators: ind,
          strategy,
          signal: action(ind, ind.length - 1, strategy),
          backtest: visibleResult,
          optionScenario: {
            kind: optionKind,
            spot,
            days,
            iv,
            rate,
            dividend,
            legs,
            risk,
            disclaimer: '理论情景分析，不是期权历史回测',
          },
        },
        (_, v) =>
          typeof v === 'number' && !Number.isFinite(v) ? String(v) : v,
        2,
      ),
    );
  }
  return (
    <main className="shell">
      <header>
        <div className="brand">
          ◈ MARKET LAB <span>美股 · 期权研究台</span>
        </div>
        <span className="badge">PAPER ONLY · 模拟交易</span>
      </header>
      <section className="heading">
        <div>
          <p className="eyebrow">RESEARCH WORKSPACE</p>
          <h1>输入代码，展开你的研究。</h1>
          <p>单股分析 · 多股对比 · 期权策略 · 模拟验证</p>
        </div>
        <button className="secondary" onClick={exportReport}>
          ↓ 导出分析 JSON
        </button>
      </section>
      <section className="panel">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label style={{ flex: 1, minWidth: 220 }}>
            股票 / 数字货币代码（最多12个，逗号分隔）
            <input
              aria-label="股票代码"
              placeholder="例如 AAPL, MSFT, NVDA"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <Pick
            label="股票行情源（数字货币自动使用 Coinbase）"
            value={provider}
            onChange={(v) => {
              setProvider(v);
              setAuto(false);
            }}
            options={{
              demo: '演示数据 · 立即体验',
              tencent: '腾讯 · 公共延迟行情',
              yahoo: 'Yahoo · 公共行情',
              alpaca: 'Alpaca · IEX 行情',
            }}
          />
          <button
            disabled={busy}
            style={{ alignSelf: 'flex-end' }}
            type="submit"
          >
            {busy ? '正在获取…' : '分析资产 →'}
          </button>
        </form>
        <p>BTC、ETH、XRP 等自动识别为数字货币 USD 现货交易对，采用 UTC 日线，不查询同名股票。</p>
        {mode === 'demo' && (
          <div
            role="alert"
            style={{
              background: '#4b1726',
              color: '#ffdce3',
              padding: 18,
              border: '2px solid #ff768b',
              borderRadius: 8,
              marginTop: 18,
              fontWeight: 700,
            }}
          >
            演示模式：下方所有股票价格均为虚构数据，不是该股票真实行情。请切换“腾讯
            · 公共延迟行情”并重新分析。
          </div>
        )}
        <div className="notice">
          {failedQuery &&
            `上次成功的旧数据（不是 ${failedQuery} 的结果）：${current.symbol} · `}
          {current.source} · 日线截至 {current.asOf} · {current.adjustment}
          {current.quote
            ? ` · 最新参考价时间 ${current.quote.time.replace('T', ' ').slice(0, 19)} UTC`
            : ''}
        </div>
        <div className="row">
          {data.map((d) => (
            <button
              className={d.symbol === current.symbol ? '' : 'secondary'}
              key={d.symbol}
              onClick={() => setSelected(d.symbol)}
            >
              {d.symbol}{' '}
              <span style={{ opacity: 0.7 }}>
                ${fmt(d.quote?.price ?? d.bars.at(-1)!.close)}
              </span>
            </button>
          ))}
        </div>
      </section>
      {message && (
        <div className="message" role="status">
          {message}
        </div>
      )}
      {busy && (
        <section className="panel" role="status">
          正在查询 {input.toUpperCase()}，完成后显示对应股票的分析与建议…
        </section>
      )}
      {failedQuery && (
        <section
          className="panel"
          role="alert"
          style={{ border: '2px solid #f27991' }}
        >
          <h2>{failedQuery} 查询失败，暂无本次分析</h2>
          <p>
            已隐藏旧股票 {current.symbol} 的分析和买卖建议，避免误认成{' '}
            {failedQuery}。请核对代码后重新查询。
          </p>
          <div className="row">
            {failedQuery.split(/[,，\s]+/).includes('APPL') && (
              <button
                disabled={busy}
                onClick={() => {
                  const corrected = failedQuery.replace(/\bAPPL\b/g, 'AAPL');
                  setInput(corrected);
                  void load(corrected);
                }}
              >
                苹果代码是 AAPL · 改正并查询
              </button>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setFailedQuery('');
                setMessage('');
                setInput(data.map((s) => s.symbol).join(', '));
              }}
            >
              返回上次成功结果：{current.symbol}
            </button>
          </div>
        </section>
      )}
      <div hidden={!!failedQuery || busy}>
        <MarketScanPanel onSelect={series=>{setData(old=>[series,...old.filter(x=>x.symbol!==series.symbol)].slice(0,12));setSelected(series.symbol);setTab('guidance');}} />
        <DecisionBanner
          series={current}
          onDetails={() => setTab('guidance')}
          riskBlock={
            current.assetClass === 'crypto' ? '数字货币技术观察；美股大盘风控不适用' : riskGate.symbol === current.symbol
              ? riskGate.reason
              : '正在核验大盘与风控'
          }
        />
        {current.assetClass !== 'crypto' && <ShortPanel series={current} />}
        <RangeCenterPanel series={current} />
        <EventRadar />
        <RateProbability />
        <ExitPlan series={current} />
        <SectorPanel
          onAnalyze={(symbols) => {
            setInput(symbols);
            void load(symbols);
          }}
        />
        <Tabs value={current.assetClass === 'crypto' && ['backtest', 'options'].includes(tab) ? 'paper' : tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList
            className="tabbar"
            style={{
              height: 'auto',
              minHeight: 48,
              width: '100%',
              flexWrap: 'wrap',
            }}
          >
            {[
              ['research', '首页 · 大盘与风控'],
              ['analysis', '01 股票分析'],
              ['volume', '成交量'],
              ['guidance', '支撑压力 / 买卖提示'],
              ['backtest', '02 策略回测'],
              ['options', '03 期权策略'],
              ['paper', '04 模拟账户'],
              ['settings', '数据与提醒'],
            ].map(([id, label]) => (
              <TabsTrigger disabled={current.assetClass === 'crypto' && ['backtest', 'options'].includes(id)} key={id} value={id} style={{ padding: '8px 12px' }}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="research" keepMounted>
            {current.assetClass !== 'crypto' ? <ReviewDashboard series={current} onRisk={setRiskGate} /> : <p className="notice">数字货币为 24/7 现货市场；美股大盘风控与期权模型不适用。可查看成交量、支撑压力并进行现货模拟。</p>}
            <DataCenter
              data={data}
              onQuotes={(quotes, source) =>
                setData((old) =>
                  old.map((s) => {
                    const id = s.source.startsWith('腾讯')
                      ? 'tencent'
                      : s.source.startsWith('Yahoo')
                        ? 'yahoo'
                        : s.source.startsWith('Polygon')
                          ? 'polygon'
                          : s.source.startsWith('Alpha Vantage')
                            ? 'alpha'
                            : '';
                    const q = quotes.find((v) => v.symbol === s.symbol)?.quote;
                    return id === source && q ? { ...s, quote: q } : s;
                  }),
                )
              }
              onData={(next) => {
                setData(next);
                setSelected(next[0].symbol);
                setResult(null);
                setAuto(false);
                setMessage(
                  '数据中心已更新当前分析数据；可切换股票分析或直接运行批量回测。',
                );
              }}
            />
          </TabsContent>
          <TabsContent value="guidance">
            <TradeGuidancePanel series={current} />
          </TabsContent>
          <TabsContent value="volume">
            <VolumePanel series={current} />
          </TabsContent>
          <TabsContent value="analysis">
            <TradeGuidancePanel series={current} />
            <VolumePanel series={current} />
            {current.assetClass !== 'crypto' && <><StockResearch symbol={current.symbol} /><NewsPanel symbol={current.symbol} /></>}
            <Metrics
              items={[
                [
                  `${current.symbol} ${mode === 'demo' ? '虚构演示价' : '行情参考价格'}`,
                  '$' + fmt(spot),
                  '最新成交或最后日线',
                ],
                [
                  '日线涨跌',
                  pct(last.close / ind.at(-2)!.close - 1),
                  '基于已完成日线',
                ],
                [
                  'RSI · 14',
                  fmt(last.rsi),
                  last.rsi! > 70
                    ? '超买区域'
                    : last.rsi! < 30
                      ? '超卖区域'
                      : '中性区域',
                ],
                ['成交量比', fmt(last.volumeRatio) + '×', '相对前20日均量'],
              ]}
            />
            <div className="grid2">
              <section className="panel">
                <div className="sectionTitle">
                  <h2>{current.symbol} · 日线行情</h2>
                  <small>最近90个数据日</small>
                </div>
                <div className="row">
                  <small style={{ color: '#e8bb66' }}>━ MA20</small>
                  <small style={{ color: '#8da3ff' }}>━ MA50</small>
                  <small>布林带 20 / 2σ · 下方成交量</small>
                </div>
                <Candles bars={bars} fills={visibleResult?.result.fills} />
                <small>
                  B / S 为当前回测的实际模拟成交标记；鼠标悬停蜡烛可读 OHLCV。
                </small>
              </section>
              <section className="panel">
                <h2>技术解读</h2>
                <Pick
                  label="信号策略"
                  value={strategy}
                  options={strategies}
                  onChange={(v) => setStrategy(v as Strategy)}
                />
                <div className="message">
                  <h3>{signalNames[action(ind, ind.length - 1, strategy)]}</h3>
                  <p>
                    {last.ma20! > last.ma50!
                      ? '20日均线高于50日均线，短期趋势强于中期。'
                      : '20日均线低于50日均线，短期趋势弱于中期。'}
                  </p>
                </div>
                <DataTable
                  columns={['指标', '当前值']}
                  rows={[
                    ['MA20 / MA50', `${fmt(last.ma20)} / ${fmt(last.ma50)}`],
                    [
                      'MACD / 信号线',
                      `${fmt(last.macd)} / ${fmt(last.signal)}`,
                    ],
                    [
                      '布林带上 / 下轨',
                      `${fmt(last.upper)} / ${fmt(last.lower)}`,
                    ],
                    ['MFI · 14', fmt(last.mfi)],
                    ['OBV', fmt(last.obv, 0)],
                  ]}
                />
                <p className="fineprint">
                  MFI、OBV
                  为量价代理指标，不等于“主力净流入”。美股资金动向需要独立的大单
                  / 逐笔 / 机构持仓数据，本版不伪造主力数据。
                </p>
              </section>
            </div>
            <section className="panel">
              <h2>自选股对比</h2>
              <DataTable
                columns={[
                  '股票',
                  '日线日期',
                  '收盘价',
                  'RSI14',
                  'MACD柱',
                  '量比',
                  '所选策略条件',
                ]}
                rows={data.map((d) => {
                  const a = indicators(d.bars),
                    x = a.at(-1)!;
                  return [
                    d.symbol,
                    d.asOf,
                    fmt(x.close),
                    fmt(x.rsi),
                    fmt(x.hist),
                    fmt(x.volumeRatio),
                    signalNames[action(a, a.length - 1, strategy)],
                  ];
                })}
              />
            </section>
            <div className="grid2">
              <section className="panel">
                <h2>RSI · 14</h2>
                <LineChart
                  series={[
                    {
                      name: 'RSI',
                      color: '#8da3ff',
                      values: ind.slice(-90).map((x) => x.rsi ?? 50),
                    },
                    {
                      name: '超买70',
                      color: '#ff768b',
                      values: Array(90).fill(70),
                    },
                    {
                      name: '超卖30',
                      color: '#58dfb0',
                      values: Array(90).fill(30),
                    },
                  ]}
                />
              </section>
              <section className="panel">
                <h2>MACD</h2>
                <LineChart
                  series={[
                    {
                      name: 'MACD',
                      color: '#58dfb0',
                      values: ind.slice(-90).map((x) => x.macd ?? 0),
                    },
                    {
                      name: '信号线',
                      color: '#e8bb66',
                      values: ind.slice(-90).map((x) => x.signal ?? 0),
                    },
                  ]}
                  format={(x) => fmt(x, 1)}
                />
              </section>
            </div>
            {current.warnings.map((w) => (
              <p className="fineprint" key={w}>
                {w}
              </p>
            ))}
          </TabsContent>
          <TabsContent value="backtest">
            <SensitivityPanel
              key={current.symbol + current.asOf + current.source}
              series={current}
            />
            <section className="panel">
              <div className="sectionTitle">
                <h2>{current.symbol} · 股票策略回测</h2>
                <button onClick={run}>运行回测 →</button>
              </div>
              <div className="formgrid">
                <Pick
                  label="策略"
                  value={strategy}
                  options={strategies}
                  onChange={(v) => setStrategy(v as Strategy)}
                />
                <Num
                  label="初始资金 USD"
                  value={config.initial}
                  onChange={(v) => setConfig({ ...config, initial: v })}
                  min={100}
                />
                <label>
                  开始日期
                  <input
                    type="date"
                    value={config.start}
                    onChange={(e) =>
                      setConfig({ ...config, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  结束日期
                  <input
                    type="date"
                    value={config.end}
                    onChange={(e) =>
                      setConfig({ ...config, end: e.target.value })
                    }
                  />
                </label>
                <Num
                  label="仓位 %"
                  value={config.allocation * 100}
                  onChange={(v) =>
                    setConfig({ ...config, allocation: v / 100 })
                  }
                  max={100}
                  min={1}
                />
                <Num
                  label="单边费用 bp"
                  value={config.feeBps}
                  onChange={(v) => setConfig({ ...config, feeBps: v })}
                  max={100}
                />
                <Num
                  label="单边滑点 bp"
                  value={config.slippageBps}
                  onChange={(v) => setConfig({ ...config, slippageBps: v })}
                  max={100}
                />
                <Num
                  label="止损 %"
                  value={config.stop * 100}
                  onChange={(v) => setConfig({ ...config, stop: v / 100 })}
                  min={1}
                  max={99}
                />
                <Num
                  label="回撤熔断 %"
                  value={config.maxDrawdown * 100}
                  onChange={(v) =>
                    setConfig({ ...config, maxDrawdown: v / 100 })
                  }
                  min={1}
                  max={99}
                />
              </div>
              <p className="fineprint">
                固定50根日线预热；当日收盘信号于下一可用交易日开盘执行。只做多、不加杠杆；止损遇跳空按较差开盘价。回撤熔断于收盘检测、下一日开盘清仓。夏普无风险收益设为0，按252日年化。基准为100%买入持有，未计费用。量价多因子不是基本面因子模型。
              </p>
            </section>
            {visibleResult ? (
              <>
                <p className="fineprint">
                  结果参数快照：{strategies[visibleResult.strategy]} ·{' '}
                  {visibleResult.config.start} 至 {visibleResult.config.end} ·
                  仓位 {pct(visibleResult.config.allocation)}
                  ；修改参数后需重新运行。
                </p>
                <Metrics
                  items={[
                    ['总收益', pct(visibleResult.result.total)],
                    ['年化收益', pct(visibleResult.result.annual)],
                    ['夏普比率', fmt(visibleResult.result.sharpe)],
                    ['最大回撤', pct(visibleResult.result.maxDrawdown)],
                    ['胜率', pct(visibleResult.result.winRate)],
                    [
                      '盈亏比',
                      fmt(visibleResult.result.payoff),
                      '平均盈利 / 平均亏损绝对值',
                    ],
                    [
                      '利润因子',
                      fmt(visibleResult.result.profitFactor),
                      '盈利总额 / 亏损总额绝对值',
                    ],
                    ['已平仓笔数', String(visibleResult.result.closedTrades)],
                  ]}
                />
                <section className="panel">
                  <h2>账户权益曲线</h2>
                  <LineChart
                    series={[
                      {
                        name: '策略权益',
                        color: '#58dfb0',
                        values: visibleResult.result.curve.map((x) => x.equity),
                      },
                      {
                        name: '买入持有基准',
                        color: '#7b92b2',
                        values: visibleResult.result.curve.map(
                          (x) => x.benchmark,
                        ),
                      },
                    ]}
                    labels={visibleResult.result.curve.map((x) => x.date)}
                  />
                  <p>
                    期末未平仓 {visibleResult.result.openQty} 股 ·{' '}
                    {visibleResult.result.halt ? '已触发熔断' : '未触发熔断'}
                  </p>
                </section>
                <section className="panel">
                  <div className="sectionTitle">
                    <h2>成交明细（最近100条）</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          'backtest-trades.csv',
                          'date,side,price,quantity,fee,pnl,reason\n' +
                            visibleResult.result.fills
                              .map((f) =>
                                [
                                  f.date,
                                  f.side,
                                  f.price,
                                  f.qty,
                                  f.fee,
                                  f.pnl ?? '',
                                  f.reason,
                                ].join(','),
                              )
                              .join('\n'),
                          'text/csv;charset=utf-8',
                        )
                      }
                    >
                      导出全部 CSV
                    </button>
                  </div>
                  <DataTable
                    columns={[
                      '日期',
                      '方向',
                      '数量',
                      '成交价',
                      '费用',
                      '已实现损益',
                      '原因',
                    ]}
                    rows={visibleResult.result.fills
                      .slice(-100)
                      .reverse()
                      .map((f) => [
                        f.date,
                        f.side,
                        f.qty,
                        fmt(f.price),
                        fmt(f.fee),
                        fmt(f.pnl),
                        f.reason,
                      ])}
                  />
                </section>
              </>
            ) : (
              <section className="panel">
                <h2>选择策略和时间区间后运行</h2>
                <p>
                  这里将展示真实计算的绩效与成交记录。演示行情上的回测不代表股票历史表现。
                </p>
              </section>
            )}
          </TabsContent>
          <TabsContent value="options">
            <section className="panel">
              <div className="sectionTitle">
                <h2>{current.symbol} · 期权策略构建</h2>
                <span className="badge">理论 / 手动权利金</span>
              </div>
              <div className="formgrid">
                <Pick
                  label="策略模板"
                  value={optionKind}
                  options={optionStrategies}
                  onChange={(v) =>
                    setOptionKind(v as keyof typeof optionStrategies)
                  }
                />
                <Num
                  label="基础行权价 USD"
                  value={strike}
                  onChange={setStrike}
                  min={1}
                />
                <Num
                  label="行权价间距 USD"
                  value={width}
                  onChange={setWidth}
                  min={1}
                />
                <Num
                  label="距到期天数"
                  value={days}
                  onChange={setDays}
                  min={1}
                  max={730}
                />
                <Num
                  label="隐含波动率 %"
                  value={iv * 100}
                  onChange={(v) => setIv(v / 100)}
                  min={1}
                  max={300}
                />
                <Num
                  label="无风险利率 %"
                  value={rate * 100}
                  onChange={(v) => setRate(v / 100)}
                  step={0.1}
                  max={30}
                />
                <Num
                  label="连续股息率 %"
                  value={dividend * 100}
                  onChange={(v) => setDividend(v / 100)}
                  step={0.1}
                  max={30}
                />
                <Num
                  label="组合数量"
                  value={contracts}
                  onChange={setContracts}
                  min={1}
                  max={100}
                />
              </div>
              {!optValid && (
                <p className="negative">
                  请填写合法参数：行权价必须大于间距；到期1–730天；波动率1%–300%。
                </p>
              )}
              <p className="notice">
                标的参考价 ${fmt(spot)} · Black–Scholes
                欧式理论估值。美股个股期权通常为美式，本模型不模拟提前行权、指派、除息及真实成交价差。每标准合约100股，暂不支持调整后合约。
              </p>
              <DataTable
                columns={[
                  '方向 / 数量',
                  '类型',
                  '行权价',
                  '权利金 / 股（可编辑）',
                  'Delta',
                  'Gamma',
                  'Theta / 日',
                  'Vega / 1%',
                ]}
                rows={legs.map((l, i) => {
                  const g =
                    l.type === 'stock'
                      ? null
                      : greeks(
                          spot,
                          l.strike,
                          days,
                          iv,
                          l.type,
                          rate,
                          dividend,
                        );
                  return [
                    `${l.qty > 0 ? '买入' : '卖出'} ${Math.abs(l.qty)}`,
                    l.type,
                    l.type === 'stock' ? '—' : fmt(l.strike),
                    <input
                      key={i}
                      aria-label={`第${i + 1}腿权利金`}
                      style={{ width: 120 }}
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        Number.isFinite(l.premium)
                          ? Number(l.premium.toFixed(4))
                          : ''
                      }
                      onChange={(e) => {
                        const p = legs.map((x) => x.premium);
                        p[i] =
                          e.target.value === '' ? NaN : Number(e.target.value);
                        setOverrides(p);
                      }}
                    />,
                    fmt(g?.delta, 3),
                    fmt(g?.gamma, 4),
                    fmt(g?.theta, 3),
                    fmt(g?.vega, 3),
                  ];
                })}
              />
              <p className="fineprint">
                Greeks
                为单份每股理论值，不会因为手动权利金而反推IV。更改策略参数将重置手动权利金；下单前请核对。
              </p>
            </section>
            <Metrics
              items={[
                [
                  premium >= 0 ? '净支出 / 组合' : '净收入 / 组合',
                  '$' + fmt(Math.abs(premium)),
                ],
                ['最大收益 / 组合', fmt(risk.maxProfit)],
                ['最大亏损 / 组合', fmt(risk.maxLoss)],
                [
                  '盈亏平衡价',
                  risk.breakevens.map((x) => fmt(x)).join(' / ') ||
                    '无有限交点',
                ],
              ]}
            />
            <div className="grid2">
              <section className="panel">
                <h2>到期损益 · 每组合 USD</h2>
                <LineChart
                  series={[
                    {
                      name: '到期损益（未扣手续费）',
                      color: '#58dfb0',
                      values: optPayoffs,
                    },
                  ]}
                  labels={optPrices.map((s) => '$' + fmt(s, 0))}
                />
                <p className="fineprint">
                  横轴：到期标的价格。收益上限 /
                  亏损上限按全价格域计算，非仅图中区间。
                </p>
              </section>
              <section className="panel">
                <h2>记录期权模拟交易</h2>
                <p>
                  以当前各腿权利金记录开仓，组合整体计价、整体平仓。每合约单边费用
                  $0.65。
                </p>
                <Metrics
                  items={[
                    ['组合数量', fmt(contracts, 0)],
                    ['开仓费用', '$' + fmt(optionFee * contracts)],
                  ]}
                />
                <button disabled={!ready || !optValid} onClick={buyOption}>
                  加入模拟账户 →
                </button>
                <p className="fineprint">
                  现金担保看跌预留完整行权资金；备兑组合同时模拟买入100股，不占用已有股票。价差预留定义风险所需资金。期权到期采用内在价值情景估值、手动整体平仓，不执行真实行权或指派。
                </p>
              </section>
            </div>
            <section className="panel">
              <h2>真实期权链 · Alpaca 指示性数据</h2>
              <div className="formgrid">
                <label>
                  到期日筛选（可留空）
                  <input
                    type="date"
                    value={chainExpiry}
                    onChange={(e) => setChainExpiry(e.target.value)}
                  />
                </label>
                <Pick
                  label="类型筛选"
                  value={chainType}
                  onChange={setChainType}
                  options={{ all: '全部', C: '看涨 Call', P: '看跌 Put' }}
                />
                <button
                  disabled={busy}
                  onClick={loadChain}
                  style={{ alignSelf: 'end' }}
                >
                  获取期权链
                </button>
              </div>
              <p className="fineprint">
                在“数据与提醒”填写 Alpaca
                数据凭证后可用。此处报价供查看，不会自动覆盖上方情景权利金。
              </p>
              {chain && (
                <>
                  <p className="notice">
                    {chain.source}
                    {chain.truncated
                      ? ' · 已截取前500个合约，请缩小到期日范围'
                      : ''}
                  </p>
                  <DataTable
                    columns={[
                      '合约',
                      '到期日',
                      '类型',
                      '行权价',
                      'Bid',
                      'Ask',
                      'IV',
                      'Delta',
                      '报价时间 UTC',
                    ]}
                    rows={chainRows}
                  />
                </>
              )}
            </section>
            <section className="panel">
              <h2>期权历史回测：尚未启用</h2>
              <p>
                需要逐日历史合约链、买卖报价、到期与公司行动数据；当前提供到期损益和持仓情景模拟，不能用它替代期权历史策略绩效。
              </p>
            </section>
          </TabsContent>
          <TabsContent value="paper">
            <div className="notice">
              本设备模拟账户 · 初始 $100,000 ·
              记录保存在当前浏览器，请导出备份。不同数据源持仓分开标记，仅同源行情更新估值。
            </div>
            <Metrics
              items={[
                ['账户权益', '$' + fmt(equity(account))],
                ['可用资金', '$' + fmt(available(account))],
                ['累计损益', '$' + fmt(equity(account) - account.initial)],
                [
                  '回撤 / 状态',
                  pct(
                    1 -
                      equity(account) / Math.max(account.peak, equity(account)),
                  ),
                  account.halted ? '已熔断 · 禁止新开仓' : '正常',
                ],
              ]}
            />
            <div className="grid2">
              <section className="panel">
                <h2>{current.symbol} · {current.assetClass === 'crypto' ? '数字货币现货' : '股票'}模拟买入</h2>
                <div className="formgrid">
                  <Num
                    label={current.assetClass === 'crypto' ? '数字货币数量（支持小数）' : '股票数量（整股）'}
                    value={quantity}
                    onChange={setQuantity}
                    min={current.assetClass === 'crypto' ? 0.00000001 : 1}
                    step={current.assetClass === 'crypto' ? 0.00000001 : 1}
                  />
                  <button
                    disabled={!ready}
                    style={{ alignSelf: 'end' }}
                    onClick={buyStock}
                  >
                    模拟买入
                  </button>
                </div>
                <p className="fineprint">
                  参考价 ${fmt(spot)} · {current.source}
                  。市价模拟含5bp滑点和1bp单边费用，不模拟撮合排队 /
                  市场深度；参考价可能陈旧。
                </p>
              </section>
              <section className="panel">
                <h2>账户风控</h2>
                <div className="formgrid">
                  <Num
                    label="单标的累计风险 %"
                    value={maxPos * 100}
                    onChange={(v) =>
                      Number.isFinite(v) &&
                      v >= 1 &&
                      v <= 100 &&
                      setMaxPos(v / 100)
                    }
                    min={1}
                    max={100}
                  />
                  <Num
                    label="账户回撤熔断 %"
                    value={ddLimit * 100}
                    onChange={(v) =>
                      Number.isFinite(v) &&
                      v >= 1 &&
                      v <= 99 &&
                      setDdLimit(v / 100)
                    }
                    min={1}
                    max={99}
                  />
                  <Num
                    label="股票止损 %"
                    value={stop * 100}
                    onChange={(v) =>
                      Number.isFinite(v) &&
                      v >= 1 &&
                      v <= 99 &&
                      setStop(v / 100)
                    }
                    min={1}
                    max={99}
                  />
                </div>
                <p className="fineprint">
                  行情刷新时检查股票止损 /
                  熔断；熔断关闭股票并锁定新开仓，期权组合需手动平仓。页面关闭时不运行。未刷新标的保留上次估值；这些约束不能代替实盘风控。
                </p>
              </section>
            </div>
            <section className="panel">
              <div className="sectionTitle">
                <h2>持仓与浮动盈亏</h2>
                <button
                  className="secondary"
                  onClick={() => {
                    setInput(
                      [...new Set(account.positions.map((p) => p.symbol))].join(
                        ', ',
                      ),
                    );
                    setMessage(
                      '持仓代码已填入输入框，请选择相同数据源并点击分析股票更新估值。',
                    );
                  }}
                >
                  将持仓填入查询
                </button>
              </div>
              <DataTable
                columns={[
                  '标的 / 策略',
                  '数据源',
                  '数量',
                  '开仓单价 / 组合',
                  '当前单价 / 组合',
                  '浮动盈亏',
                  '预留资金',
                  '操作',
                ]}
                rows={account.positions.map((p) => [
                  `${p.symbol} · ${p.label}`,
                  p.source,
                  p.qty,
                  fmt(p.entry),
                  fmt(p.mark),
                  <span className={p.mark >= p.entry ? 'positive' : 'negative'}>
                    {fmt((p.mark - p.entry) * p.qty)}
                  </span>,
                  fmt(p.reserve * p.qty),
                  <button
                    className="secondary"
                    onClick={() => {
                      try {
                        setAccount(
                          closePosition(
                            account,
                            p.id,
                            p.kind === 'stock'
                              ? p.mark * p.qty * 0.0006
                              : p.legs!.filter((l) => l.type !== 'stock')
                                  .length *
                                  0.65 *
                                  p.qty,
                          ),
                        );
                        setMessage('模拟持仓已平仓。');
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    模拟平仓
                  </button>,
                ])}
              />
            </section>
            <section className="panel">
              <div className="sectionTitle">
                <h2>交易流水</h2>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      'paper-account.json',
                      JSON.stringify(account, null, 2),
                    )
                  }
                >
                  导出账户备份
                </button>
              </div>
              <DataTable
                columns={['时间 UTC', '操作', '现金变动']}
                rows={account.ledger
                  .slice(0, 100)
                  .map((l) => [
                    l.time.slice(0, 19).replace('T', ' '),
                    l.description,
                    fmt(l.amount),
                  ])}
              />
            </section>
          </TabsContent>
          <TabsContent value="settings" keepMounted>
            <section className="panel">
              <h2>导入 {current.symbol} 历史日线</h2>
              <p>
                标准 CSV 列：date,open,high,low,close,volume。日期
                YYYY-MM-DD，至少55根日线，所有价格须使用一致复权口径。
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="导入历史日线 CSV"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 5e6) throw Error('CSV不得超过5MB');
                    const d = importCsv(current.symbol, await file.text());
                    setData((old) =>
                      old.map((x) => (x.symbol === d.symbol ? d : x)),
                    );
                    setResult(null);
                    setAuto(false);
                    setMessage(d.warnings.join('；'));
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
                  e.target.value = '';
                }}
              />
            </section>
            <section className="panel">
              <h2>自定义价格与量能提醒</h2>
              <p>
                按最新完整日线检查：价格跨越阈值或量比异常，进入下方提醒日志；配置邮件后可使用同一提醒流。仅页面开启、刷新行情或扫描时执行。
              </p>
              <div className="formgrid">
                {[
                  ['symbol', '股票代码'],
                  ['above', '收盘上穿价格'],
                  ['below', '收盘下穿价格'],
                  ['volume', '量比至少达到（倍）'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={
                        customAlert[
                          key as 'symbol' | 'above' | 'below' | 'volume'
                        ]
                      }
                      onChange={(e) =>
                        setCustomAlert((old) => ({
                          ...old,
                          [key]: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={customAlert.enabled}
                  onChange={(e) =>
                    setCustomAlert((old) => ({
                      ...old,
                      enabled: e.target.checked,
                    }))
                  }
                />{' '}
                启用自定义提醒（指定代码须在本次扫描股票列表中）
              </label>
              <button
                className="secondary"
                onClick={() => data.forEach((d) => logSignal(d, strategy))}
              >
                检查当前已加载数据
              </button>
            </section>
            <EmailSettings alerts={alerts} />
            <div className="grid2">
              <section className="panel">
                <h2>数据连接</h2>
                <p>
                  公共股票行情无需密钥；Alpaca IEX 历史 /
                  最新成交和期权链需要数据凭证。密钥只存在当前页面内存，经本站服务端转发给
                  Alpaca；不保存在浏览器存储。
                </p>
                <div
                  className="formgrid"
                  style={{ gridTemplateColumns: '1fr 1fr' }}
                >
                  <label>
                    Alpaca Key
                    <input
                      type="password"
                      autoComplete="off"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </label>
                  <label>
                    Alpaca Secret
                    <input
                      type="password"
                      autoComplete="off"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setKey('');
                    setSecret('');
                    setAuto(false);
                    setMessage('凭证已从页面内存清除。');
                  }}
                >
                  清除凭证
                </button>
                <p className="fineprint">
                  仅调用 data.alpaca.markets
                  行情端点；此应用没有真实券商下单端点。IEX
                  是单一交易所，并非全市场合并成交量。
                  <a
                    href="https://docs.alpaca.markets/us/docs/market-data-faq"
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看官方说明 ↗
                  </a>
                </p>
              </section>
              <section className="panel">
                <h2>信号扫描与提醒</h2>
                <label
                  className="row"
                  style={{ flexDirection: 'row', margin: '18px 0' }}
                >
                  <Switch checked={auto} onCheckedChange={setAuto} />{' '}
                  每60秒刷新自选股并扫描日线信号
                </label>
                <button
                  className="secondary"
                  onClick={async () => {
                    if (typeof Notification === 'undefined') {
                      setMessage(
                        '当前浏览器不支持系统通知，请查看站内信号日志。',
                      );
                      return;
                    }
                    const p = await Notification.requestPermission();
                    setMessage(
                      p === 'granted'
                        ? '系统通知已启用'
                        : '系统通知未获授权，仍保留站内提醒。',
                    );
                  }}
                >
                  启用浏览器通知
                </button>
                <button
                  className="secondary"
                  style={{ marginLeft: 10 }}
                  onClick={() => {
                    data.forEach((d) => logSignal(d, strategy));
                    setMessage(
                      '已扫描当前加载数据；相同数据日、策略、信号去重。',
                    );
                  }}
                >
                  立即扫描
                </button>
                <p className="fineprint">
                  仅页面保持打开时运行；浏览器后台节流可能推迟执行。使用已完成日线生成条件，不是逐笔实时策略。邮件可接入本页
                  Resend 配置自动发送，X
                  自动发布和关闭页面后的定时服务尚未接入。
                </p>
              </section>
            </div>
            <section className="panel">
              <div className="sectionTitle">
                <h2>信号日志</h2>
                <a
                  href={`mailto:?subject=${encodeURIComponent('Market Lab 美股策略信号')}&body=${encodeURIComponent(
                    alerts
                      .slice(0, 10)
                      .map((x) => x.text)
                      .join('\n') || '暂无信号',
                  )}`}
                >
                  生成邮件草稿 ↗
                </a>
              </div>
              <DataTable
                columns={['扫描时间 UTC', '信号 / 来源']}
                rows={alerts.map((a) => [
                  a.time.slice(0, 19).replace('T', ' '),
                  a.text,
                ])}
              />
            </section>
            <section className="panel">
              <h2>从研究到交易的实现路线</h2>
              <DataTable
                columns={['阶段', '本版状态']}
                rows={[
                  [
                    '行情、清洗、指标、单股/多股对比',
                    '已实现；外部数据源按权限 / 可用性返回，失败明确报错',
                  ],
                  [
                    '股票策略回测与绩效',
                    '已实现4种策略、交易成本、止损、熔断、成交导出',
                  ],
                  [
                    '期权策略与交易',
                    '10种模板、收益图、理论Greeks、真实指示性链、情景模拟持仓',
                  ],
                  [
                    '全天候自动提醒',
                    '本版页面内扫描、系统通知及Resend邮件；关闭页面后运行需要后台服务',
                  ],
                  ['期权历史回测', '待接入历史期权链与真实报价数据集'],
                  [
                    '真实自动化执行',
                    '未来另行接入券商、权限与订单审计；当前只有模拟交易',
                  ],
                ]}
              />
            </section>
          </TabsContent>
        </Tabs>
      </div>
      <footer>
        所有金额以 USD 计。回测与理论估值不保证未来收益。
        <a
          href="https://www.optionseducation.org/strategies/all-strategies"
          target="_blank"
          rel="noreferrer"
        >
          期权策略与行权机制说明 ↗
        </a>{' '}
        · 数据口径、日期与未实现项均在对应页面列明。
      </footer>
    </main>
  );
}

export default function Lab() {
  const [initial, setInitial] = useState<{
    data: Series[];
    input: string;
    provider: string;
  } | null>(null);
  const [input, setInput] = useState('GOOGL');
  const [provider, setProvider] = useState('tencent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requesting = useRef(false);
  async function start() {
    if (requesting.current) return;
    requesting.current = true;
    setBusy(true);
    setError('');
    try {
      const symbols = [
        ...new Set(
          input
            .toUpperCase()
            .split(/[,，\s]+/)
            .filter(Boolean),
        ),
      ];
      if (
        !symbols.length ||
        symbols.length > 12 ||
        symbols.some((s) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(s))
      )
        throw Error('请输入1至12个有效美股代码。');
      let data: Series[];
      if (provider === 'demo') { if (symbols.some(isCryptoSymbol)) throw Error('数字货币请选择真实行情源，演示模式不生成币价'); data = symbols.map(demo); }
      else {
        const r = await fetch('/api/market', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols, provider }),
        });
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error ?? '行情加载失败');
        const failed = d.results.filter((x: any) => x.error);
        if (failed.length)
          throw Error(
            failed.map((x: any) => `${x.symbol}: ${x.error}`).join('；'),
          );
        data = d.results;
      }
      setInitial({ data, input: symbols.join(', '), provider });
    } catch (e) {
      setError(
        (e as Error).message + '。未生成或替换为虚构价格，请重试或更换来源。',
      );
    } finally {
      requesting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void start();
  }, []);
  if (initial)
    return (
      <Workspace
        initialData={initial.data}
        initialInput={initial.input}
        initialProvider={initial.provider}
      />
    );
  return (
    <main className="shell">
      <header>
        <div className="brand">
          ◈ MARKET LAB <span>美股 · 期权研究台</span>
        </div>
        <span className="badge">真实公共行情 · 模拟交易</span>
      </header>
      <section className="heading">
        <div>
          <p className="eyebrow">RESEARCH WORKSPACE</p>
          <h1>输入股票代码，获取真实行情。</h1>
          <p>价格加载成功后才显示分析结果；失败时不会填入演示价格。</p>
        </div>
      </section>
      <section className="panel">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label style={{ flex: 1, minWidth: 220 }}>
            股票代码
            <input
              value={input}
              aria-label="股票代码"
              onChange={(e) => setInput(e.target.value)}
              placeholder="GOOGL, AAPL, MSFT"
            />
          </label>
          <Pick
            label="行情来源"
            value={provider}
            onChange={setProvider}
            options={{
              tencent: '腾讯 · 真实公共延迟行情',
              yahoo: 'Yahoo · 真实公共行情',
              demo: '虚构价格 · 仅体验演示',
            }}
          />
          <button disabled={busy} type="submit" style={{ alignSelf: 'end' }}>
            {busy ? '正在获取真实行情…' : '分析股票 →'}
          </button>
        </form>
        {error && (
          <p className="message" role="alert">
            {error}
          </p>
        )}
        <p className="fineprint">
          例如 GOOGL 为 Alphabet A 类股，GOOG 为 C 类股；两者代码和价格不同。
        </p>
      </section>
    </main>
  );
}

