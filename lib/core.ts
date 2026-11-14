import {MAX_WATCHED_IPS} from './topology-limits';
export type Row = Record<string, any>;
export const SECTIONS = ['interfaces','addresses','vlans','bridges','bridgeports','bridgevlans','dhcpservers','pools','leases','arp','hosts','routes','wanmembers','pppoe','dhcpclients','health','pppactive','pppaccounts','pppprofiles','pppservers'];
export const truth=(v:any)=>v===true||v==='true'||v==='yes';
export const list=(v:any):Row[]=>Array.isArray(v)?v:[];
export const num=(v:any):number|null=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function seconds(v:any):number|null{
 if(typeof v==='number') return v;
 if(typeof v!=='string')return null;
 let total=0,found=false;for(const m of v.matchAll(/(\d+)(w|d|h|m|s)/g)){total+=Number(m[1])*({w:604800,d:86400,h:3600,m:60,s:1}[m[2]]||0);found=true;}
 const c=v.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);if(c){total+=+c[1]*3600 + +c[2]*60 + +c[3];found=true;}return found?total:null;
}
export function rates(current:Row,previous:Row|null,at:number,prevAt:number|null){
 const out:Record<string,Row>={};const elapsed=prevAt?(at-prevAt)/1000:0;
 const cu=seconds(current.resource?.uptime),pu=seconds(previous?.resource?.uptime);
 const safe=elapsed>0&&elapsed<=180&&cu!==null&&pu!==null&&cu>pu;
 for(const c of list(current.stats)){const p=list(previous?.stats).find(x=>x.name===c.name);const rx=num(c['rx-byte']),tx=num(c['tx-byte']),pr=num(p?.['rx-byte']),pt=num(p?.['tx-byte']);out[c.name]={rx:safe&&p&&rx!==null&&pr!==null&&rx>=pr?(rx-pr)*8/elapsed:null,tx:safe&&p&&tx!==null&&pt!==null&&tx>=pt?(tx-pt)*8/elapsed:null};}return out;
}
export function clients(sections:Record<string,Row[]>){
 const map=new Map<string,Row>();
 for(const l of list(sections.leases)){const ip=l['active-address']||l.address;if(!ip)continue;map.set(ip,{ip,mac:l['active-mac-address']||l['mac-address']||'',hostname:l['host-name']||'',dhcp:l.status||'unknown',server:l.server,source:'DHCP',lastSeen:l['last-seen']||'',interface:'',arp:''});}
 for(const a of list(sections.arp)){if(!a.address)continue;const c=map.get(a.address)||{ip:a.address,hostname:'',dhcp:'',source:'ARP'};Object.assign(c,{mac:a['mac-address']||c.mac,interface:a.interface||'',arp:a.status||(truth(a.complete)?'complete':'unknown')});if(c.source==='DHCP')c.source='DHCP + ARP';map.set(a.address,c);}
 for(const c of map.values()){const host=list(sections.hosts).find(h=>String(h['mac-address']).toLowerCase()===String(c.mac).toLowerCase());if(host)c.port=host['on-interface'];c.state=['reachable','permanent'].includes(c.arp)?'ARP phản hồi':c.arp==='stale'?'ARP đã cũ':c.dhcp==='bound'?'DHCP còn hạn':'Đã ghi nhận';}return [...map.values()];
}
export function wanNames(sections:Record<string,Row[]>){
 const set=new Set<string>();for(const r of list(sections.wanmembers))if(String(r.list).toUpperCase()==='WAN')set.add(r.interface);
 for(const r of [...list(sections.pppoe),...list(sections.dhcpclients)])if(!truth(r.disabled))set.add(r.name||r.interface);
 for(const r of list(sections.routes))if(r['dst-address']==='0.0.0.0/0'){const gw=String(r['immediate-gw']||r.gateway||'');const i=gw.includes('%')?gw.split('%').pop():null;if(i)set.add(i);else if(list(sections.interfaces).some(x=>x.name===gw))set.add(gw);}
 for(const p of [...list(sections.pppoe),...list(sections.vlans)])if(set.has(p.name)&&p.interface)set.delete(p.interface);
 return [...set].filter(Boolean);
}
export async function sha256(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function secret(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function ingestError(b:any):string|null{
 if(!b||b.schema!==1)return 'schema must be 1';
 if(b.kind==='probes'){if(!Array.isArray(b.results)||b.results.length>MAX_WATCHED_IPS||b.results.some((p:any)=>!p||typeof p.id!=='string'||typeof p.ip!=='string'||p.sent!==2||!Number.isInteger(p.received)||p.received<0||p.received>2||(p.error!==undefined&&typeof p.error!=='boolean')))return 'Invalid ping results';return null;}
 if(b.kind==='wan-probes'){if(!Array.isArray(b.results)||b.results.length>8||b.results.some((p:any)=>!p||typeof p.interface!=='string'||p.interface.length>100||p.sent!==2||!Number.isInteger(p.received)||p.received<0||p.received>2||(p.error!==undefined&&typeof p.error!=='boolean')))return 'Invalid WAN ping results';return null;}
 if(b.kind==='metrics'){if(!b.resource||typeof b.resource!=='object'||!Array.isArray(b.stats)||b.stats.length>512)return 'Invalid metrics';return null;}
 if(b.kind!=='section'||!SECTIONS.includes(b.section)||!Array.isArray(b.rows)||b.rows.length>50||!Number.isInteger(b.part)||b.part<0||b.part>200||typeof b.generation!=='string'||b.generation.length>80||typeof b.final!=='boolean')return 'Invalid section';return null;
}
