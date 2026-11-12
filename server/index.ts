import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {db,sqlite} from './database';
import {requestContext} from '../lib/server';
import {authenticated,checkLogin,session,viewerInfo,viewerList,saveViewer,initializeViewers,VIEW_IDS} from './auth';
import {loginHTML,renderLogin} from './login-page';
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
initializeViewers(['main',...sqlite.prepare('SELECT id FROM projects').all().map((p:any)=>p.id)]);
const failures=new Map<string,{count:number,until:number}>();
function validOrigin(origin:string|undefined,url:URL,headers:Record<string,any>){if(!origin)return false;try{const actual=new URL(origin),forwardedHost=String(headers['x-forwarded-host']||'').split(',')[0].trim(),forwardedProto=String(headers['x-forwarded-proto']||'').split(',')[0].trim();return origin===url.origin||(process.env.NETWATCH_PUBLIC_URL&&origin===process.env.NETWATCH_PUBLIC_URL)||(!!forwardedHost&&actual.host.toLowerCase()===forwardedHost.toLowerCase()&&(!forwardedProto||actual.protocol===forwardedProto+':'));}catch{return false;}}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/',process.env.NETWATCH_PUBLIC_URL||'http://'+req.headers.host);
  const method=req.method||'GET',path=url.pathname;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
  if(path==='/healthz'&&method==='GET'){res.end('ok');return;}
  const publicBrandAssets:Record<string,{file:string;type:string}>={'/brand/logo-viet-phuong.png':{file:'brand/logo-viet-phuong.png',type:'image/png'},'/brand/network-scene.svg':{file:'brand/network-scene.svg',type:'image/svg+xml'}};
  if(publicBrandAssets[path]&&['GET','HEAD'].includes(method)){const asset=publicBrandAssets[path];res.setHeader('Content-Type',asset.type);res.setHeader('Cache-Control','public, max-age=86400');res.end(method==='HEAD'?undefined:await readFile(resolve(root,asset.file)));return;}
  const auth=authenticated(req.headers.cookie||'');
  const ingestRequest=path==='/api/ingest'&&method==='POST';
  if(!auth&&!ingestRequest&&path!=='/login'){
   if(path.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Đăng nhập tại /login"}');}
   else{res.writeHead(302,{Location:'/login'});res.end();}return;
  }
  // Viewer access is an explicit read allowlist; router ingest has separate bearer authentication.
  if(auth?.role==='viewer'&&path.startsWith('/api/')&&!ingestRequest&&!(method==='GET'&&['/api/dashboard','/api/projects','/api/session','/api/banner'].includes(path))){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Tài khoản chỉ xem không được thay đổi dữ liệu hoặc tải bộ cài router.'}));return;}
  if(auth?.role==='viewer'&&method==='GET'&&path==='/api/dashboard'&&!auth.projectIds?.includes(url.searchParams.get('project')||'main')){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Bạn không có quyền xem dự án này.'}));return;}
  if(auth?.role==='viewer'&&method==='GET'&&path==='/api/dashboard'&&!auth.viewIds?.includes(url.searchParams.get('view')||'overview')){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Bạn không có quyền xem mục này.'}));return;}
  let body:Buffer|undefined;
  if(!['GET','HEAD'].includes(method)){
   const chunks:Buffer[]=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   body=Buffer.concat(chunks);
  }
  if(path==='/login'){
   if(method==='POST'){
    if(!validOrigin(req.headers.origin,url,req.headers)){res.writeHead(403);res.end('Invalid origin');return;}
    const key=req.socket.remoteAddress||'local',now=Date.now(),f=failures.get(key);
    if(f&&f.until>now&&f.count>=5){res.writeHead(429);res.end('Chờ 5 phút rồi thử lại.');return;}
    const form=new URLSearchParams(body?.toString()),password=form.get('password')||'',username=form.get('username')||'';
    const role=password.length<=256&&username.length<=32?checkLogin(username,password):null;
    if(role){
     failures.delete(key);res.writeHead(303,{Location:'/', 'Set-Cookie':`netwatch=${session(role)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${(process.env.COOKIE_SECURE==='true'||process.env.NETWATCH_PUBLIC_URL?.startsWith('https:'))?'; Secure':''}`});res.end();return;
    }
    if(failures.size>2000)for(const [k,v] of failures)if(v.until<now)failures.delete(k);
    failures.set(key,{count:f&&f.until>now?f.count+1:1,until:now+300000});res.writeHead(401,{'Content-Type':'text/html; charset=utf-8'});res.end(renderLogin(true,username));return;
   }
   if(method!=='GET'){res.writeHead(405);res.end();return;}
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(loginHTML);return;
  }
  if(path==='/logout'){res.writeHead(303,{Location:'/login','Set-Cookie':'netwatch=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});res.end();return;}
  if(path.startsWith('/api/')){
   if(path==='/api/session'&&method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({role:auth?.role,username:auth?.username,...(auth?.role==='viewer'?{projectIds:auth.projectIds,viewIds:auth.viewIds}:{})}));return;}
   if(path==='/api/banner'){
    if(!auth){res.writeHead(401);res.end();return;}res.setHeader('Content-Type','application/json');
    if(method==='GET'){const row=sqlite.prepare("SELECT value FROM settings WHERE key='support-banner'").get() as any;res.end(row?.value||JSON.stringify({enabled:false,name:'',phone:'',message:'Gặp sự cố kỹ thuật? Vui lòng liên hệ kỹ thuật viên.',position:'top'}));return;}
    if(auth.role!=='owner'){res.writeHead(403);res.end();return;}if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!validOrigin(req.headers.origin,url,req.headers)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    try{const b=JSON.parse((body||Buffer.alloc(0)).toString());if(typeof b.enabled!=='boolean'||typeof b.name!=='string'||b.name.length>80||typeof b.phone!=='string'||b.phone.length>40||typeof b.message!=='string'||b.message.length>240||!['top','bottom'].includes(b.position))throw Error('Vui lòng kiểm tra nội dung banner, tên, số điện thoại và vị trí.');const value=JSON.stringify({enabled:b.enabled,name:b.name.trim(),phone:b.phone.trim(),message:b.message.trim(),position:b.position});sqlite.prepare("INSERT INTO settings(key,value) VALUES ('support-banner',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(value);res.end(value);}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e instanceof Error?e.message:'Không lưu được banner.'}));}return;
   }
   if(path==='/api/viewer'||path==='/api/viewers'){
    if(auth?.role!=='owner'){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type','application/json');
    if(method==='GET'){res.end(JSON.stringify(path==='/api/viewers'?{accounts:viewerList()}:viewerInfo()));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!validOrigin(req.headers.origin,url,req.headers)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    if(!body||body.length>16384){res.writeHead(413);res.end();return;}
    try{saveViewer(JSON.parse(body.toString()),['main',...sqlite.prepare('SELECT id FROM projects').all().map((p:any)=>p.id)],VIEW_IDS);res.end(JSON.stringify({accounts:viewerList()}));}catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Không lưu được tài khoản.'}));}return;
   }
   const handler=routes[path.slice(5)]?.[method];if(!handler){res.writeHead(404);res.end();return;}
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request(url,{method,headers,...(body?{body}: {})});
   const result:Response=await requestContext.run({authenticated:!!auth,role:auth?.role,projectIds:auth?.projectIds,viewIds:auth?.viewIds},()=>handler(request));
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
