'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {chains,chainStatus,logicGate,type Evidence,type LogicState,type ChainId,type LogicAction} from '@/lib/logic';
import type {FeedItem,loadLogicFeed} from '@/lib/logic-feed';
import type {Series} from '@/lib/engine';
import type {SourceCheck} from '@/lib/source-watch';
import type {EarningsWeek} from '@/lib/earnings-calendar';
import {researchContext} from '@/lib/research-context';
import {channelReading} from '@/lib/channel';
import {volumeNarrative} from '@/lib/volume';
import {weeks} from '@/lib/review';
const empty=()=>({thesisId:'',expectedRevision:0,chain:'macro' as ChainId,symbols:'',fact:'',interpretation:'',source:'',publishedAt:'',expiresAt:'',stance:'uncertain' as Evidence['stance'],action:'review' as LogicAction});
const beijing=(v:string)=>new Date(Date.parse(v)+8*3600e3).toISOString().slice(0,16);
const actionNames={'review':'仅记录观察','block-long':'暂停做多入场','block-short':'暂停做空入场','block-both':'暂停双向入场','clear':'解除本条限制（不解除其他证据）'};
export default function LogicPanel({series,earnings,state,onChange}:{series:Series;earnings:EarningsWeek|null;state:LogicState;onChange:(s:LogicState)=>void}){
  const [feed,setFeed]=useState<Awaited<ReturnType<typeof loadLogicFeed>>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState(empty),[now,setNow]=useState(Date.now());
  const [history,setHistory]=useState<Evidence[]>([]),[before,setBefore]=useState<string|null>('9007199254740991');
  const seen=useRef<Set<string>|null>(null),active=useRef(false),saving=useRef(false),form=useRef<HTMLDetailsElement>(null),stateRef=useRef(state),lastReview=useRef<string|null>(null);
  stateRef.current=state;
  useEffect(()=>{
    if(!state.available)return;
    const summary=state.rows.filter(e=>e.action!=='clear').map(e=>{const c=state.checks?.find(x=>x.evidenceId===e.id);return `${e.id}:${Date.parse(e.expiresAt)<=now?'expired':'active'}:${e.sourceDigest?(c?.status??'pending'):'manual'}:${e.sourceDigest&&c&&now-Date.parse(c.checkedAt)>15*60000?'stale':''}`;}).sort().join('|');
    if(lastReview.current!==null&&lastReview.current!==summary)setNotice('逻辑复核状态发生变化：已自动重算受影响股票的入场限制，请查看证据记录。');
    lastReview.current=summary;
  },[state,now]);
  const refresh=useCallback(async()=>{
    if(active.current)return;active.current=true;setBusy(true);setError('');
    const outcomes=await Promise.allSettled([
      (async()=>{const check=await fetch('/api/logic/recheck',{method:'POST'});if(!check.ok)throw Error('自动原文核查不可用');const r=await fetch('/api/logic'),v=await r.json() as {rows:Evidence[];checks:SourceCheck[];error?:string};if(!r.ok)throw Error(v.error??'证据库读取失败');onChange({rows:v.rows,checks:v.checks,available:true});})(),
      (async()=>{const r=await fetch('/api/logic/feed'),v=await r.json() as Awaited<ReturnType<typeof loadLogicFeed>>;if(!r.ok)throw Error('新闻刷新失败');setFeed(v);const items:FeedItem[]=v.sources.flatMap((s:{items:FeedItem[]})=>s.items);const newCount=seen.current?items.filter(i=>!seen.current!.has(i.url)).length:0;if(newCount)setNotice(`发现${newCount}条新线索，请核验后决定是否改变逻辑。`);seen.current=new Set([...(seen.current??[]),...items.map(i=>i.url)]);})(),
    ]);
    if(outcomes[0].status==='rejected')onChange({...stateRef.current,available:false});
    const failures=outcomes.filter(x=>x.status==='rejected').map(x=>(x as PromiseRejectedResult).reason?.message??'刷新失败');setError(failures.join('；'));setNow(Date.now());setBusy(false);active.current=false;
  // Keep the polling callback stable; failed reads may retain old rows but never mark them available.
  },[onChange]);
  useEffect(()=>{void refresh();const poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},300000);const tick=setInterval(()=>setNow(Date.now()),30000);const resume=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',resume);return()=>{clearInterval(poll);clearInterval(tick);document.removeEventListener('visibilitychange',resume);};},[refresh]);
  function edit(e?:Evidence,item?:FeedItem){
    setDraft(e?{...e,expectedRevision:e.revision,symbols:e.symbols.join(','),publishedAt:beijing(e.publishedAt),expiresAt:beijing(new Date(Date.now()+864e5).toISOString())}:{...empty(),chain:item?.chain??'macro',source:item?.url??'',publishedAt:item?.publishedAt?beijing(item.publishedAt):'',expiresAt:beijing(new Date(Date.now()+864e5).toISOString())});
    if(form.current){form.current.open=true;form.current.scrollIntoView({behavior:'smooth',block:'center'});}
  }
  async function save(event:React.FormEvent){event.preventDefault();if(saving.current||active.current)return;saving.current=true;setError('');try{
    const thesisId=draft.thesisId||crypto.randomUUID();setDraft({...draft,thesisId});
    const payload={...draft,thesisId,symbols:draft.symbols.toUpperCase().split(',').map(s=>s.trim()).filter(Boolean),publishedAt:new Date(draft.publishedAt+':00+08:00').toISOString(),expiresAt:new Date(draft.expiresAt+':00+08:00').toISOString()};
    const r=await fetch('/api/logic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),v=await r.json() as {error?:string};if(!r.ok)throw Error(v.error??'保存失败');
    setDraft(empty());setNotice('复核已保存；正在重新计算执行提示。');setHistory([]);setBefore('9007199254740991');await refresh();
  }catch(e){setError((e as Error).message);}finally{saving.current=false;}}
  async function moreHistory(){if(!before)return;try{const r=await fetch(`/api/logic?before=${before}`,{headers:{Origin:location.origin}}),v=await r.json() as {rows:Evidence[];next:string|null;error?:string};if(!r.ok)throw Error(v.error??'历史读取失败');setHistory(old=>[...old,...v.rows]);setBefore(v.next);}catch(e){setError((e as Error).message);}}
  const equity=series.assetClass!=='crypto',review=equity?researchContext(series,new Date(now),earnings):null;
  const bars=volumeNarrative(series.bars,new Date(now),equity?'America/New_York':'UTC').completed;
  const day=channelReading(bars),week=channelReading(weeks(bars,new Date(now),equity?'America/New_York':'UTC'));
  return <section className="panel" aria-label="动态逻辑与执行分析">
    <h2>动态逻辑 · 证据与执行分析</h2>
    <p>三条链是待验证的研究假设。新闻先入待核验列表，人工复核后才影响限制；技术完成度与证据判断分开，不生成胜率。原文指纹改变、证据过期或核查失败时，自动暂停依赖旧解释，并保留纠错记录；这不等于自动理解并改写新闻因果。</p>
    <button disabled={busy} onClick={()=>void refresh()}>{busy?'正在核对来源…':'刷新证据与新闻'}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}。未将失败当作没有风险。</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{chains.map(c=><article key={c.id}><h3>{c.title} · {state.available?chainStatus(state.rows,c.id,now,state.checks):'证据库不可用'}</h3><p>{c.hypothesis}</p><p>{c.tests}</p><small>反证 / 失效：{c.kill}</small></article>)}</div>
    <h3>{series.symbol} · 当前执行复核</h3>
    <p>技术：日线20日 {day?.direction??'数据不足'}；周线20周 {week?.direction??'数据不足'}。数据截至 {bars.at(-1)?.date??'未知'}，方向不同不强行合并。</p>
    {!equity?<p>三条链的股票执行限制尚未映射到数字货币；此处不生成币种入场结论。</p>:<>{(['long','short'] as const).map(side=>{const gate=logicGate(state,series.symbol,side,now),structure=review!.failures.some(x=>x.side===side),event=review!.eventBlocked||review!.volatility,stale=!bars.length||now-Date.parse(bars.at(-1)!.date)>7*864e5||/演示|合成/.test(series.source);return <div key={side}><strong>{side==='long'?'做多':'做空'}：{gate.blocked||event||stale?'暂停入场 / 待复核':structure?'旧右侧结构失效，重新确认':'本面板未发现阻断，仍需技术及成交条件确认'}</strong><ul>{gate.reasons.map(r=><li key={r}>{r}</li>)}{event&&<li>财报或近期异常波动仍需复核。</li>}{structure&&<li>突破后回到原区间，原右侧入场理由失效；不能据此自动反向开仓。</li>}{stale&&<li>行情不足、过期或为演示样本。</li>}</ul></div>;})}<small>这些限制同时显示在全市场候选卡片中，只影响入场计划展示；未接入模拟下单拦截，也不代替已有仓位止损。没有证据不等于风险已排除。</small></>}
    <details><summary>自动发现的待核验线索</summary><p>页面可见时每5分钟检查一次；后台标签页可能被浏览器节流，关闭页面停止。尚无全天候后台新闻理解或外部推送。标题不是证据，不自动改变交易限制。</p><p>最近抓取：{feed?.fetchedAt??'尚未取得'}；此时间不代表事件发生时间。政策、航运、商品及公司消息覆盖不完整。</p>{feed?.sources.map(source=><div key={source.id}><h4>{source.label} · {source.error?'读取失败':`${source.items.length}条`}</h4>{source.error&&<p>{source.error}</p>}{source.items.map(item=><article key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small> · {item.publishedAt??'发布时间未知'} · {item.sourceType}</small><button className="secondary" onClick={()=>edit(undefined,item)}>核验后记录</button></article>)}</div>)}</details>
    <details ref={form}><summary>新增证据 / 追加复核</summary><form onSubmit={save} style={{display:'grid',gap:12,maxWidth:760}}>
      <p>先打开原文核查，再填写事实与解释。保存为人工复核，不冒充系统独立核验。默认24小时复核期可调整，最长90天。</p>
      <label>所属链<select value={draft.chain} onChange={e=>setDraft({...draft,chain:e.target.value as ChainId})}>{chains.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>影响股票（逗号分隔；* 表示全部美股）<input required value={draft.symbols} placeholder="ORCL 或 NVDA,DELL；不自动推定关联" onChange={e=>setDraft({...draft,symbols:e.target.value})}/></label>
      <label>核实的事实 / 数值与期间<textarea required maxLength={1500} value={draft.fact} onChange={e=>setDraft({...draft,fact:e.target.value})}/></label>
      <label>你的解释、反证条件与限制理由<textarea required maxLength={1500} value={draft.interpretation} onChange={e=>setDraft({...draft,interpretation:e.target.value})}/></label>
      <label>HTTPS原文来源<input required type="url" value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}/></label>
      <label>来源发布时间（北京时间；不是未来事件日期）<input required type="datetime-local" value={draft.publishedAt} onChange={e=>setDraft({...draft,publishedAt:e.target.value})}/></label>
      <label>下次必须复核时间（北京时间）<input required type="datetime-local" value={draft.expiresAt} onChange={e=>setDraft({...draft,expiresAt:e.target.value})}/></label>
      <label>对原假设的影响<select value={draft.stance} onChange={e=>setDraft({...draft,stance:e.target.value as Evidence['stance']})}><option value="uncertain">尚不确定</option><option value="supports">支持</option><option value="contradicts">反证</option></select></label>
      <label>执行限制<select value={draft.action} onChange={e=>setDraft({...draft,action:e.target.value as LogicAction})}>{Object.entries(actionNames).filter(([k])=>k!=='clear'||draft.expectedRevision>0).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <button type="submit" disabled={busy}>{draft.expectedRevision?'保存追加复核，保留旧版本':'保存人工复核证据'}</button>
    </form></details>
    <details><summary>已复核证据 · {state.rows.length}条逻辑</summary>{!state.rows.length&&<p>暂无人工复核记录；三条链保留为假设。</p>}{state.rows.map(row=><article key={row.id}><h4>{row.symbols.join(', ')} · {actionNames[row.action]} · 第{row.revision}版</h4><p>{row.fact}</p><p>解释：{row.interpretation}</p><p>自动核查：{row.sourceDigest?(state.checks?.find(c=>c.evidenceId===row.id)?.reason??'尚未完成，暂不依赖该解释入场'):'原文自动访问不可用或不在支持名单，仅按人工复核有效期管理'}</p><a href={row.source} target="_blank" rel="noreferrer">核查原文</a><p>发布 {row.publishedAt} · 复核 {row.recordedAt} · 有效至 {row.expiresAt} {Date.parse(row.expiresAt)<=now?'（已过期）':''}</p><button className="secondary" onClick={()=>edit(row)}>追加复核 / 解除本条限制</button></article>)}</details>
    <details><summary>历史复核记录</summary><button disabled={!before} onClick={()=>void moreHistory()}>读取历史（每次最多200条）</button>{history.map(e=><p key={e.id}>{e.recordedAt} · {e.thesisId} / 第{e.revision}版 · {actionNames[e.action]} · {e.fact} · 解释：{e.interpretation}</p>)}</details>
    <p className="fineprint">证据按登录身份保存在站点数据库。localhost与线上数据库独立；当前版本没有后台大模型、完整实时新闻、运费或利率数据接口。宏观主链与商品链可能共享同一原因，不按新闻数量重复加分。</p>
  </section>;
}
