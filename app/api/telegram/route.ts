import {browserUser,database,json,sameOrigin} from '../../../lib/server';
import {projectId,scopedKey,findProject} from '../../../lib/projects';
import {decryptSecret,encryptSecret} from '../../../server/auth';
import {getTelegramConfig,getGlobalTelegramConfig,saveTelegramConfig,saveGlobalTelegramConfig,sendTelegramConfig,GlobalTelegramConfig} from '../../../server/telegram';

const validChat=(v:string)=>v.length<=128&&(!v||/^-?\d{1,24}$/.test(v)||/^@?[A-Za-z0-9_]{5,64}$/.test(v));
const validToken=(v:string)=>v.length<=512&&(!v||/^[0-9]{5,}:[A-Za-z0-9_-]{20,}$/.test(v));
async function legacyGlobal(db:any){
 const rows:any=await db.prepare("SELECT value FROM settings WHERE key='telegram' OR key LIKE 'net-%:telegram' ORDER BY CASE WHEN key='telegram' THEN 0 ELSE 1 END,key").all();
 for(const row of rows.results||[]){try{const c=JSON.parse(row.value);if(c.enabled&&c.chatId&&c.tokenCipher)return {ownerChatId:String(c.chatId),tokenCipher:String(c.tokenCipher),summaryEnabled:true,summaryTime:'08:00'} as GlobalTelegramConfig;}catch{}}
 return null;
}

export async function GET(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được cấu hình Telegram.'},403);
 try{const db=database(),scope=new URL(req.url).searchParams.get('scope')||'project';
  if(scope==='global'){
   const current=await getGlobalTelegramConfig(db),legacy=await legacyGlobal(db),c=current.tokenCipher?current:legacy||current;let configured=false;try{configured=!!c.tokenCipher&&!!decryptSecret(c.tokenCipher);}catch{}
   return json({ownerChatId:c.ownerChatId||'',tokenConfigured:configured,summaryEnabled:c.summaryEnabled!==false,summaryTime:/^([01]\d|2[0-3]):[0-5]\d$/.test(c.summaryTime)?c.summaryTime:'08:00',legacy:!current.tokenCipher&&!!legacy});
  }
  if(scope!=='project')return json({error:'Phạm vi cấu hình không hợp lệ.'},400);
  const id=projectId(req);if(!await findProject(db,id))return json({error:'Không tìm thấy dự án.'},404);
  const row:any=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(id,'telegram_project')).first();const c=row?JSON.parse(row.value):{enabled:false,chatId:''};
  return json({enabled:!!c.enabled,chatId:String(c.chatId||''),configured:!!row});
 }catch{return json({error:'Không đọc được cấu hình Telegram.'},500);}
}

export async function POST(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được cấu hình Telegram.'},403);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const db=database(),input:any=await req.json(),scope=String(input.scope||'project'),id=projectId(req),action=String(input.action||'');
  if(scope==='global'){
   const old=await getGlobalTelegramConfig(db),legacy=old.tokenCipher?null:await legacyGlobal(db),base=old.tokenCipher?old:legacy||old;
   const ownerChatId=String(input.ownerChatId??base.ownerChatId??'').trim(),rawToken=typeof input.botToken==='string'?input.botToken.trim():'';
   if(!validChat(ownerChatId))return json({error:'Chat ID cá nhân không hợp lệ.'},400);if(!validToken(rawToken))return json({error:'Bot Token có định dạng không hợp lệ.'},400);
   const tokenCipher=input.clearToken?undefined:rawToken?encryptSecret(rawToken):base.tokenCipher;
   const summaryTime=String(input.summaryTime??base.summaryTime??'08:00');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(summaryTime))return json({error:'Giờ gửi bản tin phải theo định dạng HH:MM.'},400);
   if(action==='test'){
    if(!ownerChatId||!tokenCipher)return json({error:'Nhập Chat ID cá nhân và Bot Token trước khi gửi thử.'},400);
    const ok=await sendTelegramConfig({enabled:true,chatId:ownerChatId,tokenCipher},'✅ NetWatch: gửi thử thành công tới tài khoản nhận tổng.');if(!ok)return json({error:'Không gửi được. Kiểm tra Bot Token, Chat ID và nhắn /start cho bot trước.'},502);return json({ok:true});
   }
   if(action!=='save')return json({error:'Thao tác không hợp lệ.'},400);
   if(ownerChatId&&!tokenCipher)return json({error:'Cần Bot Token để bật cảnh báo Telegram.'},400);
   const value:GlobalTelegramConfig={ownerChatId,tokenCipher,summaryEnabled:input.summaryEnabled!==false,summaryTime};await saveGlobalTelegramConfig(db,value);
   return json({ok:true,ownerChatId,tokenConfigured:!!tokenCipher,summaryEnabled:value.summaryEnabled,summaryTime});
  }
  if(scope!=='project')return json({error:'Phạm vi cấu hình không hợp lệ.'},400);
  const project=await findProject(db,id);if(!project)return json({error:'Không tìm thấy dự án.'},404);const old=await getTelegramConfig(db,id);
  const chatId=String(input.chatId??old.chatId??'').trim(),enabled=!!input.enabled;
  if(!validChat(chatId))return json({error:'Chat ID nhóm không hợp lệ.'},400);
  if(action==='test'){
   const global=await getGlobalTelegramConfig(db),legacy=global.tokenCipher?null:await legacyGlobal(db),tokenCipher=global.tokenCipher||legacy?.tokenCipher;
   if(!chatId||!tokenCipher)return json({error:'Cần cấu hình Bot Token dùng chung và Chat ID nhóm trước khi gửi thử.'},400);
   const ok=await sendTelegramConfig({enabled:true,chatId,tokenCipher},`✅ NetWatch: gửi thử nhóm dự án ${project.name||id}.`);if(!ok)return json({error:'Không gửi được. Thêm bot vào nhóm và cấp quyền gửi tin nhắn.'},502);return json({ok:true});
  }
  if(action!=='save')return json({error:'Thao tác không hợp lệ.'},400);
  if(enabled&&!chatId)return json({error:'Nhập Chat ID nhóm để bật gửi cảnh báo dự án.'},400);
  await saveTelegramConfig(db,id,{enabled,chatId});return json({ok:true,enabled,chatId,configured:true});
 }catch{return json({error:'Không lưu được cấu hình Telegram.'},500);}
}
