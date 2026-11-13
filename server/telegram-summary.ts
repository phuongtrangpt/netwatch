import {db} from './database';
import {projectList,scopedKey} from '../lib/projects';
import {sendOwnerTelegram,getGlobalTelegramConfig} from './telegram';

const localParts=(date:Date)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
async function setting(project:string,key:string,fallback:any){const row:any=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(project,key)).first();return row?JSON.parse(row.value):fallback;}

export async function sendScheduledTelegramSummary(now=Date.now()){
 const config=await getGlobalTelegramConfig(db);if(!config.summaryEnabled||!config.ownerChatId||!config.tokenCipher)return;
 const p=localParts(new Date(now)),day=`${p.year}-${p.month}-${p.day}`,time=`${p.hour}:${p.minute}`;if(time<config.summaryTime)return;
 const state:any=await db.prepare("SELECT value FROM settings WHERE key='telegram_summary_state'").first();if(state&&JSON.parse(state.value).lastDate===day)return;
 const projects=await projectList(db),lines=['📊 NetWatch · Bản tin tình trạng 24 giờ',`${day} · ${time} · múi giờ Việt Nam`],windowStart=now-86400000;
 let alertCount=0;
 for(const project of projects){
  const router:any=await db.prepare('SELECT last_seen FROM router WHERE id=?').bind(project.id).first(),seen=Number(router?.last_seen||0),routerOnline=seen>0&&now-seen<=180000;
  const title=`${project.name||project.id} — ${routerOnline?'🟢 Đang gửi dữ liệu':seen?'🔴 Mất liên lạc':'⚪ Chưa có dữ liệu'}`;lines.push('',title);
  const probe=await setting(project.id,'probe_latest',{results:[]}),offline=(probe.results||[]).filter((x:any)=>now-x.at<=120000&&x.received===0&&!x.error&&x.consecutiveFailures>=2);
  const wan=await setting(project.id,'wan_probe_latest',{results:[]}),wanDown=(wan.results||[]).filter((x:any)=>now-x.at<=150000&&x.status==='offline');
  for(const x of wanDown){lines.push(`  🔴 Internet ${x.label||x.interface}: Offline`);alertCount++;}
  for(const x of offline){const d=(project as any).id?await setting(project.id,'topology',{devices:[]}):{devices:[]},device=(d.devices||[]).find((v:any)=>v.id===x.id);lines.push(`  🔴 ${device?.name||x.ip} (${x.ip}): ping không phản hồi`);alertCount++;}
  const recent:any=await db.prepare("SELECT at,message FROM events WHERE project_id=? AND level='warning' AND at>=? ORDER BY at DESC LIMIT 12").bind(project.id,windowStart).all();
  if(recent.results?.length){lines.push('  Sự cố ghi nhận trong 24 giờ:');for(const e of recent.results){lines.push(`  • ${new Date(e.at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} ${e.message}`);alertCount++;}}
  if(!wanDown.length&&!offline.length&&!recent.results?.length)lines.push('  Không ghi nhận sự cố trong 24 giờ.');
 }
 lines.splice(2,0,`Dự án: ${projects.length} · mục sự cố: ${alertCount}`);
 let message=lines.join('\n');if(message.length>3900)message=message.slice(0,3820)+'\n… Bản tin đã rút gọn do giới hạn Telegram.';
 if(await sendOwnerTelegram(db,message))await db.prepare("INSERT INTO settings(key,value) VALUES ('telegram_summary_state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({lastDate:day,sentAt:now})).run();
}
