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
  const loginPage=await fetch(origin+'/login');assert.equal(loginPage.status,200);assert.ok((await loginPage.text()).includes('Trang được sử dụng miễn phí'));
  for(const [asset,mime] of [['/brand/logo-viet-phuong.png','image/png'],['/brand/network-scene.svg','image/svg+xml']]){const response=await fetch(origin+asset);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),mime);}
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

async function viewerHarness(){
 const data=mkdtempSync(join(tmpdir(),'netwatch-accounts-')),probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;let child,output='';
 async function start(){child=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),NETWATCH_PASSWORD:'test-password-12345'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error(output);}
 async function stop(){if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}}
 async function login(username='admin',password='test-password-12345'){const r=await fetch(origin+'/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}),redirect:'manual'});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 function api(path,cookie,body,extra={}){return fetch(origin+path,{method:body?'POST':'GET',headers:{origin,cookie:cookie||'','Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});}
 async function dispose(){await stop();rmSync(data,{recursive:true,force:true});}
 return {data,origin,start,stop,login,api,dispose};
}
test('multiple viewers are isolated by assigned project and cannot mutate or elevate permissions',async()=>{
 const h=await viewerHarness();try{
  await h.start();const proxied=await fetch(h.origin+'/login',{method:'POST',headers:{origin:'https://netwatch.example','x-forwarded-host':'netwatch.example','x-forwarded-proto':'https','Content-Type':'application/x-www-form-urlencoded'},body:'username=admin&password=test-password-12345',redirect:'manual'});assert.equal(proxied.status,303,'login accepts the browser origin reported by the trusted reverse proxy');const admin=await h.login();assert.equal(admin.status,303);const ac=admin.cookie;
  const project=async name=>{const r=await h.api('/api/projects',ac,{name,model:'E50UG',mode:'pppoe'});assert.equal(r.status,200);return (await r.json()).project.id;};
  const a=await project('Nhà trọ A'),b=await project('Nhà trọ B');
  const create=async(username,projectIds,password,viewIds)=>{const r=await h.api('/api/viewers',ac,{username,projectIds,password,enabled:true,...(viewIds?{viewIds}:{})});assert.equal(r.status,200,await r.clone().text());return (await r.json()).accounts.find(v=>v.username===username);};
  const va=await create('owner_a',[a],'viewer-a-password-123',['overview','topology']),vb=await create('owner_b',[b],'viewer-b-password-123');await create('manager',[a,b],'shared-password-123');
  const la=await h.login('owner_a','viewer-a-password-123'),lb=await h.login('owner_b','viewer-b-password-123'),lm=await h.login('manager','shared-password-123');assert.equal(la.status,303);assert.equal(lb.status,303);assert.equal(lm.status,303);
  assert.deepEqual(await (await h.api('/api/session',la.cookie)).json(),{role:'viewer',username:'owner_a',projectIds:[a],viewIds:['overview','topology']});
  for(const [cookie,ids]of [[la.cookie,[a]],[lb.cookie,[b]],[lm.cookie,[a,b]]]){const r=await h.api('/api/projects',cookie);assert.deepEqual((await r.json()).projects.map(p=>p.id).sort(),ids.sort());}
  assert.equal((await h.api('/api/dashboard?project='+a,la.cookie)).status,200);assert.equal((await h.api('/api/dashboard?project='+a+'&view=wan',la.cookie)).status,403);const scoped=await (await h.api('/api/dashboard?project='+a+'&view=overview',la.cookie)).json();assert.equal(scoped.sections.pppoe,undefined);assert.equal((await h.api('/api/dashboard?project='+b,la.cookie)).status,403);assert.equal((await h.api('/api/dashboard',la.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project=main&project='+a,la.cookie)).status,403);
  assert.equal((await h.api('/api/dashboard?project='+b,lb.cookie)).status,200);assert.equal((await h.api('/api/dashboard?project='+a,lb.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project='+b,lm.cookie)).status,200);
  for(const path of ['/api/projects','/api/topology','/api/config','/api/pair','/api/viewer','/api/viewers','/api/future-write-route'])assert.equal((await h.api(path+'?project='+a,la.cookie,{enabled:false},{'x-role':'owner','oai-authenticated-user-id':'owner'})).status,403,path);
  for(const path of ['/api/upgrade','/api/viewer','/api/viewers'])assert.equal((await h.api(path,la.cookie)).status,403,path);
  const forged=la.cookie.replace(/^netwatch=viewer:[^.]+/,'netwatch=owner');assert.equal((await h.api('/api/dashboard',forged)).status,401);
  let r=await h.api('/api/topology?project='+a,ac,{revision:0,devices:[{id:'device-a',name:'WiFi riêng A',ip:'10.20.1.5',type:'ap',parentId:'router',enabled:true,pinned:true}],positions:{},wireWaypoints:{},wireAnchors:{}});assert.equal(r.status,200,await r.clone().text());
  r=await h.api('/api/dashboard?project='+a,la.cookie);assert.equal((await r.json()).topology.devices[0].name,'WiFi riêng A');
  for(const bad of [{username:'OWNER_A',projectIds:[a],password:'another-password-123',enabled:true},{username:'empty',projectIds:[],password:'another-password-123',enabled:true},{username:'invalid',projectIds:['net-'+ 'f'.repeat(32)],password:'another-password-123',enabled:true},{username:'same',projectIds:[a],password:'test-password-12345',enabled:true}])assert.equal((await h.api('/api/viewers',ac,bad)).status,400);
  assert.equal((await h.api('/api/viewers',ac,{...va,password:'',projectIds:[b]},{origin:'http://wrong.test'})).status,403);
  r=await h.api('/api/viewers',ac,{...va,password:'',projectIds:[b]});assert.equal(r.status,200);assert.equal((await h.api('/api/projects',la.cookie)).status,401);
  const moved=await h.login('owner_a','viewer-a-password-123');assert.equal(moved.status,303);assert.equal((await h.api('/api/dashboard?project='+a,moved.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project='+b,moved.cookie)).status,200);assert.equal((await h.api('/api/dashboard?project='+b,lb.cookie)).status,200);
  const c=await project('Nhà trọ C');assert.equal((await h.api('/api/dashboard?project='+c,moved.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project='+c,lm.cookie)).status,403);
  await h.stop();await h.start();assert.equal((await h.api('/api/dashboard?project='+b,moved.cookie)).status,200);assert.equal((await h.api('/api/dashboard?project='+c,moved.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project='+b,lb.cookie)).status,200);
  r=await h.api('/api/viewers',ac,{...va,projectIds:[b],password:'viewer-a-password-456'});assert.equal(r.status,200);assert.equal((await h.api('/api/projects',moved.cookie)).status,401);assert.equal((await h.login('owner_a','viewer-a-password-123')).status,401);const changed=await h.login('owner_a','viewer-a-password-456');assert.equal(changed.status,303);
  r=await h.api('/api/viewers',ac,{...vb,password:'',enabled:false});assert.equal(r.status,200);assert.equal((await h.api('/api/projects',lb.cookie)).status,401);assert.equal((await h.login('owner_b','viewer-b-password-123')).status,401);assert.equal((await h.api('/api/dashboard?project='+b,lm.cookie)).status,200);
  r=await h.api('/api/viewers',ac,{id:va.id,action:'delete'});assert.equal(r.status,200);assert.equal((await h.api('/api/projects',changed.cookie)).status,401);assert.equal((await h.api('/api/projects',ac)).status,200);
  const result=await (await h.api('/api/viewers',ac)).json();assert.ok(!JSON.stringify(result).includes('hash'));assert.ok(!JSON.stringify(result).includes('revision'));assert.equal(result.accounts.length,2);
  const stored=readFileSync(join(h.data,'viewer.json'),'utf8');for(const password of ['viewer-a-password-123','viewer-b-password-123','shared-password-123','viewer-a-password-456'])assert.ok(!stored.includes(password));assert.equal(JSON.parse(stored).schemaVersion,2);
  assert.equal((await (await h.api('/api/projects',ac)).json()).projects.length,4);assert.equal((await (await h.api('/api/dashboard?project='+a,ac)).json()).topology.devices[0].name,'WiFi riêng A');
 }finally{await h.dispose();}
});
test('legacy viewer is migrated to a current-project snapshot without granting future projects',async()=>{
 const {writeFileSync}=await import('node:fs'),{scryptSync,createHmac}=await import('node:crypto');const h=await viewerHarness();try{
  await h.start();const admin=await h.login();let r=await h.api('/api/projects',admin.cookie,{name:'Existing project',model:'E50UG',mode:'pppoe'});const a=(await r.json()).project.id;await h.stop();
  const salt='00112233445566778899aabbccddeeff',revision='1'.repeat(32),password='legacy-viewer-password';writeFileSync(join(h.data,'viewer.json'),JSON.stringify({enabled:true,username:'view',salt,hash:scryptSync(password,salt,32).toString('hex'),revision}));
  const key=JSON.parse(readFileSync(join(h.data,'auth.json'),'utf8')).key,payload=`viewer:${revision}.${Date.now()+3600000}.${'2'.repeat(32)}`,cookie='netwatch='+payload+'.'+createHmac('sha256',key).update(payload).digest('hex');
  await h.start();assert.equal((await h.api('/api/dashboard',cookie)).status,200);assert.equal((await h.api('/api/dashboard?project='+a,cookie)).status,200);
  r=await h.api('/api/projects',admin.cookie,{name:'Future project',model:'E50UG',mode:'pppoe'});const b=(await r.json()).project.id;assert.equal((await h.api('/api/dashboard?project='+b,cookie)).status,403);
  await h.stop();await h.start();assert.equal((await h.api('/api/dashboard?project='+b,cookie)).status,403);
  const migrated=(await (await h.api('/api/viewers',admin.cookie)).json()).accounts[0];assert.deepEqual(migrated.projectIds.sort(),['main',a].sort());
  r=await h.api('/api/viewers',admin.cookie,{...migrated,projectIds:[a],password:''});assert.equal(r.status,200);assert.equal((await h.api('/api/projects',cookie)).status,401);
  const login=await h.login('view',password);assert.equal(login.status,303);assert.equal((await h.api('/api/dashboard',login.cookie)).status,403);assert.equal((await h.api('/api/dashboard?project='+a,login.cookie)).status,200);
 }finally{await h.dispose();}
});
