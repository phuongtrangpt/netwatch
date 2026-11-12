import {readFileSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
const file=join(process.env.DATA_DIR||'/data','support.json');
export type Support={enabled:boolean,title:string,message:string,name:string,phone:string,facebook:string,position:'top'|'bottom',audience:'all'|'viewer'};
const defaults:Support={enabled:true,title:'HỖ TRỢ KỸ THUẬT',message:'Nếu gặp sự cố kỹ thuật hoặc mất kết nối mạng, vui lòng liên hệ kỹ thuật viên để được hỗ trợ.',name:'Việt Phương',phone:'0963839369',facebook:'https://www.facebook.com/leviethoaiphuong/',position:'top',audience:'all'};
export function getSupport():Support{try{return {...defaults,...JSON.parse(readFileSync(file,'utf8'))};}catch{return defaults;}}
export function saveSupport(input:any):Support{
 if(!input||typeof input.enabled!=='boolean'||!['top','bottom'].includes(input.position)||!['all','viewer'].includes(input.audience))throw Error('Cấu hình không hợp lệ');
 for(const [key,max] of Object.entries({title:100,message:500,name:100,phone:30,facebook:300}))if(typeof input[key]!=='string'||input[key].length>max)throw Error('Thông tin hỗ trợ không hợp lệ');
 if(input.phone&&!/^\\+?[0-9 .()-]{7,30}$/.test(input.phone))throw Error('Số điện thoại không hợp lệ');
 if(input.facebook){let url:URL;try{url=new URL(input.facebook);}catch{throw Error('Liên kết Facebook không hợp lệ');}if(url.protocol!=='https:'||!['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname))throw Error('Liên kết Facebook phải dùng HTTPS và thuộc facebook.com');}
 const value:Support={enabled:input.enabled,title:input.title,message:input.message,name:input.name,phone:input.phone,facebook:input.facebook,position:input.position,audience:input.audience};
 writeFileSync(file+'.tmp',JSON.stringify(value),{mode:0o600});renameSync(file+'.tmp',file);return value;
}
