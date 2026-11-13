import type {MapNode} from './topology.ts';
export type Point={x:number;y:number};
export type PositionMap=Record<string,Point>;
export type Wire={id:string;source:string;target:string;wan:boolean;index:number;count:number;portLabel:string};
type Rect={id:string;l:number;r:number;t:number;b:number};
type Segment={a:Point;b:Point;wire:string};
export function positionSnapshot(nodes:MapNode[]):PositionMap{return Object.fromEntries(nodes.map(n=>[n.id,{x:n.x,y:n.y}]))}
// Apply stored positions; only newly added nodes may be placed in a free space.
export function fixedLayout(nodes:MapNode[],positions:PositionMap){
 const result=nodes.map(n=>({...n,...(positions[n.id]?{x:positions[n.id].x,y:positions[n.id].y}:{})}));const occupied=result.filter(n=>positions[n.id]&&n.kind!=='port');
 // With no saved layout, retain the explicit automatic arrangement.
 if(!occupied.length)return result;
 const overlap=(n:MapNode,x:number,y:number)=>occupied.some(o=>x<o.x+o.width+24&&x+n.width+24>o.x&&y<o.y+o.height+24&&y+n.height+24>o.y);
 for(const n of result){if(positions[n.id]||n.kind==='port')continue;
  let parent=result.find(p=>p.id===n.parentId);if(parent?.kind==='port')parent=result.find(p=>p.id===parent!.parentId);parent=parent||result.find(p=>p.id==='router');
  const px=parent?.x||40,py=parent?.y||200,pw=parent?.width||210,ph=parent?.height||170;
  const preferred={x:px+pw+72,y:py};
  const X=new Set([8,preferred.x,px,Math.max(8,px-n.width-72)]),Y=new Set([8,py,py+ph+40,Math.max(8,py-n.height-40)]);
  for(const o of occupied){X.add(o.x);X.add(o.x+o.width+32);X.add(Math.max(8,o.x-n.width-32));Y.add(o.y);Y.add(o.y+o.height+32);Y.add(Math.max(8,o.y-n.height-32));}
  const candidates=[...X].flatMap(x=>[...Y].map(y=>({x,y}))).filter(p=>!overlap(n,p.x,p.y));
  const bounds={l:Math.min(...occupied.map(o=>o.x)),t:Math.min(...occupied.map(o=>o.y)),r:Math.max(...occupied.map(o=>o.x+o.width)),b:Math.max(...occupied.map(o=>o.y+o.height))};
  const score=(p:Point)=>{const cx=p.x+n.width/2,cy=p.y+n.height/2,dx=Math.abs(cx-(px+pw/2)),dy=Math.abs(cy-(py+ph/2));return dx+dy+Math.max(0,bounds.l-p.x)*.7+Math.max(0,bounds.t-p.y)*.7+Math.max(0,p.x+n.width-bounds.r)*.4+Math.max(0,p.y+n.height-bounds.b)*.4+(p.x<px?24:0);};
  candidates.sort((a,b)=>score(a)-score(b)||a.y-b.y||a.x-b.x);const spot=candidates[0]||preferred;n.x=spot.x;n.y=spot.y;occupied.push(n);
 }
 return result;
}
// Port junctions are routing aids, never user-positioned devices. A single child
// can connect directly with the port name on its wire; fan-outs use a nearby bus.
export function compactPorts(nodes:MapNode[]){
 const result=nodes.map(n=>({...n}));const removed=new Set<string>();
 for(const port of result.filter(n=>n.kind==='port')){const parent=result.find(n=>n.id===port.parentId);if(!parent)continue;const children=result.filter(n=>n.parentId===port.id);
  // Do not draw dangling interface stubs: a port junction only represents
  // an actual visible downstream branch. This also handles partial PPPoE data.
  if(!children.length){removed.add(port.id);continue;}
  if(children.length===1){children[0].parentId=parent.id;children[0].portName=port.name;removed.add(port.id);continue;}
  const right=!children.length||children.reduce((a,c)=>a+c.x+c.width/2,0)/children.length>=parent.x+parent.width/2;
  port.x=right?parent.x+parent.width+44:Math.max(8,parent.x-44);const centers=children.map(c=>c.y+c.height/2);port.y=centers.length?Math.min(...centers):parent.y+30+result.filter(n=>n.kind==='port').indexOf(port)*18;port.height=centers.length?Math.max(2,Math.max(...centers)-port.y):2;
 }
 return result.filter(n=>!removed.has(n.id));
}
export function graphWires(nodes:MapNode[]):Wire[]{return nodes.filter(n=>n.parentId&&nodes.some(p=>p.id===n.parentId)).map(n=>{const siblings=nodes.filter(c=>c.parentId===n.parentId&&c.kind!=='wan').sort((a,b)=>a.id.localeCompare(b.id));const wans=nodes.filter(c=>c.kind==='wan');return {id:'edge-'+n.id,source:n.kind==='wan'?n.id:n.parentId!,target:n.kind==='wan'?n.parentId!:n.id,wan:n.kind==='wan',index:n.kind==='wan'?wans.findIndex(c=>c.id===n.id):siblings.findIndex(c=>c.id===n.id),count:n.kind==='wan'?wans.length:siblings.length,portLabel:! /sfp/i.test(n.portName||n.name)&&(n.kind==='port'||n.portName)?(n.portName||n.name):''}})}
export type Side='left'|'right'|'top'|'bottom';
export type EndpointAnchor={nodeId:string;side:Side;offset:number};
export type WireAnchorPair={source?:EndpointAnchor;target?:EndpointAnchor};
export type AnchorMap=Record<string,WireAnchorPair>;
export function projectAnchor(node:MapNode,p:Point):EndpointAnchor{
 const x=Math.max(node.x,Math.min(node.x+node.width,p.x)),y=Math.max(node.y,Math.min(node.y+node.height,p.y));
 const choices:[Side,number][]=[['left',Math.abs(p.x-node.x)],['right',Math.abs(p.x-node.x-node.width)],['top',Math.abs(p.y-node.y)],['bottom',Math.abs(p.y-node.y-node.height)]];
 choices.sort((a,b)=>a[1]-b[1]);const side=choices[0][0];return {nodeId:node.id,side,offset:Math.max(0,Math.min(1,side==='left'||side==='right'?(y-node.y)/node.height:(x-node.x)/node.width))};
}
export function validateAnchors(value:unknown):string|null{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>100)return 'Điểm neo không hợp lệ';
 for(const [key,pair] of Object.entries(value as AnchorMap)){if(!/^edge-[a-zA-Z0-9:._-]{1,150}$/.test(key)||!pair||typeof pair!=='object'||Array.isArray(pair)||Object.keys(pair).some(k=>!['source','target'].includes(k)))return 'Điểm neo không hợp lệ';for(const a of [pair.source,pair.target])if(a!==undefined&&(!a||typeof a.nodeId!=='string'||a.nodeId.length>150||!a.nodeId||!['left','right','top','bottom'].includes(a.side)||!Number.isFinite(a.offset)||a.offset<0||a.offset>1))return 'Vị trí neo không hợp lệ';}return null;
}
function activeAnchor(nodes:MapNode[],wire:Wire,source:boolean,settings:AnchorMap){const a=settings[wire.id]?.[source?'source':'target'];return a&&a.nodeId===(source?wire.source:wire.target)&&nodes.some(n=>n.id===a.nodeId&&n.kind!=='port')?a:undefined;}
export function wireSides(nodes:MapNode[],wire:Wire,settings:AnchorMap={}):{sourceSide:Side;targetSide:Side}{
 const defaults=automaticSides(nodes,wire);return {sourceSide:activeAnchor(nodes,wire,true,settings)?.side||defaults.sourceSide,targetSide:activeAnchor(nodes,wire,false,settings)?.side||defaults.targetSide};
}
function automaticSides(nodes:MapNode[],wire:Wire):{sourceSide:Side;targetSide:Side}{
 const s=nodes.find(n=>n.id===wire.source)!,t=nodes.find(n=>n.id===wire.target)!;
 if(s.kind==='port'||t.kind==='port'){const right=t.x+t.width/2>=s.x+s.width/2;return {sourceSide:right?'right':'left',targetSide:right?'left':'right'};}
 const dx=t.x+t.width/2-s.x-s.width/2,dy=t.y+t.height/2-s.y-s.height/2;
 const gx=Math.abs(dx)-(s.width+t.width)/2,gy=Math.abs(dy)-(s.height+t.height)/2;
 if(gy>=24&&(gx<24||wire.wan))return {sourceSide:dy>=0?'bottom':'top',targetSide:dy>=0?'top':'bottom'};
 return {sourceSide:dx>=0?'right':'left',targetSide:dx>=0?'left':'right'};
}
function sidePoint(node:MapNode,side:Side,offset:number):Point{return side==='left'?{x:node.x,y:offset}:side==='right'?{x:node.x+node.width,y:offset}:side==='top'?{x:offset,y:node.y}:{x:offset,y:node.y+node.height};}
export function wireAnchors(nodes:MapNode[],wire:Wire,settings:AnchorMap={}){
 const all=graphWires(nodes),s=nodes.find(n=>n.id===wire.source)!,t=nodes.find(n=>n.id===wire.target)!;const sides=wireSides(nodes,wire,settings);
 const anchor=(node:MapNode,side:Side,source:boolean)=>{
  const fixed=activeAnchor(nodes,wire,source,settings);if(fixed)return sidePoint(node,fixed.side,(side==='left'||side==='right'?node.y:node.x)+fixed.offset*(side==='left'||side==='right'?node.height:node.width));
  const horizontal=side==='left'||side==='right';const start=horizontal?node.y:node.x,length=horizontal?node.height:node.width;
  const peers=all.filter(w=>(source?w.source:w.target)===node.id&&(source?wireSides(nodes,w,settings).sourceSide:wireSides(nodes,w,settings).targetSide)===side).map(w=>{const other=nodes.find(n=>n.id===(source?w.target:w.source))!;const ownCenter=horizontal?node.y+node.height/2:node.x+node.width/2;return {id:w.id,desired:(!source&&node.kind!=='router')||(source&&node.kind==='wan')?ownCenter:(horizontal?other.y+other.height/2:other.x+other.width/2)};}).sort((a,b)=>a.desired-b.desired||a.id.localeCompare(b.id));
  const margin=Math.min(8,length/2),gap=Math.min(14,Math.max(0,(length-margin*2)/Math.max(1,peers.length-1)));const values=peers.map(p=>Math.max(start+margin,Math.min(start+length-margin,p.desired)));
  for(let i=1;i<values.length;i++)values[i]=Math.max(values[i],values[i-1]+gap);if(values.length)values[values.length-1]=Math.min(values[values.length-1],start+length-margin);for(let i=values.length-2;i>=0;i--)values[i]=Math.min(values[i],values[i+1]-gap);
  return sidePoint(node,side,values[peers.findIndex(p=>p.id===wire.id)]??start+length/2);
 };
 return {start:anchor(s,sides.sourceSide,true),end:anchor(t,sides.targetSide,false),...sides};
}
const shift=(p:Point,side:Side,d:number):Point=>({x:p.x+(side==='right'?d:side==='left'?-d:0),y:p.y+(side==='bottom'?d:side==='top'?-d:0)});
export function manualWirePath(nodes:MapNode[],wire:Wire,waypoints:Point[],settings:AnchorMap={}){
 const {start,end,sourceSide,targetSide}=wireAnchors(nodes,wire,settings),a=shift(start,sourceSide,20),b=shift(end,targetSide,20);const points=[start,a];let p=a;for(const q of [...waypoints,b]){if(p.x!==q.x&&p.y!==q.y)points.push({x:q.x,y:p.y});points.push(q);p=q;}points.push(end);const simple=simplify(points);
 const outward=(p:Point,q:Point,side:Side)=>side==='left'?q.x<p.x&&q.y===p.y:side==='right'?q.x>p.x&&q.y===p.y:side==='top'?q.y<p.y&&q.x===p.x:q.y>p.y&&q.x===p.x;
 if(outward(start,simple[1],sourceSide)&&outward(end,simple[simple.length-2],targetSide))return simple;
 // If a moved anchor points away from existing bend points, route around the
 // device rather than reversing through its body. The recursive call has no
 // manual waypoints, so it uses only the normal obstacle router.
 const source=nodes.find(n=>n.id===wire.source)!,target=nodes.find(n=>n.id===wire.target)!;
 const stops=waypoints.map((q,i):MapNode=>({id:'manual-stop-'+wire.id+'-'+i,name:'',subtitle:'',type:'other',kind:'device',x:q.x,y:q.y,width:0,height:0}));const chain=[source,...stops,target],all=[...nodes,...stops],pieces:Wire[]=[],bindings:AnchorMap={};
 const normalized=(node:MapNode,side:Side,p:Point):EndpointAnchor=>({nodeId:node.id,side,offset:node.width&&node.height?Math.max(0,Math.min(1,(side==='left'||side==='right')?(p.y-node.y)/node.height:(p.x-node.x)/node.width)):.5});
 for(let i=0;i<chain.length-1;i++){const w={...wire,id:wire.id+'-segment-'+i,source:chain[i].id,target:chain[i+1].id},sides=automaticSides(all,w);pieces.push(w);bindings[w.id]={source:i===0?normalized(source,sourceSide,start):{nodeId:w.source,side:sides.sourceSide,offset:.5},target:i===chain.length-2?normalized(target,targetSide,end):{nodeId:w.target,side:sides.targetSide,offset:.5}};}
 const routed=routeWires(all,pieces,{},bindings);return simplify(pieces.flatMap(w=>routed.routes[w.id]));
}

