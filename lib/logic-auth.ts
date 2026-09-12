import {authorizeScan} from './scan-auth.ts';
export function logicOwner(req:Request,development:boolean){
  const loopback=['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname),user=req.headers.get('oai-authenticated-user-id');
  if(development&&loopback&&req.method==='GET'&&req.headers.get('sec-fetch-site')==='same-origin'&&!req.headers.has('Origin'))return user??'local-development';
  authorizeScan(req,development);return user??'local-development';
}
