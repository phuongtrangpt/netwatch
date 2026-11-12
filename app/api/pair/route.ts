import {projectId,findProject,installFilename} from '../../../lib/projects';

import { database,browserUser,sameOrigin,json } from '../../../lib/server';
import { secret,sha256 } from '../../../lib/core';
import { installer } from '../../../lib/routeros';
export async function POST(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{
 const db=database(),id=projectId(req),project=await findProject(db,id);if(!project)return json({error:'Không tìm thấy dự án'},404);const {version,replace}=await req.json() as any;const match=String(version||'').match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:\s|$|\()/);if(!match||+match[1]!==7||+match[2]<17)return json({error:'Bộ cài này cần RouterOS 7.17 trở lên (nhánh 7.x). Gửi phiên bản hiện tại để được hỗ trợ; không cần tự nâng cấp.'},400);
 const serviceToken='';
 const existing=await db.prepare('SELECT id FROM router WHERE id=?').bind(id).first();if(existing&&replace!==true)return json({error:'Đã có khóa kết nối. Xác nhận tạo lại để thay thế bộ cài cũ.'},409);
 const token=secret();const hash=await sha256(token);const now=Date.now();
 await db.batch([db.prepare("INSERT INTO router(id,token_hash,paired_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,paired_at=excluded.paired_at").bind(id,hash,now),db.prepare('INSERT INTO events(id,at,level,message,project_id) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),now,'info',existing?'Đã thay khóa gửi dữ liệu. Cần cài lại script trên router.':'Đã tạo bộ cài. Đang chờ router gửi dữ liệu.',id)]);
 return new Response(installer(process.env.NETWATCH_INGEST_URL || new URL(req.url).origin,serviceToken,token,id,project.mode),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+installFilename(id)+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return json({error:'Không tạo được bộ cài. Vui lòng thử lại.'},500);}
}
