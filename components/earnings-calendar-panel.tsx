'use client';
import {useEffect,useState} from 'react';
import type {EarningsWeek} from '@/lib/earnings-calendar';
export default function EarningsCalendarPanel({onLoad}:{onLoad:(week:EarningsWeek)=>void}){
  const [week,setWeek]=useState<EarningsWeek|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){setBusy(true);setError('');try{const r=await fetch('/api/earnings'),d=await r.json() as EarningsWeek&{error?:string};if(!r.ok)throw Error(d.error??'财报日历读取失败');if(!Array.isArray(d.rows)||!Array.isArray(d.failed))throw Error('财报日历格式异常');setWeek(d);onLoad(d);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30*60_000);return()=>clearInterval(timer);},[]);
  return <section className="panel" aria-label="下周财报提醒"><h2>本周提前看 · 下周财报日历</h2>
    <p>总市值至少3000万美元 · 美东时间周一至周日 · Nasdaq预计日期，需公司投资者关系公告确认。财报前的技术形态可能被跳空和业绩预期变化打破。</p>
    <button className="secondary" onClick={()=>void refresh()} disabled={busy}>{busy?'读取财报日历…':'刷新财报日历'}</button>
    {error&&<p role="alert">{error}。旧列表如有保留，其日期与更新时间如下。</p>}
    {week&&<><h3>{week.start} 至 {week.end}</h3><p>成功读取 {week.checked}/7 天 · 符合市值条件 {week.rows.length} 条 · 市值不足排除 {week.excluded} · 市值缺失未纳入 {week.unknownCap} · 更新于 {week.updatedAt}</p>
      {week.failed.length>0&&<p role="alert">覆盖不完整：{week.failed.map(x=>x.date+' '+x.reason).join('；')}。不能据此判断这些日期没有财报。</p>}
      {!week.rows.length&&<p>{week.failed.length?'暂未取得符合条件的有效记录。':'成功返回的名单中暂无符合市值条件的公司。'}</p>}
      <div style={{overflowX:'auto'}}><table><thead><tr><th>预计日期（美东）</th><th>公司 / 代码</th><th>时段</th><th>总市值（美元）</th><th>核对来源</th></tr></thead><tbody>{week.rows.map(x=><tr key={x.date+x.symbol}><td>{x.date}</td><td>{x.symbol} · {x.name}</td><td>{x.time}</td><td>{x.marketCap.toLocaleString('en-US')}</td><td><a href={x.source} target="_blank" rel="noreferrer">Nasdaq · 预计</a></td></tr>)}</tbody></table></div>
      <p>市值是日历源返回的快照，不保证实时。页面打开时自动按周更新，不是后台推送服务。</p></>}
  </section>;
}
