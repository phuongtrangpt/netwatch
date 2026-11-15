import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {readFileSync,readdirSync} from 'node:fs';
import {observe,monitoringData,inMaintenance,recordPacket,sweepMonitoring,finishExpiredMaintenance} from '../server/monitoring';
import {summarizeSegments} from '../lib/monitoring';
function fixture(){const sql=new Database(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));const prepare=(query:string)=>{let values:any[]=[];const statement:any={bind:(...v:any[])=>{values=v;return statement;},first:async()=>sql.prepare(query).get(...values)||null,all:async()=>({results:sql.prepare(query).all(...values)}),run:async()=>sql.prepare(query).run(...values),execute:()=>sql.prepare(query).run(...values)};return statement;};return {sql,db:{prepare,batch:async(q:any[])=>sql.transaction(()=>q.map(s=>s.execute()))()}};}
const start=1800000000000;
test('history uses duration, retains uncertainty, tracks outages once and isolates projects',async()=>{
 const {db,sql}=fixture();try{
 await observe(db,'main','link:wan','FPT','link','online',start);
 await observe(db,'main','link:wan','FPT','link','online',start+30000);
 await observe(db,'main','link:wan','FPT','link','offline',start+60000);
 await observe(db,'main','link:wan','FPT','link','offline',start+90000);
 await observe(db,'main','link:wan','FPT','link','online',start+120000);
 const data=await monitoringData(db,'main',1,start+150000);assert.equal(data.rows[0].offlineMs,60000);assert.equal(data.rows[0].onlineMs,90000);assert.equal(data.incidents.length,1);assert.equal(data.incidents[0].restored,true);assert.equal(data.rows[0].uptime,60);assert.ok(data.rows[0].coverage<1);assert.equal((await monitoringData(db,'other',1,start+150000)).rows.length,0);
 // A 10 minute collection gap is uncertainty, not ten minutes of uptime.
 await observe(db,'main','link:wan','FPT','link','online',start+720000);
 const result=await monitoringData(db,'main',1,start+750000);assert.equal(result.rows[0].onlineMs,240000);assert.ok(result.rows[0].unknownMs>86000000);
 }finally{sql.close();}
});
test('maintenance expires by server time and has project/device isolation',async()=>{
 const {db,sql}=fixture();try{sql.prepare('INSERT INTO maintenance VALUES (?,?,?,?,?)').run('main','device-one',start,start+60000,'test');assert.equal(await inMaintenance(db,'main','device-one',start),true);assert.equal(await inMaintenance(db,'main','device-two',start),false);assert.equal(await inMaintenance(db,'other','device-one',start),false);assert.equal(await inMaintenance(db,'main','device-one',start+60001),false);sql.prepare('INSERT INTO maintenance VALUES (?,?,?,?,?)').run('main','project',start,start+120000,'test');assert.equal(await inMaintenance(db,'main','device-two',start+60001),true);}finally{sql.close();}
});
test('router outage changes children to unknown; no guessed per-device outage',async()=>{
 const {db,sql}=fixture();try{sql.prepare('INSERT INTO router(id,token_hash,paired_at,last_seen) VALUES (?,?,?,?)').run('main','test',start,start);await observe(db,'main','router','Router','router','online',start);await observe(db,'main','device-one','Camera','device','online',start);await sweepMonitoring(db,start+200000);const data=await monitoringData(db,'main',1,start+200001);assert.equal(data.rows.find((r:any)=>r.id==='router').status,'offline');assert.equal(data.rows.find((r:any)=>r.id==='device-one').status,'unknown');assert.equal(data.rows.find((r:any)=>r.id==='device-one').offlineMs,0);assert.equal(data.incidents.length,1);assert.equal(data.incidents[0].kind,'router');}finally{sql.close();}
});
test('coverage reports missing samples separately and buckets contain an outage',()=>{
 const r=summarizeSegments([{target_id:'x',label:'x',kind:'link',status:'online',started_at:0,ended_at:500},{target_id:'x',label:'x',kind:'link',status:'offline',started_at:500,ended_at:600}],0,1000,10);assert.equal(r.offlineMs,100);assert.equal(r.unknownMs,400);assert.equal(r.uptime,500/600*100);assert.equal(r.coverage,60);assert.equal(r.buckets[5],'offline');
});

test('expiry restores alerts for an ongoing outage and drops queued maintenance alerts',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const directory=mkdtempSync('/tmp/netwatch-maint-test-');process.env.DATA_DIR=directory;process.env.NETWATCH_PASSWORD='maintenance-test-password';
 const {encryptSecret}=await import('../server/auth');const {sendTelegram,retryTelegramAlerts}=await import('../server/telegram');const {db,sql}=fixture();const original=globalThis.fetch,sent:any[]=[];
 globalThis.fetch=(async(_url:any,options:any)=>{sent.push(JSON.parse(options.body));return new Response(JSON.stringify({ok:true}));}) as any;
 try{
 const now=Date.now();sql.prepare('INSERT INTO router(id,token_hash,paired_at,last_seen) VALUES (?,?,?,?)').run('main','test',now,now);
 sql.prepare('INSERT INTO settings VALUES (?,?)').run('telegram_global',JSON.stringify({ownerChatId:'123',tokenCipher:encryptSecret('test-token')}));
 sql.prepare('INSERT INTO maintenance VALUES (?,?,?,?,?)').run('main','project',now-1000,now+60000,'test');
 await observe(db,'main','link:ether1','FPT','link','offline',now);assert.equal(await sendTelegram(db,'main','should suppress','link:ether1'),false);assert.equal(sent.length,0);
 sql.prepare('INSERT INTO settings VALUES (?,?)').run('telegram_outbox:test',JSON.stringify({project:'main',target:'link:ether1',createdAt:now,nextAttemptAt:0,chatId:'123',tokenCipher:encryptSecret('test-token'),message:'old outage'}));
 await retryTelegramAlerts(db);assert.equal(sent.length,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'telegram_outbox:%'").get().n,0);
 sql.prepare('UPDATE maintenance SET until_at=?').run(now-1);await finishExpiredMaintenance(db,now);assert.equal(sent.length,1);assert.match(sent[0].text,/Bảo trì đã hết hạn/);assert.match(sent[0].text,/FPT/);assert.equal(await inMaintenance(db,'main','project',now),false);
 await finishExpiredMaintenance(db,now+10);assert.equal(sent.length,1,'No duplicate expiry message');
 sql.prepare('INSERT INTO maintenance VALUES (?,?,?,?,?)').run('main','device-one',now,now+60000,'test');
 sql.prepare('INSERT INTO settings VALUES (?,?)').run('telegram_outbox:batch',JSON.stringify({project:'main',target:'children',entries:[{target:'device-one',message:'Camera A failed'},{target:'device-two',message:'Camera B failed'}],createdAt:now,nextAttemptAt:0,chatId:'123',tokenCipher:encryptSecret('test-token'),message:'old batch'}));
 await retryTelegramAlerts(db);assert.equal(sent.length,2);assert.ok(sent[1].text.includes('Camera B'));assert.ok(!sent[1].text.includes('Camera A'));

 }finally{globalThis.fetch=original;sql.close();rmSync(directory,{recursive:true,force:true});}
});
