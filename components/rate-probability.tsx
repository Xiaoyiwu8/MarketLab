'use client';
import { useEffect, useState } from 'react';
import { beijingInput } from '@/lib/event-time';
import {
  compareRates,
  validRate,
  type RateSnapshot,
} from '@/lib/rate-probability';
const storage = 'market-lab-rate-probabilities-v1';
const date = (s: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(s));
export default function RateProbability() {
  const [rows, setRows] = useState<RateSnapshot[]>([]),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [now, setNow] = useState(Date.now());
  const [meeting, setMeeting] = useState(''),
    [baseline, setBaseline] = useState(''),
    [sample, setSample] = useState(''),
    [hike, setHike] = useState(''),
    [hold, setHold] = useState(''),
    [cut, setCut] = useState(''),
    [source, setSource] = useState(
      'https://www.cmegroup.com/en/markets/interest-rates/cme-fedwatch-tool.html',
    );
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(storage) ?? '[]');
      const clean = Array.isArray(r)
        ? r.filter((s) => s && validRate(s)).slice(0, 100)
        : [];
      setRows(clean);
      setSelected(clean[0]?.meeting ?? '');
    } catch {
      setError('概率记录读取失败，请重新录入。');
    }
    setReady(true);
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storage, JSON.stringify(rows));
      } catch {
        setError('存储失败，记录仅保留本次会话。');
      }
  }, [rows, ready]);
  function save() {
    try {
      if ([hike, hold, cut].some((v) => !v.trim()))
        throw Error('三项概率都必须填写，缺失不等于0');
      const s = {
        meeting,
        baseline: baseline.trim(),
        sampledAt: beijingInput(sample),
        recordedAt: new Date().toISOString(),
        hike: Number(hike),
        hold: Number(hold),
        cut: Number(cut),
        source: new URL(source).href,
      };
      if (!validRate(s))
        throw Error(
          '请核对会议日期、利率基准、HTTPS来源，概率须在0–100且合计100%',
        );
      if (Date.parse(s.sampledAt) > Date.now() + 60000)
        throw Error('采样时间不能在未来');
      setRows((old) =>
        [
          s,
          ...old.filter(
            (x) =>
              !(
                x.meeting === s.meeting &&
                x.baseline === s.baseline &&
                x.source === s.source &&
                x.sampledAt === s.sampledAt
              ),
          ),
        ].slice(0, 100),
      );
      setSelected(meeting);
      setError('');
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const result = compareRates(rows, selected),
    expired = result
      ? now - Date.parse(result.current.sampledAt) > 86400000
      : false;
  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>美联储利率概率 · 变化跟踪</h2>
        <strong>
          {!result
            ? '尚无可靠概率记录'
            : expired
              ? '超过24小时 · 待复核'
              : '手动录入快照 · 非实时'}
        </strong>
      </div>
      <p>
        按指定会议记录相对基准利率的“加息、不变、降息”概率。来源应为期货隐含概率，不以新闻情绪生成百分比。
      </p>
      {!!rows.length && (
        <label>
          查看会议（美东官方会议日期）
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {[...new Set(rows.map((s) => s.meeting))].sort().map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      )}
      {result && (
        <>
          <h3>
            {selected}会议 · 最新录入的加息概率 {result.current.hike.toFixed(1)}
            %
          </h3>
          <p>
            {result.delta === null
              ? '缺少同一会议、同一利率基准及同一来源的上一条采样，暂不计算增减。'
              : `较上一条采样${result.delta > 0 ? '上升' : result.delta < 0 ? '下降' : '不变'} ${Math.abs(result.delta).toFixed(1)} 个百分点（${result.previous!.hike.toFixed(1)}% → ${result.current.hike.toFixed(1)}%）。`}
          </p>
          <div className="metrics">
            {[
              ['加息', result.current.hike],
              ['不变', result.current.hold],
              ['降息', result.current.cut],
            ].map(([name, n]) => (
              <div className="metric" key={name}>
                <small>{name}</small>
                <strong>{Number(n).toFixed(1)}%</strong>
              </div>
            ))}
          </div>
          <p>
            参考利率基准：{result.current.baseline}
            <br />
            数据采样时间：{date(result.current.sampledAt)} 北京时间
            {result.previous && (
              <>
                <br />
                比较采样时间：{date(result.previous.sampledAt)} 北京时间
              </>
            )}
            <br />
            本地录入时间：{date(result.current.recordedAt)} 北京时间 ·{' '}
            <a href={result.current.source} target="_blank" rel="noreferrer">
              原始来源
            </a>
          </p>
          <p>
            {expired
              ? '此快照已超过本工具24小时复核阈值，不能称为当前实时概率。'
              : '时间较新不等于真实性已由工具核验；请核对原文。'}
          </p>
          <button
            className="secondary"
            onClick={() =>
              setRows((old) => old.filter((s) => s !== result.current))
            }
          >
            删除这条错误记录
          </button>
        </>
      )}
      <details>
        <summary>录入已核对的概率快照</summary>
        <div className="formgrid">
          <label>
            会议日期
            <input
              type="date"
              value={meeting}
              onChange={(e) => setMeeting(e.target.value)}
            />
          </label>
          <label>
            比较利率基准
            <input
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              placeholder="填来源所用目标利率区间"
            />
          </label>
          <label>
            源数据采样时间（北京时间）
            <input
              type="datetime-local"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
          </label>
          {[
            ['加息 %', hike, setHike],
            ['不变 %', hold, setHold],
            ['降息 %', cut, setCut],
          ].map(([label, v, setter]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={String(v)}
                onChange={(e) =>
                  (setter as (s: string) => void)(e.target.value)
                }
              />
            </label>
          ))}
          <label>
            原文来源
            <input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
        </div>
        <button disabled={!ready} onClick={save}>
          保存采样并比较
        </button>
      </details>
      {error && <p role="alert">{error}</p>}
      <p className="fineprint">
        自动概率接口尚未接入。
        <a
          href="https://www.cmegroup.com/en/markets/interest-rates/cme-fedwatch-tool.html"
          target="_blank"
          rel="noreferrer"
        >
          打开CME FedWatch核对
        </a>{' '}
        ·{' '}
        <a
          href="https://www.cmegroup.com/market-data/market-data-api/fedwatch-api.html"
          target="_blank"
          rel="noreferrer"
        >
          官方API说明
        </a>
        。60%变为65%是增加5个百分点，不是增加5%；远期会议终点利率高于当前基准，也不等于该次会议单次加息的概率。记录不自动触发交易。
      </p>
    </section>
  );
}
