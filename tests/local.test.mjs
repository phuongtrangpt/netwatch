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
  let r=await fetch(origin+'/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:'password=test-password-12345',redirect:'manual'});assert.equal(r.status,303);const cookie=r.headers.get('set-cookie').split(';')[0];
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
  r=await api('/api/projects',{name:'Nhà trọ',model:'E50UG',mode:'pppoe'});assert.equal(r.status,200);
  const persisted=JSON.parse(readFileSync(join(data,'auth.json'),'utf8'));assert.ok(!JSON.stringify(persisted).includes('test-password'));
  await stop();await start();
  r=await api('/api/dashboard');assert.equal(r.status,200);const state=await r.json();assert.equal(state.config.aliases.ether1,'FPT');assert.equal(state.topology.devices[0].name,'WiFi Tầng 2');assert.equal(state.topology.positions['device-aaa'].x,260);assert.equal(state.metrics.resource['cpu-load'],20);assert.equal(state.history.length,1);
  r=await api('/api/projects');assert.equal((await r.json()).projects.length,2);
  r=await fetch(origin+'/',{headers:{cookie}});assert.equal(r.status,200);assert.ok((await r.text()).includes('/assets/'));
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
  await start();const admin=await login('admin','test-password-12345');assert.equal(admin.status,303);
  let r=await api('/api/viewer',admin.cookie);assert.deepEqual(await r.json(),[]);
  r=await api('/api/viewer',admin.cookie,{enabled:true,username:'view',password:'viewer-password-123',permissions:{'*':['overview','topology']}});assert.equal(r.status,200);
  assert.equal((await login('admin','viewer-password-123')).status,401);
  const viewer=await login('view','viewer-password-123');assert.equal(viewer.status,303);
  r=await api('/api/session',viewer.cookie);assert.deepEqual(await r.json(),{role:'viewer',username:'view',permissions:{'*':['overview','topology']}});
  r=await api('/api/projects',admin.cookie,{name:'Nhà trọ',model:'E50UG',mode:'pppoe'});const projects=await r.json();assert.equal(r.status,200);
  r=await api('/api/projects',viewer.cookie);assert.equal((await r.json()).projects.length,2);
  for(const project of projects.projects){r=await api('/api/dashboard?project='+project.id,viewer.cookie);assert.equal(r.status,200);}
  for(const path of ['/api/projects','/api/topology','/api/config','/api/pair','/api/viewer','/api/future-write-route']){r=await api(path,viewer.cookie,{enabled:false}, {'oai-authenticated-user-id':'owner','x-role':'owner'});assert.equal(r.status,403,path);}
  for(const path of ['/api/upgrade','/api/viewer'])assert.equal((await api(path,viewer.cookie)).status,403,path);
  const forged=viewer.cookie.replace(/viewer:[a-f0-9]+/,'owner');assert.equal((await api('/api/dashboard',forged)).status,401);
  r=await api('/api/config',admin.cookie,{wans:['ether1'],aliases:{ether1:'FPT'},manual:true});assert.equal(r.status,200);
  r=await api('/api/topology',admin.cookie,{revision:0,devices:[{id:'device-'+ 'a'.repeat(32),name:'WiFi',ip:'10.10.10.5',type:'ap',enabled:true,pinned:true,parentId:'router'}],positions:{},wireWaypoints:{},wireAnchors:{}});assert.equal(r.status,200,await r.clone().text());
  r=await api('/api/dashboard',viewer.cookie);assert.equal((await r.json()).topology.devices.length,1);
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