const inside=(p:Point,r:Rect)=>p.x>r.l&&p.x<r.r&&p.y>r.t&&p.y<r.b;
const equal=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
function segments(points:Point[],wire:string):Segment[]{return points.slice(1).map((p,i)=>({a:points[i],b:p,wire})).filter(s=>!equal(s.a,s.b));}
export function pathData(points:Point[]){return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}
function simplify(points:Point[]){const out:Point[]=[];for(const p of points){if(out.length&&equal(out[out.length-1],p))continue;while(out.length>1){const a=out[out.length-2],b=out[out.length-1];if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))out.pop();else break;}out.push(p);}return out;}
function collision(a:Point,b:Point,s:Segment){const h=a.y===b.y,sh=s.a.y===s.b.y;if(h===sh){if(h?a.y!==s.a.y:a.x!==s.a.x)return 0;const overlap=h?Math.min(Math.max(a.x,b.x),Math.max(s.a.x,s.b.x))-Math.max(Math.min(a.x,b.x),Math.min(s.a.x,s.b.x)):Math.min(Math.max(a.y,b.y),Math.max(s.a.y,s.b.y))-Math.max(Math.min(a.y,b.y),Math.min(s.a.y,s.b.y));return overlap>0?10000+overlap*20:0;}const hor=h?{a,b}:s,ver=h?s:{a,b};return ver.a.x>Math.min(hor.a.x,hor.b.x)&&ver.a.x<Math.max(hor.a.x,hor.b.x)&&hor.a.y>Math.min(ver.a.y,ver.b.y)&&hor.a.y<Math.max(ver.a.y,ver.b.y)?800:0;}
class Heap{q:{id:number;g:number;f:number}[]=[];push(v:{id:number;g:number;f:number}){let i=this.q.length;this.q.push(v);while(i){const p=(i-1)>>1;if(this.q[p].f<=v.f)break;this.q[i]=this.q[p];i=p;}this.q[i]=v;}pop(){const v=this.q[0],last=this.q.pop()!;if(this.q.length){let i=0;while(i*2+1<this.q.length){let j=i*2+1;if(j+1<this.q.length&&this.q[j+1].f<this.q[j].f)j++;if(this.q[j].f>=last.f)break;this.q[i]=this.q[j];i=j;}this.q[i]=last;}return v;}}
export function routeWires(nodes:MapNode[],wires=graphWires(nodes),manual:Record<string,Point[]>={},settings:AnchorMap={}){
 const obstacles:Rect[]=nodes.filter(n=>n.kind!=='port').map(n=>({id:n.id,l:n.x-12,r:n.x+n.width+12,t:n.y-12,b:n.y+n.height+12}));
 const xs=new Set<number>(),ys=new Set<number>();const anchors=wires.map(w=>wireAnchors(nodes,w,settings));
 for(const r of obstacles)for(const d of [0,10]){xs.add(r.l-d);xs.add(r.r+d);ys.add(r.t-d);ys.add(r.b+d);}
 const endpoints=anchors.map(({start,end},i)=>{const a=shift(start,anchors[i].sourceSide,20),b=shift(end,anchors[i].targetSide,20);for(const p of [a,b]){xs.add(p.x);ys.add(p.y);}xs.add(a.x+8*(i%7+1));ys.add(a.y+8*(i%7+1));return {a,b,start,end};});
 for(const v of [-40,Math.max(720,...nodes.map(n=>n.x+n.width))+60])xs.add(v);for(const v of [-40,Math.max(530,...nodes.map(n=>n.y+n.height))+60])ys.add(v);
 const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),nx=X.length,ny=Y.length,size=nx*ny;
 const blocked=new Uint8Array(size);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(obstacles.some(r=>inside({x:X[x],y:Y[y]},r)))blocked[y*nx+x]=1;
 const freeCache=new Map<string,boolean>();const point=(v:number):Point=>({x:X[v%nx],y:Y[Math.floor(v/nx)]});
 const free=(v:number,u:number)=>{const key=Math.min(v,u)+':'+Math.max(v,u);let ok=freeCache.get(key);if(ok===undefined){const a=point(v),b=point(u);ok=!blocked[u]&&!blocked[v]&&!obstacles.some(r=>inside({x:(a.x+b.x)/2,y:(a.y+b.y)/2},r));freeCache.set(key,ok);}return ok;};
 const used:Segment[]=[],routes:Record<string,Point[]>={},unresolved:string[]=[];
 for(let wi=0;wi<wires.length;wi++){
  const w=wires[wi],{a,b,start,end}=endpoints[wi];
  if(manual[w.id]?.length){const pts=manualWirePath(nodes,w,manual[w.id],settings);routes[w.id]=pts;used.push(...segments(pts,w.id));continue;}
  const out=(p:Point,q:Point,side:Side)=>side==='left'?q.x<p.x&&q.y===p.y:side==='right'?q.x>p.x&&q.y===p.y:side==='top'?q.y<p.y&&q.x===p.x:q.y>p.y&&q.x===p.x;
  const clear=(points:Point[])=>points.length>1&&out(start,points[1],anchors[wi].sourceSide)&&out(end,points[points.length-2],anchors[wi].targetSide)&&segments(points,w.id).every(({a:p,b:q})=>!obstacles.some(r=>{if((r.id===w.source&&equal(p,start))||(r.id===w.target&&equal(q,end)))return false;return p.y===q.y?p.y>r.t&&p.y<r.b&&Math.max(p.x,q.x)>r.l&&Math.min(p.x,q.x)<r.r:p.x>r.l&&p.x<r.r&&Math.max(p.y,q.y)>r.t&&Math.min(p.y,q.y)<r.b;})&&used.every(s=>collision(p,q,s)===0));
  const candidates:Point[][]=[];
  const {sourceSide,targetSide}=anchors[wi],horizontal=sourceSide==='left'||sourceSide==='right';
  if((start.x===end.x||start.y===end.y)&&((horizontal&&sourceSide==='right'&&end.x>start.x)||(horizontal&&sourceSide==='left'&&end.x<start.x)||(!horizontal&&sourceSide==='bottom'&&end.y>start.y)||(!horizontal&&sourceSide==='top'&&end.y<start.y)))candidates.push([start,end]);
  if(horizontal&&(targetSide==='left'||targetSide==='right')){const direction=sourceSide==='right'?1:-1;const peers=wires.map((other,i)=>({other,anchor:anchors[i]})).filter(p=>p.other.source===w.source&&p.anchor.sourceSide===sourceSide&&Math.sign(p.anchor.end.y-p.anchor.start.y)===Math.sign(end.y-start.y)).sort((p,q)=>Math.abs(p.anchor.end.y-p.anchor.start.y)-Math.abs(q.anchor.end.y-q.anchor.start.y)||p.other.id.localeCompare(q.other.id));const rank=peers.findIndex(p=>p.other.id===w.id);const lane=start.x+direction*(20+Math.max(0,Math.abs(end.x-start.x)-40)*(peers.length-rank)/(peers.length+1));for(const x of [lane,(start.x+end.x)/2,a.x,b.x])candidates.push([start,{x,y:start.y},{x,y:end.y},end]);}
  if(!horizontal&&(targetSide==='top'||targetSide==='bottom')){for(const y of [(start.y+end.y)/2,a.y,b.y])candidates.push([start,{x:start.x,y},{x:end.x,y},end]);}
  // Try a compact elbow before searching the full obstacle grid.
  candidates.push([start,a,{x:b.x,y:a.y},b,end],[start,a,{x:a.x,y:b.y},b,end]);
  const simple=candidates.map(simplify).find(clear);if(simple){routes[w.id]=simple;used.push(...segments(simple,w.id));continue;}
  const from=Y.indexOf(a.y)*nx+X.indexOf(a.x),to=Y.indexOf(b.y)*nx+X.indexOf(b.x),dist=new Float64Array(size*2).fill(Infinity),prev=new Int32Array(size*2).fill(-1),heap=new Heap();const first=from*2+((anchors[wi].sourceSide==='top'||anchors[wi].sourceSide==='bottom')?1:0);dist[first]=0;heap.push({id:first,g:0,f:Math.abs(a.x-b.x)+Math.abs(a.y-b.y)});let found=-1,visits=0;
  while(heap.q.length&&visits++<size*2){const cur=heap.pop();if(cur.g!==dist[cur.id])continue;const v=cur.id>>1,dir=cur.id%2;if(v===to){found=cur.id;break;}const x=v%nx,y=Math.floor(v/nx),p=point(v);const next=[x>0?v-1:-1,x+1<nx?v+1:-1,y>0?v-nx:-1,y+1<ny?v+nx:-1];for(const u of next){if(u<0||!free(v,u))continue;const q=point(u),nd=p.y===q.y?0:1;const penalty=used.reduce((sum,s)=>sum+collision(p,q,s),0);const cost=cur.g+Math.abs(q.x-p.x)+Math.abs(q.y-p.y)+(dir===nd?0:72)+penalty,id=u*2+nd;if(cost<dist[id]){dist[id]=cost;prev[id]=cur.id;heap.push({id,g:cost,f:cost+Math.abs(q.x-b.x)+Math.abs(q.y-b.y)});}}}
  let pts:Point[];if(found<0){unresolved.push(w.id);pts=[start,a,{x:a.x,y:b.y},b,end];}else{const rev:Point[]=[];for(let id=found;id>=0;id=prev[id])rev.push(point(id>>1));pts=[start,...rev.reverse(),end];}
  pts=simplify(pts);routes[w.id]=pts;used.push(...segments(pts,w.id));
 }
 // Report genuinely constrained layouts instead of moving icons to conceal them.
 const conflicts=new Set(unresolved);for(let i=0;i<used.length;i++)for(let j=i+1;j<used.length;j++){if(used[i].wire!==used[j].wire&&collision(used[i].a,used[i].b,used[j])>0){conflicts.add(used[i].wire);conflicts.add(used[j].wire);}}
 return {routes,conflicts:conflicts.size};
}
