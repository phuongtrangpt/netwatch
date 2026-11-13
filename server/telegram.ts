import {decryptSecret} from './auth';
import {scopedKey} from '../lib/projects';

type Store={prepare:(sql:string)=>any};
export type TelegramConfig={enabled:boolean;chatId:string;tokenCipher?:string};

export async function getTelegramConfig(db:Store,project:string):Promise<TelegramConfig>{
 const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(scopedKey(project,'telegram')).first();
 return row?JSON.parse(row.value):{enabled:false,chatId:''};
}

export async function saveTelegramConfig(db:Store,project:string,value:TelegramConfig){
 await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(scopedKey(project,'telegram'),JSON.stringify(value)).run();
}

export async function sendTelegramConfig(config:TelegramConfig,message:string):Promise<boolean>{
 try{
  if(!config.chatId||!config.tokenCipher)return false;
  const token=decryptSecret(config.tokenCipher);
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:config.chatId,text:message,disable_web_page_preview:true}),signal:AbortSignal.timeout(7000)});
  if(!response.ok)return false;const result:any=await response.json();return result?.ok===true;
 }catch{return false;}
}

export async function sendTelegram(db:Store,project:string,message:string):Promise<boolean>{
 try{const config=await getTelegramConfig(db,project);return config.enabled?sendTelegramConfig(config,message):false;}catch{return false;}
}
