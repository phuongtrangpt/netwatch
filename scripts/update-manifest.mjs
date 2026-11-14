import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
const [archive,output]=process.argv.slice(2),version=JSON.parse(readFileSync('package.json','utf8')).version,name=basename(archive);
if(name!==`netwatch-windows-x64-${version}.zip`)throw Error('Unexpected Windows package name');
const manifest={tag_name:'v'+version,draft:false,prerelease:false,body:readFileSync('netwatch/CHANGELOG.md','utf8').split(/\n# /)[0],assets:[{name,state:'uploaded',size:statSync(archive).size,digest:'sha256:'+createHash('sha256').update(readFileSync(archive)).digest('hex'),browser_download_url:`https://github.com/phuongtrangpt/netwatch/releases/download/v${version}/${name}`} ]};
writeFileSync(output,JSON.stringify(manifest));
