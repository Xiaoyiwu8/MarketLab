export type Listing = { symbol: string; name: string; exchange: string };
export function parseDirectory(text: string, nasdaq: boolean) {
  const lines = text.trim().split(/\r?\n/), headers = lines.shift()!.split('|');
  if (!headers.includes('Security Name') || !headers.includes('Test Issue')) throw Error('Nasdaq 股票目录格式变化');
  const stamp = lines.find(l => l.startsWith('File Creation Time:'))?.split('|')[0];
  if (!stamp) throw Error('股票目录缺少生成时间');
  let excluded = 0;
  const listings: Listing[] = [];
  for (const line of lines) {
    if (line.startsWith('File Creation Time:') || !line.trim()) continue;
    const row = Object.fromEntries(headers.map((h,i)=>[h,line.split('|')[i] ?? '']));
    const symbol = nasdaq ? row.Symbol : row['ACT Symbol'], name = row['Security Name'];
    if (row['Test Issue'] !== 'N' || row.ETF === 'Y' || /warrant|preferred|\bunits?\b|\bright(s)?\b|notes due|debenture|\bETN\b|\bfund\b/i.test(name) || !/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) { excluded++; continue; }
    listings.push({symbol,name,exchange:nasdaq?'NASDAQ':row.Exchange});
  }
  return {listings,excluded,stamp};
}
export async function stockUniverse(fetcher: typeof fetch = fetch) {
  const files = await Promise.all(['nasdaqlisted','otherlisted'].map(async name=>{
    const r=await fetcher(`https://www.nasdaqtrader.com/dynamic/SymDir/${name}.txt`,{signal:AbortSignal.timeout(20000)});
    if(!r.ok) throw Error(`Nasdaq 目录返回 ${r.status}`);
    return parseDirectory(await r.text(),name==='nasdaqlisted');
  }));
  const listings=[...new Map(files.flatMap(f=>f.listings).map(l=>[l.symbol,l])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
  if(listings.length<1000) throw Error('目录数量异常，未启动局部扫描');
  return {listings,excluded:files.reduce((s,f)=>s+f.excluded,0),stamps:files.map(f=>f.stamp),retrievedAt:new Date().toISOString()};
}
