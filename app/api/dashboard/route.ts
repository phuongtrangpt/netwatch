import {discoveredInventory} from '../../../lib/discovery';
import {database,browserUser,json} from '../../../lib/server';
import {clients,rates,wanNames,SECTIONS} from '../../../lib/core';
import {projectId,scopedKey,findProject} from '../../../lib/projects';
export async function GET(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);
 try{const db=database(),id=projectId(req),project=await findProject(db,id);if(!project)return json({error:'Không tìm thấy dự án'},404);
 const router:any=await db.prepare('SELECT paired_at,last_seen,metrics,previous,previous_at FROM router WHERE id=?').bind(id).first();
 const keys=SECTIONS.map(k=>scopedKey(id,k));const data:any=await db.prepare(`SELECT c.name,c.data,h.updated_at FROM section_chunks c JOIN section_heads h ON c.name=h.name AND c.generation=h.generation WHERE c.name IN (${keys.map(()=>'?').join(',')}) ORDER BY c.name,c.part`).bind(...keys).all();const sections:Record<string,any[]>={},updated:Record<string,number>={};for(const r of data.results){const name=id==='main'?r.name:r.name.slice(id.length+1);(sections[name]||=[]).push(...JSON.parse(r.data));updated[name]=r.updated_at;}
 const hours=Math.min(24,Math.max(1,Number(new URL(req.url).searchParams.get('hours'))||6));
 const history:any=id==='main'?await db.prepare('SELECT minute,data FROM history WHERE minute>=? ORDER BY minute DESC LIMIT 1440').bind(Date.now()-hours*3600000).all():await db.prepare('SELECT minute,data FROM project_history WHERE project_id=? AND minute>=? ORDER BY minute DESC LIMIT 1440').bind(id,Date.now()-hours*3600000).all();
 const events:any=await db.prepare('SELECT id,at,level,message FROM events WHERE project_id=? ORDER BY at DESC LIMIT 100').bind(id).all();
 const settings:any=await db.prepare('SELECT key,value FROM settings WHERE key IN (?,?,?,?)').bind(...['wan','topology','probe_latest','discovery'].map(k=>scopedKey(id,k))).all();const get=(k:string,f:any)=>{const r=settings.results.find((r:any)=>r.key===scopedKey(id,k));return r?JSON.parse(r.value):f;};
 const config=get('wan',{wans:[],aliases:{},manual:false}),topology=get('topology',{revision:0,devices:[]}),probes=get('probe_latest',{results:[]});const metrics=router?.metrics?JSON.parse(router.metrics):null;
 const discovery=get('discovery',null);const discovered=discoveredInventory(sections,updated,(discovery?.devices||[]).filter((d:any)=>['DHCP','PPPoE'].includes(d.source)));
 return json({discovered,project,paired:!!router,pairedAt:router?.paired_at,lastSeen:router?.last_seen,metrics,rates:metrics?rates(metrics,router.previous?JSON.parse(router.previous):null,router.last_seen,router.previous_at):{},sections,updated,clients:clients(sections),wanNames:config.manual?config.wans:wanNames(sections),config,topology,probes,history:history.results.reverse().map((r:any)=>({at:r.minute,...JSON.parse(r.data)})),events:events.results,serverTime:Date.now()});
 }catch{return json({error:'Chưa đọc được dữ liệu. Vui lòng thử lại.'},503);}
}
