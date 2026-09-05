'use client';
import { useEffect, useRef, useState } from 'react';
import { Switch } from '@/components/ui/switch';
export default function EmailSettings({
  alerts,
}: {
  alerts: { time: string; text: string }[];
}) {
  const [apiKey, setKey] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [auto, setAuto] = useState(false),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const latest = useRef(new Set<string>());
  async function send(body: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, from, to, body }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus('邮件服务已接受发送请求。');
    } catch (e) {
      setStatus((e as Error).message);
      setAuto(false);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const fresh = alerts.filter((a) => !latest.current.has(a.time + a.text));
    if (!fresh.length) return;
    fresh.forEach((a) => latest.current.add(a.time + a.text));
    if (auto && !busy) void send(fresh.map((a) => a.text).join('\n'));
  }, [alerts]);
  return (
    <section className="panel">
      <h2>邮件提醒 · Resend</h2>
      <p>
        填写你自己的邮件服务凭证；发件地址须在 Resend
        验证。凭证仅保存在此页内存，刷新后需重填。
      </p>
      <div className="formgrid">
        <label>
          Resend API Key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label>
          已验证发件邮箱
          <input
            type="email"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          收件邮箱
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void send('Market Lab 邮件提醒连接测试。当前仅为模拟交易研究工具。')
          }
          style={{ alignSelf: 'end' }}
        >
          发送测试邮件
        </button>
      </div>
      <label className="row" style={{ flexDirection: 'row' }}>
        <Switch checked={auto} onCheckedChange={setAuto} />{' '}
        对新信号自动发送邮件（页面保持打开）
      </label>
      {status && <p className="message">{status}</p>}
      <p className="fineprint">
        关闭页面后不发送。当前批次新信号摘要通过邮件发送；失败时暂停自动邮件，错误保留在页面。
        <a
          href="https://resend.com/docs/api-reference/emails/send-email"
          target="_blank"
          rel="noreferrer"
        >
          邮件服务接入说明 ↗
        </a>
      </p>
    </section>
  );
}
