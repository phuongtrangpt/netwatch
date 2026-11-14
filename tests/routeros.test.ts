import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installer,upgradeInstaller} from '../lib/routeros.ts';
const token='f'.repeat(64);
function decode(value:string){return value.slice(1,-1).replace(/\\([\\"$n])/g,(_,c)=>c==='n'?'\n':c);}
function source(script:string,name:string){const prefix=':local '+name+' ';const line=script.split('\n').find(x=>x.startsWith(prefix));assert.ok(line);return decode(line.slice(prefix.length));}
for(const mode of ['infrastructure','pppoe']){
 test(`${mode}: HTTP collector omits HTTPS-only arguments; HTTPS verifies certificates`,()=>{
  const http=source(installer('http://mang.homephuongtrang.online','',token,'main',mode),'nwSource');
  const https=source(installer('https://netwatch.example','',token,'main',mode),'nwSource');
  assert.ok(http.includes('http://mang.homephuongtrang.online/api/ingest'));
  assert.ok(!http.includes('check-certificate='));assert.ok(!http.includes(' certificate='));
  assert.ok(https.includes('http-data=$nwPayload check-certificate=yes output=user'));
  assert.ok(http.includes(':onerror nwUploadError'));assert.ok(http.includes(' . $nwUploadError'));
  assert.ok(!http.includes(':return }'));assert.ok(http.includes('job find where script='));
 });
 test(`${mode}: upgrading preserves endpoint/key and chooses TLS arguments by protocol`,()=>{
  const upgrade=upgradeInstaller(mode);const template=source(upgrade,'nwTemplate');
  assert.equal(template.split('__NW_FETCH_CONFIG__').length,2);assert.equal(template.split('__NW_TLS_OPTIONS__').length,2);
  assert.ok(upgrade.includes('[:find $nwConfig "https://"]'));
  for(const origin of ['http://mang.homephuongtrang.online','https://netwatch.example']){
   const original=source(installer(origin,'',token,'net-'+'a'.repeat(32),mode),'nwSource');
   const start=original.indexOf('/tool fetch url=');const end=original.indexOf(' http-data=',start);
   const config=original.slice(start,end);
   const upgraded=template.replace('__NW_FETCH_CONFIG__',config).replace('__NW_TLS_OPTIONS__',origin.startsWith('https://')?' check-certificate=yes':'');
   assert.equal(upgraded,original);assert.ok(upgraded.includes('Authorization: Bearer '+token));
  }
 });
}

test('collector v6 covers 100 configured IPs in both installation modes',()=>{for(const mode of ['infrastructure','pppoe']){const script=source(installer('http://localhost:8080','',token,'main',mode),'nwSource');assert.ok(script.includes('$nwProbeCount < 100'));assert.ok(script.includes('"collector"=6'));assert.ok(!script.includes('$nwProbeCount < 16'));}});
