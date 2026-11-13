import {list,truth} from './core.ts';
export type WatchedDevice={id:string;ip:string;name:string;type:string;parentId:string;enabled:boolean;pinned?:boolean;virtual?:boolean;notifyEnabled?:boolean;notifyRepeatMinutes?:0|30|60};
export const DEVICE_TYPES=['switch','router','ap','camera','nvr','server','pc','printer','other'];
export function validIP(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(value))return false;
 const a=value.split('.');if(a.some(x=>String(Number(x))!==x||+x>255))return false;
 const n=a.map(Number);return n[0]>0&&n[0]<224&&n[0]!==127&&!(n[0]===169&&n[1]===254)&&value!=='255.255.255.255';
}
export function validateDevices(value:unknown):string|null{
 if(!Array.isArray(value)||value.length>48)return 'Tối đa 16 IP theo dõi và 32 switch ảo.';
 if(value.filter(d=>!d?.virtual).length>16||value.filter(d=>d?.virtual).length>32)return 'Tối đa 16 IP theo dõi và 32 switch ảo.';
 const ids=new Set<string>(),ips=new Set<string>();
 for(const d of value){if(!d||typeof d.id!=='string'||!/^device-[a-zA-Z0-9-]{1,60}$/.test(d.id)||(d.virtual===true?(d.ip!==''||d.type!=='switch'||d.enabled!==false||d.pinned!==true):!validIP(d.ip))||typeof d.name!=='string'||!d.name.trim()||d.name.length>60||!DEVICE_TYPES.includes(d.type)||typeof d.enabled!=='boolean'||typeof d.parentId!=='string'||d.parentId.length>120)return 'Kiểm tra lại IP, tên và loại thiết bị.';if(d.virtual!==undefined&&typeof d.virtual!=='boolean')return 'Loại thiết bị không hợp lệ.';if(d.pinned!==undefined&&typeof d.pinned!=='boolean')return 'Trạng thái ghim không hợp lệ.';if(d.notifyEnabled!==undefined&&typeof d.notifyEnabled!=='boolean')return 'Trạng thái cảnh báo không hợp lệ.';if(d.notifyRepeatMinutes!==undefined&&![0,30,60].includes(d.notifyRepeatMinutes))return 'Chu kỳ nhắc lại không hợp lệ.';if(ids.has(d.id)||(!d.virtual&&ips.has(d.ip)))return 'IP hoặc mã thiết bị bị trùng.';ids.add(d.id);if(!d.virtual)ips.add(d.ip);}
 const parents=new Map(value.map(d=>[d.id,d.parentId]));
 for(const d of value){if(d.parentId!=='router'&&!d.parentId.startsWith('port:')&&!ids.has(d.parentId))return 'Thiết bị cha không tồn tại.';const seen=new Set([d.id]);let p=d.parentId;while(ids.has(p)){if(seen.has(p))return 'Không thể tạo vòng lặp trong sơ đồ.';seen.add(p);p=parents.get(p)!;}}
 return null;
}
export function probeState(device:WatchedDevice,probe:any,now:number,routerSeen:number|null){
 if(device.virtual)return {key:'virtual',label:'Online · mặc định',tone:'green'};
 if(!device.enabled)return {key:'paused',label:'Tạm dừng',tone:'gray'};
 if(!probe||probe.ip!==device.ip)return {key:'pending',label:'Chưa có kết quả ping',tone:'gray'};
 if(!routerSeen||now-routerSeen>100000||now-probe.at>120000)return {key:'stale',label:'Dữ liệu cũ',tone:'gray'};
 if(probe.error)return {key:'error',label:'Lỗi kiểm tra ping',tone:'amber'};
 if(probe.received===0)return Number(probe.consecutiveFailures??1)>=3?{key:'down',label:'Offline',tone:'red'}:{key:'checking',label:'Đang xác nhận mất kết nối',tone:'amber'};
 if(probe.received<probe.sent)return {key:'partial',label:'Mất gói',tone:'amber'};
 return {key:'up',label:'Ping thông',tone:'green'};
}
export function inferPort(d:any,ip:string){return list(d.clients).find(c=>c.ip===ip)?.port||'';}
export type MapNode={id:string;name:string;subtitle:string;type:string;kind:'router'|'port'|'wan'|'device';parentId?:string;edgeLabel?:string;portName?:string;dashed?:boolean;up?:boolean;device?:WatchedDevice;x:number;y:number;width:number;height:number};
export function topologyLayout(data:any,devices:WatchedDevice[],_showUnused=false){
 const iface=list(data.sections?.interfaces),stats=list(data.metrics?.stats),wans:string[]=data.wanNames||[];
 const running=(name:string)=>truth(stats.find(x=>x.name===name)?.running??iface.find(x=>x.name===name)?.running);
 const fresh=!!data.lastSeen&&Date.now()-data.lastSeen<100000;
 const wanPhysical=new Set(wans);for(const w of wans){const p=[...list(data.sections?.pppoe),...list(data.sections?.vlans)].find(i=>i.name===w);if(p?.interface)wanPhysical.add(p.interface);}
 const ports=iface.filter(x=>x.type==='ether'&&!wanPhysical.has(x.name)&&(running(x.name)||devices.some(d=>d.pinned!==false&&d.parentId==='port:'+x.name)));
 const visiblePorts=new Set(ports.map(p=>'port:'+p.name));
 const nodes:MapNode[]=[{id:'router',name:data.metrics?.identity||data.project?.model||'MikroTik',subtitle:data.metrics?.resource?.['board-name']||'Router tổng',type:'router',kind:'router',x:0,y:230,width:210,height:170,up:fresh}];
 for(const p of ports)nodes.push({id:'port:'+p.name,name:p.name,subtitle:p.comment||'Cổng LAN',type:'port',kind:'port',parentId:'router',up:fresh&&running(p.name),x:0,y:0,width:2,height:108});
 for(const d of devices){const parentId=d.parentId.startsWith('port:')&&!visiblePorts.has(d.parentId)?'router':d.parentId;nodes.push({id:d.id,name:d.name,subtitle:d.virtual?'Không IP · Kết nối logic':d.ip,type:d.type,kind:'device',parentId,edgeLabel:(d as any).automatic?(parentId==='router'?'Logic':(d as any).evidence==='PPPoE'?'PPPoE':'Học qua MAC'):parentId==='router'?'Theo dõi IP':'Khai báo',dashed:true,device:d,x:0,y:0,width:210,height:170});}
 const kids=(id:string)=>nodes.filter(n=>n.parentId===id);const heights=new Map<string,number>();
 const measure=(id:string):number=>{const n=nodes.find(n=>n.id===id)!;const children=kids(id);const total=children.reduce((sum,c)=>sum+measure(c.id),0)+Math.max(0,children.length-1)*28;const h=Math.max(n.height,total);heights.set(id,h);return h;};measure('router');
 const place=(id:string,top:number,depth:number)=>{const n=nodes.find(n=>n.id===id)!;n.x=40+depth*350;n.y=top;let cursor=top;for(const c of kids(id)){place(c.id,cursor,depth+1);cursor+=heights.get(c.id)!+28;}};place('router',260,0);
 // Reserve a header lane for WAN; branch width depends on depth, never client count.
 wans.forEach((name,i)=>nodes.push({id:'wan:'+name,name:data.config?.aliases?.[name]||iface.find(x=>x.name===name)?.comment||name,subtitle:name,type:'cloud',kind:'wan',parentId:'router',edgeLabel:name,up:fresh&&running(name),x:40+i*250,y:20,width:210,height:170}));
 const width=Math.max(720,...nodes.map(n=>n.x+n.width+40));
 const positions=data.topology?.layoutMode==='manual'&&data.topology?.layoutVersion===4?data.topology.positions||{}:{};for(const n of nodes){const pos=positions[n.id];if(pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)){n.x=pos.x;n.y=pos.y;}}
 return {nodes,width:Math.max(width,...nodes.map(n=>n.x+n.width+30)),height:Math.max(530,...nodes.map(n=>n.y+n.height+30))};
}

export function visibleOnMap(d:WatchedDevice,probe:any,now:number,routerSeen:number|null){return d.virtual||d.pinned!==false||!probe?.offlineSince||now-probe.offlineSince<600000||probeState(d,probe,now,routerSeen).tone!=='red';}

export function branchPath(sx:number,sy:number,tx:number,ty:number,index:number,count:number,wan=false){
 if(wan){const y=sy+24+index*12;return `M ${sx} ${sy} V ${y} H ${tx} V ${ty}`;}
 const gap=tx-sx;const lane=sx+20+Math.max(0,gap-40)*(count-index)/(count+1);
 return `M ${sx} ${sy} H ${lane} V ${ty} H ${tx}`;
}
