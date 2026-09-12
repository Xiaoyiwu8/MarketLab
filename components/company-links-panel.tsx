'use client';
import {useState} from 'react';
const links=[
  {from:'NVIDIA · NVDA',to:'Lumentum · LITE',kind:'战略投资 + 供应合作',date:'2026-03-02',detail:'公告投资20亿美元，支持光学技术研发与美国产能；当前持股数量和比例未核验。',source:'https://nvidianews.nvidia.com/news/nvidia-announces-strategic-partnership-with-lumentum-to-develop-state-of-the-art-optics-technology'},
  {from:'NVIDIA · NVDA',to:'Coherent · COHR',kind:'战略投资 + 采购承诺',date:'2026-03',detail:'公告投资20亿美元，另含采购承诺；投资金额与采购金额分开，当前持股比例未核验。',source:'https://blogs.nvidia.com/blog/coherent-texas-ai-optical/'},
  {from:'NVIDIA · NVDA',to:'Nebius · NBIS',kind:'战略投资 + AI云合作',date:'2026-03-11',detail:'公告拟投资20亿美元并深化AI基础设施合作；不以公告金额推算当前持股比例。',source:'https://nebius.com/newsroom/nvidia-and-nebius-partner-to-scale-full-stack-ai-cloud'},
  {from:'Google / Alphabet · GOOGL / GOOG',to:'Marvell · MRVL',kind:'认股权证 + 定制芯片合作',date:'2026-08-19（8-K）',detail:'8-K披露向Google发行最多可认购58,970,907股的认股权证，行权价206.58美元，附归属条件。可认购数量不等于已经持有的股份。',source:'https://investor.marvell.com/sec-filings/all-sec-filings/content/0001193125-26-356217/0001193125-26-356217.pdf'},
  {from:'Google / Alphabet · GOOGL / GOOG',to:'Anthropic（本表未提供交易代码）',kind:'投资 + 云合作',date:'2025-01（FTC报告）',detail:'FTC报告记录Google与Anthropic的投资及云合作关系；当前持股比例、后续增资与退出未核验。不能把持有GOOGL等同于直接持有Anthropic。',source:'https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-issues-staff-report-ai-partnerships-investments-study'},
];
export default function CompanyLinksPanel(){
  const [query,setQuery]=useState('');const matches=links.filter(x=>(x.from+' '+x.to+' '+x.kind).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="panel" aria-label="公司投资与合作关系"><h2>公司投资与合作关系</h2><p>方向为“投资方 → 被投方”。单向投资不等于相互持股；采购、合作和认股权证单独标注。核对日期：2026-09-12。此表为人工核验的重点关系，不是完整持仓数据库，也不参与技术完成度评分。</p>
    <label>搜索公司、代码或关系类型 <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="NVDA、MRVL、Anthropic…" /></label>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>方向</th><th>关系类型</th><th>公告/资料日期</th><th>已知内容与待核验事项</th><th>来源</th></tr></thead><tbody>{matches.map(x=><tr key={x.to}><td>{x.from} → {x.to}</td><td>{x.kind}</td><td>{x.date}</td><td>{x.detail}</td><td><a href={x.source} target="_blank" rel="noreferrer">公司公告 / 监管资料</a></td></tr>)}</tbody></table></div>
    {!matches.length&&<p>列表暂无匹配关系；不代表两家公司没有投资或合作。</p>}
    <p>研究用途：观察共同客户、资金与供应链依赖。关联公司可能共同承受行业冲击，不能仅凭投资关系推断股价上涨、订单利润或分散风险。</p>
  </section>;
}
