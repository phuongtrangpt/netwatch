import {routeWires} from '../lib/wire-routing';
self.onmessage=({data})=>{
 try{self.postMessage({key:data.key,result:routeWires(data.nodes,data.wires,data.manual,data.anchors)});}
 catch{self.postMessage({key:data.key,error:true});}
};
