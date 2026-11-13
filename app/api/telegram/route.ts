import {browserUser,database,json,sameOrigin} from '../../../lib/server';
import {projectId,scopedKey,findProject} from '../../../lib/projects';
import {decryptSecret,encryptSecret} from '../../../server/auth';
import {getTelegramConfig,saveTelegramConfig,sendTelegramConfig} from '../../../server/telegram';

export async function GET(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được cấu hình Telegram.'},403);
 try{const db=database(),id=projectId(req);if(!await findProject(db,id))return json({error:'Không tìm thấy dự án.'},404);const c=await getTelegramConfig(db,id);let configured=false;try{configured=!!c.tokenCipher&&!!decryptSecret(c.tokenCipher);}catch{}return json({enabled:!!c.enabled,chatId:c.chatId||'',tokenConfigured:configured});}catch{return json({error:'Không đọc được cấu hình Telegram.'},500);}
}

export async function POST(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được cấu hình Telegram.'},403);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const db=database(),id=projectId(req);if(!await findProject(db,id))return json({error:'Không tìm thấy dự án.'},404);const input:any=await req.json();const old=await getTelegramConfig(db,id);
  const chatId=String(input.chatId??old.chatId??'').trim(),enabled=!!input.enabled,clearToken=!!input.clearToken,rawToken=typeof input.botToken==='string'?input.botToken.trim():'';
  if(chatId.length>128|| (chatId&&!/^@?[A-Za-z0-9_+-]+$/.test(chatId)))return json({error:'Chat ID không hợp lệ.'},400);
  if(rawToken.length>512|| (rawToken&&!/^[0-9]{5,}:[A-Za-z0-9_-]{20,}$/.test(rawToken)))return json({error:'Bot Token có định dạng không hợp lệ.'},400);
  const tokenCipher=clearToken?undefined:rawToken?encryptSecret(rawToken):old.tokenCipher;
  if(input.action==='test'){
   if(!chatId||!tokenCipher)return json({error:'Nhập Chat ID và Bot Token rồi bấm Lưu trước.'},400);
   const project=await findProject(db,id),ok=await sendTelegramConfig({enabled:true,chatId,tokenCipher},`✅ NetWatch: gửi thử thành công cho dự án ${project?.name||id}.`);
   if(!ok)return json({error:'Không gửi được. Kiểm tra Bot Token, Chat ID và nhắn /start cho bot trước.'},502);
   return json({ok:true});
  }
  if(input.action!=='save')return json({error:'Thao tác không hợp lệ.'},400);
  if(enabled&&(!chatId||!tokenCipher))return json({error:'Cần Chat ID và Bot Token để bật cảnh báo.'},400);
  await saveTelegramConfig(db,id,{enabled,chatId,tokenCipher});return json({ok:true,enabled,chatId,tokenConfigured:!!tokenCipher});
 }catch{return json({error:'Không lưu được cấu hình Telegram.'},500);}
}
