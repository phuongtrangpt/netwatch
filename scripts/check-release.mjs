import {readFileSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const config=readFileSync('netwatch/config.yaml','utf8');
const version=/^version:\s*"([^"]+)"/m.exec(config)?.[1];
assert.match(version||'',/^\d+\.\d+\.\d+$/,'Phiên bản phải có dạng 1.0.0');
assert.equal(version,pkg.version,'package.json và netwatch/config.yaml phải cùng phiên bản');
assert.equal(JSON.parse(readFileSync('package-lock.json','utf8')).version,version,'package-lock.json phải cùng phiên bản');
assert.ok(config.includes('image: ghcr.io/phuongtrangpt/netwatch'));
assert.ok(readFileSync('repository.yaml','utf8').includes('https://github.com/phuongtrangpt/netwatch'));
const event=process.env.GITHUB_EVENT_NAME;
let publish=event==='workflow_dispatch';
if(process.env.GITHUB_REF?.startsWith('refs/tags/')){assert.equal(process.env.GITHUB_REF,'refs/tags/v'+version,'Tag phải khớp phiên bản trong mã');publish=true;}
if(event==='push'&&process.env.GITHUB_REF==='refs/heads/main'){
 const before=process.env.BEFORE_SHA;
 let old;try{if(before&&/^[a-f0-9]{40}$/.test(before)&&!/^0+$/.test(before))old=execFileSync('git',['show',`${before}:netwatch/config.yaml`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
 const previous=/^version:\s*"([^"]+)"/m.exec(old||'')?.[1];
 publish=previous!==version;
 if(!publish)console.log('::notice::Mã đã được kiểm tra nhưng chưa phát hành: tăng phiên bản để tạo bản cập nhật HAOS.');
}
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`version=${version}\npublish=${publish}\n`);
console.log(JSON.stringify({version,publish}));
