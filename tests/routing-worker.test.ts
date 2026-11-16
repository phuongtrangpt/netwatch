import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {buildSync} from 'esbuild';
import {graphWires,routeWires} from '../lib/wire-routing';
test('background routing returns keyed paths and preserves manual bends without blocking the caller',async()=>{
 const code=buildSync({entryPoints:['app/wire-routing.worker.ts'],bundle:true,write:false,format:'cjs',platform:'browser'}).outputFiles[0].text;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:v=>parentPort.postMessage(v)};${code}\nparentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
 const d=(id:string,x:number,y:number,parentId?:string)=>({id,name:id,subtitle:'',type:'switch',kind:id==='router'?'router':'device',x,y,width:176,height:84,parentId});
 const nodes=[d('router',40,200),d('device-a',600,200,'router'),d('device-block',350,180)],wires=graphWires(nodes as any),manual={'edge-device-a':[{x:280,y:350},{x:570,y:350}]},anchors={};
 try{
  const reply=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  worker.postMessage({key:'geometry-2',nodes,wires,manual,anchors});
  const result=await reply;assert.equal(result.key,'geometry-2');assert.deepEqual(result.result,routeWires(nodes as any,wires,manual,anchors));
 }finally{await worker.terminate();}
});
