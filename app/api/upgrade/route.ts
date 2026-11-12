import {projectId,findProject} from '../../../lib/projects';
import {browserUser,json,database} from '../../../lib/server';
import {upgradeInstaller} from '../../../lib/routeros';
export async function GET(req:Request){
 if(!await browserUser())return json({error:'Vui lòng đăng nhập'},401);
 const id=projectId(req),project=await findProject(database(),id);if(!project)return json({error:'Không tìm thấy dự án'},404);
 return new Response(upgradeInstaller(project.mode),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="netwatch-upgrade-v4.rsc"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
