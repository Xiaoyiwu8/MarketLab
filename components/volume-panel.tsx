'use client';
import type { Series } from '@/lib/engine';
import { volumeSummary } from '@/lib/volume';
import { volumeRead, avg } from '@/lib/review';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

const number = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const percent = (n: number | null) =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const compact = (n: number) =>
  n >= 100000000
    ? `${(n / 100000000).toFixed(2)}亿`
    : n >= 10000
      ? `${(n / 10000).toFixed(1)}万`
      : number(n);

export default function VolumePanel({ series }: { series: Series }) {
  const s = volumeSummary(series.bars);
  if (!s.last)
    return <section className="panel">暂无已完成交易日的成交量数据。</section>;
  const rows = s.completed.slice(-60);
  const reading = volumeRead(s.completed);
  const moving = [5, 20].map((n) => ({
    n,
    values: s.completed
      .map((b, i) =>
        i >= n - 1
          ? avg(s.completed.slice(i - n + 1, i + 1).map((x) => x.volume))
          : null,
      )
      .slice(-60),
  }));
  const max = Math.max(
    1,
    ...rows.map((b) => b.volume),
    ...moving.flatMap((m) => m.values.filter((x): x is number => x !== null)),
  );
  const cards = [
    [
      '最近完整日成交量',
      `${compact(s.last.volume)} 股`,
      `${s.last.date} · ${number(s.last.volume)} 股`,
    ],
    [
      '较上一交易日',
      percent(s.changePct),
      `增减 ${number(s.change)} 股 · 上日 ${number(s.previous?.volume)} 股`,
    ],
    [
      '相对前20日均量',
      s.ratio === null ? '—' : `${s.ratio.toFixed(2)}×`,
      `前20日均量 ${number(s.average20)} 股（不含最新日）`,
    ],
    [
      '最近5日总成交量',
      s.recent5 === null ? '—' : `${compact(s.recent5)} 股`,
      `较此前5日 ${percent(s.fiveChange)}`,
    ],
  ];
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>{series.symbol} · 成交量与变化</h2>
        <small>单位：股 · 数据截至 {s.last.date}</small>
      </div>
      <p className="fineprint">
        来源：{series.source} · {series.adjustment}
        。按行情源提供的日线成交股数统计；不包含今日可能尚未完成的交易。报价刷新不会刷新历史成交量，请使用行情加载按钮更新日线。
      </p>
      <div className="metrics">
        {cards.map(([label, value, detail]) => (
          <div className="metric" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <p>
        {s.ratio === null
          ? '历史样本不足或基准成交量为零，暂不计算量比。'
          : `最新成交量是前20日均量的 ${s.ratio.toFixed(2)} 倍，${s.ratio > 1 ? '高于' : s.ratio < 1 ? '低于' : '等于'}近期平均水平。`}{' '}
        成交量反映交易活跃度，不能据此识别“主力”买卖或资金净流入。
      </p>
      <div className="sectionTitle">
        <h3>最近60个交易日成交量</h3>
        <small>绿色：收盘≥开盘；红色：收盘&lt;开盘</small>
      </div>
      <svg
        viewBox="0 0 940 240"
        role="img"
        aria-label={`${series.symbol} 最近60个交易日成交量柱状图`}
        style={{ width: '100%', minHeight: 160 }}
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="75"
              x2="930"
              y1={205 - v * 175}
              y2={205 - v * 175}
              stroke="#334155"
            />
            <text x="2" y={209 - v * 175} fill="#a0b0c5" fontSize="12">
              {compact(max * v)}
            </text>
          </g>
        ))}
        {moving.map((m, index) => (
          <polyline
            key={m.n}
            points={m.values
              .map((v, i) =>
                v === null
                  ? null
                  : `${78 + ((i + 0.5) * 850) / rows.length},${205 - (v / max) * 175}`,
              )
              .filter(Boolean)
              .join(' ')}
            fill="none"
            stroke={index === 0 ? '#e8bb66' : '#8da3ff'}
            strokeWidth="2"
          />
        ))}
        {rows.map((b, i) => (
          <rect
            key={b.date}
            x={78 + (i * 850) / rows.length}
            y={205 - (b.volume / max) * 175}
            width={Math.max(1, 850 / rows.length - 3)}
            height={(b.volume / max) * 175}
            fill={b.close >= b.open ? '#54d6a0' : '#f27991'}
          >
            <title>
              {b.date}：{number(b.volume)} 股
            </title>
          </rect>
        ))}
        <text x="78" y="231" fill="#a0b0c5" fontSize="12">
          {rows[0].date}
        </text>
        <text x="930" y="231" textAnchor="end" fill="#a0b0c5" fontSize="12">
          {s.last.date}
        </text>
      </svg>
      <p>
        黄色：VMA5 · 蓝色：VMA20（包含当日）。{reading?.state} ·{' '}
        {reading?.pairing}。VMA5 {number(reading?.ma5)} 股；VMA10{' '}
        {number(reading?.ma10)} 股；VMA20 {number(reading?.ma20)} 股。
      </p>
      <details>
        <summary>查看最近20个交易日明细</summary>
        <Table>
          <TableHeader>
            <TableRow>
              {['日期', '成交量（股）', '较前日增减（股）', '较前日变化'].map(
                (h) => (
                  <TableHead key={h}>{h}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.completed
              .slice(-20)
              .reverse()
              .map((b) => {
                const prev = s.completed[s.completed.indexOf(b) - 1];
                const delta = prev ? b.volume - prev.volume : null;
                return (
                  <TableRow key={b.date}>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>{number(b.volume)}</TableCell>
                    <TableCell>{number(delta)}</TableCell>
                    <TableCell>
                      {percent(
                        prev && prev.volume > 0 && delta !== null
                          ? delta / prev.volume
                          : null,
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </details>
      <p className="fineprint">
        这是当前股票在所选行情源覆盖范围内的成交股数，不是成交金额，也不是整个美股市场总量。IEX
        数据仅覆盖该交易所；CSV 与演示数据沿用其来源口径。
      </p>
    </section>
  );
}
