import { indicators, type Bar, type Fill } from '@/lib/engine';
export function LineChart({
  series,
  labels,
  format = (x: number) => x.toFixed(0),
}: {
  series: { name: string; color: string; values: number[] }[];
  labels?: string[];
  format?: (x: number) => string;
}) {
  const vals = series.flatMap((x) => x.values).filter(Number.isFinite);
  if (!vals.length) return <p>暂无可绘制数据</p>;
  const lo = Math.min(...vals),
    hi = Math.max(...vals),
    range = Math.max(hi - lo, 1),
    y = (v: number) => 240 - ((v - lo) / range) * 200,
    n = Math.max(...series.map((x) => x.values.length)),
    xx = (i: number) => 65 + (i / Math.max(1, n - 1)) * 720;
  return (
    <div>
      <div className="row">
        {series.map((s) => (
          <small key={s.name} style={{ color: s.color }}>
            ━ {s.name}
          </small>
        ))}
      </div>
      <svg
        viewBox="0 0 830 285"
        className="chart"
        role="img"
        aria-label={series.map((x) => x.name).join('与') + '图'}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="65"
              x2="785"
              y1={y(lo + t * range)}
              y2={y(lo + t * range)}
              stroke="#263747"
            />
            <text x="4" y={y(lo + t * range) + 4}>
              {format(lo + t * range)}
            </text>
          </g>
        ))}
        {lo < 0 && hi > 0 && (
          <line
            x1="65"
            x2="785"
            y1={y(0)}
            y2={y(0)}
            stroke="#758594"
            strokeDasharray="5 5"
          />
        )}
        {series.map((s) => (
          <polyline
            key={s.name}
            points={s.values.map((v, i) => `${xx(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2.2"
          />
        ))}
        {labels &&
          [0, Math.floor((n - 1) / 2), n - 1].map((i) => (
            <text
              key={i}
              x={xx(i)}
              y="271"
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {labels[i]}
            </text>
          ))}
      </svg>
    </div>
  );
}
export function Candles({ bars, fills = [] }: { bars: Bar[]; fills?: Fill[] }) {
  const all = indicators(bars),
    data = all.slice(-90);
  if (!data.length) return null;
  const lo = Math.min(...data.map((x) => Math.min(x.low, x.lower ?? x.low))),
    hi = Math.max(...data.map((x) => Math.max(x.high, x.upper ?? x.high))),
    range = Math.max(hi - lo, 1),
    y = (v: number) => 250 - ((v - lo) / range) * 215,
    x = (i: number) => 65 + (i / (data.length - 1)) * 720,
    maxV = Math.max(...data.map((x) => x.volume));
  return (
    <svg
      className="chart"
      viewBox="0 0 830 360"
      role="img"
      aria-label="近90根日K线、MA20、MA50、布林带、成交量和回测成交标记"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1="65"
            x2="785"
            y1={y(lo + t * range)}
            y2={y(lo + t * range)}
            stroke="#263747"
          />
          <text x="5" y={y(lo + t * range) + 4}>
            {(lo + t * range).toFixed(1)}
          </text>
        </g>
      ))}
      {(['upper', 'lower', 'ma20', 'ma50'] as const).map((key, j) => (
        <polyline
          key={key}
          points={data
            .map((b, i) => (b[key] === null ? '' : `${x(i)},${y(b[key]!)}`))
            .join(' ')}
          fill="none"
          stroke={['#375772', '#375772', '#e8bb66', '#8da3ff'][j]}
          strokeWidth={j < 2 ? 1 : 1.5}
        />
      ))}
      {data.map((b, i) => {
        const c = b.close >= b.open ? '#58dfb0' : '#ff768b';
        return (
          <g key={b.date}>
            <title>
              {b.date} 开{b.open.toFixed(2)} 高{b.high.toFixed(2)} 低
              {b.low.toFixed(2)} 收{b.close.toFixed(2)} 量{b.volume}
            </title>
            <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={c} />
            <rect
              x={x(i) - 2.2}
              y={Math.min(y(b.open), y(b.close))}
              width="4.4"
              height={Math.max(1, Math.abs(y(b.open) - y(b.close)))}
              fill={c}
            />
            <rect
              x={x(i) - 2.2}
              y={325 - (b.volume / maxV) * 50}
              width="4.4"
              height={(b.volume / maxV) * 50}
              fill={c}
              opacity=".4"
            />
            {fills
              .filter((f) => f.date === b.date)
              .map((f, j) => (
                <text
                  key={j}
                  x={x(i)}
                  y={f.side === 'BUY' ? y(b.low) + 15 : y(b.high) - 8}
                  textAnchor="middle"
                  style={{
                    fill: f.side === 'BUY' ? '#58dfb0' : '#ff768b',
                    fontWeight: 800,
                  }}
                >
                  {f.side === 'BUY' ? 'B' : 'S'}
                </text>
              ))}
          </g>
        );
      })}
      <text x="65" y="351">
        {data[0].date}
      </text>
      <text x="785" y="351" textAnchor="end">
        {data.at(-1)!.date}
      </text>
    </svg>
  );
}
