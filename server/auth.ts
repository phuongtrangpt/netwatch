import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
export type Role='owner'|'viewer';
const directory=process.env.DATA_DIR||'/data',path=join(directory,'auth.json'),viewerPath=join(directory,'viewer.json');
if(!existsSync(path)){
 const password=process.env.NETWATCH_PASSWORD;
 if(!password||password.length<12)throw Error('Lần chạy đầu: đặt NETWATCH_PASSWORD ít nhất 12 ký tự (hoặc password trong cấu hình add-on).');
 const salt=randomBytes(16).toString('hex');
 writeFileSync(path,JSON.stringify({salt,hash:scryptSync(password,salt,32).toString('hex'),key:randomBytes(32).toString('hex')}),{mode:0o600,flag:'wx'});
}
const credentials=JSON.parse(readFileSync(path,'utf8'));
let viewer=existsSync(viewerPath)?JSON.parse(readFileSync(viewerPath,'utf8')):{enabled:false,username:'view',revision:randomBytes(16).toString('hex')};
export function checkPassword(password:string){return timingSafeEqual(scryptSync(password,credentials.salt,32),Buffer.from(credentials.hash,'hex'));}
export function viewerInfo(){return {enabled:!!viewer.enabled,username:viewer.username};}
export function saveViewer(input:any){
 if(!input||typeof input.enabled!=='boolean'||typeof input.username!=='string'||typeof input.password!=='string')throw Error('Dữ liệu tài khoản không hợp lệ.');
 const username=input.username.trim();
 if(!/^[a-zA-Z0-9._-]{1,32}$/.test(username)||['admin','owner'].includes(username.toLowerCase()))throw Error('Tên đăng nhập gồm 1–32 chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới; không dùng admin/owner.');
 const password=input.password;
 if(password&&(password.length<12||password.length>256))throw Error('Mật khẩu cần từ 12 đến 256 ký tự.');
 if(input.enabled&&!viewer.hash&&!password)throw Error('Cần đặt mật khẩu khi tạo tài khoản chỉ xem.');
 if(password&&checkPassword(password))throw Error('Mật khẩu chỉ xem phải khác mật khẩu quản trị.');
 const next={...viewer,username,enabled:input.enabled,revision:randomBytes(16).toString('hex')};
 if(password){next.salt=randomBytes(16).toString('hex');next.hash=scryptSync(password,next.salt,32).toString('hex');}
 writeFileSync(viewerPath+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(viewerPath+'.tmp',viewerPath);viewer=next;
 return viewerInfo();
}
export function checkLogin(username:string,password:string):Role|null{
 if((username==='admin'||username==='')&&checkPassword(password))return 'owner';
 if(viewer.enabled&&username===viewer.username&&viewer.hash&&timingSafeEqual(scryptSync(password,viewer.salt,32),Buffer.from(viewer.hash,'hex')))return 'viewer';
 return null;
}
const signature=(payload:string)=>createHmac('sha256',credentials.key).update(payload).digest('hex');
export function session(role:Role='owner'){const identity=role==='owner'?'owner':'viewer:'+viewer.revision;const payload=`${identity}.${Date.now()+86400000}.${randomBytes(16).toString('hex')}`;return `${payload}.${signature(payload)}`;}
export function authenticated(cookie:string):Role|null{
 const token=/(?:^|;\s*)netwatch=([^;]+)/.exec(cookie)?.[1];if(!token)return null;
 const parts=token.split('.');if(parts.length!==4)return null;const sig=parts.pop()!,payload=parts.join('.');
 if(!/^\d+$/.test(parts[1])||+parts[1]<=Date.now()||!/^[a-f0-9]{64}$/.test(sig)||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload),'hex')))return null;
 if(parts[0]==='owner')return 'owner';
 return viewer.enabled&&parts[0]==='viewer:'+viewer.revision?'viewer':null;
}
export function accountName(role:Role){return role==='owner'?'admin':viewer.username;}
export const loginHTML=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetWatch · Đăng nhập</title><style>body{font:16px system-ui;background:#f3f1fa;color:#233c35;display:grid;place-items:center;min-height:90vh;margin:0}form{background:white;padding:32px;border-radius:18px;width:min(320px,80vw)}label{display:block;margin-top:16px}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:8px;border:1px solid #ccc;border-radius:8px}button{background:#6637b8;color:white;border:0;margin-top:20px}</style><form method="post" action="/login"><h1>NetWatch</h1><p>Giám sát mạng trên Raspberry Pi</p><label>Tên đăng nhập<input name="username" value="admin" required maxlength="32" autocomplete="username" autofocus autocapitalize="none"></label><label>Mật khẩu<input type="password" name="password" required maxlength="256" autocomplete="current-password"></label><button>Đăng nhập</button></form></html>`;
