'use client';
import { SIGNAL_VERSION } from '@/lib/maturity';
import { useEffect, useRef, useState } from 'react';
import type { ScanState } from '@/lib/market-scan';
import type { Series } from '@/lib/engine';
import CandidatePanel from './candidate-panel';
export default function MarketScanPanel({onSelect}:{onSelect:(series:Series)=>void}){
  const [scan,setScan]=useState<ScanState|null>(null),[running,setRunning]=useState(false),[error,setError]=useState('');
  const stop=useRef(false),locked=useRef(false);
  async function refresh(){try{const r=await fetch('/api/scan'),d=await r.json() as {error?:string;scan:ScanState|null};if(!r.ok)throw Error(d.error ?? '扫描请求失败');setScan(d.scan);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!locked.current)void refresh();},15000);return()=>{clearInterval(timer);stop.current=true;};},[]);
  async function start(){
    if(locked.current)return;locked.current=true;stop.current=false;setRunning(true);setError('');
    async function request(body:unknown){const r=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;scan:ScanState|null};if(!r.ok)throw Error(d.error ?? '扫描请求失败');setScan(d.scan);return d.scan as ScanState;}
    try{let state=await request({action:'start'});while(!stop.current&&state.status!=='complete'){state=await request({action:'step',date:state.date});if(state.status!=='complete')await new Promise(r=>setTimeout(r,1200));}}
    catch(e){setError((e as Error).message);}finally{locked.current=false;setRunning(false);}
  }
  const results=scan?[...scan.long,...scan.short]:[];
  return <section className="panel" style={{border:'2px solid #4f9b86',marginBottom:24}}>
    <p className="eyebrow">DAILY US MARKET SCAN · PAPER ONLY</p><h2>每日全市场选股 · 左侧2多2空 / 右侧2多2空</h2>
    <p>从 Nasdaq 官方上市目录逐一检查美股普通股与普通股 ADR。排除 ETF、优先股、权证、基金及不支持的代码；价格低于 $5 或近20日平均成交额低于 $500万的不推荐。不是固定股票池。</p>
    <div className="row"><button disabled={running} onClick={()=>void start()}>{running?'正在逐批扫描…':'开始 / 继续今日全市场扫描'}</button>{running&&<button className="secondary" onClick={()=>{stop.current=true;}}>当前批次后暂停</button>}<button className="secondary" onClick={()=>void refresh()}>刷新结果</button></div>
    {error&&<p role="alert">{error}。已保存的进度保留，未改用演示结果。</p>}
    {!scan&&<p>尚无全市场扫描记录。首次扫描需逐只获取历史行情，可能耗时较长。</p>}
    {scan&&<><h3>交易日 {scan.date} · {scan.status==='complete'?'已完成全名单尝试':'扫描尚未完成'}</h3>
      <progress style={{width:'100%'}} value={scan.cursor} max={scan.total} aria-label="全市场扫描进度" />
      <p>{scan.cursor} / {scan.total} 只 · 有效历史 {scan.analyzed} · 流动性/价格排除 {scan.ineligible} · 数据失败 {scan.failed} · 目录预先排除 {scan.excluded}</p>
      <p>更新于 {scan.updatedAt} · 腾讯公共延迟日线。数据失败意味着覆盖不完整；候选仅从成功获取并符合条件的股票中选出。</p>
      {scan.analyzed-scan.ineligible===0&&<p role="status">尚无通过数据与流动性检查的股票，不能据此判断市场没有机会。</p>}
      {scan.rejections&&<details open><summary>各组为什么入选或被排除</summary><p>每只有效股票在每组记录首个未通过条件；符合条件数为排序前数量，不等于最终名额。尚在扫描时统计为当前进度。</p>{Object.entries(scan.rejections).map(([group,reasons])=><div key={group}><h4>{group}</h4><ul>{Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([reason,count])=><li key={reason}>{reason}：{count} 只</li>)}</ul></div>)}</details>}
      {scan.ruleVersion!==SIGNAL_VERSION?<p>旧版结果已停用。请开始扫描，按左侧 / 右侧四组规则重新检查全名单。</p>:scan.status==='complete'?<CandidatePanel data={results} busy={false} onSelect={symbol=>{const s=results.find(x=>x.symbol===symbol);if(s)onSelect(s);}} />:<p>完成全名单检查后才展示四组候选（每组最多2只），避免把先扫描到的股票误认为全市场最佳候选。</p>}
      {scan.failed>0&&<details><summary>查看失败原因（前100条）</summary><ul>{scan.errors.map(e=><li key={e.symbol}>{e.symbol}：{e.reason}</li>)}</ul></details>}
      <details><summary>名单来源与筛选口径</summary><p>{scan.directoryStamps.join(' / ')}</p><a href="https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs" target="_blank" rel="noreferrer">Nasdaq 官方目录说明</a><p>右侧要求突破回踩和趋势确认；左侧要求横盘区间、高低位置、支撑/压力附近反转或假突破收回和独立日线确认。各策略条件及收益风险条件全部满足后，按参考收益风险比排序。排序不是胜率；入场仍需核对当前价格及事件。做空标的不代表券商有可借股票。</p></details>
    </>}
    <p className="fineprint">扫描进度保存在网站。网页运行可暂停续跑；每日无人值守执行还需要每日任务运行环境在线。行情限流时停止并保留进度。交易休市日沿用最近完整交易日，并显示日期。</p>
  </section>;
}
