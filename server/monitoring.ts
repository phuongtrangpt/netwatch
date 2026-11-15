import {scopedKey} from '../lib/projects';
import {summarizeSegments,monitoringTTL} from '../lib/monitoring';
import {list,truth,wanNames} from '../lib/core';
export async function inMaintenance(db:any,project:string,target='project',now=Date.now()){
 const row=await db.prepare('SELECT until_at FROM maintenance WHERE project_id=? AND target_id IN (?,?) AND until_at>? LIMIT 1').bind(project,'project',target,now).first();return !!row;
}
export async function observe(db:any,project:string,target:string,label:string,kind:string,status:string,now=Date.now()){
 const old=await db.prepare('SELECT * FROM monitor_states WHERE project_id=? AND target_id=?').bind(project,target).first();const queries:any[]=[];
 const segment=(state:string,start:number,end:number)=>{if(end>start)queries.push(db.prepare('INSERT INTO monitor_segments(project_id,target_id,label,kind,status,started_at,ended_at) VALUES (?,?,?,?,?,?,?)').bind(project,target,old?.label||label,kind,state,start,end));};
 if(old){if(now<old.observed_at)return;const expires=old.observed_at+monitoringTTL(kind),gap=now>expires&&old.status!=='unknown';if(gap){segment(old.status,old.started_at,expires);segment('unknown',expires,now);}else if(old.status!==status)segment(old.status,old.started_at,now);
  const start=!gap&&old.status===status?old.started_at:now;queries.push(db.prepare('UPDATE monitor_states SET label=?,kind=?,status=?,started_at=?,observed_at=? WHERE project_id=? AND target_id=?').bind(label,kind,status,start,now,project,target));
 }else queries.push(db.prepare('INSERT INTO monitor_states(project_id,target_id,label,kind,status,started_at,observed_at) VALUES (?,?,?,?,?,?,?)').bind(project,target,label,kind,status,now,now));
 await db.batch(queries);
}
export async function recordPacket(db:any,project:string,body:any,now:number){
 const read=async(k:string,f:any)=>{const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(project,k)).first();return row?JSON.parse(row.value):f;};
 if(body.kind==='metrics'){
  await observe(db,project,'router','Luồng dữ liệu router','router','online',now);
  const config=await read('wan',{});let names:string[]=config.manual?config.wans||[]:[];
  if(!config.manual){const keys=['wanmembers','pppoe','dhcpclients','routes','interfaces','vlans'].map(k=>scopedKey(project,k));const rows=await db.prepare('SELECT c.name,c.data FROM section_chunks c JOIN section_heads h ON c.name=h.name AND c.generation=h.generation WHERE c.name IN (?,?,?,?,?,?) ORDER BY c.part').bind(...keys).all();const sections:any={};for(const row of rows.results){const name=project==='main'?row.name:row.name.startsWith(project+':')?row.name.slice(project.length+1):'';if(['wanmembers','pppoe','dhcpclients','routes','interfaces','vlans'].includes(name))(sections[name]||=[]).push(...JSON.parse(row.data));}names=wanNames(sections);}
  for(const name of names){const s=list(body.stats).find(s=>s.name===name);await observe(db,project,'link:'+name,config.aliases?.[name]||name,'link',s?.running===undefined?'unknown':truth(s.running)?'online':'offline',now);}
 }else if(body.kind==='probes'){
  const topology=await read('topology',{devices:[]}),latest=await read('probe_latest',{results:[]});const router=await db.prepare('SELECT last_seen FROM router WHERE id=?').bind(project).first();
  for(const result of latest.results){const device=topology.devices.find((d:any)=>d.id===result.id&&d.enabled&&!d.virtual);if(!device)continue;const status=!router?.last_seen||now-router.last_seen>180000||result.error?'unknown':result.received>0?'online':result.consecutiveFailures>=2?'offline':'unknown';await observe(db,project,result.id,device.name,'device',status,now);}
 }else if(body.kind==='wan-probes'){
  const config=await read('wan',{}),latest=await read('wan_probe_latest',{results:[]});const router=await db.prepare('SELECT last_seen FROM router WHERE id=?').bind(project).first();
  for(const result of latest.results.filter((r:any)=>body.results.some((p:any)=>p.interface===r.interface)))await observe(db,project,'internet:'+result.interface,config.aliases?.[result.interface]||result.interface,'internet',!router?.last_seen||now-router.last_seen>180000||result.error?'unknown':result.status==='checking'?'unknown':result.status,now);
 }
}
export async function monitoringData(db:any,project:string,days=1,now=Date.now()){
 const from=now-days*86400000,states=(await db.prepare('SELECT * FROM monitor_states WHERE project_id=? ORDER BY kind,label').bind(project).all()).results;
 const stored=(await db.prepare('SELECT * FROM (SELECT * FROM monitor_segments WHERE project_id=? AND ended_at>? ORDER BY ended_at DESC LIMIT 50000) ORDER BY started_at').bind(project,from).all()).results;
 const maintenance=(await db.prepare('SELECT target_id,until_at,reason FROM maintenance WHERE project_id=? AND until_at>?').bind(project,now).all()).results;
 const pingRows=await db.prepare('SELECT key,value FROM settings WHERE key IN (?,?)').bind(scopedKey(project,'probe_latest'),scopedKey(project,'wan_probe_latest')).all();const latency=new Map<string,any>();for(const row of pingRows.results){const wan=row.key===scopedKey(project,'wan_probe_latest');for(const result of JSON.parse(row.value).results||[])latency.set(wan?'internet:'+result.interface:result.id,result);}
 const groups=new Map<string,any[]>();for(const s of stored){if(!groups.has(s.target_id))groups.set(s.target_id,[]);groups.get(s.target_id)!.push(s);}
 const rows=states.map((state:any)=>{const expires=state.observed_at+monitoringTTL(state.kind),end=Math.min(now,expires),segments=[...(groups.get(state.target_id)||[])];if(end>state.started_at)segments.push({...state,ended_at:end});if(now>expires)segments.push({...state,status:'unknown',started_at:Math.max(expires,state.started_at),ended_at:now});const summary=summarizeSegments(segments,from,now);const ping=latency.get(state.target_id);const rttMs=now<=expires&&ping&&!ping.error&&now-ping.at<=150000&&ping.received>0&&Number.isFinite(ping.rttMs)?ping.rttMs:null;return {rttMs,id:state.target_id,label:state.label,kind:state.kind,status:now>expires?'unknown':state.status,observedAt:state.observed_at,...summary,maintenance:maintenance.find((m:any)=>m.target_id==='project'||m.target_id===state.target_id)||null};});
 const recoveries=new Set([...stored,...states].filter((s:any)=>s.status==='online').map((s:any)=>s.target_id+':'+s.started_at));
 const incidents=[...stored.filter((s:any)=>s.status==='offline').map((s:any)=>({...s,restored:recoveries.has(s.target_id+':'+s.ended_at)})),...states.filter((s:any)=>s.status==='offline').map((s:any)=>({...s,ended_at:now-s.observed_at<=monitoringTTL(s.kind)?null:s.observed_at+monitoringTTL(s.kind),restored:false}))].sort((a,b)=>b.started_at-a.started_at).slice(0,50);
 return {from,to:now,days,rows,incidents,maintenance};
}
let lastPrune=0;
export async function sweepMonitoring(db:any,now=Date.now()){
 const routers=(await db.prepare('SELECT id,last_seen FROM router WHERE last_seen IS NOT NULL').all()).results;
 for(const r of routers){if(now-r.last_seen<=180000)continue;await observe(db,r.id,'router','Luồng dữ liệu router','router','offline',now);const children=(await db.prepare("SELECT * FROM monitor_states WHERE project_id=? AND kind<>'router' AND status<>'unknown'").bind(r.id).all()).results;for(const c of children)await observe(db,r.id,c.target_id,c.label,c.kind,'unknown',now);}
 if(now-lastPrune>=3600000){lastPrune=now;await db.prepare('DELETE FROM monitor_segments WHERE ended_at<?').bind(now-7*86400000).run();for(const r of routers)await db.prepare('DELETE FROM monitor_segments WHERE id IN (SELECT id FROM monitor_segments WHERE project_id=? ORDER BY ended_at DESC LIMIT -1 OFFSET 50000)').bind(r.id).run();await db.prepare("DELETE FROM monitor_states WHERE kind<>'router' AND observed_at<?").bind(now-7*86400000).run();}
}

