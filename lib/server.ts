import {AsyncLocalStorage} from 'node:async_hooks';
import {db} from '../server/database';
export const requestContext=new AsyncLocalStorage<{authenticated:boolean;role?:"owner"|"viewer";originValidated?:boolean;identity?:string}>();
export function database(){return db;}
export async function browserUser(){return requestContext.getStore()?.authenticated?(requestContext.getStore()?.role||null):null;}
export function sameOrigin(req:Request){return requestContext.getStore()?.originValidated??(req.headers.get('origin')===new URL(req.url).origin);}
export const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
