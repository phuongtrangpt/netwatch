import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Topology from '../app/topology';
import Projects from '../app/projects';
function buttons(html:string){return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>({attrs:m[1],text:m[2].replace(/<[^>]*>/g,'')}));}
const data={topology:{revision:0,devices:[],positions:{}},sections:{},metrics:{collector:4},probes:{results:[]},lastSeen:Date.now(),project:{id:'main'}};
test('viewers can inspect and fullscreen topology, while mutation buttons are hidden',()=>{
 const props={data,demo:false,onRefresh:()=>{},onConnect:()=>{},notify:()=>{}};
 const viewer=buttons(renderToStaticMarkup(React.createElement(Topology,{...props,readOnly:true})));
 for(const name of ['Thêm switch ảo','Thêm IP theo dõi','Chỉnh sơ đồ','Gỡ rối dây','Tự sắp xếp']){const b=viewer.find(b=>b.text===name);assert.ok(b,name);assert.match(b.attrs,/hidden/);}
 for(const name of ['Sơ đồ','Danh sách IP','Toàn màn hình']){const b=viewer.find(b=>b.text.includes(name));assert.ok(b,name);assert.doesNotMatch(b.attrs,/hidden|disabled/);}
 const owner=buttons(renderToStaticMarkup(React.createElement(Topology,{...props,readOnly:false})));
 assert.doesNotMatch(owner.find(b=>b.text==='Thêm IP theo dõi')!.attrs,/hidden/);
});
test('project selector stays available while viewer create/edit controls are hidden',()=>{
 const html=renderToStaticMarkup(React.createElement(Projects,{projects:[{id:'main',name:'Nhà',model:'RB5009',mode:'infrastructure'}],readOnly:true,onSelect:()=>{},onSaved:()=>{},notify:()=>{}}));
 assert.doesNotMatch(html,/RB5009|E50UG|Raspberry Pi/);
 const bs=buttons(html);assert.match(bs.find(b=>b.text.includes('Thêm dự án'))!.attrs,/hidden/);assert.doesNotMatch(bs.find(b=>b.text.includes('Mở dự án'))!.attrs,/hidden|disabled/);
});
