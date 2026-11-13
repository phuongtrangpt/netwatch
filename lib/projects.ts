export const MAIN_PROJECT={id:'main',name:'Mạng chính · RB5009',model:'RB5009',mode:'infrastructure',createdAt:0};
export const validProjectId=(v:string)=>v==='main'||/^net-[a-f0-9]{32}$/.test(v);
export function projectId(req:Request){const id=new URL(req.url).searchParams.get('project')||'main';if(!validProjectId(id))throw new Error('Invalid project');return id;}
export const scopedKey=(id:string,key:string)=>id==='main'?key:id+':'+key;
export async function findProject(db:D1Database,id:string){return await db.prepare('SELECT id,name,model,mode,created_at AS createdAt FROM projects WHERE id=?').bind(id).first<any>()||(id==='main'?MAIN_PROJECT:null);}
export async function projectList(db:D1Database){const rows:any=await db.prepare('SELECT p.id,p.name,p.model,p.mode,p.created_at AS createdAt,r.last_seen AS lastSeen,r.metrics IS NOT NULL AS hasData FROM projects p LEFT JOIN router r ON r.id=p.id ORDER BY p.created_at').all();const main=rows.results.find((p:any)=>p.id==='main');if(!main){const r:any=await db.prepare("SELECT last_seen FROM router WHERE id='main'").first();rows.results.unshift({...MAIN_PROJECT,lastSeen:r?.last_seen||null,hasData:!!r?.last_seen});}return rows.results;}

export const installFilename=(id:string)=>'netwatch-'+(id==='main'?'main':id.slice(4,12))+'-v5.rsc';
