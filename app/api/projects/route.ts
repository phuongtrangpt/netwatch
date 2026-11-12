import {database,browserUser,sameOrigin,json,allowedProjects} from '../../../lib/server';
import {projectList,validProjectId,findProject} from '../../../lib/projects';
export async function GET(){if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);try{const rows=await projectList(database()),allowed=allowedProjects();return json({projects:allowed?rows.filter((p:any)=>allowed.includes(p.id)):rows});}catch{return json({error:'Không đọc được danh sách dự án'},503);}}
export async function POST(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 try{const b:any=await req.json();if(typeof b.name!=='string'||!b.name.trim()||b.name.length>70||!['E50UG','RB5009','Khác'].includes(b.model)||!['infrastructure','pppoe'].includes(b.mode))return json({error:'Kiểm tra tên và loại dự án'},400);const db=database();let id=b.id;
 if(id){if(typeof id!=='string'||!validProjectId(id)||!await findProject(db,id))return json({error:'Không tìm thấy dự án'},404);await db.prepare('INSERT INTO projects(id,name,model,mode,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,model=excluded.model,mode=excluded.mode').bind(id,b.name.trim(),b.model,b.mode,Date.now()).run();}
 else{const total:any=await db.prepare('SELECT COUNT(*) AS n FROM projects').first();if(total.n>=19)return json({error:'Tối đa 20 dự án ở phiên bản này'},400);id='net-'+crypto.randomUUID().replaceAll('-','');await db.prepare('INSERT INTO projects(id,name,model,mode,created_at) VALUES (?,?,?,?,?)').bind(id,b.name.trim(),b.model,b.mode,Date.now()).run();}
 return json({project:await findProject(db,id),projects:await projectList(db)});
 }catch{return json({error:'Không lưu được dự án'},500);}
}
