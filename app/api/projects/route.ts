import {database,browserUser,sameOrigin,json} from '../../../lib/server';
import {projectList,validProjectId,findProject,ROUTER_MODELS} from '../../../lib/projects';
export async function GET(){if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);try{return json({projects:await projectList(database())});}catch{return json({error:'Không đọc được danh sách dự án'},503);}}
export async function POST(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{const b:any=await req.json();if(typeof b.name!=='string'||!b.name.trim()||b.name.length>70||!ROUTER_MODELS.includes(b.model)||!['infrastructure','pppoe'].includes(b.mode))return json({error:'Kiểm tra tên và loại dự án'},400);const db=database();let id=b.id;
 if(id){if(typeof id!=='string'||!validProjectId(id)||!await findProject(db,id))return json({error:'Không tìm thấy dự án'},404);await db.prepare('INSERT INTO projects(id,name,model,mode,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,model=excluded.model,mode=excluded.mode').bind(id,b.name.trim(),b.model,b.mode,Date.now()).run();}
 else{const total:any=await db.prepare('SELECT COUNT(*) AS n FROM projects').first();if(total.n>=19)return json({error:'Tối đa 20 dự án ở phiên bản này'},400);id='net-'+crypto.randomUUID().replaceAll('-','');await db.prepare('INSERT INTO projects(id,name,model,mode,created_at) VALUES (?,?,?,?,?)').bind(id,b.name.trim(),b.model,b.mode,Date.now()).run();}
 return json({project:await findProject(db,id),projects:await projectList(db)});
 }catch{return json({error:'Không lưu được dự án'},500);}
}

export async function DELETE(req:Request){
 if(await browserUser()!=='owner')return json({error:'Chỉ quản trị viên được xóa dự án'},403);
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{
  const input:any=await req.json();if(typeof input.id!=='string'||!validProjectId(input.id))return json({error:'Mã dự án không hợp lệ'},400);
  if(input.id==='main')return json({error:'Mạng chính là dự án mặc định, không thể xóa. Bạn có thể đổi tên và cấu hình lại.'},400);
  const db=database(),project:any=await findProject(db,input.id);if(!project)return json({error:'Dự án không còn tồn tại'},404);
  if(input.confirmName!==project.name)return json({error:'Nhập đúng tên dự án để xác nhận xóa'},400);
  const prefix=input.id+':';
  await db.batch([
   db.prepare('DELETE FROM router WHERE id=?').bind(input.id),
   db.prepare('DELETE FROM project_history WHERE project_id=?').bind(input.id),
   db.prepare('DELETE FROM events WHERE project_id=?').bind(input.id),
   db.prepare('DELETE FROM section_chunks WHERE substr(name,1,?)=?').bind(prefix.length,prefix),
   db.prepare('DELETE FROM section_heads WHERE substr(name,1,?)=?').bind(prefix.length,prefix),
   db.prepare('DELETE FROM settings WHERE substr(key,1,?)=?').bind(prefix.length,prefix),
   db.prepare("DELETE FROM settings WHERE key GLOB 'telegram_outbox:*' AND CASE WHEN json_valid(value) THEN json_extract(value,'$.project') END=?").bind(input.id),
   db.prepare('DELETE FROM projects WHERE id=?').bind(input.id),
  ]);
  return json({deleted:input.id,projects:await projectList(db)});
 }catch{return json({error:'Không xóa được dự án. Vui lòng thử lại.'},500);}
}
