import {projectId,scopedKey,findProject} from '../../../lib/projects';
import { database,browserUser,sameOrigin,json } from '../../../lib/server';
export async function POST(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{const db=database(),id=projectId(req);if(!await findProject(db,id))return json({error:"Không tìm thấy dự án"},404);const key=scopedKey(id,"wan");const data:any=await req.json();if(!Array.isArray(data.wans)||data.wans.length>32||new Set(data.wans).size!==data.wans.length||data.wans.some((x:any)=>typeof x!=='string'||x.length>100)||!data.aliases||typeof data.aliases!=='object'||Array.isArray(data.aliases)||Object.keys(data.aliases).length>32||Object.values(data.aliases).some(x=>typeof x!=='string'||x.length>80))return json({error:'Cấu hình không hợp lệ'},400);
 await db.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,JSON.stringify({wans:data.wans,aliases:data.aliases,manual:!!data.manual})).run();return json({ok:true});
 }catch{return json({error:'Không lưu được cấu hình'},500);}
}
