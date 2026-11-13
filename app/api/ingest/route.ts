import {refreshDiscovery} from '../../../lib/discovery';
import {database,json} from '../../../lib/server';
import {sha256,ingestError,list,truth,rates,wanNames} from '../../../lib/core';
import {projectId,scopedKey} from '../../../lib/projects';
import {wanProbeTransition} from '../../../lib/wan-alerts';
import {sendTelegram} from '../../../server/telegram';
export async function POST(req:Request){try{
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return json({error:'Unauthorized'},401);
 const db=database(),id=projectId(req);const router:any=await db.prepare('SELECT * FROM router WHERE id=?').bind(id).first();if(!router||await sha256(auth.slice(7))!==router.token_hash)return json({error:'Unauthorized'},401);
 const reader=req.body?.getReader();if(!reader)return json({error:'Empty body'},400);let size=0;const chunks:Uint8Array[]=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>65536){await reader.cancel();return json({error:'Payload too large'},413);}chunks.push(r.value);}const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}let body:any;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{return json({error:'Invalid JSON'},400);}const error=ingestError(body);if(error)return json({error},400);
 if(body.kind==='section'&&body.section.startsWith('ppp')){const allowed:Record<string,string[]>={pppactive:['name','service','caller-id','address','uptime','session-id'],pppaccounts:['name','service','profile','local-address','remote-address','caller-id','disabled'],pppprofiles:['name','local-address','remote-address','rate-limit','only-one','use-encryption'],pppservers:['service-name','interface','default-profile','disabled','max-mtu','max-mru','one-session-per-host','max-sessions']};body.rows=body.rows.map((row:any)=>Object.fromEntries((allowed[body.section]||[]).filter(k=>row?.[k]!==undefined&&['string','number','boolean'].includes(typeof row[k])).map(k=>[k,row[k]])));}

 const now=Date.now(),statements:any[]=[],telegramAlerts:string[]=[];let wanTargets:any[]=[];const read=async(k:string,f:any)=>{const r:any=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(id,k)).first();return r?JSON.parse(r.value):f;};const topology=await read('topology',{revision:0,devices:[]});
 const event=(level:string,message:string)=>db.prepare('INSERT INTO events(id,at,level,message,project_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),now,level,message,id);
 if(body.kind==='metrics'){
  if(router.last_seen&&now-router.last_seen<20000)return json({error:'Wait 20 seconds between metrics'},429);const prev=router.metrics?JSON.parse(router.metrics):null;const calculated=rates(body,prev,now,router.last_seen),minute=Math.floor(now/60000)*60000,data=JSON.stringify({rates:calculated,cpu:body.resource['cpu-load']});
  const wanConfig=await read('wan',{wans:[],aliases:{},manual:false});if(wanConfig.manual&&Array.isArray(wanConfig.wans)&&wanConfig.wans.length>=2)wanTargets=[...new Set(wanConfig.wans)].slice(0,8).filter((n:string)=>list(body.stats).some((s:any)=>s.name===n)).map((n:string)=>({interface:n}));
  statements.push(db.prepare('UPDATE router SET previous=metrics,previous_at=last_seen,metrics=?,last_seen=? WHERE id=?').bind(JSON.stringify(body),now,id));
  statements.push(id==='main'?db.prepare('INSERT INTO history(minute,data) VALUES (?,?) ON CONFLICT(minute) DO UPDATE SET data=excluded.data').bind(minute,data):db.prepare('INSERT INTO project_history(project_id,minute,data) VALUES (?,?,?) ON CONFLICT(project_id,minute) DO UPDATE SET data=excluded.data').bind(id,minute,data));
  let selectedWans:string[]=Array.isArray(wanConfig.wans)&&wanConfig.manual?wanConfig.wans:[];
  if(!wanConfig.manual){
   const keys=['wanmembers','pppoe','dhcpclients','routes','interfaces','vlans'].map(k=>scopedKey(id,k));
   const rows:any=await db.prepare(`SELECT c.name,c.data FROM section_chunks c JOIN section_heads h ON c.name=h.name AND c.generation=h.generation WHERE c.name IN (${keys.map(()=>'?').join(',')}) ORDER BY c.name,c.part`).bind(...keys).all();
   const sections:Record<string,any[]>={};for(const row of rows.results){const key=id==='main'?row.name:row.name.slice(id.length+1);(sections[key]||=[]).push(...JSON.parse(row.data));}selectedWans=wanNames(sections);
  }
  if(prev)for(const s of list(body.stats)){
   const old=list(prev.stats).find(x=>x.name===s.name);
   if(old&&old.running!==undefined&&s.running!==undefined&&truth(old.running)!==truth(s.running)){
    const online=truth(s.running);statements.push(event(online?'info':'warning',`${s.name}: ${online?'có kết nối':'mất kết nối'}`));
    if(selectedWans.includes(s.name)){
     const label=String(wanConfig.aliases?.[s.name]||s.name);
     telegramAlerts.push(`${online?'🟢':'🔴'} WAN ${label} (${s.name}): ${online?'Link đã phục hồi':'Link mất kết nối'}. Đây là trạng thái interface, chưa xác nhận Internet bằng ping.`);
    }
   }
  }
 }else if(body.kind==='wan-probes'){
  const config=await read('wan',{wans:[],aliases:{},manual:false});const expected=!!config.manual&&Array.isArray(config.wans)?[...new Set(config.wans)].slice(0,8):[];if(expected.length<2)return json({error:'WAN checks require at least two manually selected interfaces'},409);
  const metricNames=new Set(list(router.metrics?JSON.parse(router.metrics).stats:[]).map((x:any)=>x.name));if(expected.some((n:string)=>!metricNames.has(n)))return json({error:'A selected WAN interface is not present on this router'},409);
  const old=await read('wan_probe_latest',{results:[]});if(old.at&&now-old.at<20000)return json({error:'Wait 20 seconds between WAN probes'},429);const results:any[]=[],seen=new Set<string>();
  for(const p of body.results){if(!expected.includes(p.interface)||seen.has(p.interface))return json({error:'Unconfigured or duplicate WAN interface'},400);seen.add(p.interface);const prior=old.results.find((x:any)=>x.interface===p.interface);
   const {status,confirmedStatus,failures,transition}=wanProbeTransition(prior,p,now);
   const label=String(config.aliases?.[p.interface]||p.interface);
   results.push({interface:p.interface,label,status,confirmedStatus,failures,received:p.received,error:!!p.error,at:now,lastSuccessAt:status==='online'?now:prior?.lastSuccessAt||null});
   if(transition){const down=transition==='offline';const message=`${label} (${p.interface}): ${down?'mất kết nối Internet sau 2 lần kiểm tra thất bại':'Internet đã kết nối trở lại'}`;statements.push(event(down?'warning':'info',message));telegramAlerts.push(`${down?'🔴':'🟢'} ${message}`);}
  }
  statements.push(db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(id,'wan_probe_latest'),JSON.stringify({at:now,results:[...old.results.filter((x:any)=>!seen.has(x.interface)),...results]})));
 }else if(body.kind==='probes'){
  const old=await read('probe_latest',{results:[]});if(old.at&&now-old.at<20000)return json({error:'Wait 20 seconds between probes'},429);const configured=new Map(topology.devices.filter((d:any)=>d.enabled&&!d.virtual).map((d:any)=>[d.id,d]));const ids=new Set(),results:any[]=[],previousAlerts=await read('device_alert_state',{}),nextAlerts:any={};
  for(const p of body.results){const target:any=configured.get(p.id);if(!target||target.ip!==p.ip||ids.has(p.id))return json({error:'Unconfigured or duplicate ping target'},400);ids.add(p.id);const prior=old.results.find((x:any)=>x.id===p.id&&x.ip===p.ip),was=previousAlerts[p.id]?.ip===p.ip?previousAlerts[p.id]:null;const failed=!p.error&&p.received===0;const continuous=prior&&now-prior.at<150000;const result={consecutiveFailures:failed?(continuous?(prior.consecutiveFailures||1)+1:1):0,offlineSince:failed?(continuous&&prior.received===0&&!prior.error?prior.offlineSince||now:now):null,lastSuccessAt:p.received>0?now:prior?.lastSuccessAt||null,id:p.id,ip:p.ip,sent:2,received:p.received,error:!!p.error,at:now};results.push(result);
   if(prior&&now-prior.at<120000&&!prior.error&&!result.error&&((prior.received===0)!==(result.received===0)))statements.push(event(result.received===0?'warning':'info',`${target.name} (${p.ip}): ${result.received===0?'không phản hồi ping':'ping thông trở lại'}`));
   if(target.notifyEnabled!==true)continue;
   if(failed&&result.consecutiveFailures>=2){const repeat=[0,30,60].includes(target.notifyRepeatMinutes)?target.notifyRepeatMinutes:0,due=!was||(repeat>0&&now-(was.lastAlertAt||0)>=repeat*60000);if(due){const message=`${target.name} (${p.ip}): ${was?'vẫn Offline, chưa khắc phục':'mất kết nối ping sau 2 lần kiểm tra'}`;if(!was)statements.push(event('warning',message));telegramAlerts.push(`🔴 ${message}`);nextAlerts[p.id]={ip:p.ip,name:target.name,offlineSince:was?.offlineSince||result.offlineSince||now,lastAlertAt:now,repeatMinutes:repeat};}else nextAlerts[p.id]=was;
   }else if(was&&!p.error&&p.received>0){const message=`${target.name} (${p.ip}): kết nối ping đã phục hồi`;statements.push(event('info',message));telegramAlerts.push(`🟢 ${message}`);
   }else if(was&&p.error)nextAlerts[p.id]=was;
  }
  // Only retain repeat schedules for devices still explicitly enabled and opted in.
  for(const d of topology.devices)if(d.enabled&&!d.virtual&&d.notifyEnabled===true&&previousAlerts[d.id]&&!nextAlerts[d.id]&&!ids.has(d.id))nextAlerts[d.id]=previousAlerts[d.id];
  statements.push(db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(id,'probe_latest'),JSON.stringify({at:now,results})),db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(id,'device_alert_state'),JSON.stringify(nextAlerts)));
 }else{
  const name=scopedKey(id,body.section);statements.push(db.prepare('INSERT INTO section_chunks(name,generation,part,data,received_at) VALUES (?,?,?,?,?) ON CONFLICT(name,generation,part) DO UPDATE SET data=excluded.data,received_at=excluded.received_at').bind(name,body.generation,body.part,JSON.stringify(body.rows),now));
  if(body.final){const existing:any=await db.prepare('SELECT COUNT(*) AS n FROM section_chunks WHERE name=? AND generation=? AND part<?').bind(name,body.generation,body.part).first();if(Number(existing?.n)!==body.part)return json({error:'Missing section chunks'},409);statements.push(db.prepare('INSERT INTO section_heads(name,generation,updated_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET generation=excluded.generation,updated_at=excluded.updated_at').bind(name,body.generation,now),db.prepare('DELETE FROM section_chunks WHERE name=? AND generation<>?').bind(name,body.generation));}
 }
 if(Math.floor(now/30000)%10===0){statements.push(id==='main'?db.prepare('DELETE FROM history WHERE minute IN (SELECT minute FROM history WHERE minute<? LIMIT 500)').bind(now-7*86400000):db.prepare('DELETE FROM project_history WHERE project_id=? AND minute IN (SELECT minute FROM project_history WHERE project_id=? AND minute<? LIMIT 500)').bind(id,id,now-7*86400000));statements.push(db.prepare('DELETE FROM events WHERE id IN (SELECT id FROM events WHERE project_id=? ORDER BY at DESC LIMIT -1 OFFSET 300)').bind(id));statements.push(db.prepare('DELETE FROM section_chunks WHERE received_at<? AND generation NOT IN (SELECT generation FROM section_heads)').bind(now-3600000));}
 await db.batch(statements);if(body.kind==='section'&&body.final&&['leases','hosts','addresses','pppactive'].includes(body.section))await refreshDiscovery(db,id,now);if(telegramAlerts.length)await sendTelegram(db,id,`NetWatch · ${router.name||id}\n${telegramAlerts.join('\n')}`);return json({ok:true,receivedAt:now,...(body.kind==='metrics'?{targets:topology.devices.filter((d:any)=>d.enabled&&!d.virtual).map((d:any)=>({id:d.id,ip:d.ip})),targetRevision:topology.revision,wanTargets}:{})});
 }catch{return json({error:'Unable to store telemetry'},500);}}
