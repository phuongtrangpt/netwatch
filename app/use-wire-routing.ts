import {useEffect,useRef,useState,useMemo} from 'react';
import {manualWirePath} from '../lib/wire-routing';
// Routing can search a large obstacle grid. Never do that on the UI thread.
export function useWireRouting(nodes:any[],wires:any[],manual:any,anchors:any,enabled:boolean){
 const key=JSON.stringify([nodes.map(n=>[n.id,n.x,n.y,n.width,n.height,n.parentId,n.kind]),wires,manual,anchors]);
 const [resolved,setResolved]=useState<any>(null),cache=useRef<any>(null);
 useEffect(()=>{
  if(!enabled)return;
  if(cache.current?.key===key){setResolved(cache.current);return;}
  let worker:Worker|undefined,active=true;
  const timer=setTimeout(()=>{
   try{worker=new Worker(new URL('./wire-routing.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(active&&data.key===key&&data.result){cache.current=data;setResolved(data);}};
    worker.postMessage({key,nodes,wires,manual,anchors});
   }catch{/* Keep the lightweight paths when workers are unavailable. */}
  },120);
  return()=>{active=false;clearTimeout(timer);worker?.terminate();};
 },[key,enabled]);
 const preview=useMemo(()=>resolved?.key===key?resolved.result:{routes:Object.fromEntries(wires.map(w=>[w.id,manualWirePath(nodes,w,manual[w.id]||[],anchors)])),conflicts:0,conflictIds:[]},[key,resolved]);
 return preview;
}
