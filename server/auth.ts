import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
export type Role='owner'|'viewer';
export type Account={role:Role;username:string;id?:string;projectIds?:string[];viewIds?:string[]};
export const VIEW_IDS=['overview','topology','wan','lan','clients','ports','routes','pppoe','events'];
const directory=process.env.DATA_DIR||'/data',path=join(directory,'auth.json'),viewerPath=join(directory,'viewer.json');
if(!existsSync(path)){
 const password=process.env.NETWATCH_PASSWORD;
 if(!password||password.length<12)throw Error('Lần chạy đầu: đặt NETWATCH_PASSWORD ít nhất 12 ký tự (hoặc password trong cấu hình add-on).');
 const salt=randomBytes(16).toString('hex');
 writeFileSync(path,JSON.stringify({salt,hash:scryptSync(password,salt,32).toString('hex'),key:randomBytes(32).toString('hex')}),{mode:0o600,flag:'wx'});
}
const credentials=JSON.parse(readFileSync(path,'utf8'));
const existing=existsSync(viewerPath)?JSON.parse(readFileSync(viewerPath,'utf8')):null;
let viewers:any[]=existing?.schemaVersion===2?existing.accounts:[];
function persist(accounts:any[]){writeFileSync(viewerPath+'.tmp',JSON.stringify({schemaVersion:2,accounts}),{mode:0o600});renameSync(viewerPath+'.tmp',viewerPath);viewers=accounts;}
export function initializeViewers(projectIds:string[]){
 // Preserve the legacy viewer's access to CURRENT projects; never grant future projects implicitly.
 if(existing&&existing.schemaVersion!==2){const accounts=existing.hash?[{...existing,id:'viewer-'+randomBytes(16).toString('hex'),projectIds:[...new Set(projectIds)],viewIds:[...VIEW_IDS],legacySession:true}]:[];persist(accounts);}
}
export function checkPassword(password:string){return timingSafeEqual(scryptSync(password,credentials.salt,32),Buffer.from(credentials.hash,'hex'));}
const info=(v:any)=>({id:v.id,enabled:!!v.enabled,username:v.username,projectIds:[...v.projectIds],viewIds:[...(v.viewIds||VIEW_IDS)]});
export function viewerList(){return viewers.map(info);}
export function viewerInfo(){return viewers[0]?info(viewers[0]):{enabled:false,username:'view'};}
export function saveViewer(input:any,validProjectIds:string[],validViewIds:string[]=VIEW_IDS){
 if(!input||typeof input!=='object')throw Error('Dữ liệu tài khoản không hợp lệ.');
 const old=input.id?viewers.find(v=>v.id===input.id):null;
 if(input.id&&!old)throw Error('Không tìm thấy tài khoản.');
 if(input.action==='delete'){if(!old)throw Error('Không tìm thấy tài khoản.');persist(viewers.filter(v=>v.id!==old.id));return;}
 if(typeof input.enabled!=='boolean'||typeof input.username!=='string'||typeof input.password!=='string')throw Error('Dữ liệu tài khoản không hợp lệ.');
 const username=input.username.trim(),password=input.password;
 if(!/^[a-zA-Z0-9._-]{1,32}$/.test(username)||['admin','owner'].includes(username.toLowerCase()))throw Error('Tên đăng nhập gồm 1–32 chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới; không dùng admin/owner.');
 if(viewers.some(v=>v.id!==old?.id&&v.username.toLowerCase()===username.toLowerCase()))throw Error('Tên đăng nhập đã được sử dụng.');
 if(!old&&viewers.length>=100)throw Error('Tối đa 100 tài khoản chỉ xem.');
 if(password&&(password.length<12||password.length>256))throw Error('Mật khẩu cần từ 12 đến 256 ký tự.');
 if(!old?.hash&&!password)throw Error('Cần đặt mật khẩu cho tài khoản mới.');
 if(password&&checkPassword(password))throw Error('Mật khẩu chỉ xem phải khác mật khẩu quản trị.');
 if(!Array.isArray(input.projectIds)||input.projectIds.length>20||input.projectIds.some((id:any)=>typeof id!=='string'||!validProjectIds.includes(id)))throw Error('Chỉ chọn các dự án đang có trong danh sách.');
 const projectIds=[...new Set(input.projectIds)] as string[];
 const requestedViews=input.viewIds===undefined?validViewIds:input.viewIds;
 if(!Array.isArray(requestedViews)||requestedViews.length>validViewIds.length||requestedViews.some((id:any)=>typeof id!=='string'||!validViewIds.includes(id)))throw Error('Chỉ chọn các mục hiển thị đang có trong danh sách.');
 const viewIds=[...new Set(requestedViews)] as string[];
 if(input.enabled&&!viewIds.length)throw Error('Chọn ít nhất một mục hiển thị cho tài khoản đang bật.');
 if(input.enabled&&!projectIds.length)throw Error('Chọn ít nhất một dự án cho tài khoản đang bật.');
 const next={...old,id:old?.id||'viewer-'+randomBytes(16).toString('hex'),username,enabled:input.enabled,projectIds,viewIds,legacySession:false,revision:randomBytes(16).toString('hex')};
 if(password){next.salt=randomBytes(16).toString('hex');next.hash=scryptSync(password,next.salt,32).toString('hex');}
 persist(old?viewers.map(v=>v.id===old.id?next:v):[...viewers,next]);return info(next);
}
const owner:Account={role:'owner',username:'admin'};
const viewerAccount=(v:any):Account=>({role:'viewer',username:v.username,id:v.id,projectIds:[...v.projectIds],viewIds:[...(v.viewIds||VIEW_IDS)]});
export function checkLogin(username:string,password:string):Account|null{
 if((username==='admin'||username==='')&&checkPassword(password))return owner;
 const viewer=viewers.find(v=>v.enabled&&v.username===username);
 return viewer&&timingSafeEqual(scryptSync(password,viewer.salt,32),Buffer.from(viewer.hash,'hex'))?viewerAccount(viewer):null;
}
const signature=(payload:string)=>createHmac('sha256',credentials.key).update(payload).digest('hex');
export function session(account:Account=owner){const viewer=account.role==='viewer'?viewers.find(v=>v.id===account.id):null;const identity=account.role==='owner'?'owner':`viewer:${viewer.id}:${viewer.revision}`;const payload=`${identity}.${Date.now()+86400000}.${randomBytes(16).toString('hex')}`;return `${payload}.${signature(payload)}`;}
export function authenticated(cookie:string):Account|null{
 const token=/(?:^|;\s*)netwatch=([^;]+)/.exec(cookie)?.[1];if(!token)return null;
 const parts=token.split('.');if(parts.length!==4)return null;const sig=parts.pop()!,payload=parts.join('.');
 if(!/^\d+$/.test(parts[1])||+parts[1]<=Date.now()||!/^[a-f0-9]{64}$/.test(sig)||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload),'hex')))return null;
 if(parts[0]==='owner')return owner;
 const viewer=viewers.find(v=>v.enabled&&(parts[0]===`viewer:${v.id}:${v.revision}`||(v.legacySession&&parts[0]==='viewer:'+v.revision)));
 return viewer?viewerAccount(viewer):null;
}
