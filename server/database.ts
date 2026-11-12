import Database from 'better-sqlite3';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const directory=process.env.DATA_DIR || '/data';
mkdirSync(directory,{recursive:true,mode:0o700});
export const sqlite=new Database(join(directory,'netwatch.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){
 if(!sqlite.prepare('SELECT name FROM migrations WHERE name=?').get(name))sqlite.transaction(()=>{
  sqlite.exec(readFileSync(join('drizzle',name),'utf8'));
  sqlite.prepare('INSERT INTO migrations(name) VALUES (?)').run(name);
 })();
}
class Statement {
 constructor(public sql:string,public values:any[]=[]){ }
 bind(...values:any[]){return new Statement(this.sql,values);}
 async first(column?:string){const row:any=sqlite.prepare(this.sql).get(...this.values);return row?(column?row[column]:row):null;}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.values),success:true};}
 execute(){const r=sqlite.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
 async run(){return this.execute();}
}
export const db={prepare:(sql:string)=>new Statement(sql),batch:async(statements:Statement[])=>sqlite.transaction(()=>statements.map(s=>s.execute()))()};
