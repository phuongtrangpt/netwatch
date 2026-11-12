import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {db,sqlite} from './database';
import {requestContext} from '../lib/server';
import {authenticated,checkLogin,session,loginHTML,accountName,viewerInfo,saveViewer} from './auth';
import * as dashboard from '../app/api/dashboard/route';
import * as projects from '../app/api/projects/route';
import * as config from '../app/api/config/route';
import * as topology from '../app/api/topology/route';
import * as pair from '../app/api/pair/route';
import * as upgrade from '../app/api/upgrade/route';
import * as ingest from '../app/api/ingest/route';
const routes:any={dashboard,projects,config,topology,pair,upgrade,ingest};
const root=resolve('dist/public'),port=Number(process.env.PORT||8080);
for(const name of ['NETWATCH_INGEST_URL','NETWATCH_PUBLIC_URL'])if(process.env[name]){const u=new URL(process.env[name]!);if(!['http:','https:'].includes(u.protocol)||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error(name+' phải là URL gốc http(s)://HOST:PORT, không có đường dẫn hay thông tin đăng nhập.');process.env[name]=u.origin;}
const failures=new Map<string,{count:number,until:number}>();
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/',process.env.NETWATCH_PUBLIC_URL||'http://'+req.headers.host);
  const method=req.method||'GET',path=url.pathname;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
  if(path==='/healthz'&&method==='GET'){res.end('ok');return;}
  const auth=authenticated(req.headers.cookie||'');
  const ingestRequest=path==='/api/ingest'&&method==='POST';
  if(!auth&&!ingestRequest&&path!=='/login'){
   if(path.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Đăng nhập tại /login"}');}
   else{res.writeHead(302,{Location:'/login'});res.end();}return;
  }
  // Viewer access is an explicit read allowlist; router ingest has separate bearer authentication.
  if(auth==='viewer'&&path.startsWith('/api/')&&!ingestRequest&&!(method==='GET'&&['/api/dashboard','/api/projects','/api/session'].includes(path))){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Tài khoản chỉ xem không được thay đổi dữ liệu hoặc tải bộ cài router.'}));return;}
  let body:Buffer|undefined;
  if(!['GET','HEAD'].includes(method)){
   const chunks:Buffer[]=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   body=Buffer.concat(chunks);
  }
  if(path==='/login'){
   if(method==='POST'){
    if(req.headers.origin!==url.origin){res.writeHead(403);res.end('Invalid origin');return;}
    const key=req.socket.remoteAddress||'local',now=Date.now(),f=failures.get(key);
    if(f&&f.until>now&&f.count>=5){res.writeHead(429);res.end('Chờ 5 phút rồi thử lại.');return;}
    const form=new URLSearchParams(body?.toString()),password=form.get('password')||'',username=form.get('username')||'';
    const role=password.length<=256&&username.length<=32?checkLogin(username,password):null;
    if(role){
     failures.delete(key);res.writeHead(303,{Location:'/', 'Set-Cookie':`netwatch=${session(role)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${(process.env.COOKIE_SECURE==='true'||process.env.NETWATCH_PUBLIC_URL?.startsWith('https:'))?'; Secure':''}`});res.end();return;
    }
    if(failures.size>2000)for(const [k,v] of failures)if(v.until<now)failures.delete(k);
    failures.set(key,{count:f&&f.until>now?f.count+1:1,until:now+300000});res.writeHead(401,{'Content-Type':'text/html; charset=utf-8'});res.end(loginHTML.replace('<h1>NetWatch</h1>','<h1>NetWatch</h1><p>Sai tên đăng nhập hoặc mật khẩu.</p>'));return;
   }
   if(method!=='GET'){res.writeHead(405);res.end();return;}
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(loginHTML);return;
  }
  if(path==='/logout'){res.writeHead(303,{Location:'/login','Set-Cookie':'netwatch=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});res.end();return;}
  if(path.startsWith('/api/')){
   if(path==='/api/session'&&method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({role:auth,username:auth?accountName(auth):null}));return;}
   if(path==='/api/viewer'){
    if(auth!=='owner'){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type','application/json');
    if(method==='GET'){res.end(JSON.stringify(viewerInfo()));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(req.headers.origin!==url.origin){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    if(!body||body.length>4096){res.writeHead(413);res.end();return;}
    try{res.end(JSON.stringify(saveViewer(JSON.parse(body.toString()))));}catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Không lưu được tài khoản.'}));}return;
   }
   const handler=routes[path.slice(5)]?.[method];if(!handler){res.writeHead(404);res.end();return;}
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request(url,{method,headers,...(body?{body}: {})});
   const result:Response=await requestContext.run({authenticated:!!auth,role:auth||undefined},()=>handler(request));
   res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(Buffer.from(await result.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(method)){res.writeHead(405);res.end();return;}
  let file=resolve(root,'.'+decodeURIComponent(path));
  if(file!==root&&!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{if(!(await stat(file)).isFile())file=resolve(root,'index.html');}catch{if(extname(file)){res.writeHead(404);res.end();return;}file=resolve(root,'index.html');}
  const mime:any={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(method==='HEAD'?undefined:await readFile(file));
 }catch(error){console.error('Request failed:',error instanceof Error?error.message:'error');if(!res.headersSent)res.writeHead(500);res.end('Internal error');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log(`NetWatch listening on :${port}; dữ liệu: ${process.env.DATA_DIR||'/data'}`));
for(const signal of ['SIGTERM','SIGINT']as const)process.on(signal,()=>{server.close(()=>{sqlite.pragma('wal_checkpoint(TRUNCATE)');sqlite.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});
