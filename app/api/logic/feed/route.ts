import {loadLogicFeed} from '@/lib/logic-feed';
let cached:{at:number;value:ReturnType<typeof loadLogicFeed>}|undefined;
export async function GET(){
  if(!cached||Date.now()-cached.at>300000)cached={at:Date.now(),value:loadLogicFeed()};
  return Response.json(await cached.value,{headers:{'Cache-Control':'no-store'}});
}
