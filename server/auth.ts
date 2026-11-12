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
export const MODULES=['overview','topology','wan','lan','clients','ports','routes','pppoe','events'] as const;
export type Module=typeof MODULES[number];
type Viewer={username:string;enabled:boolean;salt?:string;hash?:string;revision:string;permissions:Record<string,Module[]>};
let legacy=existsSync(viewerPath)?JSON.parse(readFileSync(viewerPath,'utf8')):null;
const accountsPath=join(directory,'viewers.json');
let viewers:Viewer[]=existsSync(accountsPath)?JSON.parse(readFileSync(accountsPath,'utf8')):[];
if(!existsSync(accountsPath)&&legacy?.hash)viewers=[{...legacy,permissions:{'*':[...MODULES]}}];
function persist(){writeFileSync(accountsPath+'.tmp',JSON.stringify(viewers),{mode:0o600});renameSync(accountsPath+'.tmp',accountsPath);}
if(!existsSync(accountsPath))persist();
export function viewerInfo(){return viewers.map(({username,enabled,permissions})=>({username,enabled,permissions}));}
export function saveViewer(input:any){
 if(!input||typeof input.enabled!=='boolean'||typeof input.username!=='string'||typeof input.password!=='string')throw Error('Dữ liệu tài khoản không hợp lệ.');
 const username=input.username.trim();
 if(!/^[a-zA-Z0-9._-]{1,32}$/.test(username)||['admin','owner'].includes(username.toLowerCase()))throw Error('Tên tài khoản không hợp lệ.');
 const old=viewers.find(v=>v.username===username);
 if(viewers.length>=50&&!old)throw Error('Tối đa 50 tài khoản.');
 if(input.password&&(input.password.length<12||input.password.length>256||checkPassword(input.password)))throw Error('Mật khẩu phải từ 12 đến 256 ký tự và khác mật khẩu Admin.');
 if(input.enabled&&!old?.hash&&!input.password)throw Error('Tài khoản mới cần mật khẩu.');
 const permissions:Record<string,Module[]>={};
 if(!input.permissions||typeof input.permissions!=='object'||Array.isArray(input.permissions)||Object.keys(input.permissions).length>25)throw Error('Quyền dự án không hợp lệ.');
 for(const [id,modules] of Object.entries(input.permissions)){
  if(id!=='*'&&!/^main$|^net-[a-f0-9]{32}$/.test(id))throw Error('Mã dự án không hợp lệ.');
  if(!Array.isArray(modules)||modules.length>MODULES.length||modules.some(m=>!MODULES.includes(m as Module)))throw Error('Quyền chức năng không hợp lệ.');
  permissions[id]=[...new Set(modules as Module[])];
 }
 const next:Viewer={...old,username,enabled:input.enabled,permissions,revision:randomBytes(16).toString('hex')};
 if(input.password){next.salt=randomBytes(16).toString('hex');next.hash=scryptSync(input.password,next.salt,32).toString('hex');}
 viewers=[...viewers.filter(v=>v.username!==username),next];persist();return viewerInfo();
}
export function removeViewer(username:string){viewers=viewers.filter(v=>v.username!==username);persist();return viewerInfo();}
export function checkLogin(username:string,password:string):string|null{
 if((username==='admin'||username==='')&&checkPassword(password))return 'owner';
 const v=viewers.find(v=>v.enabled&&v.username===username);
 if(v?.hash&&v.salt&&timingSafeEqual(scryptSync(password,v.salt,32),Buffer.from(v.hash,'hex')))return 'viewer:'+v.username;
 return null;
}
const signature=(payload:string)=>createHmac('sha256',credentials.key).update(payload).digest('hex');
export function session(identity:string='owner'){const v=viewers.find(v=>'viewer:'+v.username===identity);const subject=identity==='owner'?'owner':v?'viewer:'+v.username+':'+v.revision:'invalid';const payload=`${subject}.${Date.now()+86400000}.${randomBytes(16).toString('hex')}`;return `${payload}.${signature(payload)}`;}
export function authenticated(cookie:string):string|null{
 const token=/(?:^|;\\s*)netwatch=([^;]+)/.exec(cookie)?.[1];if(!token)return null;
 const parts=token.split('.');if(parts.length!==4)return null;const sig=parts.pop()!,payload=parts.join('.');
 if(!/^\\d+$/.test(parts[1])||+parts[1]<=Date.now()||!/^[a-f0-9]{64}$/.test(sig)||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload),'hex')))return null;
 if(parts[0]==='owner')return 'owner';
 const v=viewers.find(v=>v.enabled&&parts[0]==='viewer:'+v.username+':'+v.revision);return v?'viewer:'+v.username:null;
}
export function accountName(identity:string){return identity==='owner'?'admin':identity.slice(7);}
export function canView(identity:string|null,project:string,module:Module){if(identity==='owner')return true;if(!identity?.startsWith('viewer:'))return false;const v=viewers.find(v=>v.username===identity.slice(7)&&v.enabled);return !!v&&(v.permissions[project]||v.permissions['*']||[]).includes(module);}
export function projectAccess(identity:string|null,project:string){if(identity==='owner')return true;if(!identity?.startsWith('viewer:'))return false;const v=viewers.find(v=>v.username===identity.slice(7)&&v.enabled);return !!v&&((v.permissions[project]||v.permissions['*']||[]).length>0);}
export function visiblePermissions(identity:string|null){if(identity==='owner')return null;const v=viewers.find(v=>identity==='viewer:'+v.username&&v.enabled);return v?.permissions||{};}
export const loginHTML=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetWatch · Đăng nhập</title><style>body{font:16px system-ui;background:#f3f1fa;color:#233c35;display:grid;place-items:center;min-height:90vh;margin:0}form{background:white;padding:32px;border-radius:18px;width:min(320px,80vw)}label{display:block;margin-top:16px}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:8px;border:1px solid #ccc;border-radius:8px}button{background:#6637b8;color:white;border:0;margin-top:20px}</style><form method="post" action="/login"><h1>NetWatch</h1><p>Giám sát mạng trên Raspberry Pi</p><label>Tên đăng nhập<input name="username" value="admin" required maxlength="32" autocomplete="username" autofocus autocapitalize="none"></label><label>Mật khẩu<input type="password" name="password" required maxlength="256" autocomplete="current-password"></label><button>Đăng nhập</button></form></html>`;
