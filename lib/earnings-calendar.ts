export type EarningsRow={symbol:string;name:string;date:string;time:string;marketCap:number;source:string};
export type EarningsWeek={start:string;end:string;updatedAt:string;rows:EarningsRow[];failed:{date:string;reason:string}[];excluded:number;unknownCap:number;checked:number};
export function nextEarningsWeek(now=new Date()){
  // Reporting dates and weeks follow the US exchange's local date, including DST.
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const d=new Date(date+'T12:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()+((8-day)%7||7));
  return Array.from({length:7},(_,i)=>new Date(d.getTime()+i*864e5).toISOString().slice(0,10));
}
export function parseEarnings(payload:unknown,date:string){
  const p=payload as {data?:{rows?:unknown;asOf?:string};status?:{rCode?:number}};
  if(p?.status?.rCode!==200||!p.data||!Array.isArray(p.data.rows))throw Error('日历源未返回有效名单，不能视为当日没有财报');
  if(!p.data.asOf||new Date(p.data.asOf+' 12:00:00 UTC').toISOString().slice(0,10)!==date)throw Error('日历源返回的日期不匹配');
  const rows:EarningsRow[]=[];let excluded=0,unknownCap=0;
  for(const raw of p.data.rows){const x=raw as Record<string,unknown>;
    const cap=typeof x.marketCap==='string'&&/^\$?[\d,]+(?:\.\d+)?$/.test(x.marketCap)?Number(x.marketCap.replace(/[$,]/g,'')):NaN;
    if(!Number.isFinite(cap)||cap<=0){unknownCap++;continue;}if(cap<30_000_000){excluded++;continue;}
    if(typeof x.symbol!=='string'||!/^\^?[A-Z][A-Z0-9.-]{0,14}$/.test(x.symbol)||typeof x.name!=='string')throw Error('日历记录格式异常');
    rows.push({symbol:x.symbol,name:x.name,date,marketCap:cap,time:x.time==='time-pre-market'?'盘前':x.time==='time-after-hours'?'盘后':'时间未提供',source:'https://www.nasdaq.com/market-activity/earnings?date='+date});
  }
  return {rows:[...new Map(rows.map(x=>[x.symbol,x])).values()],excluded,unknownCap};
}
export async function loadEarningsWeek(now=new Date(),fetcher:typeof fetch=fetch):Promise<EarningsWeek>{
  const dates=nextEarningsWeek(now),result:EarningsWeek={start:dates[0],end:dates[6],updatedAt:now.toISOString(),rows:[],failed:[],excluded:0,unknownCap:0,checked:0};
  // Small bounded batches avoid overwhelming the public source.
  for(let i=0;i<dates.length;i+=3){
    const batch=await Promise.all(dates.slice(i,i+3).map(async date=>{try{
      const r=await fetcher('https://api.nasdaq.com/api/calendar/earnings?date='+date,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error('日历源 HTTP '+r.status);return {date,data:parseEarnings(await r.json(),date)};
    }catch(e){return {date,error:e instanceof Error?e.message:'财报数据读取失败'};}}));
    for(const b of batch){if(b.data){result.checked++;result.rows.push(...b.data.rows);result.excluded+=b.data.excluded;result.unknownCap+=b.data.unknownCap;}else result.failed.push({date:b.date,reason:b.error!});}
  }
  result.rows.sort((a,b)=>a.date.localeCompare(b.date)||b.marketCap-a.marketCap||a.symbol.localeCompare(b.symbol));return result;
}
