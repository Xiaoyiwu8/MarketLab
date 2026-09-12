'use client';
import type {Series} from '@/lib/engine';
import {representatives} from '@/lib/representatives';
import {stockCandidates} from '@/lib/candidates';
export default function ScanExamples({data,onSelect,complete}:{data:Series[];onSelect:(series:Series)=>void;complete:boolean}){
  const now=new Date(),groups=representatives(data,now),diagnostics=stockCandidates(data,now).evaluated;
  return <div aria-label="四组筛选案例"><h3>看具体股票 · 每组1个筛选案例</h3><p>{complete?'从本次扫描保留的代表池中选取。':'扫描尚未完成：仅从目前已处理并保留的代表池中选取，后续可能更换。'}优先展示各组内条件较完整者；案例用于解释筛选，不代表现在可以入场，也不代表所有被排除股票。</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{(['left','right'] as const).flatMap(group=>(['long','short'] as const).map(side=>{
      const label=`${group==='left'?'左侧':'右侧'}${side==='long'?'做多':'做空'}` as '左侧做多'|'左侧做空'|'右侧做多'|'右侧做空';
      const item=groups[group][side][0];
      if(!item)return <article key={label}><h4>{label}</h4><p>当前代表池暂无足够有效样本举例；不使用编造股票填充。</p></article>;
      const first=diagnostics.find(x=>x.series.symbol===item.series.symbol)?.diagnostic[label],passed=item.checks.filter(c=>c.pass),missing=item.checks.filter(c=>!c.pass);
      return <article key={label} style={{border:'1px solid #64748b',borderRadius:10,padding:16}}><h4>{label} · {item.series.symbol}</h4><p><strong>筛选案例 · {item.status}</strong></p><p>当前卡点：{first??missing[0]?.label??'无缺失技术条件，仍须事件与成交核验'}</p><p>已通过：{passed.map(c=>c.label).join('；')||'尚未通过本组关键形态条件'}</p><p>仍需等待：{missing.map(c=>c.label).join('；')||'核对当前价格、事件与逻辑限制；技术达标不等于可交易'}</p><small>形态日 {item.date??'未形成'} · 确认日 {item.confirmationDate??'未确认'} · 日线截至 {item.series.bars.at(-1)?.date}</small><p>{item.series.source}</p><button className="secondary" onClick={()=>onSelect(item.series)}>查看 {item.series.symbol} 图表与执行复核</button></article>;
    }))}</div>
  </div>;
}