export async function finishExpiredMaintenance(db:any,now=Date.now()){
 const expired=(await db.prepare("SELECT * FROM maintenance WHERE until_at<=? ORDER BY project_id,CASE WHEN target_id='project' THEN 0 ELSE 1 END").bind(now).all()).results;
 const covered=new Set<string>();
 for(const m of expired){
  await db.prepare('DELETE FROM maintenance WHERE project_id=? AND target_id=? AND until_at=?').bind(m.project_id,m.target_id,m.until_at).run();
  if(covered.has(m.project_id)||await inMaintenance(db,m.project_id,m.target_id,now))continue;if(m.target_id==='project')covered.add(m.project_id);
  const router=await db.prepare('SELECT last_seen FROM router WHERE id=?').bind(m.project_id).first(),fresh=!!router?.last_seen&&now-router.last_seen<=180000;
  const topologyRow=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(m.project_id,'topology')).first(),devices=topologyRow?JSON.parse(topologyRow.value).devices:[];
  const states=(await db.prepare("SELECT * FROM monitor_states WHERE project_id=? AND status='offline'").bind(m.project_id).all()).results;
  const down=states.filter((s:any)=>now-s.observed_at<=monitoringTTL(s.kind)&&(m.target_id==='project'||m.target_id===s.target_id)&&(s.kind==='router'?!fresh:fresh)&&(s.kind!=='device'||devices.some((d:any)=>d.id===s.target_id&&d.enabled&&d.notifyEnabled)));
  if(!down.length)continue;
  const {sendTelegram}=await import('./telegram');let entries:{target:string;message:string}[]=[],size=0;const send=async()=>{await sendTelegram(db,m.project_id,entries.map(e=>e.message).join('\n'),m.target_id==='project'?(fresh?'children':'project'):m.target_id,entries);entries=[];size=0;};
  for(const s of down){const message=`🛠️ Bảo trì đã hết hạn. Sự cố vẫn còn: ${s.label} (${s.kind==='router'?'mất dữ liệu router':s.kind==='link'?'mất link':s.kind==='internet'?'mất Internet':'không phản hồi ping'})`;if(size+message.length>3000&&entries.length)await send();entries.push({target:s.target_id,message});size+=message.length+1;}if(entries.length)await send();
  for(const key of ['device_alert_state','wan_reminder_state']){const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(m.project_id,key)).first();if(!row)continue;const value=JSON.parse(row.value);for(const s of down){const target=key==='device_alert_state'?s.target_id:s.target_id.replace(/^(link|internet):/,'');if(value[target])value[target].lastAlertAt=now;}await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(value),scopedKey(m.project_id,key)).run();} 
 }
}
