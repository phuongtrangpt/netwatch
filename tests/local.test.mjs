import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from 'node:net';
test('local auth, pairing, SQLite batches, topology and restart persistence',async()=>{
 const data=mkdtempSync(join(tmpdir(),'netwatch-test-'));
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`;let child,output='';
 async function start(){child=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),NETWATCH_PASSWORD:'test-password-12345',NETWATCH_INGEST_URL:origin},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error(output);}
 async function stop(){child.kill('SIGTERM');await once(child,'exit');}
 try{
  await start();
  assert.equal((await fetch(origin+'/api/dashboard',{headers:{'oai-authenticated-user-id':'fake'}})).status,401);
  assert.equal((await fetch(origin+'/api/ingest',{method:'POST',body:'{}'})).status,401);
  let r=await fetch(origin+'/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:'password=test-password-12345',redirect:'manual'});assert.equal(r.status,303,output);const cookie=r.headers.get('set-cookie').split(';')[0];
  const headers={origin,cookie,'Content-Type':'application/json'};
  const api=(path,body,extra={})=>fetch(origin+path,{method:body?'POST':'GET',headers:{...headers,...extra},...(body?{body:JSON.stringify(body)}:{})});
  r=await api('/api/dashboard');assert.equal(r.status,200);assert.equal((await r.json()).paired,false);
  r=await api('/api/config',{wans:['ether1'],aliases:{ether1:'FPT'},manual:true},{origin:'https://wrong.test'});assert.equal(r.status,403);
  r=await api('/api/config',{wans:['ether1'],aliases:{ether1:'FPT'},manual:true});assert.equal(r.status,200);
  r=await api('/api/pair',{version:'7.21.5'});assert.equal(r.status,200);const script=await r.text();assert.ok(script.includes(origin+'/api/ingest'));assert.ok(!script.includes('OAI-Sites-Authorization'));
  const token=script.match(/Authorization: Bearer ([a-f0-9]{64})/)[1];
  r=await fetch(origin+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({schema:1,kind:'metrics',resource:{uptime:'1h','cpu-load':20},stats:[{name:'ether1',running:true,'rx-byte':1000,'tx-byte':1000}]})});assert.equal(r.status,200);
  r=await api('/api/topology',{revision:0,devices:[{id:'device-aaa',name:'WiFi Tầng 2',ip:'10.10.10.5',type:'ap',parentId:'router',enabled:true,pinned:true}],layoutMode:'manual',positions:{'device-aaa':{x:260,y:300}},wireWaypoints:{},wireAnchors:{}});assert.equal(r.status,200,await r.clone().text());
  r=await api('/api/topology',{revision:0,devices:[]});assert.equal(r.status,409);
  r=await api('/api/projects',{name:'Nhà trọ',model:'MikroTik',mode:'pppoe'});assert.equal(r.status,200);
  const persisted=JSON.parse(readFileSync(join(data,'auth.json'),'utf8'));assert.ok(!JSON.stringify(persisted).includes('test-password'));
  await stop();await start();
  r=await api('/api/dashboard');assert.equal(r.status,200);const state=await r.json();assert.equal(state.config.aliases.ether1,'FPT');assert.equal(state.topology.devices[0].name,'WiFi Tầng 2');assert.equal(state.topology.positions['device-aaa'].x,260);assert.equal(state.metrics.resource['cpu-load'],20);assert.equal(state.history.length,1);
  r=await api('/api/projects');assert.equal((await r.json()).projects.length,2);
  r=await fetch(origin+'/',{headers:{cookie}});assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('/assets/'));
  const assets=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(m=>m[1]);
  assert.ok(assets.some(p=>p.endsWith('.js')));assert.ok(assets.some(p=>p.endsWith('.css')));
  for(const asset of assets){const resource=await fetch(new URL(asset,origin),{headers:{cookie}});assert.equal(resource.status,200,asset);assert.match(resource.headers.get('content-type')||'',asset.endsWith('.js')?/javascript/:/text\/css/);assert.ok((await resource.text()).length>0);}
  // A reverse proxy changes the internal URL while the browser stays on one origin.
  r=await api('/api/projects',{name:'Dự án qua HTTPS proxy',model:'MikroTik',mode:'infrastructure'},{origin:'https://netwatch.example.test','sec-fetch-site':'same-origin'});assert.equal(r.status,200,await r.clone().text());const proxyProject=(await r.json()).project;
  r=await api('/api/projects',{id:proxyProject.id,name:'Đã sửa qua proxy',model:'RB4011',mode:'pppoe'},{origin:'https://netwatch.example.test','sec-fetch-site':'same-origin'});assert.equal(r.status,200);
  r=await api('/api/projects',{name:'Không được tạo',model:'MikroTik',mode:'infrastructure'},{origin:'https://foreign.example.test','sec-fetch-site':'cross-site'});assert.equal(r.status,403);
  r=await api('/api/config',{wans:['ether1'],aliases:{ether1:'FPT'},manual:true},{origin:'https://netwatch.example.test','sec-fetch-site':'same-origin'});assert.equal(r.status,200);
  const hundred=Array.from({length:100},(_,i)=>({id:'device-ip-'+i,name:'Thiết bị '+i,ip:'10.20.0.'+(i+1),type:'ap',parentId:'router',enabled:true,pinned:true}));
  const virtuals=Array.from({length:32},(_,i)=>({id:'device-virtual-'+i,name:'Switch ảo '+i,ip:'',type:'switch',parentId:'router',enabled:false,pinned:true,virtual:true}));
  const all=[...hundred,...virtuals],positions=Object.fromEntries(all.map((d,i)=>[d.id,{x:300,y:i*200}])),wireWaypoints=Object.fromEntries(all.map((d,i)=>['edge-'+d.id,[{x:200,y:i*200}]]));
  r=await api('/api/topology',{revision:1,devices:all,positions,wireWaypoints,wireAnchors:{}});assert.equal(r.status,200,await r.clone().text());
  r=await fetch(origin+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({schema:1,kind:'probes',results:hundred.map(d=>({id:d.id,ip:d.ip,sent:2,received:2}))})});assert.equal(r.status,200,await r.clone().text());
  r=await api('/api/dashboard');const large=await r.json();assert.equal(large.topology.devices.length,132);assert.equal(large.probes.results.length,100);
  r=await api('/api/topology',{revision:2,devices:[...all,{...hundred[0],id:'device-extra',ip:'10.20.0.101'}]});assert.equal(r.status,400);
  await stop();await start();r=await api('/api/dashboard');assert.equal((await r.json()).topology.devices.length,132);
 }finally{if(child&&child.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});}
});

test('cloud migration preserves manual graph/history and refuses overwriting',async()=>{
 const {default:Database}=await import('better-sqlite3');const {writeFileSync,readdirSync}=await import('node:fs');const {spawnSync}=await import('node:child_process');
 const data=mkdtempSync(join(tmpdir(),'netwatch-import-'));let db;
 try{
  db=new Database(join(data,'netwatch.db'));for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(join('drizzle',f),'utf8'));
  const topology={revision:4,devices:[{id:'device-main',name:'Switch Tầng 2',pinned:true,virtual:true,parentId:'router'}],positions:{'device-main':{x:100,y:200}},wireAnchors:{}};
  const input={format:'netwatch-cloud-export-v1',projects:[{id:'main',name:'Mạng chính',mode:'infrastructure',model:'RB5009'}],snapshots:[{project:{id:'main'},config:{wans:['ether1'],aliases:{ether1:'FPT'}},topology,history:[{at:60000,cpu:5,rates:{}}]}]};const file=join(data,'import.json');writeFileSync(file,JSON.stringify(input));
  const run=()=>spawnSync(process.execPath,['scripts/import-cloud.mjs',file],{env:{...process.env,DATA_DIR:data},encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='topology'").get().value),topology);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM history').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM router').get().n,0);
  assert.notEqual(run().status,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,1);
 }finally{db?.close();rmSync(data,{recursive:true,force:true});}
});

test('viewer reads all projects, cannot edit or obtain installers, survives restart and can be revoked',async()=>{
 const data=mkdtempSync(join(tmpdir(),'netwatch-viewer-'));const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;let child,output='';
 async function start(){child=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),NETWATCH_PASSWORD:'test-password-12345'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error(output);}
 async function stop(){child.kill('SIGTERM');await once(child,'exit');}
 async function login(username,password){const r=await fetch(origin+'/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}),redirect:'manual'});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 function api(path,cookie,body,extra={}){return fetch(origin+path,{method:body?'POST':'GET',headers:{origin,cookie:cookie||'','Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});}
 try{
  await start();assert.ok((await (await fetch(origin+'/login')).text()).includes('NetWatch v'+JSON.parse(readFileSync('package.json','utf8')).version));const admin=await login('admin','test-password-12345');assert.equal(admin.status,303,output);
  let proxyLogin=await fetch(origin+'/login',{method:'POST',headers:{origin:'https://netwatch.example.test','sec-fetch-site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:'test-password-12345'}),redirect:'manual'});
  assert.equal(proxyLogin.status,303,'Same-origin mobile form behind reverse proxy must be accepted');
  proxyLogin=await fetch(origin+'/login',{method:'POST',headers:{origin:'https://attacker.example.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:'test-password-12345'}),redirect:'manual'});
  assert.equal(proxyLogin.status,403,'Cross-origin login must be rejected');
  let r=await api('/api/viewer',admin.cookie);assert.deepEqual(await r.json(),[]);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'view',password:'viewer-password-123',permissions:{'*':['overview','topology']}});assert.equal(r.status,200);
  assert.equal((await login('admin','viewer-password-123')).status,401);
  const viewer=await login('view','viewer-password-123');assert.equal(viewer.status,303);
  r=await api('/api/session',viewer.cookie);const viewerSession=await r.json();assert.match(viewerSession.loginId,/^[a-f0-9]{24}$/);delete viewerSession.loginId;assert.deepEqual(viewerSession,{version:JSON.parse(readFileSync('package.json','utf8')).version,role:'viewer',username:'view',permissions:{'*':['overview','topology']}});
  r=await api('/api/projects',admin.cookie,{name:'Nhà trọ',model:'E50UG',mode:'pppoe'});const projects=await r.json();assert.equal(r.status,200);
  r=await api('/api/projects',viewer.cookie);assert.equal((await r.json()).projects.length,2);
  for(const project of projects.projects){r=await api('/api/dashboard?project='+project.id,viewer.cookie);assert.equal(r.status,200);}
  for(const path of ['/api/projects','/api/topology','/api/config','/api/pair','/api/viewer','/api/future-write-route']){r=await api(path,viewer.cookie,{enabled:false}, {'oai-authenticated-user-id':'owner','x-role':'owner'});assert.equal(r.status,403,path);}
  for(const path of ['/api/upgrade','/api/viewer'])assert.equal((await api(path,viewer.cookie)).status,403,path);
  const forged=viewer.cookie.replace('netwatch=','netwatch=x');assert.equal((await api('/api/dashboard',forged)).status,401);
  r=await api('/api/config',admin.cookie,{wans:['ether1'],aliases:{ether1:'FPT'},manual:true});assert.equal(r.status,200);
  r=await api('/api/topology',admin.cookie,{revision:0,devices:[{id:'device-'+ 'a'.repeat(32),name:'WiFi',ip:'10.10.10.5',type:'ap',enabled:true,pinned:true,parentId:'router'}],positions:{},wireWaypoints:{},wireAnchors:{}});assert.equal(r.status,200,await r.clone().text());
  r=await api('/api/dashboard?module=topology',viewer.cookie);assert.equal((await r.json()).topology.devices.length,1);
  r=await api('/api/dashboard?module=overview',viewer.cookie);assert.equal((await r.json()).topology.devices.length,0);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'view',password:'another-password-123',permissions:{'*':['overview','topology']}},{origin:'http://wrong.test'});assert.equal(r.status,403);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'view',password:'test-password-12345',permissions:{'*':['overview','topology']}});assert.equal(r.status,400);
  const stored=readFileSync(join(data,'viewers.json'),'utf8');assert.ok(!stored.includes('viewer-password-123'));assert.ok(!JSON.stringify(await (await api('/api/viewer',admin.cookie)).json()).includes('hash'));
  await stop();await start();assert.equal((await api('/api/dashboard',viewer.cookie)).status,200);assert.equal((await api('/api/session',admin.cookie)).status,200);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'view',password:'viewer-password-456',permissions:{'*':['overview','topology']}});assert.equal(r.status,200);assert.equal((await api('/api/dashboard',viewer.cookie)).status,401);
  assert.equal((await login('view','viewer-password-123')).status,401);
  const newViewer=await login('view','viewer-password-456');assert.equal(newViewer.status,303);
  r=await api('/api/viewer',admin.cookie,{enabled:false,username:'view',password:'',permissions:{'*':['overview','topology']}});assert.equal(r.status,200);assert.equal((await api('/api/dashboard',newViewer.cookie)).status,401);assert.equal((await login('view','viewer-password-456')).status,401);
  assert.equal((await api('/api/dashboard',admin.cookie)).status,200);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'tenant',password:'tenant-password-123',permissions:{main:['topology']}});assert.equal(r.status,200);
  const tenant=await login('tenant','tenant-password-123');assert.equal(tenant.status,303);
  r=await api('/api/projects',tenant.cookie);assert.deepEqual((await r.json()).projects.map(p=>p.id),['main']);
  assert.equal((await api('/api/dashboard?project=main&module=overview',tenant.cookie)).status,403);
  assert.equal((await api('/api/dashboard?project=main&module=topology',tenant.cookie)).status,200);
  assert.equal((await api('/api/dashboard?project='+projects.projects.find(p=>p.id!=='main').id+'&module=topology',tenant.cookie)).status,403);
  r=await api('/api/support',admin.cookie,{enabled:true,title:'Hỗ trợ kỹ thuật',message:'Gọi khi có sự cố',name:'Việt Phương',phone:'0963839369',facebook:'https://www.facebook.com/leviethoaiphuong/',position:'top',audience:'all'});assert.equal(r.status,200);
  assert.equal((await (await api('/api/support',tenant.cookie)).json()).phone,'0963839369');
  assert.equal((await api('/api/support',tenant.cookie,{enabled:false})).status,403);
 }finally{if(child&&child.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});}
});

test('WAN link/probe alerts reach each Telegram destination, failed groups retry after restart',async()=>{
 const {writeFileSync,appendFileSync,existsSync}=await import('node:fs');
 const {default:Database}=await import('better-sqlite3');
 const data=mkdtempSync(join(tmpdir(),'netwatch-wan-'));
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`,log=join(data,'sent.jsonl'),mock=join(data,'mock.mjs');let child,db,output='';
 writeFileSync(mock,`import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://api.telegram.org/bot')){const body=JSON.parse(options.body);appendFileSync(${JSON.stringify(log)},JSON.stringify(body)+'\\n');const marker=${JSON.stringify(join(data,'group-failed'))};if(body.chat_id==='-10099'&&!existsSync(marker)){writeFileSync(marker,'1');return new Response(JSON.stringify({ok:false}),{status:503});}return new Response(JSON.stringify({ok:true}),{status:200});}return original(url,options);};`);
 const messages=()=>existsSync(log)?readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
 async function start(){child=spawn(process.execPath,['--import',mock,'dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),NETWATCH_PASSWORD:'test-password-12345'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error(output);}
 async function stop(){child.kill('SIGTERM');await once(child,'exit');}
 try{
  await start();db=new Database(join(data,'netwatch.db'));
  const login=await fetch(origin+'/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:'password=test-password-12345',redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
  const api=(path,body)=>fetch(origin+path,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await api('/api/config',{wans:['ether1','ether2'],aliases:{ether1:'FPT',ether2:'VNPT'},manual:true})).status,200);
  assert.equal((await api('/api/telegram',{scope:'global',action:'save',ownerChatId:'12345',botToken:'12345:'+ 'a'.repeat(25),summaryEnabled:false,summaryTime:'08:00'})).status,200);
  assert.equal((await api('/api/telegram',{scope:'project',action:'save',enabled:true,chatId:'-10099'})).status,200);
  const paired=await api('/api/pair',{version:'7.20.4'});const token=(await paired.text()).match(/Authorization: Bearer ([a-f0-9]{64})/)[1];
  async function ingest(body){db.prepare('UPDATE router SET last_seen=? WHERE id=?').run(Date.now()-30000,'main');if(body.kind==='wan-probes'){const row=db.prepare("SELECT value FROM settings WHERE key='wan_probe_latest'").get();if(row){const value=JSON.parse(row.value);value.at=Date.now()-30000;value.results.forEach(x=>x.at=value.at);db.prepare("UPDATE settings SET value=? WHERE key='wan_probe_latest'").run(JSON.stringify(value));}}const r=await fetch(origin+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({schema:1,...body})});assert.equal(r.status,200,await r.text());}
  assert.equal((await api('/api/projects',{id:'main',name:'Trường Tam Thanh',model:'MikroTik',mode:'infrastructure'})).status,200);
  const metrics=(up,lan=true)=>({kind:'metrics',resource:{uptime:'1h','cpu-load':5},stats:[{name:'ether1',running:up},{name:'ether2',running:true},{name:'ether3',running:lan}]});
  await ingest(metrics(true));assert.equal(messages().length,0,'Initial sample is not a link change');
  await ingest(metrics(false));assert.equal(messages().length,2);assert.ok(messages().every(m=>m.text.includes('WAN FPT')&&m.text.includes('Link mất kết nối')));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'telegram_outbox:%'").get().n,1,'Only failed group delivery remains queued');
  assert.ok(db.prepare("SELECT message FROM events WHERE message LIKE 'Telegram chưa gửi được%' ").get());
  const queued=db.prepare("SELECT key,value FROM settings WHERE key LIKE 'telegram_outbox:%'").get();const item=JSON.parse(queued.value);item.nextAttemptAt=0;db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(item),queued.key);
  await stop();await start();for(let i=0;i<50&&messages().length<3;i++)await new Promise(r=>setTimeout(r,20));assert.equal(messages().length,3);assert.equal(messages()[2].chat_id,'-10099');
  for(let i=0;i<50&&db.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'telegram_outbox:%'").get().n;i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'telegram_outbox:%'").get().n,0);
  await ingest(metrics(false));assert.equal(messages().length,3,'No repeated Link down alert');
  await ingest(metrics(false,false));assert.equal(messages().length,3,'LAN events do not generate WAN alerts');
  await ingest(metrics(true,false));assert.equal(messages().length,5);assert.ok(messages().slice(-2).every(m=>m.text.includes('Link đã phục hồi')));
  const probes=received=>({kind:'wan-probes',results:[{interface:'ether1',sent:2,received},{interface:'ether2',sent:2,received:2}]});
  await ingest(probes(2));await ingest(probes(0));assert.equal(messages().length,5,'First ping failure must not send false recovery');
  await ingest(probes(0));assert.equal(messages().length,7);assert.ok(messages().slice(-2).every(m=>m.text.includes('mất kết nối Internet')));
  await ingest(probes(0));assert.equal(messages().length,7);
  await ingest(probes(2));assert.equal(messages().length,9);assert.ok(messages().slice(-2).every(m=>m.text.includes('Internet đã kết nối trở lại')));
  // Automatic WAN discovery also works for a single WAN, without enabling multi-WAN probes.
  await api('/api/config',{wans:[],aliases:{},manual:false});
  await ingest({kind:'section',section:'wanmembers',generation:'wan-test',part:0,final:true,rows:[{list:'WAN',interface:'ether1'}]});
  await ingest(metrics(false,false));assert.equal(messages().length,11);
  assert.equal((await api('/api/config',{wans:['ether1'],aliases:{ether1:'FPT'},manual:true,notifyRepeatMinutes:30})).status,200);
  await ingest(metrics(false,false));assert.equal(messages().length,11,'Enabling reminders starts the interval');
  const reminderRow=db.prepare("SELECT value FROM settings WHERE key='wan_reminder_state'").get();const reminders=JSON.parse(reminderRow.value);reminders.ether1.lastAlertAt=Date.now()-31*60000;db.prepare("UPDATE settings SET value=? WHERE key='wan_reminder_state'").run(JSON.stringify(reminders));
  await ingest(metrics(false,false));assert.equal(messages().length,13);assert.ok(messages().slice(-2).every(m=>m.text.includes('Nhắc lại mỗi 30 phút')&&m.text.includes('FPT')));
  await ingest(metrics(false,false));assert.equal(messages().length,13,'No duplicate reminder before next interval');
  assert.equal((await api('/api/config',{wans:['ether1'],aliases:{},manual:true})).status,200);
  assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='wan'").get().value).notifyRepeatMinutes,30,'Older clients preserve the setting');
  assert.equal((await api('/api/config',{wans:['ether1'],aliases:{},manual:true,notifyRepeatMinutes:1})).status,400);
  assert.equal((await api('/api/config',{wans:['ether1'],aliases:{},manual:true,notifyRepeatMinutes:0})).status,200);
  await ingest(metrics(false,false));assert.equal(messages().length,13);
  await ingest(metrics(true,false));assert.equal(messages().length,15);
  assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='wan_reminder_state'").get().value),{});
  assert.ok(messages().every(m=>m.text.includes('NetWatch · Dự án: Trường Tam Thanh')),'Every WAN loss/recovery/reminder and retried group delivery includes the project name');

 }finally{if(child&&child.exitCode===null)await stop();db?.close();rmSync(data,{recursive:true,force:true});}
});

