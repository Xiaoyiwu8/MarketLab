export const chains = [
  {id:'macro',title:'宏观主链',hypothesis:'能源成本 → 通胀预期 → 政策路径 → 实际利率与估值',tests:'核对油价持续性、通胀广度、实际利率及政策声明；不能由油价上涨直接推出加息或股市上涨。',kill:'能源回落、通胀扩散停止或政策路径改变时，重新审视原传导链。'},
  {id:'ai',title:'AI产业链',hypothesis:'订单 → 交付与收入 → 利润 → 现金流与融资',tests:'核对RPO兑现、客户集中度、毛利率、资本开支、融资完成额及股权稀释；不能按一天涨跌排列公司质量。',kill:'交付延迟、订单撤销、利润率恶化，或融资完成、现金流改善时，更新对应环节。'},
  {id:'shipping',title:'地缘与商品链',hypothesis:'航道受扰 → 实际供给与运费 → 能源成本 → 通胀压力',tests:'核对航道通行量、出口量、库存、绕行与保险成本；标题数量不等于供给损失。',kill:'通航恢复、替代供给增加或库存弥补缺口时，不能继续沿用原供给冲击判断。'},
] as const;
export type ChainId = typeof chains[number]['id'];
export type LogicAction = 'review'|'block-long'|'block-short'|'block-both'|'clear';
export type Evidence = {id:string; thesisId:string; revision:number; chain:ChainId; symbols:string[]; fact:string; interpretation:string; source:string; sourceDigest?:string; publishedAt:string; recordedAt:string; expiresAt:string; stance:'supports'|'contradicts'|'uncertain'; action:LogicAction};
export type LogicState = {rows:Evidence[]; available:boolean;checks?:import('./source-watch.ts').SourceCheck[]};
export function httpsSource(value:string){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error();u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);return u.href;}catch{throw Error('来源必须是有效的HTTPS原文链接');}}
export function validateEvidence(input:unknown,now=new Date()):Omit<Evidence,'id'|'recordedAt'|'revision'> & {expectedRevision:number}{
  if(!input||typeof input!=='object')throw Error('证据格式无效');
  const x=input as Record<string,unknown>;
  const text=(key:string,max:number)=>{const v=x[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${key}缺失或过长`);return v.trim();};
  const thesisId=text('thesisId',80),fact=text('fact',1500),interpretation=text('interpretation',1500),source=httpsSource(text('source',2000));
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(thesisId))throw Error('逻辑编号无效');
  if(!chains.some(c=>c.id===x.chain)||!['supports','contradicts','uncertain'].includes(String(x.stance))||!['review','block-long','block-short','block-both','clear'].includes(String(x.action)))throw Error('逻辑状态无效');
  if(!Array.isArray(x.symbols)||!x.symbols.length||x.symbols.length>12||x.symbols.some(s=>typeof s!=='string'||!(s==='*'||/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)))||(x.symbols.includes('*')&&x.symbols.length>1))throw Error('填写最多12个股票代码，或单独填写*表示全部美股');
  const publishedAt=text('publishedAt',40),expiresAt=text('expiresAt',40),p=Date.parse(publishedAt),e=Date.parse(expiresAt);
  if(!Number.isFinite(p)||p>now.getTime()||!Number.isFinite(e)||e<=now.getTime()||e>now.getTime()+90*864e5)throw Error('来源发布时间不能在未来；复核有效期须在未来90天内');
  if(!Number.isInteger(x.expectedRevision)||Number(x.expectedRevision)<0)throw Error('复核版本无效');
  return {thesisId,fact,interpretation,source,publishedAt:new Date(p).toISOString(),expiresAt:new Date(e).toISOString(),chain:x.chain as ChainId,stance:x.stance as Evidence['stance'],action:x.action as LogicAction,symbols:[...new Set(x.symbols)] as string[],expectedRevision:Number(x.expectedRevision)};
}
export function latestEvidence(rows:Evidence[],now=Date.now()){
  const latest=new Map<string,Evidence>();
  for(const row of rows){if(Date.parse(row.recordedAt)>now)continue;const old=latest.get(row.thesisId);if(!old||row.revision>old.revision)latest.set(row.thesisId,row);}
  return [...latest.values()];
}
export function logicGate(state:LogicState|undefined,symbol:string,side:'long'|'short',now=Date.now()){
  if(!state?.available)return {blocked:true,reasons:['逻辑证据库尚未成功读取，先复核事件风险。']};
  const relevant=latestEvidence(state.rows,now).filter(e=>e.symbols.includes('*')||e.symbols.includes(symbol));
  const reasons=relevant.filter(e=>e.action==='block-both'||e.action===`block-${side}`).map(e=>`${chains.find(c=>c.id===e.chain)!.title}：${e.interpretation}${Date.parse(e.expiresAt)<=now?'（已过期，原暂停限制待复核后解除）':''}`);
  for(const e of relevant){
    if(e.action==='clear')continue;
    const check=state.checks?.find(c=>c.evidenceId===e.id);
    if(Date.parse(e.expiresAt)<=now&&e.action==='review')reasons.push(`证据已过期：${e.fact}。自动转为暂停依赖，需追加复核。`);
    if(e.sourceDigest&&(!check||check.status!=='unchanged'||now-Date.parse(check.checkedAt)>15*60000))reasons.push(`原文自动核查：${check?.status==='changed'?'内容已变化，原解释已暂停使用':check?.reason||'核查尚未完成或已过期'}。需重新核验后恢复。`);
  }
  return {blocked:reasons.length>0,reasons};
}
export function chainStatus(rows:Evidence[],chain:ChainId,now=Date.now(),checks:import('./source-watch.ts').SourceCheck[]=[]){
  const all=latestEvidence(rows,now).filter(x=>x.chain===chain&&x.action!=='clear'),active=all.filter(x=>Date.parse(x.expiresAt)>now);
  if(!all.length)return '待验证假设';
  if(all.some(e=>e.sourceDigest&&checks.some(c=>c.evidenceId===e.id&&c.status==='changed')))return '原文变化 · 原解释待复核';
  if(all.some(e=>e.sourceDigest&&!checks.some(c=>c.evidenceId===e.id&&c.status==='unchanged'&&now-Date.parse(c.checkedAt)<=15*60000)))return '自动核查不足 · 暂停依赖';
  if(active.length!==all.length)return '证据过期 · 待复核';
  const stances=new Set(active.map(x=>x.stance));
  if(stances.has('supports')&&stances.has('contradicts'))return '支持与反证并存';
  if(stances.has('uncertain'))return '存在未决证据';
  return stances.has('contradicts')?'出现反证':'已有支持证据 · 非因果证明';
}
