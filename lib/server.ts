import {AsyncLocalStorage} from 'node:async_hooks';
import {db} from '../server/database';
export const requestContext=new AsyncLocalStorage<{authenticated:boolean;role?:"owner"|"viewer";projectIds?:string[];viewIds?:string[]}>();
export function database(){return db;}
export async function browserUser(){return requestContext.getStore()?.authenticated?(requestContext.getStore()?.role||null):null;}
export function allowedProjects(){const context=requestContext.getStore();return context?.role==='viewer'?(context.projectIds||[]):null;}
export function allowedViews(){const context=requestContext.getStore();return context?.role==='viewer'?(context.viewIds||[]):null;}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin)return false;try{const actual=new URL(origin),request=new URL(req.url),forwardedHost=req.headers.get('x-forwarded-host')?.split(',')[0].trim(),forwardedProto=req.headers.get('x-forwarded-proto')?.split(',')[0].trim();return origin===request.origin||(process.env.NETWATCH_PUBLIC_URL&&origin===process.env.NETWATCH_PUBLIC_URL)||(!!forwardedHost&&actual.host.toLowerCase()===forwardedHost.toLowerCase()&&(!forwardedProto||actual.protocol===forwardedProto+':'));}catch{return false;}}
export const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
