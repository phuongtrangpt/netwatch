import {createHash} from 'node:crypto';
import {systemInfo,beginUpdate} from './updates';
import {APP_VERSION} from './version';
import {createServer} from 'node:http';
import {getSupport,saveSupport} from './support';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {db,sqlite} from './database';
import {requestContext} from '../lib/server';
import {authenticated,checkLogin,session,loginHTML,accountName,isAdmin,adminInfo,saveAdmin,removeAdmin,changeOwnPassword,viewerInfo,saveViewer,removeViewer,canView,projectAccess,visiblePermissions} from './auth';
import * as dashboard from '../app/api/dashboard/route';
import * as projects from '../app/api/projects/route';
import * as config from '../app/api/config/route';
import * as topology from '../app/api/topology/route';
import * as pair from '../app/api/pair/route';
import * as upgrade from '../app/api/upgrade/route';
import * as ingest from '../app/api/ingest/route';
import * as telegram from '../app/api/telegram/route';
import * as profile from '../app/api/profile/route';
import {sendTelegram,retryTelegramAlerts} from './telegram';
import {sendScheduledTelegramSummary} from './telegram-summary';
import {scopedKey} from '../lib/projects';
const routes:any={dashboard,projects,config,topology,pair,upgrade,ingest,telegram,profile};
const root=resolve('dist/public'),port=Number(process.env.PORT||8080);
for(const name of ['NETWATCH_INGEST_URL','NETWATCH_PUBLIC_URL'])if(process.env[name]){const u=new URL(process.env[name]!);if(!['http:','https:'].includes(u.protocol)||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error(name+' phải là URL gốc http(s)://HOST:PORT, không có đường dẫn hay thông tin đăng nhập.');process.env[name]=u.origin;}
const browserOrigin=(req:any,url:URL)=>{
 const origin=req.headers.origin;if(typeof origin!=='string')return false;
 // Fetch Metadata is set by modern browsers and survives HTTPS reverse proxies.
 // A same-origin browser request is safe even when a proxy rewrites Host internally.
 if(req.headers['sec-fetch-site']==='same-origin')return /^https?:\/\//.test(origin);
 const allowed=new Set<string>();
 if(process.env.NETWATCH_PUBLIC_URL)allowed.add(new URL(process.env.NETWATCH_PUBLIC_URL).origin);
 for(const item of (process.env.NETWATCH_ALLOWED_ORIGINS||'').split(',')){if(item.trim())try{allowed.add(new URL(item.trim()).origin);}catch{}}
 const host=req.headers.host;if(typeof host==='string')try{allowed.add(new URL((req.socket.encrypted?'https://':'http://')+host).origin);}catch{}
 if(process.env.NETWATCH_TRUST_PROXY==='true'){
  const forwarded=(req.headers['x-forwarded-host']||'').split(',')[0]?.trim();
  const proto=(req.headers['x-forwarded-proto']||'').split(',')[0]?.trim();
  if(forwarded&&['https','http'].includes(proto))try{allowed.add(new URL(proto+'://'+forwarded).origin);}catch{}
 }
 return allowed.has(origin);
};
const failures=new Map<string,{count:number,until:number}>();
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||'/',process.env.NETWATCH_PUBLIC_URL||'http://'+req.headers.host);
  const method=req.method||'GET',path=url.pathname;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
  if(path==='/healthz'&&method==='GET'){res.setHeader('X-NetWatch-Version',APP_VERSION);res.end('ok');return;}
  const auth=authenticated(req.headers.cookie||'');
  const viewer=!!auth&&auth.startsWith('viewer:');
  const ingestRequest=path==='/api/ingest'&&method==='POST';
  if(!auth&&!ingestRequest&&path!=='/login'){
   if(path.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Đăng nhập tại /login"}');}
   else{res.writeHead(302,{Location:'/login'});res.end();}return;
  }
  // Viewer access is an explicit read allowlist; router ingest has separate bearer authentication.
  if(viewer&&path.startsWith('/api/')&&!ingestRequest&&!(method==='GET'&&['/api/dashboard','/api/projects','/api/session','/api/support','/api/system'].includes(path))){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Tài khoản chỉ xem không được thay đổi dữ liệu hoặc tải bộ cài router.'}));return;}
  let body:Buffer|undefined;
  if(!['GET','HEAD'].includes(method)){
   const chunks:Buffer[]=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   body=Buffer.concat(chunks);
  }
  if(path==='/login'){
   if(method==='POST'){
    if(!browserOrigin(req,url)){res.writeHead(403);res.end('Invalid origin');return;}
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
   if(path==='/api/session'&&method==='GET'){let displayName=auth?accountName(auth):null;if(auth==='owner'){try{const row:any=sqlite.prepare("SELECT value FROM settings WHERE key='admin_profile'").get();const value=row?JSON.parse(row.value):null;displayName=typeof value?.displayName==='string'&&value.displayName.trim()?value.displayName.trim():'Quản trị viên';}catch{displayName='Quản trị viên';}}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:APP_VERSION,loginId:createHash('sha256').update(/(?:^|;\s*)netwatch=([^;]+)/.exec(req.headers.cookie||'')?.[1]||'').digest('hex').slice(0,24),role:viewer?'viewer':'owner',username:auth?accountName(auth):null,...(isAdmin(auth)?{displayName}:{}),permissions:visiblePermissions(auth)}));return;}
   if(path==='/api/system'){
    res.setHeader('Content-Type','application/json');
    if(method==='GET'){res.end(JSON.stringify(await systemInfo()));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!isAdmin(auth)){res.writeHead(403);res.end(JSON.stringify({error:'Chỉ quản trị viên được cập nhật.'}));return;}
    if(!browserOrigin(req,url)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    try{const input=JSON.parse(body?.toString()||'{}');if(input.action!=='install')throw Error('Thao tác không hợp lệ.');const result=await beginUpdate(input.version,shutdown);res.writeHead(202);res.end(JSON.stringify(result));}
    catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Không bắt đầu được cập nhật.'}));}return;
   }
   if(path==='/api/admins'||path==='/api/password'){
    res.setHeader('Content-Type','application/json');
    if(!isAdmin(auth)){res.writeHead(403);res.end(JSON.stringify({error:'Chỉ tài khoản quản trị được sử dụng chức năng này.'}));return;}
    if(path==='/api/admins'&&method==='GET'){res.end(JSON.stringify(adminInfo()));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!browserOrigin(req,url)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    try{
     const input=JSON.parse(body?.toString()||'{}');
     if(path==='/api/password'){changeOwnPassword(auth!,input.currentPassword,input.newPassword);res.end(JSON.stringify({ok:true,reauthenticate:true}));return;}
     if(!['save','delete'].includes(input.action))throw Error('Thao tác không hợp lệ.');
     const value=input.action==='delete'?removeAdmin(auth!,input.username,input.currentPassword):saveAdmin(auth!,input);res.end(JSON.stringify(value));
    }catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Không cập nhật được tài khoản.'}));}return;
   }
   if(path==='/api/support'){
    res.setHeader('Content-Type','application/json');
    if(method==='GET'){const value=getSupport();res.end(JSON.stringify(value));return;}
    if(!isAdmin(auth)){res.writeHead(403);res.end(JSON.stringify({error:'Chỉ Admin được thay đổi banner.'}));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!browserOrigin(req,url)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    try{res.end(JSON.stringify(saveSupport(JSON.parse((body||Buffer.alloc(0)).toString()))));}
    catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Cấu hình không hợp lệ'}));}return;
   }
   if(path==='/api/viewer'){
    if(!isAdmin(auth)){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type','application/json');
    if(method==='GET'){res.end(JSON.stringify(viewerInfo()));return;}
    if(method==='DELETE'){if(!browserOrigin(req,url)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}res.end(JSON.stringify(removeViewer(url.searchParams.get('username')||'')));return;}
    if(method!=='POST'){res.writeHead(405);res.end();return;}
    if(!browserOrigin(req,url)){res.writeHead(403);res.end(JSON.stringify({error:'Invalid origin'}));return;}
    if(!body||body.length>4096){res.writeHead(413);res.end();return;}
    try{res.end(JSON.stringify(saveViewer(JSON.parse(body.toString()))));}catch(error){res.writeHead(400);res.end(JSON.stringify({error:error instanceof Error?error.message:'Không lưu được tài khoản.'}));}return;
   }
   if(viewer&&['/api/projects','/api/dashboard'].includes(path)&&method==='GET'&&path==='/api/dashboard'){
    const id=url.searchParams.get('project')||'main',module=url.searchParams.get('module')||'overview';
    if(!projectAccess(auth,id)||!['overview','topology','wan','lan','clients','ports','routes','pppoe','events'].includes(module)||!canView(auth,id,module as any)){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Bạn không được cấp quyền xem mục này.'}));return;}
   }
   if(!browserOrigin(req,url)&&!['GET','HEAD'].includes(method)&&!ingestRequest){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Invalid origin'}));return;}
   const handler=routes[path.slice(5)]?.[method];if(!handler){res.writeHead(404);res.end();return;}
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request(url,{method,headers,...(body?{body}: {})});
   const result:Response=await requestContext.run({authenticated:!!auth,role:viewer?'viewer':'owner',originValidated:browserOrigin(req,url)},()=>handler(request));
   let payload=Buffer.from(await result.arrayBuffer());
   if(viewer&&method==='GET'&&result.ok&&path==='/api/projects'){
    const data=JSON.parse(payload.toString());data.projects=data.projects.filter((p:any)=>projectAccess(auth,p.id));payload=Buffer.from(JSON.stringify(data));
   }
   if(viewer&&method==='GET'&&result.ok&&path==='/api/dashboard'){
    const module=url.searchParams.get('module')||'overview',data=JSON.parse(payload.toString());
    const sectionsByModule:any={overview:['interfaces','addresses','pppoe','dhcpclients'],topology:[],wan:['interfaces','addresses','pppoe','dhcpclients','routes'],lan:['interfaces','bridges','vlans','bridgeports','addresses'],clients:['leases','arp','pppoe','interfaces'],ports:['interfaces'],routes:['routes'],pppoe:['pppoe','pppoeactive','pppoesecrets','interfaces'],events:[]};
    data.sections=Object.fromEntries(Object.entries(data.sections||{}).filter(([key])=>(sectionsByModule[module]||[]).includes(key)));
    if(module!=='events'&&module!=='overview')data.events=[];
    if(module!=='overview'&&module!=='wan')data.history=[];
    if(module!=='topology')data.topology={devices:[]};
    if(module!=='clients'&&module!=='overview')data.clients=[];
    if(module!=='topology'&&module!=='overview')data.discovered=[];
    if(module!=='wan')data.wanChecks={results:[]};
    if(module==='events')data.sections={};
    if(module==='topology'){data.sections={};data.clients=[];data.history=[];data.events=[];data.discovered=[];data.rates={};data.config={};}
    if(module==='events'){data.metrics=null;data.rates={};data.config={};data.wanNames=[];data.clients=[];data.discovered=[];data.probes={};}
    if(module==='routes'){data.clients=[];data.discovered=[];data.probes={};}
    payload=Buffer.from(JSON.stringify(data));
   }
   res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(payload);return;
  }
  if(!['GET','HEAD'].includes(method)){res.writeHead(405);res.end();return;}
  let file=resolve(root,'.'+decodeURIComponent(path));
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{if(!(await stat(file)).isFile())file=resolve(root,'index.html');}catch{if(extname(file)){res.writeHead(404);res.end();return;}file=resolve(root,'index.html');}
  const mime:any={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(method==='HEAD'?undefined:await readFile(file));
 }catch(error){console.error('Request failed:',error instanceof Error?error.message:'error');if(!res.headersSent)res.writeHead(500);res.end('Internal error');}
});
void retryTelegramAlerts(db).catch(error=>console.error('NetWatch Telegram retry:',error instanceof Error?error.message:'error'));
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,'0.0.0.0',()=>console.log(`NetWatch listening on :${port}; dữ liệu: ${process.env.DATA_DIR||'/data'}`));
const checkRouterHeartbeat=()=>{try{const now=Date.now(),routers=sqlite.prepare('SELECT r.id,r.last_seen,p.name FROM router r LEFT JOIN projects p ON p.id=r.id WHERE r.last_seen IS NOT NULL').all() as any[];for(const r of routers){const key=scopedKey(r.id,'router_alert_state'),row=sqlite.prepare('SELECT value FROM settings WHERE key=?').get(key) as any,offline=now-r.last_seen>180000,online=!offline,previous=row?JSON.parse(row.value):null;if(previous&&previous.online===online)continue;sqlite.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify({online,at:now}));if(row||offline){const label=r.name||'Mạng chính';const message=offline?`Router không gửi dữ liệu trong hơn 3 phút: ${label}`:`Router đã gửi dữ liệu trở lại: ${label}`;sqlite.prepare('INSERT INTO events(id,at,level,message,project_id) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),now,offline?'warning':'info',message,r.id);void sendTelegram(db,r.id,`${offline?'🔴':'🟢'} NetWatch · ${label}\n${message}`);}}}catch(error){console.error('NetWatch heartbeat monitor:',error instanceof Error?error.message:'error');}};
const heartbeatTimer=setInterval(()=>{checkRouterHeartbeat();void retryTelegramAlerts(db).catch(error=>console.error('NetWatch Telegram retry:',error instanceof Error?error.message:'error'));},30000);heartbeatTimer.unref();
const summaryTimer=setInterval(()=>{void sendScheduledTelegramSummary().catch(error=>console.error('NetWatch Telegram summary:',error instanceof Error?error.message:'error'));},30000);summaryTimer.unref();
function shutdown(){clearInterval(heartbeatTimer);clearInterval(summaryTimer);server.close(()=>{sqlite.pragma('wal_checkpoint(TRUNCATE)');sqlite.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
for(const signal of ['SIGTERM','SIGINT']as const)process.on(signal,shutdown);
