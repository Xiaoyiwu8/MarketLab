// The scheduler supplies a short-lived Sites token via the process environment.
// Never write the token or HTTP headers to logs or files.
const token=process.env.MARKETLAB_SITE_TOKEN;
if(!token)throw Error('MARKETLAB_SITE_TOKEN must be supplied by the authenticated scheduler');
const url='https://equity-options-lab-wxy.yeetmayas.chatgpt.site/api/scan';
async function request(body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':token},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  let d;try{d=await r.json();}catch{throw Error(`Scan endpoint returned non-JSON (${r.status}); reauthenticate without logging credentials`);}
  if(!r.ok)throw Error(d.error ?? `Scan failed: ${r.status}`);
  return d.scan;
}
let scan=await request({action:'start'}),steps=0;
while(scan.status!=='complete'){
  scan=await request({action:'step',date:scan.date});
  if(++steps%20===0)console.log(JSON.stringify({date:scan.date,cursor:scan.cursor,total:scan.total,failed:scan.failed}));
  await new Promise(r=>setTimeout(r,1500));
}
console.log(JSON.stringify({date:scan.date,status:scan.status,analyzed:scan.analyzed,total:scan.total,failed:scan.failed,long:scan.long.map(s=>s.symbol),short:scan.short.map(s=>s.symbol)}));
