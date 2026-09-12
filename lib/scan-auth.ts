// Development access is enabled by a build-time flag, never by an HTTP header.
export function authorizeScan(req:Request,development=false){
  const url=new URL(req.url),origin=req.headers.get('Origin');
  if(origin && origin!==url.origin)throw Error('不允许跨站启动扫描');
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(development && loopback && origin===url.origin)return;
  if(!req.headers.get('oai-authenticated-user-id'))throw Error('请先登录 Market Lab 再运行扫描');
}
