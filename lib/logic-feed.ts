import {httpsSource,type ChainId} from './logic.ts';
export type FeedItem={title:string;url:string;publishedAt:string|null;publisher:string;chain:ChainId;sourceType:string};
export const feedSources=[
  {id:'fed',label:'美联储货币政策公告',url:'https://www.federalreserve.gov/feeds/press_monetary.xml',chain:'macro' as const,sourceType:'官方标题；正文及因果解释待核验'},
  {id:'energy',label:'EIA Today in Energy',url:'https://www.eia.gov/rss/todayinenergy.xml',chain:'shipping' as const,sourceType:'官方标题；正文及影响范围待核验'},
  {id:'ai',label:'AI公司新闻检索',url:'https://news.google.com/rss/search?q=(Oracle+OR+Nvidia+OR+Dell)+(AI+OR+earnings)+when:7d&hl=en-US&gl=US&ceid=US:en',chain:'ai' as const,sourceType:'聚合索引；非原始证据，不自动确认投资关系'},
];
export function parseFeed(xml:string,source:typeof feedSources[number]):FeedItem[]{
  if(!/<(?:rss|rdf:RDF)\b/i.test(xml))throw Error('来源未返回有效RSS');
  const decode=(v:string)=>v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
  const items=(xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi)??[]).flatMap(block=>{
    const field=(tag:string)=>decode(block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]??'');
    try{const url=httpsSource(field('link')),title=field('title').slice(0,500),raw=field('pubDate')||field('dc:date'),stamp=Date.parse(raw);
      const host=new URL(url).hostname;if(source.id==='fed'&&!/(^|\.)federalreserve\.gov$/.test(host))return [];if(source.id==='energy'&&!/(^|\.)eia\.gov$/.test(host))return [];
      return title?[{title,url,publishedAt:Number.isFinite(stamp)?new Date(stamp).toISOString():null,publisher:source.label,chain:source.chain,sourceType:source.sourceType}]:[];
    }catch{return [];}
  });
  return [...new Map(items.map(item=>[item.url,item])).values()].slice(0,15);
}
export async function loadLogicFeed(loader:typeof fetch=fetch){
  const sources=await Promise.all(feedSources.map(async source=>{try{const r=await loader(source.url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const xml=await r.text();if(xml.length>2000000)throw Error('来源内容超出处理上限');return {id:source.id,label:source.label,items:parseFeed(xml,source),error:null as string|null};}catch(e){return {id:source.id,label:source.label,items:[] as FeedItem[],error:(e as Error).message};}}));
  return {fetchedAt:new Date().toISOString(),sources};
}
