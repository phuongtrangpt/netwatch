import {decryptSecret} from './auth';
import {scopedKey} from '../lib/projects';

type Store={prepare:(sql:string)=>any};
export type TelegramConfig={enabled:boolean;chatId:string;tokenCipher?:string};
export type GlobalTelegramConfig={ownerChatId:string;tokenCipher?:string;summaryEnabled:boolean;summaryTime:string};

async function readSetting(db:Store,key:string,fallback:any){const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();return row?JSON.parse(row.value):fallback;}
export async function getTelegramConfig(db:Store,project:string):Promise<TelegramConfig>{
 const config=await readSetting(db,scopedKey(project,'telegram_project'),null);
 if(config)return {enabled:!!config.enabled,chatId:String(config.chatId||'')};
 return {enabled:false,chatId:''};
}
async function getLegacyTelegramConfig(db:Store,project:string):Promise<TelegramConfig>{
 const legacy=await readSetting(db,scopedKey(project,'telegram'),{enabled:false,chatId:''});
 return {enabled:!!legacy.enabled,chatId:String(legacy.chatId||''),tokenCipher:legacy.tokenCipher};
}
export async function saveTelegramConfig(db:Store,project:string,value:TelegramConfig){
 await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(project,'telegram_project'),JSON.stringify({enabled:!!value.enabled,chatId:value.chatId})).run();
}
export async function getGlobalTelegramConfig(db:Store):Promise<GlobalTelegramConfig>{
 return readSetting(db,'telegram_global',{ownerChatId:'',summaryEnabled:true,summaryTime:'08:00'});
}
export async function saveGlobalTelegramConfig(db:Store,value:GlobalTelegramConfig){
 await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('telegram_global',JSON.stringify(value)).run();
}
export async function sendTelegramConfig(config:TelegramConfig,message:string):Promise<boolean>{
 try{
  if(!config.chatId||!config.tokenCipher)return false;
  const token=decryptSecret(config.tokenCipher);
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:config.chatId,text:message,disable_web_page_preview:true}),signal:AbortSignal.timeout(7000)});
  if(!response.ok)return false;const result:any=await response.json();return result?.ok===true;
 }catch{return false;}
}
export async function sendOwnerTelegram(db:Store,message:string):Promise<boolean>{
 try{const config=await getGlobalTelegramConfig(db);if(!config.ownerChatId||!config.tokenCipher)return false;return sendTelegramConfig({enabled:true,chatId:config.ownerChatId,tokenCipher:config.tokenCipher},message);}catch{return false;}
}

async function deliverAlert(db:Store,project:string,config:TelegramConfig,message:string){
 // Persist each destination independently before delivery. One working recipient
 // must not hide a failed group delivery or discard an alert during an outage.
 const key='telegram_outbox:'+crypto.randomUUID(),now=Date.now();
 const value={project,chatId:config.chatId,tokenCipher:config.tokenCipher,message,createdAt:now,nextAttemptAt:now+30000,attempts:0};
 await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind(key,JSON.stringify(value)).run();
 const ok=await sendTelegramConfig(config,message);
 if(ok)await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();
 else await db.prepare('INSERT INTO events(id,at,level,message,project_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),now,'warning',`Telegram chưa gửi được tới Chat ID ${config.chatId}; đã xếp hàng thử lại khi kết nối phục hồi.`,project).run();
 return ok;
}

let flushing=false;
export async function retryTelegramAlerts(db:Store){
 if(flushing)return;flushing=true;
 try{
  const rows=await db.prepare("SELECT key,value FROM settings WHERE key LIKE 'telegram_outbox:%' ORDER BY key").all();
  let tried=0;
  for(const row of rows.results.sort((a:any,b:any)=>JSON.parse(a.value).createdAt-JSON.parse(b.value).createdAt)){
   const item=JSON.parse(row.value),now=Date.now();
   if(now-item.createdAt>86400000){
    await db.prepare('DELETE FROM settings WHERE key=?').bind(row.key).run();
    await db.prepare('INSERT INTO events(id,at,level,message,project_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),now,'warning',`Telegram không gửi được tới Chat ID ${item.chatId} sau 24 giờ; đã dừng thử lại.`,item.project).run();continue;
   }
   if(item.nextAttemptAt>now||tried>=2)continue;tried++;
   if(await sendTelegramConfig({enabled:true,chatId:item.chatId,tokenCipher:item.tokenCipher},item.message))await db.prepare('DELETE FROM settings WHERE key=?').bind(row.key).run();
   else{item.attempts++;item.nextAttemptAt=now+Math.min(300000,30000*2**Math.min(item.attempts,4));await db.prepare('UPDATE settings SET value=? WHERE key=?').bind(JSON.stringify(item),row.key).run();}
  }
 }finally{flushing=false;}
}

export async function sendTelegram(db:Store,project:string,message:string):Promise<boolean>{
 try{
  const global=await getGlobalTelegramConfig(db),target=await getTelegramConfig(db,project);
  if(global.tokenCipher){
   const destinations=[global.ownerChatId,...(target.enabled?[target.chatId]:[])].filter((x,i,a)=>!!x&&a.indexOf(x)===i);
   const results=await Promise.all(destinations.map(chatId=>deliverAlert(db,project,{enabled:true,chatId,tokenCipher:global.tokenCipher},message)));
   return results.some(Boolean);
  }
  // Keep existing 1.0.5 installations working until the owner configures the shared bot.
  const legacy=await getLegacyTelegramConfig(db,project);return legacy.enabled?deliverAlert(db,project,legacy,message):false;
 }catch{return false;}
}
