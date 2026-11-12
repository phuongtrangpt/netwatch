import {list} from './core.ts';
import {validIP} from './topology.ts';
export type Discovered={id:string;ip:string;mac:string;name:string;port:string;source:string;status:string;checkedAt:number;lastSeen:number|null;offlineSince:number|null};
export function discoveredInventory(sections:any,updated:Record<string,number>,previous:Discovered[]=[],now=Date.now()){
 const records=new Map<string,Discovered>();const own=new Set(list(sections.addresses).map(a=>String(a.address||'').split('/')[0]));
 const add=(c:any,source:string,status:string,at:number)=>{if(!validIP(c.ip)||own.has(c.ip))return;const mac=String(c.mac||'').toLowerCase();const id='device-auto-'+((mac?mac.replace(/[^a-z0-9]/g,'').slice(0,12)+'-':'')+c.ip.replaceAll('.','-'));const old=previous.find(p=>p.id===id||p.ip===c.ip);const active=status==='online';records.set(c.ip,{id,ip:c.ip,mac,name:c.hostname||old?.name||c.ip,port:c.port||'',source,status,checkedAt:at,lastSeen:active?at:old?.lastSeen||null,offlineSince:status==='offline'?(old?.offlineSince||at):null});};
 for(const c of list(sections.leases)){const mac=c['active-mac-address']||c['mac-address']||'';const host=list(sections.hosts).find(h=>String(h['mac-address']||'').toLowerCase()===String(mac).toLowerCase());add({ip:c['active-address']||c.address,mac,hostname:c['host-name'],port:host?.['on-interface']||''},'DHCP',c.status==='bound'?'leased':'known',updated.leases||0);}
 for(const c of list(sections.pppactive)){if(c.service&&c.service!=='pppoe')continue;add({ip:c.address,mac:c['caller-id'],hostname:c.name,port:''},'PPPoE','online',updated.pppactive||0);}
 for(const old of previous){if(!['DHCP','PPPoE'].includes(old.source))continue;if([...records.values()].some(r=>r.id===old.id||r.ip===old.ip))continue;const offlineSince=old.offlineSince||now;if(now-offlineSince<600000)records.set(old.ip,{...old,status:'missing',offlineSince});}
 return [...records.values()];
}
export async function refreshDiscovery(db:any,project:string,now:number){
 const key=(s:string)=>project==='main'?s:project+':'+s;const names=['leases','hosts','addresses','pppactive'];
 const rows:any=await db.prepare(`SELECT c.name,c.data,h.updated_at FROM section_chunks c JOIN section_heads h ON c.name=h.name AND c.generation=h.generation WHERE c.name IN (${names.map(()=>'?').join(',')}) ORDER BY c.name,c.part`).bind(...names.map(key)).all();const sections:any={},updated:any={};for(const r of rows.results){const name=project==='main'?r.name:r.name.slice(project.length+1);(sections[name]||=[]).push(...JSON.parse(r.data));updated[name]=r.updated_at;}
 const old:any=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key('discovery')).first();const devices=discoveredInventory(sections,updated,old?JSON.parse(old.value).devices:[],now);await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key('discovery'),JSON.stringify({devices,updatedAt:now})).run();
}
