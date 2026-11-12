import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const directory=process.env.DATA_DIR||'/data',path=join(directory,'auth.json');
if(!existsSync(path)){
 const password=process.env.NETWATCH_PASSWORD;
 if(!password||password.length<12)throw Error('Lần chạy đầu: đặt NETWATCH_PASSWORD ít nhất 12 ký tự (hoặc password trong cấu hình add-on).');
 const salt=randomBytes(16).toString('hex');
 writeFileSync(path,JSON.stringify({salt,hash:scryptSync(password,salt,32).toString('hex'),key:randomBytes(32).toString('hex')}),{mode:0o600,flag:'wx'});
}
const credentials=JSON.parse(readFileSync(path,'utf8'));
export function checkPassword(password:string){return timingSafeEqual(scryptSync(password,credentials.salt,32),Buffer.from(credentials.hash,'hex'));}
const signature=(payload:string)=>createHmac('sha256',credentials.key).update(payload).digest('hex');
export function session(){const payload=`owner.${Date.now()+86400000}.${randomBytes(16).toString('hex')}`;return `${payload}.${signature(payload)}`;}
export function authenticated(cookie:string){const token=/(?:^|;\s*)netwatch=([^;]+)/.exec(cookie)?.[1];if(!token)return false;const parts=token.split('.');if(parts.length!==4)return false;const sig=parts.pop()!,payload=parts.join('.');return /^\d+$/.test(parts[1])&&+parts[1]>Date.now()&&/^[a-f0-9]{64}$/.test(sig)&&timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload),'hex'));}
export const loginHTML=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetWatch · Đăng nhập</title><style>body{font:16px system-ui;background:#f3f1fa;color:#233c35;display:grid;place-items:center;min-height:90vh;margin:0}form{background:white;padding:32px;border-radius:18px;width:min(320px,80vw)}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:16px;border:1px solid #ccc;border-radius:8px}button{background:#6637b8;color:white;border:0}</style><form method="post" action="/login"><h1>NetWatch</h1><p>Giám sát mạng trên Raspberry Pi</p><label>Mật khẩu quản trị<input type="password" name="password" required autofocus maxlength="256" autocomplete="current-password"></label><button>Đăng nhập</button></form></html>`;
