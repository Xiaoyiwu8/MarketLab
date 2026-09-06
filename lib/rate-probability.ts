export type RateSnapshot = {
  meeting: string;
  baseline: string;
  sampledAt: string;
  recordedAt: string;
  hike: number;
  hold: number;
  cut: number;
  source: string;
};
export function validRate(s: RateSnapshot) {
  return (
    typeof s.meeting === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.meeting) &&
    Number.isFinite(Date.parse(s.meeting)) &&
    new Date(s.meeting).toISOString().slice(0, 10) === s.meeting &&
    typeof s.baseline === 'string' &&
    s.baseline.trim().length > 0 &&
    Number.isFinite(Date.parse(s.sampledAt)) &&
    Number.isFinite(Date.parse(s.recordedAt)) &&
    [s.hike, s.hold, s.cut].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    ) &&
    Math.abs(s.hike + s.hold + s.cut - 100) <= 0.11 &&
    typeof s.source === 'string' &&
    /^https:\/\//.test(s.source)
  );
}
export function compareRates(rows: RateSnapshot[], meeting: string) {
  const sorted = rows
    .filter((s) => validRate(s) && s.meeting === meeting)
    .sort((a, b) => Date.parse(b.sampledAt) - Date.parse(a.sampledAt));
  const current = sorted[0];
  if (!current) return null;
  const previous = sorted.find(
    (s) =>
      s.baseline === current.baseline &&
      s.source === current.source &&
      Date.parse(s.sampledAt) < Date.parse(current.sampledAt),
  );
  return {
    current,
    previous,
    delta: previous ? current.hike - previous.hike : null,
  };
}
