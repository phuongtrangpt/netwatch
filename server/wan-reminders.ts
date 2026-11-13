import {wanNames,list,truth} from '../lib/core';
import {scopedKey,findProject} from '../lib/projects';
import {planWanReminders,type WanCondition} from '../lib/wan-reminders';
import {sendTelegram} from './telegram';
const active=new Set<string>();
export async function sendWanReminders(db:any,project:string,now=Date.now()){
 if(active.has(project))return;active.add(project);
 try{
 const read=async(key:string,fallback:any)=>{const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(project,key)).first();return row?JSON.parse(row.value):fallback;};
 const config=await read('wan',{}),repeatMinutes=[30,60].includes(config.notifyRepeatMinutes)?config.notifyRepeatMinutes:0;
 const router:any=await db.prepare('SELECT last_seen,metrics FROM router WHERE id=?').bind(project).first();
 if(!router?.metrics||now-router.last_seen>150000)return;
 const keys=['wanmembers','pppoe','dhcpclients','routes','interfaces','vlans'].map(k=>scopedKey(project,k));
 const rows:any=await db.prepare(`SELECT c.name,c.data FROM section_chunks c JOIN section_heads h ON c.name=h.name AND c.generation=h.generation WHERE c.name IN (${keys.map(()=>'?').join(',')}) ORDER BY c.name,c.part`).bind(...keys).all();
 const sections:Record<string,any[]>={};for(const row of rows.results){const key=project==='main'?row.name:row.name.slice(project.length+1);(sections[key]||=[]).push(...JSON.parse(row.data));}
 const names:string[]=config.manual?listNames(config.wans):wanNames(sections),metrics=JSON.parse(router.metrics),probes=await read('wan_probe_latest',{results:[]});
 const conditions:WanCondition[]=names.map(name=>{
  const metric=list(metrics.stats).find(s=>s.name===name),probe=probes.results.find((p:any)=>p.interface===name),freshProbe=probe&&now-probe.at<150000;
  const base={interface:name,label:String(config.aliases?.[name]||name)};
  if(metric?.running!==undefined&&!truth(metric.running))return {...base,state:'offline',reason:'Link vẫn mất kết nối'};
  if(freshProbe&&(probe.status==='offline'||probe.status==='checking'&&probe.confirmedStatus==='offline'))return {...base,state:'offline',reason:'Internet vẫn mất kết nối'};
  if(config.manual&&names.length>=2){return {...base,state:freshProbe&&probe.status==='online'?'online':'unknown'};}
  return {...base,state:metric?.running===undefined?'unknown':'online'};
 });
 const {next,due}=planWanReminders(await read('wan_reminder_state',{}),conditions,repeatMinutes,now);
 await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(project,'wan_reminder_state'),JSON.stringify(next)).run();
 if(due.length){const info=await findProject(db,project),message=`🔁 NetWatch · ${info?.name||project}\nNhắc lại mỗi ${repeatMinutes} phút · sự cố WAN chưa khắc phục\n`+due.map(w=>`🔴 ${w.label} (${w.interface}): ${w.reason}`).join('\n');await sendTelegram(db,project,message);}
 }finally{active.delete(project);}
}
function listNames(value:any):string[]{return Array.isArray(value)?[...new Set<string>(value)].slice(0,8):[];}
