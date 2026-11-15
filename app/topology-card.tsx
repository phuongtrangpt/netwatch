import type {ReactNode} from 'react';
import {Star,CheckCircle2,XCircle,AlertTriangle,HelpCircle} from 'lucide-react';
import DeviceIcon from './device-icon';
const types:Record<string,string>={switch:'Switch',router:'Router',ap:'Wi-Fi / AP',camera:'Camera',nvr:'Đầu ghi NVR',server:'Máy chủ',pc:'Máy tính',printer:'Máy in',other:'Thiết bị khác'};
export default function TopologyCard({node:n,children:handles}:{node:any;children?:ReactNode}){
 const Status=n.tone==='green'?CheckCircle2:n.tone==='red'?XCircle:n.tone==='amber'?AlertTriangle:HelpCircle;
 return <div style={{width:n.width,height:n.height}} title={n.name+' · '+n.subtitle+' · '+n.label} aria-label={n.name+' · '+n.subtitle+' · '+n.label} className={'flow-device compact-device '+n.tone+' kind-'+n.kind+(n.device?.virtual?' virtual-switch':'')}>{handles}<DeviceIcon type={n.type}/><div className="compact-device-content"><div className="compact-device-kind"><span>{n.kind==='wan'?'Internet':n.kind==='router'?'Router tổng':n.device?.virtual?'Switch ảo':types[n.type]||'Thiết bị'}</span>{n.pinned&&<Star size={10} fill="currentColor" aria-label="Đã ghim"/>}<Status size={12} aria-label={n.tone==='green'?'Có kết nối':n.tone==='red'?'Mất kết nối':n.tone==='amber'?'Đang kiểm tra':'Chưa xác định'}/></div><strong>{n.name}</strong><span className="map-device-sub mono">{n.subtitle}</span><span className={'map-device-state '+n.tone}>{n.label}</span></div></div>;
}
