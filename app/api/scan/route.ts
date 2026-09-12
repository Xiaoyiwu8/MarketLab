/// <reference types="vite/client" />
import { SIGNAL_VERSION } from '@/lib/maturity';
import { env } from 'cloudflare:workers';
import { stockUniverse, type Listing } from '@/lib/universe';
import { advanceScan, type ScanState } from '@/lib/market-scan';
import { tencent } from '@/lib/tencent';
import { authorizeScan } from '@/lib/scan-auth';
const headers={'Cache-Control':'no-store'};
function database(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw Error('扫描数据库尚未配置');return db;}
export async function GET(){
  try{const row=await database().prepare('SELECT state FROM market_scan ORDER BY date DESC LIMIT 1').first<{state:string}>();return Response.json({scan:row?JSON.parse(row.state):null},{headers});}
  catch(e){return Response.json({error:(e as Error).message},{status:503,headers});}
}
export async function POST(req:Request){
  try{
    authorizeScan(req,import.meta.env.DEV);const db=database(),{action,date}=await req.json() as {action:string;date?:string};
    if(action==='start'){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const reference=await tencent('SPY'), target=reference.rows.filter(b=>b.date<today).at(-1)?.date;
      if(!target || Date.now()-Date.parse(target+'T00:00:00Z')>7*864e5)throw Error('参考市场日线过期，不能启动每日扫描');
      const existing=await db.prepare('SELECT state FROM market_scan WHERE date=?').bind(target).first<{state:string}>();
      if(existing){const scan=JSON.parse(existing.state) as ScanState;if(scan.ruleVersion!==SIGNAL_VERSION)scan.status='running';return Response.json({scan},{headers});}
      const universe=await stockUniverse();
      const scan:ScanState={ruleVersion:SIGNAL_VERSION,date:target,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'running',total:universe.listings.length,cursor:0,analyzed:0,ineligible:0,failed:0,excluded:universe.excluded,directoryStamps:universe.stamps,errors:[],long:[],short:[]};
      await db.prepare('INSERT OR IGNORE INTO market_scan(date,state,listings) VALUES(?,?,?)').bind(target,JSON.stringify(scan),JSON.stringify(universe.listings)).run();
      const saved=await db.prepare('SELECT state FROM market_scan WHERE date=?').bind(target).first<{state:string}>();
      return Response.json({scan:JSON.parse(saved!.state)},{headers});
    }
    if(action!=='step'||!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('扫描请求无效');
    const token=crypto.randomUUID(),now=Date.now();
    const lease=await db.prepare('UPDATE market_scan SET lease_token=?,lease_until=? WHERE date=? AND lease_until<?').bind(token,now+120000,date,now).run();
    if(!lease.meta.changes)return Response.json({error:'扫描正在另一个窗口运行，请稍后刷新'},{status:409,headers});
    try{
      const row=await db.prepare('SELECT state,listings FROM market_scan WHERE date=?').bind(date).first<{state:string;listings:string}>();
      if(!row)throw Error('扫描记录不存在');
      const state=JSON.parse(row.state) as ScanState;
      const next=state.status==='complete' && state.ruleVersion===SIGNAL_VERSION?state:await advanceScan(state,JSON.parse(row.listings) as Listing[]);
      const saved=await db.prepare('UPDATE market_scan SET state=?,lease_until=0,lease_token=NULL WHERE date=? AND lease_token=?').bind(JSON.stringify(next),date,token).run();
      if(!saved.meta.changes)throw Error('扫描锁已过期，本批次未保存，请重试');
      return Response.json({scan:next},{headers});
    }finally{await db.prepare('UPDATE market_scan SET lease_until=0,lease_token=NULL WHERE date=? AND lease_token=?').bind(date,token).run();}
  }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}
