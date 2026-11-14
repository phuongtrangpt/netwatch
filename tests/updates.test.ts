import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newerVersion,parseRelease} from '../server/updates';
test('update comparison is numeric and excludes invalid or prerelease versions',()=>{
 assert.equal(newerVersion('1.0.16','1.0.15'),true);assert.equal(newerVersion('1.0.9','1.0.16'),false);assert.equal(newerVersion('2.0.0','1.99.99'),true);assert.equal(newerVersion('1.0.16','1.0.16'),false);assert.equal(newerVersion('1.0.17-beta','1.0.16'),false);
});
test('Windows packages must come from the fixed repository with size and SHA-256 metadata',()=>{
 const asset={name:'netwatch-windows-x64-1.0.17.zip',state:'uploaded',size:123,digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/phuongtrangpt/netwatch/releases/download/v1.0.17/netwatch-windows-x64-1.0.17.zip'};
 const value={tag_name:'v1.0.17',draft:false,prerelease:false,assets:[asset]};assert.ok(parseRelease(value).asset);
 for(const changed of [{browser_download_url:'https://evil.example/app.zip'},{digest:''},{size:400*1024*1024},{name:'Source code.zip'}])assert.equal(parseRelease({...value,assets:[{...asset,...changed}]}).asset,undefined);
 assert.throws(()=>parseRelease({...value,prerelease:true}));assert.throws(()=>parseRelease({...value,draft:true}));assert.throws(()=>parseRelease({...value,tag_name:'v1.0.17-beta'}));
});
