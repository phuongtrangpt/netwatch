import {browserUser,database,json,sameOrigin} from '../../../lib/server';

const defaultName='Quản trị viên';
function currentName(value:any){try{const parsed=JSON.parse(value||'{}');return typeof parsed.displayName==='string'&&parsed.displayName.trim()?parsed.displayName.trim():defaultName;}catch{return defaultName;}}
export async function GET(){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được xem cấu hình hồ sơ.'},403);
 try{const row:any=await database().prepare("SELECT value FROM settings WHERE key='admin_profile'").first();return json({displayName:currentName(row?.value)});}catch{return json({error:'Không đọc được tên hiển thị.'},503);}
}
export async function POST(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ Admin được đổi tên hiển thị.'},403);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{const input:any=await req.json(),name=typeof input.displayName==='string'?input.displayName.trim().replace(/\s+/g,' '):'';if(!name||[...name].length>40||/[\u0000-\u001f\u007f]/.test(name))return json({error:'Tên hiển thị cần từ 1 đến 40 ký tự.'},400);
  await database().prepare("INSERT INTO settings(key,value) VALUES ('admin_profile',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({displayName:name})).run();return json({ok:true,displayName:name});
 }catch{return json({error:'Không lưu được tên hiển thị.'},500);}
}
