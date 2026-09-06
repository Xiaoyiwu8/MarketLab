export type RiskEvent = {
  id: string;
  title: string;
  kind: string;
  source: string;
  occurredAt: string | null;
  recordedAt: string;
  updatedAt: string;
  expiresAt: string;
  verified: boolean;
  severity: string;
};
export function eventPhase(event: RiskEvent, now = Date.now()) {
  const expiry = Date.parse(event.expiresAt),
    time = event.occurredAt ? Date.parse(event.occurredAt) : NaN;
  if (!Number.isFinite(expiry) || !Number.isFinite(now))
    return { label: '时间无效', active: false };
  if (now >= expiry) return { label: '已过期 · 待复核', active: false };
  if (!Number.isFinite(time)) return { label: '事件时间未知', active: false };
  if (time - now > 86400000) return { label: '未来事件', active: false };
  if (time > now) return { label: '24小时内即将发生', active: true };
  if (now - time < 6 * 3600000)
    return { label: '刚发生 · 6小时内', active: true };
  return { label: '影响观察期', active: true };
}
export function beijingInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error('请填写有效北京时间');
  const d = new Date(value + ':00+08:00');
  if (
    !Number.isFinite(d.getTime()) ||
    new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16) !== value
  )
    throw Error('事件日期无效');
  return d.toISOString();
}
