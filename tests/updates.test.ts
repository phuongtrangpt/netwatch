import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newerVersion,parseRelease,fetchLatestRelease} from '../server/updates';
test('update comparison is numeric and excludes invalid or prerelease versions',()=>{
 assert.equal(newerVersion('1.0.16','1.0.15'),true);assert.equal(newerVersion('1.0.9','1.0.16'),false);assert.equal(newerVersion('2.0.0','1.99.99'),true);assert.equal(newerVersion('1.0.16','1.0.16'),false);assert.equal(newerVersion('1.0.17-beta','1.0.16'),false);
});
test('Windows packages must come from the fixed repository with size and SHA-256 metadata',()=>{
 const asset={name:'netwatch-windows-x64-1.0.17.zip',state:'uploaded',size:123,digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/phuongtrangpt/netwatch/releases/download/v1.0.17/netwatch-windows-x64-1.0.17.zip'};
 const value={tag_name:'v1.0.17',draft:false,prerelease:false,assets:[asset]};assert.ok(parseRelease(value).asset);
 for(const changed of [{browser_download_url:'https://evil.example/app.zip'},{digest:''},{size:400*1024*1024},{name:'Source code.zip'}])assert.equal(parseRelease({...value,assets:[{...asset,...changed}]}).asset,undefined);
 assert.throws(()=>parseRelease({...value,prerelease:true}));assert.throws(()=>parseRelease({...value,draft:true}));assert.throws(()=>parseRelease({...value,tag_name:'v1.0.17-beta'}));
});

test('release download manifest works without any GitHub API request',async()=>{
 const calls:string[]=[],version='1.0.20',name=`netwatch-windows-x64-${version}.zip`,manifest={tag_name:'v'+version,assets:[{name,state:'uploaded',size:42,digest:'sha256:'+'b'.repeat(64),browser_download_url:`https://github.com/phuongtrangpt/netwatch/releases/download/v${version}/${name}`}]};
 const result=await fetchLatestRelease((async(url:any)=>{calls.push(String(url));assert.ok(String(url).endsWith('/releases/latest/download/netwatch-update.json'));return new Response(JSON.stringify(manifest));}) as typeof fetch);
 assert.equal(result.version,version);assert.ok(result.asset);assert.equal(calls.length,1);
});
test('missing or invalid manifest falls back to API and reports rate limiting',async()=>{
 for(const status of [403,429]){let calls=0;await assert.rejects(fetchLatestRelease((async()=>{calls++;return new Response('{}',{status:calls===1?404:status});}) as typeof fetch),/GitHub/);assert.equal(calls,2);}
 let calls=0;const result=await fetchLatestRelease((async()=>{calls++;return new Response(JSON.stringify(calls===1?{tag_name:'unsafe'}:{tag_name:'v1.0.20',assets:[]}));}) as typeof fetch);assert.equal(result.version,'1.0.20');assert.equal(calls,2);
});
