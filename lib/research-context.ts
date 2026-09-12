import {clean,type Series} from './engine.ts';
import {volumeSummary} from './volume.ts';
import type {EarningsWeek} from './earnings-calendar.ts';
const known=[
  {symbol:'ORCL',date:'2026-09-10',title:'Q1 FY2027 财报（盘后）',url:'https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/default.aspx'},
  {symbol:'TSM',date:'2026-09-10',title:'2026年8月营收公告',url:'https://investor.tsmc.com/english/monthly-revenue/2026'},
];
export function researchContext(series:Series,now=new Date(),calendar?:EarningsWeek|null){
  const bars=volumeSummary(clean(series.bars).bars,now).completed,last=bars.at(-1),prior=bars.slice(-21,-1);
  const high=prior.length===20?Math.max(...prior.map(b=>b.high)):null,low=prior.length===20?Math.min(...prior.map(b=>b.low)):null;
  const position=!last||high===null||low===null?'历史不足':last.close>high?'高于此前20日范围':last.close<low?'低于此前20日范围':'仍在此前20日范围内；范围不等于已确认横盘';
  const failures:{side:'long'|'short';date:string}[]=[];
  for(let i=Math.max(20,bars.length-5);i<bars.length-1;i++){
    const box=bars.slice(i-20,i),top=Math.max(...box.map(b=>b.high)),bottom=Math.min(...box.map(b=>b.low));
    if(bars[i].close>top&&last!.close<=top&&last!.close>=bottom)failures.push({side:'long',date:bars[i].date});
    if(bars[i].close<bottom&&last!.close>=bottom&&last!.close<=top)failures.push({side:'short',date:bars[i].date});
  }
  const volatility=bars.slice(-2).some(b=>{const i=bars.indexOf(b);if(i<15)return false;
    const atr=bars.slice(i-14,i).reduce((s,x,k)=>{const p=bars[i-15+k].close;return s+Math.max(x.high-x.low,Math.abs(x.high-p),Math.abs(x.low-p));},0)/14;
    return atr>0&&(Math.abs(b.open-bars[i-1].close)>atr||b.high-b.low>2*atr);
  });
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const recent=known.filter(e=>e.symbol===series.symbol&&e.date<=today&&Date.parse(today)-Date.parse(e.date)<=7*864e5).map(e=>({...e,waiting:bars.filter(b=>b.date>e.date).length<2}));
  const freshCalendar=calendar&&now.getTime()-Date.parse(calendar.updatedAt)>=0&&now.getTime()-Date.parse(calendar.updatedAt)<24*3600e3;
  const upcoming=freshCalendar?calendar.rows.filter(x=>x.symbol===series.symbol&&x.date>=today):[];
  return {position,high,low,failures,volatility,recent,upcoming,eventBlocked:recent.some(e=>e.waiting)||upcoming.length>0,
    coverage:freshCalendar?'下周预计财报已查询；其他时段、行业、宏观与突发新闻仍待核验。':'下周财报尚未取得有效数据；不能据此认定无事件风险。',chart:bars.slice(-20)};
}
