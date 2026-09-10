import type { Series } from '../lib/engine.ts';
export function leftFixture(side:'long'|'short'):Series {
  const bars=Array.from({length:122},(_,i)=>{
    const c=i<80?120:100+4.8*Math.sin((i-80)*Math.PI/5);
    return {date:new Date(Date.UTC(2026,4,10+i)).toISOString().slice(0,10),open:c,close:c,high:c+.1,low:c-.1,volume:1000};
  });
  const edge=Math.min(...bars.slice(80,120).map(b=>b.low));
  bars[120]={...bars[120],open:edge+.1,close:edge+.2,high:edge+.3,low:edge-.1,volume:1500};
  bars[121]={...bars[121],open:edge+.2,close:edge+.5,high:edge+.6,low:edge+.1,volume:1800};
  return {symbol:side,source:'test fixture',warnings:[],adjustment:'qfqday',asOf:bars.at(-1)!.date,bars:side==='long'?bars:bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}))};
}
export function rightFixture(side:'long'|'short'='long', phase=3):Series {
  const rows=Array.from({length:80},(_,i)=>({open:100,close:100+Math.sin(i*Math.PI/2),high:102,low:98,volume:1000}));
  rows.push(...[
    {open:102,close:103,high:103.3,low:101.8,volume:1800},
    {open:103,close:102.6,high:102.9,low:102.1,volume:700},
    {open:102.6,close:103.2,high:103.4,low:102.3,volume:2000},
  ].slice(0,phase));
  const bars=rows.map((b,i)=>({...b,date:new Date(Date.UTC(2026,5,18+i)).toISOString().slice(0,10)}));
  return {symbol:'TEST',source:'test fixture',adjustment:'qfqday',asOf:bars.at(-1)!.date,warnings:[],bars:side==='long'?bars:bars.map(b=>({...b,open:200-b.open,close:200-b.close,high:200-b.low,low:200-b.high}))};
}
