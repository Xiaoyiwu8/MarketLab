/// <reference types="vite/client" />
import {logicOwner} from '@/lib/logic-auth';
import {sourceDigest} from '@/lib/source-watch';
import {validateEvidence,type Evidence} from '@/lib/logic';
import {logicDatabase} from '@/lib/logic-store';
const headers={'Cache-Control':'no-store'};
const owner=(req:Request)=>logicOwner(req,import.meta.env.DEV);
export async function GET(req:Request){
  try{const user=owner(req),db=logicDatabase();
    const cursor=new URL(req.url).searchParams.get('before');
    if(cursor&&!/^\d+$/.test(cursor))throw Error('历史游标无效');
    const query=cursor?'SELECT rowid AS seq,body FROM logic_evidence WHERE owner=? AND rowid<? ORDER BY rowid DESC LIMIT 201':'SELECT e.rowid AS seq,e.body FROM logic_evidence e WHERE e.owner=? AND NOT EXISTS (SELECT 1 FROM logic_evidence n WHERE n.owner=e.owner AND n.thesis_id=e.thesis_id AND n.revision>e.revision) ORDER BY e.rowid DESC';
    const q=db.prepare(query),result=await (cursor?q.bind(user,Number(cursor)):q.bind(user)).all<{seq:number;body:string}>();
    const values=result.results,selected=cursor?values.slice(0,200):values;
    const checks=cursor?[]:(await db.prepare('SELECT c.body FROM logic_source_checks c WHERE c.owner=? AND NOT EXISTS (SELECT 1 FROM logic_source_checks n WHERE n.owner=c.owner AND n.evidence_id=c.evidence_id AND n.rowid>c.rowid)').bind(user).all<{body:string}>()).results.map(x=>JSON.parse(x.body));
    return Response.json({rows:selected.map(x=>JSON.parse(x.body)),checks,next:cursor&&values.length>200?String(selected.at(-1)!.seq):null},{headers});
  }catch(e){return Response.json({error:(e as Error).message},{status:503,headers});}
}
export async function POST(req:Request){
  try{const user=owner(req),body=await req.text();if(body.length>12000)throw Error('证据内容过长');
    const value=validateEvidence(JSON.parse(body)),db=logicDatabase();
    const old=await db.prepare('SELECT revision FROM logic_evidence WHERE owner=? AND thesis_id=? ORDER BY revision DESC LIMIT 1').bind(user,value.thesisId).first<{revision:number}>();
    if((old?.revision??0)!==value.expectedRevision)return Response.json({error:'其他窗口已更新该记录，请刷新后复核。'},{status:409,headers});
    const {expectedRevision,...fields}=value;
    let digest:string|undefined;try{digest=await sourceDigest(fields.source);}catch{/* Manual review remains explicitly manual when automatic source access is unavailable. */}
    const record:Evidence={...fields,id:crypto.randomUUID(),revision:expectedRevision+1,recordedAt:new Date().toISOString(),...(digest?{sourceDigest:digest}:{})};
    // Insert-only revisions plus UNIQUE guard preserve previous evidence, including concurrent edits.
    await db.prepare('INSERT INTO logic_evidence(id,owner,thesis_id,revision,recorded_at,body) VALUES(?,?,?,?,?,?)').bind(record.id,user,record.thesisId,record.revision,record.recordedAt,JSON.stringify(record)).run();
    return Response.json({record},{headers});
  }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}
