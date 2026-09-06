export const strip = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
export function financialTable(html: string) {
  const allowed = [
    'Revenue',
    'Gross Profit',
    'Operating Income',
    'Net Income',
    'EPS (Diluted)',
    'Earnings Per Share',
    'Cash & Investments',
    'Total Debt',
    'Net Cash (Debt)',
    'Operating Cash Flow',
    'Capital Expenditures',
    'Free Cash Flow',
    'PE Ratio',
    'Forward PE',
    'P/FCF Ratio',
    'PS Ratio',
  ];
  function table(t: string) {
    const head = t.match(/<thead\b[\s\S]*?<\/thead>/)?.[0] ?? '',
      first = head.match(/<tr\b[\s\S]*?<\/tr>/)?.[0] ?? '',
      periods = (first.match(/<th\b[\s\S]*?<\/th>/g) ?? [])
        .map(strip)
        .slice(1, 6);
    const rows = (t.match(/<tr\b[\s\S]*?<\/tr>/g) ?? []).flatMap((row) => {
      const cells = row.match(/<td\b[\s\S]*?<\/td>/g) ?? [];
      if (!cells.length) return [];
      const label =
        cells[0]!.match(/class="truncate[^"]*"[^>]*>([^<]+)/)?.[1]?.trim() ??
        strip(cells[0]!);
      return allowed.includes(strip(label))
        ? [{ label: strip(label), values: cells.slice(1, 6).map(strip) }]
        : [];
    });
    return { periods, rows };
  }
  const tables = (html.match(/<table\b[\s\S]*?<\/table>/g) ?? [html])
      .map(table)
      .filter((t) => t.rows.length && t.periods.length),
    main = tables.find((t) => t.rows.some((r) => r.label === 'Revenue')) ??
      tables[0] ?? { periods: [], rows: [] };
  return {
    ...main,
    supplemental: tables.filter((t) => t !== main),
    unit: strip(
      html.match(/Financials in [^<]+/)?.[0] ?? '原页面未识别单位，请核对来源',
    ),
    sourceUpdated:
      strip(html).match(/Last updated:\s*([A-Za-z]+ \d{1,2}, \d{4})/)?.[1] ??
      '未识别',
    ttmEnd: html.match(/period ending ([^"]+)/)?.[1] ?? '未识别',
  };
}
