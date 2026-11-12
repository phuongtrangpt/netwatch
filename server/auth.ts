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
export function checkPassword(password:string){return timingSafeEqual(scryptSync(password,credentials.salt,32),Buffer.from(credentials.hash,'hex'));}
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
 const token=/(?:^|;\s*)netwatch=([^;]+)/.exec(cookie)?.[1];if(!token)return null;
 const parts=token.split('.');if(parts.length!==4)return null;const sig=parts.pop()!,payload=parts.join('.');
 if(!/^\d+$/.test(parts[1])||+parts[1]<=Date.now()||!/^[a-f0-9]{64}$/.test(sig)||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload),'hex')))return null;
 if(parts[0]==='owner')return 'owner';
 const v=viewers.find(v=>v.enabled&&parts[0]==='viewer:'+v.username+':'+v.revision);return v?'viewer:'+v.username:null;
}
export function accountName(identity:string){return identity==='owner'?'admin':identity.slice(7);}
export function canView(identity:string|null,project:string,module:Module){if(identity==='owner')return true;if(!identity?.startsWith('viewer:'))return false;const v=viewers.find(v=>v.username===identity.slice(7)&&v.enabled);return !!v&&(v.permissions[project]||v.permissions['*']||[]).includes(module);}
export function projectAccess(identity:string|null,project:string){if(identity==='owner')return true;if(!identity?.startsWith('viewer:'))return false;const v=viewers.find(v=>v.username===identity.slice(7)&&v.enabled);return !!v&&((v.permissions[project]||v.permissions['*']||[]).length>0);}
export function visiblePermissions(identity:string|null){if(identity==='owner')return null;const v=viewers.find(v=>identity==='viewer:'+v.username&&v.enabled);return v?.permissions||{};}
export const loginHTML=`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#08172f"><title>NetWatch | Đăng nhập giám sát mạng</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
*{box-sizing:border-box}body{min-height:100svh;margin:0;color:#eef5ff;background:radial-gradient(ellipse at 75% 10%,#0b4471 0%,transparent 43%),radial-gradient(ellipse at 10% 90%,#12415a 0%,transparent 44%),linear-gradient(140deg,#061022,#0a1933 55%,#041222);display:flex;flex-direction:column}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(#64a8f522 1px,transparent 1px),linear-gradient(90deg,#64a8f522 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(90deg,#000,transparent 90%)}
main{width:min(100%,1140px);margin:auto;padding:42px 24px;display:grid;grid-template-columns:1fr minmax(320px,420px);align-items:center;gap:8vw;position:relative}
.hero .eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.2em;color:#7bc9ff;font-weight:800}
.hero h2{font-size:clamp(36px,4.5vw,62px);letter-spacing:-.045em;line-height:1.12;margin:18px 0}
.hero h2 span{color:#78d0ff}.hero p{max-width:510px;color:#b3c7df;line-height:1.7;font-size:17px}
.features{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.features span{border:1px solid #41617d;background:#11355388;padding:10px 12px;border-radius:99px;font-size:12px;color:#c9e7ff}
form{background:linear-gradient(160deg,#142c49f5,#0a1e36f5);border:1px solid #3d6287;box-shadow:0 24px 80px #0006;border-radius:24px;padding:clamp(26px,4vw,38px);backdrop-filter:blur(15px)}
.wordmark{display:flex;align-items:center;gap:11px}.mark{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#4bb8ff,#267be9);display:grid;place-items:center;font-size:21px;font-weight:900;color:white}
h1{font-size:29px;letter-spacing:-.045em;margin:0}form .sub{font-size:14px;color:#afc7dd;line-height:1.5;margin:14px 0 24px}
label{display:block;font-size:13px;color:#cbdcf0;font-weight:650;margin:15px 0}
input{width:100%;margin-top:8px;height:47px;border:1px solid #41617d;border-radius:11px;padding:0 13px;background:#081b30;color:white;font:inherit;outline:0}
input:focus{border-color:#60c5ff;box-shadow:0 0 0 3px #2c95e22c}button{width:100%;margin-top:15px;border:0;border-radius:11px;background:linear-gradient(105deg,#3c9de9,#3164e2);box-shadow:0 8px 22px #1676dd30;color:#fff;font:700 15px inherit;min-height:48px;cursor:pointer}button:hover{filter:brightness(1.11)}
.form-note{font-size:12px;text-align:center;color:#a9c5da;margin:18px 0 0}a{color:#85d3ff;text-decoration:none}a:hover{text-decoration:underline}
footer{position:relative;text-align:center;padding:20px 20px 28px;border-top:1px solid #28445b;color:#a9bed0;font-size:12px;line-height:2}footer a{overflow-wrap:anywhere}
@media(max-width:780px){main{grid-template-columns:1fr;gap:25px;padding:25px 16px}.hero h2{font-size:30px;margin:10px 0}.hero p{font-size:14px}.features{margin-top:16px}.hero .eyebrow{font-size:10px}form{max-width:480px;width:100%;margin:0 auto}footer{font-size:11px;padding:12px 14px 18px}}
</style></head><body><main><section class="hero"><div class="eyebrow">Network Operations Center · NetWatch</div><h2>Hệ thống <span>giám sát mạng</span> chuyên nghiệp</h2><p>Theo dõi hạ tầng MikroTik, đường truyền, thiết bị và sơ đồ mạng tại một nơi. Dữ liệu từng dự án được phân quyền riêng tư.</p><div class="features"><span>● Theo dõi thời gian thực</span><span>● Sơ đồ trực quan</span><span>● Phân quyền bảo mật</span></div></section>
<form method="post" action="/login" autocomplete="on"><div class="wordmark"><span class="mark" aria-hidden="true">N</span><h1>NetWatch</h1></div><p class="sub">Đăng nhập để truy cập hệ thống giám sát mạng.</p><label>Tên đăng nhập<input name="username" required maxlength="32" autocomplete="username" value="admin" autocapitalize="none" spellcheck="false"></label><label>Mật khẩu<input type="password" name="password" required maxlength="256" autocomplete="current-password"></label><button type="submit">Đăng nhập hệ thống</button><p class="form-note">Hệ thống được cung cấp và sử dụng miễn phí.</p></form></main>
<footer>© 2026 Việt Phương · Hỗ trợ kỹ thuật: <a href="tel:0963839369">0963 839 369</a> · Facebook: <a href="https://www.facebook.com/leviethoaiphuong/" target="_blank" rel="noopener noreferrer">https://www.facebook.com/leviethoaiphuong/</a></footer></body></html>`;