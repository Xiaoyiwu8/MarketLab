import type { Bar } from './engine';

export function volumeSummary(bars: Bar[], now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // Exclude today's possibly incomplete session, regardless of provider.
  const completed = bars
    .filter((b) => b.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = completed.at(-1);
  const previous = completed.at(-2);
  const prior20 = completed.slice(-21, -1);
  const average20 =
    prior20.length === 20
      ? prior20.reduce((n, b) => n + b.volume, 0) / 20
      : null;
  const change = last && previous ? last.volume - previous.volume : null;
  const changePct =
    change !== null && previous && previous.volume > 0
      ? change / previous.volume
      : null;
  const ratio =
    last && average20 !== null && average20 > 0
      ? last.volume / average20
      : null;
  const recent5 =
    completed.length >= 5
      ? completed.slice(-5).reduce((n, b) => n + b.volume, 0)
      : null;
  const previous5 =
    completed.length >= 10
      ? completed.slice(-10, -5).reduce((n, b) => n + b.volume, 0)
      : null;
  const fiveChange =
    recent5 !== null && previous5 !== null && previous5 > 0
      ? recent5 / previous5 - 1
      : null;
  return {
    completed,
    last,
    previous,
    average20,
    change,
    changePct,
    ratio,
    recent5,
    fiveChange,
  };
}
