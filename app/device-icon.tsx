import {Router,Network,Wifi,Camera,HardDrive,Server,Monitor,Printer,Box,Cloud} from 'lucide-react';
const icons:Record<string,any>={router:Router,switch:Network,ap:Wifi,camera:Camera,nvr:HardDrive,server:Server,pc:Monitor,printer:Printer,cloud:Cloud};
export default function DeviceIcon({type}:{type:string}){const Icon=icons[type]||Box;return <span className={'compact-device-icon icon-'+type} aria-hidden="true"><Icon size={23} strokeWidth={1.7}/></span>;}
