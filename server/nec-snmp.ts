import snmp from 'net-snmp';
import {isIP} from 'node:net';

export type NECConfig={enabled:boolean;host:string;port:number;community:string};
export function validateNECConfig(input:any,old?:NECConfig):NECConfig{
 if(!input||typeof input.enabled!=='boolean'||typeof input.host!=='string'||isIP(input.host.trim())!==4)throw Error('Nhập IPv4 quản trị của router NEC trong LAN/VPN.');
 const host=input.host.trim(),parts=host.split('.').map(Number),port=Number(input.port);
 if(parts[0]===0||parts[0]===127||parts[0]>=224||host==='169.254.169.254'||!Number.isInteger(port)||port<1||port>65535)throw Error('Địa chỉ hoặc cổng SNMP không hợp lệ.');
 const community=input.community===''?old?.community:input.community;
 if(typeof community!=='string'||community.length<1||Buffer.byteLength(community)>128||/[\x00-\x1f\x7f]/.test(community))throw Error('Nhập community SNMP chỉ đọc, tối đa 128 byte.');
 return {enabled:input.enabled,host,port,community};
}
const text=(v:any)=>Buffer.isBuffer(v)?v.toString('utf8'):String(v??'');
export const counter=(v:any)=>Buffer.isBuffer(v)?BigInt('0x'+(v.toString('hex')||'0')).toString():/^\d+$/.test(String(v))?String(v):null;
export function normalizeNEC(system:any,table:any,x:any){
 const names=new Set<string>();
 const rows=Object.entries(table).map(([index,row]:any)=>{
  const ext=x[index]||{},base=text(ext[1]||row[2])||'if'+index;
  const name=names.has(base)?base+' #'+index:base;names.add(name);
  const rx=counter(ext[6]),tx=counter(ext[10]);
  return {name,ifIndex:Number(index),type:Number(row[3])===6?'ether':Number(row[3])===23?'pppoe-out':'other',running:Number(row[8])===1,disabled:Number(row[7])!==1,comment:text(ext[18]),'actual-mtu':row[4]??null,speed:Number(ext[15])?Number(ext[15])*1000000:Number(row[5])||null,
   // Only 64-bit counters are used for rates; a 32-bit wrap at gigabit speeds is ambiguous.
   'rx-byte':rx,'tx-byte':tx,counterBits:64,counterEpoch:String(ext[19]??''),'rx-error':row[14]??null,'tx-error':row[20]??null};
 });
 if(!rows.length)throw Error('SNMP trả về bảng interface rỗng. Kiểm tra quyền đọc IF-MIB.');
 return {identity:text(system.name)||'NEC',resource:{uptime:Math.floor(Number(system.uptime)/100)+'s',version:text(system.description),'board-name':'NEC UNIVERGE','cpu-load':null,'total-memory':null,'free-memory':null},stats:rows};
}
export async function collectNEC(config:NECConfig){
 const session=snmp.createSession(config.host,config.community,{version:snmp.Version2c,port:config.port,timeout:1800,retries:0,transport:'udp4'});
 let expired=false,closed=false;const close=()=>{if(!closed){closed=true;session.close();}};let abort:(e:Error)=>void=()=>{};
 const deadline=new Promise<never>((_,reject)=>{abort=reject;});
 const timer=setTimeout(()=>{expired=true;abort(Error('SNMP quá thời gian (15 giây). Kiểm tra IP, UDP, community và ACL.'));close();},15000);
 session.on('error',()=>{abort(Error('Không mở được kết nối SNMP.'));});
 const get=(oids:string[])=>new Promise<any[]>((resolve,reject)=>session.get(oids,(error:any,vars:any[])=>error?reject(Error('Không đọc được SNMP. Kiểm tra SNMP v2c, community và ACL.')):resolve(vars)));
 const walk=(root:string,columns:number[])=>new Promise<any>((resolve,reject)=>{
  const rows:any={};let count=0,invalid=false;
  session.subtree(root,10,(vars:any[])=>{
   for(const v of vars){if(snmp.isVarbindError(v))continue;if(++count>20000){invalid=true;return true;}const suffix=v.oid.slice(root.length+1).split('.');if(suffix.length!==2)continue;const col=Number(suffix[0]),idx=suffix[1];if(!columns.includes(col))continue;(rows[idx]||={})[col]=v.value;if(Object.keys(rows).length>512){invalid=true;return true;}}
   return expired;
  },(error:any)=>invalid?reject(Error('Bảng SNMP vượt giới hạn 512 interface.')):error?reject(Error('Không đọc được bảng interface SNMP.')):resolve(rows));
 });
 try{return await Promise.race([deadline,(async()=>{
  const vars=await get(['1.3.6.1.2.1.1.1.0','1.3.6.1.2.1.1.3.0','1.3.6.1.2.1.1.5.0']);
  if(vars.some(v=>snmp.isVarbindError(v))||!Number.isFinite(Number(vars[1]?.value)))throw Error('Router không cung cấp thông tin hệ thống SNMP cần thiết.');
  const table=await walk('1.3.6.1.2.1.2.2.1',[2,3,4,5,7,8,14,20]);
  const x=await walk('1.3.6.1.2.1.31.1.1.1',[1,6,10,15,18,19]);
  return normalizeNEC({description:vars[0].value,uptime:vars[1].value,name:vars[2].value},table,x);
 })()]);}finally{clearTimeout(timer);close();}
}
