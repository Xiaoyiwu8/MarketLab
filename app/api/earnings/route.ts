import {loadEarningsWeek,nextEarningsWeek,type EarningsWeek} from '@/lib/earnings-calendar';
let cache:{key:string;expires:number;value:Promise<EarningsWeek>}|undefined;
export async function GET(){
  const key=nextEarningsWeek()[0];
  if(!cache||cache.key!==key||cache.expires<Date.now())cache={key,expires:Date.now()+5*60_000,value:loadEarningsWeek()};
  try{return Response.json(await cache.value,{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'财报日历暂不可用，请稍后重试'},{status:503});}
}
