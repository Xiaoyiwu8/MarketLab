/// <reference types="vite/client" />
import {logicOwner} from '@/lib/logic-auth';
import {logicDatabase} from '@/lib/logic-store';
import {sourceDigest,type SourceCheck} from '@/lib/source-watch';
import type {Evidence} from '@/lib/logic';
export async function POST(req:Request){
  try{const user=logicOwner(req,import.meta.env.DEV),db=logicDatabase();
    const result=await db.prepare('SELECT e.body FROM logic_evidence e WHERE e.owner=? AND NOT EXISTS (SELECT 1 FROM logic_evidence n WHERE n.owner=e.owner AND n.thesis_id=e.thesis_id AND n.revision>e.revision)').bind(user).all<{body:string}>();
    const records=result.results.map(x=>JSON.parse(x.body) as Evidence).filter(e=>e.sourceDigest&&e.action!=='clear');
    const prior=(await db.prepare('SELECT c.body FROM logic_source_checks c WHERE c.owner=? AND NOT EXISTS (SELECT 1 FROM logic_source_checks n WHERE n.owner=c.owner AND n.evidence_id=c.evidence_id AND n.rowid>c.rowid)').bind(user).all<{body:string}>()).results.map(x=>JSON.parse(x.body) as SourceCheck);
    const allDue=records.filter(e=>{const p=prior.find(x=>x.evidenceId===e.id);return !p||Date.now()-Date.parse(p.checkedAt)>300000;}).sort((a,b)=>(Date.parse(prior.find(x=>x.evidenceId===a.id)?.checkedAt??'')||0)-(Date.parse(prior.find(x=>x.evidenceId===b.id)?.checkedAt??'')||0));
    const due=allDue.slice(0,6);
    const checks=await Promise.all(due.map(async e=>{
      let status:SourceCheck['status']='unavailable',reason='';
      try{const digest=await sourceDigest(e.source);status=digest===e.sourceDigest?'unchanged':'changed';reason=status==='changed'?'原文内容改变；可能为数据修订或页面调整，旧解释停止作为入场依据':'原文指纹未变，不等于逻辑已获证明';}catch(err){reason=(err as Error).message;}
      // Once a revision changed, only a new human review can establish a new baseline.
      if(prior.some(x=>x.evidenceId===e.id&&x.status==='changed')){status='changed';reason='此前发现原文变化，等待追加复核；不自动恢复旧解释';}
      const check:SourceCheck={evidenceId:e.id,checkedAt:new Date().toISOString(),status,reason};
      await db.prepare('INSERT INTO logic_source_checks(id,owner,evidence_id,checked_at,body) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user,e.id,check.checkedAt,JSON.stringify(check)).run();return check;
    }));
    return Response.json({checked:checks.length,remaining:allDue.length-due.length,checks},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:(e as Error).message},{status:503});}
}