test('additional administrators, password revocation, legacy sessions and update authorization',async()=>{
 const {writeFileSync}=await import('node:fs');const {createHmac}=await import('node:crypto');
 const data=mkdtempSync(join(tmpdir(),'netwatch-admins-')),mock=join(data,'release-mock.mjs');
 writeFileSync(mock,`const original=globalThis.fetch;globalThis.fetch=async(url,options)=>String(url)==='https://api.github.com/repos/phuongtrangpt/netwatch/releases/latest'?new Response(JSON.stringify({tag_name:'v9.0.0',draft:false,prerelease:false,body:'New release',assets:[]}),{status:200}):original(url,options);`);
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;let child,output='';
 const rootPassword='test-password-12345',adminPassword='tech-password-12345',adminNew='tech-password-new-12345',rootNew='root-password-new-12345';
 async function start(){child=spawn(process.execPath,['--import',mock,'dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),NETWATCH_PASSWORD:rootPassword},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error(output);}
 async function stop(){child.kill('SIGTERM');await once(child,'exit');}
 async function login(username,password){const r=await fetch(origin+'/login',{method:'POST',redirect:'manual',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password})});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
 const api=(path,cookie,body,extra={})=>fetch(origin+path,{method:body?'POST':'GET',headers:{origin,cookie,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await start();const root=await login('admin',rootPassword);assert.equal(root.status,303);
  const before=JSON.parse(readFileSync(join(data,'auth.json'),'utf8')),legacyPayload=`owner.${Date.now()+86400000}.${'a'.repeat(32)}`,legacy='netwatch='+legacyPayload+'.'+createHmac('sha256',before.key).update(legacyPayload).digest('hex');
  assert.equal((await api('/api/session',legacy)).status,200,'Existing default-admin sessions remain valid until password change');
  assert.equal((await api('/api/admins','')).status,401);
  let r=await api('/api/admins',root.cookie,{action:'save',username:'tech.one',enabled:true,password:adminPassword,currentPassword:'wrong'});assert.equal(r.status,400);
  r=await api('/api/admins',root.cookie,{action:'save',username:'tech.one',enabled:true,password:adminPassword,currentPassword:rootPassword},{origin:'http://wrong.test'});assert.equal(r.status,403);
  r=await api('/api/admins',root.cookie,{action:'save',username:'tech.one',enabled:true,password:adminPassword,currentPassword:rootPassword});assert.equal(r.status,200);const listed=await r.json();assert.deepEqual(listed.map(a=>a.username),['admin','tech.one']);assert.ok(!JSON.stringify(listed).includes('hash'));
  const tech=await login('tech.one',adminPassword);assert.equal(tech.status,303);r=await api('/api/session',tech.cookie);const session=await r.json();assert.equal(session.role,'owner');assert.equal(session.username,'tech.one');assert.equal(session.permissions,null);assert.match(session.loginId,/^[a-f0-9]{24}$/);
  assert.equal((await api('/api/config',tech.cookie,{manual:true,wans:['ether1'],aliases:{ether1:'FPT'}})).status,200);
  assert.equal((await api('/api/viewer',tech.cookie,{enabled:true,username:'view.one',password:'viewer-password-12345',permissions:{'*':['overview']}})).status,200);
  assert.equal((await api('/api/viewer',tech.cookie,{enabled:true,username:'tech.one',password:'viewer-password-12345',permissions:{'*':['overview']}})).status,400);
  const viewer=await login('view.one','viewer-password-12345');assert.equal(viewer.status,303);
  for(const path of ['/api/admins','/api/password','/api/system'])assert.equal((await api(path,viewer.cookie,{action:'install',version:'9.0.0',currentPassword:adminPassword,newPassword:adminNew})).status,403,path);
  const info=await (await api('/api/system',tech.cookie)).json();assert.equal(info.available,true);assert.equal(info.latestVersion,'9.0.0');assert.equal(info.canInstall,false);assert.ok(!JSON.stringify(info).includes('token'));
  assert.equal((await api('/api/system',tech.cookie,{action:'install',version:'9.0.0'},{origin:'http://wrong.test'})).status,403);
  assert.equal((await api('/api/system',tech.cookie,{action:'install',version:'9.0.0'})).status,400,'Docker must not overwrite its runtime files');
  assert.equal((await api('/api/admins',tech.cookie,{action:'delete',username:'tech.one',currentPassword:adminPassword})).status,400);
  assert.equal((await api('/api/admins',tech.cookie,{action:'delete',username:'admin',currentPassword:adminPassword})).status,400);
  assert.equal((await api('/api/password',tech.cookie,{currentPassword:'wrong',newPassword:adminNew})).status,400);
  assert.equal((await api('/api/password',tech.cookie,{currentPassword:adminPassword,newPassword:adminNew})).status,200);
  assert.equal((await api('/api/session',tech.cookie)).status,401);assert.equal((await login('tech.one',adminPassword)).status,401);
  const tech2=await login('tech.one',adminNew);assert.equal(tech2.status,303);
  assert.equal((await api('/api/telegram',root.cookie,{scope:'global',action:'save',ownerChatId:'12345',botToken:'12345:'+ 'a'.repeat(25),summaryEnabled:false,summaryTime:'08:00'})).status,200);
  assert.equal((await api('/api/password',root.cookie,{currentPassword:rootPassword,newPassword:rootNew})).status,200);
  assert.equal((await api('/api/session',root.cookie)).status,401);assert.equal((await api('/api/session',legacy)).status,401);assert.equal((await api('/api/session',tech2.cookie)).status,200);
  const after=JSON.parse(readFileSync(join(data,'auth.json'),'utf8'));assert.equal(after.key,before.key,'Changing password preserves secret encryption key');assert.notEqual(after.hash,before.hash);
  const root2=await login('admin',rootNew);assert.equal(root2.status,303);assert.equal((await (await api('/api/telegram?scope=global',root2.cookie)).json()).tokenConfigured,true);
  assert.equal((await api('/api/admins',root2.cookie,{action:'save',username:'tech.one',enabled:false,password:'',currentPassword:rootNew})).status,200);assert.equal((await api('/api/session',tech2.cookie)).status,401);
  await stop();await start();assert.equal((await login('admin',rootNew)).status,303);assert.equal((await login('tech.one',adminNew)).status,401);
  assert.ok(!readFileSync(join(data,'admins.json'),'utf8').includes(adminPassword));assert.ok(!readFileSync(join(data,'auth.json'),'utf8').includes(rootNew));
 }finally{if(child&&child.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});}
});
