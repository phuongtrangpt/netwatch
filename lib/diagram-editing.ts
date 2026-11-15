import type {Point} from './wire-routing';
export function moveCorner(points:Point[],index:number,next:Point){
 if(index<=0||index>=points.length-1)return points.map(p=>({...p}));const out=points.map(p=>({...p})),old=points[index],prev=points[index-1],after=points[index+1];const p={...next};
 const verticalBefore=prev.x===old.x,verticalAfter=after.x===old.x;
 if((prev.x===old.x&&after.x===old.x)||(prev.y===old.y&&after.y===old.y)){out[index]=p;return out;}
 if(index===1){if(verticalBefore)p.x=prev.x;else p.y=prev.y;}else if(verticalBefore)out[index-1].x=p.x;else out[index-1].y=p.y;
 if(index===points.length-2){if(verticalAfter)p.x=after.x;else p.y=after.y;}else if(verticalAfter)out[index+1].x=p.x;else out[index+1].y=p.y;
 out[index]=p;return out;
}
export function nearestSegment(points:Point[],point:Point){let index=0,distance=Infinity;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],x=Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),point.x)),y=Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),point.y)),d=Math.hypot(point.x-x,point.y-y);if(d<distance){distance=d;index=i;}}return index;}
export type Guide={axis:'x'|'y';value:number;from:number;to:number};
export function alignPosition(nodes:{id:string;x:number;y:number;width:number;height:number;kind?:string}[],moving:{id:string;x:number;y:number;width:number;height:number},threshold=6){
 const others=nodes.filter(n=>n.id!==moving.id&&n.kind!=='port'),position={x:moving.x,y:moving.y},guides:Guide[]=[];
 for(const axis of ['x','y'] as const){const size=axis==='x'?'width':'height',perp=axis==='x'?'y':'x',perpSize=axis==='x'?'height':'width';let best:any=null;
  for(const node of others)for(const own of [0,.5,1])for(const other of [own]){const value=node[axis]+node[size]*other,delta=value-(moving[axis]+moving[size]*own);if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={node,value,delta};}
  if(best){position[axis]+=best.delta;guides.push({axis,value:best.value,from:Math.min(moving[perp],best.node[perp])-25,to:Math.max(moving[perp]+moving[perpSize],best.node[perp]+best.node[perpSize])+25});}}
 return {position,guides};
}
export function rulerTicks(offset:number,zoom:number,length:number){const step=[10,20,50,100,200,500,1000,2000,5000].find(v=>v*zoom>=55)||10000;const first=Math.ceil(-offset/zoom/step)*step;const ticks=[];for(let value=first;value*zoom+offset<=length;value+=step)ticks.push({value,position:value*zoom+offset});return ticks;}
