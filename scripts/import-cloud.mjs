// Run only once, before pairing routers locally. Does not import/reuse tokens.
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const path=process.argv[2];if(!path)throw Error('Usage: node scripts/import-cloud.mjs /data/netwatch-cloud-export.json');
const input=JSON.parse(readFileSync(path,'utf8'));
if(input.format!=='netwatch-cloud-export-v1'||!Array.isArray(input.projects)||!Array.isArray(input.snapshots)||input.projects.length>20)throw Error('Sai định dạng file');
const db=new Database(join(process.env.DATA_DIR||'/data','netwatch.db'));db.pragma('busy_timeout=5000');
const valid=id=>id==='main'||/^net-[a-f0-9]{32}$/.test(id);
const key=(id,k)=>id==='main'?k:id+':'+k;
db.transaction(()=>{
 if(db.prepare('SELECT COUNT(*) AS n FROM router').get().n||db.prepare('SELECT COUNT(*) AS n FROM settings').get().n)throw Error('Chỉ nhập vào dữ liệu cục bộ mới, trước khi ghép router. Không ghi đè dữ liệu đang dùng.');
 for(const p of input.projects){if(!valid(p.id)||typeof p.name!=='string'||p.name.length>70||!['infrastructure','pppoe'].includes(p.mode)||!['RB5009','E50UG','Khác'].includes(p.model))throw Error('Sai dự án');db.prepare('INSERT INTO projects(id,name,model,mode,created_at) VALUES(?,?,?,?,?)').run(p.id,p.name,p.model,p.mode,Number(p.createdAt)||Date.now());}
 for(const s of input.snapshots){const id=s.project?.id;if(!valid(id)||!input.projects.some(p=>p.id===id))throw Error('Snapshot không thuộc dự án');
  for(const k of ['config','topology'])if(s[k])db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(key(id,k==='config'?'wan':k),JSON.stringify(s[k]));
  for(const row of (s.history||[]).slice(-1440)){const {at,...metrics}=row;if(!Number.isSafeInteger(at))throw Error('Sai thời gian lịch sử');if(id==='main')db.prepare('INSERT OR REPLACE INTO history(minute,data) VALUES(?,?)').run(at,JSON.stringify(metrics));else db.prepare('INSERT OR REPLACE INTO project_history(project_id,minute,data) VALUES(?,?,?)').run(id,at,JSON.stringify(metrics));}
 }
})();db.close();console.log('Đã nhập dự án, sơ đồ, alias và lịch sử khả dụng (tối đa 24 giờ). Hãy tạo bộ cài router mới trên web Pi.');
