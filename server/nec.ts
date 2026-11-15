import {db,sqlite} from './database';
import {encryptSecret,decryptSecret} from './auth';
import {collectNEC,validateNECConfig,type NECConfig} from './nec-snmp';
import {storeTelemetry} from '../app/api/ingest/route';
import {scopedKey} from '../lib/projects';
import {secret,sha256} from '../lib/core';
const busy=new Set<string>();let stopped=false;
const key=(id:string)=>scopedKey(id,'nec_snmp');
export function necStored(id:string){const row=sqlite.prepare('SELECT value FROM settings WHERE key=?').get(key(id)) as any;return row?.value||null;}
export function necConfig(id:string):NECConfig|null{const value=necStored(id);return value?JSON.parse(decryptSecret(value)):null;}
export function necStatus(id:string){const config=necConfig(id),row=sqlite.prepare('SELECT value FROM settings WHERE key=?').get(scopedKey(id,'nec_status')) as any;return {config:config?{enabled:config.enabled,host:config.host,port:config.port,hasCommunity:true}:{enabled:false,host:'',port:161,hasCommunity:false},status:row?JSON.parse(row.value):null,busy:busy.has(id)};}
export async function saveNEC(id:string,input:any){
 if(busy.has(id))throw Error('Đang đọc SNMP, chờ tối đa 15 giây rồi thử lại.');
 const config=validateNECConfig(input,necConfig(id)||undefined),value=encryptSecret(JSON.stringify(config));
 const hash=await sha256(secret());
 sqlite.transaction(()=>{
  if(!sqlite.prepare("SELECT id FROM projects WHERE id=? AND vendor='nec'").get(id))throw Error('Dự án NEC không còn tồn tại.');
  sqlite.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(id),value);
  sqlite.prepare('INSERT INTO router(id,token_hash,paired_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash').run(id,hash,Date.now());
  sqlite.prepare('DELETE FROM settings WHERE key=?').run(scopedKey(id,'nec_status'));
 })();return necStatus(id);
}
export async function pollNEC(id:string){
 if(stopped||busy.has(id))return;const saved=necStored(id),config=necConfig(id);if(!config?.enabled)return;
 busy.add(id);const at=Date.now();
 try{
  const metrics=await collectNEC(config);
  if(stopped||necStored(id)!==saved)return;
  const generation=String(at);
  for(let i=0;i<metrics.stats.length;i+=50){const response=await storeTelemetry(db,id,{schema:1,kind:'section',section:'interfaces',generation,part:i/50,final:i+50>=metrics.stats.length,rows:metrics.stats.slice(i,i+50)});if(!response.ok)throw Error('Không lưu được bảng interface.');}
  const response=await storeTelemetry(db,id,{schema:1,kind:'metrics',...metrics});if(!response.ok&&response.status!==429)throw Error('Không lưu được dữ liệu SNMP.');
  if(necStored(id)===saved)sqlite.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(scopedKey(id,'nec_status'),JSON.stringify({at,lastSuccessAt:Date.now(),ok:true,error:null}));
 }catch(error){if(necStored(id)===saved){const old=necStatus(id).status;sqlite.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(scopedKey(id,'nec_status'),JSON.stringify({at,ok:false,lastSuccessAt:old?.lastSuccessAt||null,error:error instanceof Error?error.message:'Không đọc được SNMP.'}));}}
 finally{busy.delete(id);}
}
export function startNEC(){
 // A serial queue bounds total router load; each project waits at least 30 seconds.
 let running=false;const tick=async()=>{if(running||stopped)return;running=true;try{const projects=sqlite.prepare("SELECT id FROM projects WHERE vendor='nec'").all() as any[];for(const {id} of projects){if(stopped)break;const status=necStatus(id);if(status.config.enabled&&(!status.status?.at||Date.now()-status.status.at>=30000))await pollNEC(id);}}catch{console.error('NetWatch NEC: không đọc được cấu hình SNMP.');}finally{running=false;}};
 const timer=setInterval(()=>void tick(),5000);timer.unref();void tick();return ()=>{stopped=true;clearInterval(timer);};
}
