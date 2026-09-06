'use client';
import { useEffect, useState } from 'react';
import { eventPhase, beijingInput, type RiskEvent } from '@/lib/event-time';
const key = 'market-lab-macro-events-v1';
function stamp(value: string | null, zone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}
export default function EventRadar() {
  const [events, setEvents] = useState<RiskEvent[]>([]),
    [ready, setReady] = useState(false),
    [now, setNow] = useState(Date.now()),
    [error, setError] = useState('');
  const [title, setTitle] = useState(''),
    [kind, setKind] = useState('宏观数据'),
    [time, setTime] = useState(''),
    [hours, setHours] = useState(24),
    [source, setSource] = useState(''),
    [verified, setVerified] = useState(false),
    [severity, setSeverity] = useState('关注');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(saved))
        setEvents(
          saved
            .filter(
              (e: any) =>
                e &&
                typeof e.id === 'string' &&
                typeof e.title === 'string' &&
                typeof e.source === 'string' &&
                typeof e.expiresAt === 'string' &&
                typeof e.updatedAt === 'string' &&
                typeof e.recordedAt === 'string' &&
                (e.occurredAt === null || typeof e.occurredAt === 'string'),
            )
            .slice(0, 50),
        );
    } catch {
      setError('本地事件记录无法读取，请重新录入。');
    }
    setReady(true);
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(events));
      } catch {
        setError('本地存储不可用，记录仅保留在当前会话。');
      }
  }, [events, ready]);
  function add() {
    try {
      if (!title.trim()) throw Error('请填写事件标题');
      if (!Number.isFinite(hours) || hours < 1 || hours > 168)
        throw Error('观察期须为1至168小时');
      const url = new URL(source);
      if (!['https:', 'http:'].includes(url.protocol))
        throw Error('来源须为网页链接');
      const at = time ? beijingInput(time) : null;
      const saved = new Date().toISOString();
      const expiresAt = new Date(
        (at ? Date.parse(at) : Date.now()) + hours * 3600000,
      ).toISOString();
      setEvents((old) =>
        [
          {
            id: crypto.randomUUID(),
            title: title.trim(),
            kind,
            source: url.href,
            occurredAt: at,
            recordedAt: saved,
            updatedAt: saved,
            expiresAt,
            verified,
            severity,
          },
          ...old,
        ].slice(0, 50),
      );
      setTitle('');
      setError('');
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const sorted = [...events].sort(
    (a, b) =>
      Number(eventPhase(b, now).active) - Number(eventPhase(a, now).active) ||
      Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  );
  return (
    <section className="panel" style={{ border: '1px solid #e8bb66' }}>
      <div className="sectionTitle">
        <h2>宏观事件警示 · 时间雷达</h2>
        <small>
          时效检查：{stamp(new Date(now).toISOString(), 'Asia/Shanghai')}
        </small>
      </div>
      <p>
        当前为手动事件跟踪：可录入CPI、就业、美联储或地缘事件及原文来源。不会自动确认新闻真实性、生成经济数据预期或断言事件仍在影响市场。
      </p>
      {!events.length && <p>尚未录入事件，不能据此判断“当前没有宏观风险”。</p>}
      {sorted.map((e) => {
        const phase = eventPhase(e, now);
        return (
          <article
            className="decisionCard"
            key={e.id}
            style={{
              marginBottom: 12,
              opacity: phase.label.startsWith('已过期') ? 0.65 : 1,
            }}
          >
            <div className="sectionTitle">
              <h3 style={{ fontSize: 21 }}>{e.title}</h3>
              <strong style={{ color: phase.active ? '#e8bb66' : '#a0b0c5' }}>
                {phase.label}
              </strong>
            </div>
            <p>
              {e.kind} · {e.severity}（用户设定） ·{' '}
              {e.verified ? '用户已核对来源' : '尚未核验'} ·{' '}
              <a
                href={/^https?:\/\//.test(e.source) ? e.source : undefined}
                target="_blank"
                rel="noreferrer"
              >
                原文来源
              </a>
            </p>
            <p>
              事件/预定发布时间：<b>{stamp(e.occurredAt, 'Asia/Shanghai')}</b>
              <br />
              美东时间：{stamp(e.occurredAt, 'America/New_York')}
            </p>
            <p>
              首次录入：{stamp(e.recordedAt, 'Asia/Shanghai')}
              <br />
              本地记录更新：{stamp(e.updatedAt, 'Asia/Shanghai')}
              <br />
              警示有效至：{stamp(e.expiresAt, 'Asia/Shanghai')}
            </p>
            <p className="fineprint">
              原文最新更新时间：未自动获取。本地更新不代表新闻更新时间；“影响观察期”只是计时状态，不证明影响仍持续。
              {!e.occurredAt ? '事件时间未知，不显示“刚发生”或倒计时。' : ''}
            </p>
            <div className="row">
              <button
                className="secondary"
                onClick={() => {
                  const updated = new Date().toISOString();
                  setEvents((old) =>
                    old.map((x) =>
                      x.id === e.id
                        ? {
                            ...x,
                            updatedAt: updated,
                            expiresAt: new Date(
                              Date.now() + 24 * 3600000,
                            ).toISOString(),
                            verified: true,
                          }
                        : x,
                    ),
                  );
                  setNow(Date.now());
                }}
              >
                我已重新核对原文 · 延长24小时
              </button>
              <button
                className="secondary"
                onClick={() =>
                  setEvents((old) => old.filter((x) => x.id !== e.id))
                }
              >
                移除记录
              </button>
            </div>
          </article>
        );
      })}
      <details>
        <summary>添加事件与警示时间</summary>
        <div className="formgrid">
          <label>
            事件标题
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：美国CPI发布 / 航运中断消息"
            />
          </label>
          <label>
            类型
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {['宏观数据', '央行政策', '地缘冲突', '供应与能源', '其他'].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            事件时间（北京时间，可留空）
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label>
            事件后观察期（小时）
            <input
              type="number"
              min="1"
              max="168"
              value={hours}
              onChange={(e) => setHours(e.target.valueAsNumber)}
            />
          </label>
          <label>
            消息原文URL
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            警示级别
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {['关注', '谨慎', '高风险'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />{' '}
          我已核对原文及事件时间
        </label>
        <button onClick={add} disabled={!ready}>
          保存事件警示
        </button>
      </details>
      {error && <p role="alert">{error}</p>}
      <p className="fineprint">
        未来24小时内进入预警，发生后6小时内标“刚发生”，随后进入观察期；有效期结束自动标“已过期”，须人工复核才能续期。未知事件时间时从录入时刻计算有效期。时间标签每30秒刷新，仅保存于本设备，不会自动改变买卖信号或发送外部通知。
      </p>
    </section>
  );
}
