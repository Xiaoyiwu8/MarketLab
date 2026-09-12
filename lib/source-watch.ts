export type SourceCheck={evidenceId:string;checkedAt:string;status:'unchanged'|'changed'|'unavailable';reason:string};
const allowed=['www.federalreserve.gov','www.eia.gov','www.bls.gov','www.sca.isr.umich.edu','data.sca.isr.umich.edu','www.sec.gov','investor.oracle.com','investor.tsmc.com','investor.nvidia.com','nvidianews.nvidia.com','investors.delltechnologies.com','www.maritime.dot.gov'];
export function watchableSource(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&allowed.includes(u.hostname);}catch{return false;}}
export function sourceText(html:string){
  const text=html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  const main=text.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1]??text;
  return main.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
export async function sourceDigest(url:string,loader:typeof fetch=fetch){
  if(!watchableSource(url))throw Error('该来源不在自动核查名单，需人工复核');
  const r=await loader(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});
  if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('原文读取失败或不是HTML页面');
  if(Number(r.headers.get('content-length')??0)>1500000)throw Error('原文超出核查上限');
  const reader=r.body?.getReader();if(!reader)throw Error('原文为空');const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('原文超出核查上限');}chunks.push(value);}
  const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
  const text=sourceText(new TextDecoder().decode(raw));if(text.length<100||/captcha|access denied|just a moment|verify you are human/i.test(text.slice(0,2000)))throw Error('原文可能为访问验证页，未作为有效证据');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
