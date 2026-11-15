export type MonitorStatus='online'|'offline'|'unknown';
export type Segment={target_id:string;label:string;kind:string;status:MonitorStatus;started_at:number;ended_at:number};
export function summarizeSegments(segments:Segment[],from:number,to:number,buckets=48){
 let online=0,offline=0;const parts=Array.from({length:buckets},()=>({online:0,offline:0,unknown:0}));
 for(const s of segments){const a=Math.max(from,s.started_at),b=Math.min(to,s.ended_at);if(b<=a)continue;if(s.status==='online')online+=b-a;if(s.status==='offline')offline+=b-a;
  const step=(to-from)/buckets;for(let i=Math.max(0,Math.floor((a-from)/step));i<buckets&&from+i*step<b;i++){const duration=Math.max(0,Math.min(b,from+(i+1)*step)-Math.max(a,from+i*step));parts[i][s.status]+=duration;}}
 const total=to-from,known=online+offline;
 return {onlineMs:online,offlineMs:offline,unknownMs:Math.max(0,total-known),uptime:known?online/known*100:null,coverage:total?known/total*100:0,buckets:parts.map(p=>p.offline?'offline':p.online?'online':'unknown')};
}
export const monitoringTTL=(kind:string)=>kind==='router'?180000:150000;
export function effectiveStatus(status:string,kind:string,observedAt:number,now:number){return now-observedAt>monitoringTTL(kind)?'unknown':status;}
