import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {newDeviceId} from '../lib/device-id.ts';
import {validateDevices} from '../lib/topology.ts';
test('adding IP and virtual switch works without secure-context randomUUID',()=>{
 const httpCrypto={getRandomValues:webcrypto.getRandomValues.bind(webcrypto)};
 assert.equal('randomUUID' in httpCrypto,false);
 const ip={id:newDeviceId(httpCrypto),name:'WiFi Tầng 2',ip:'10.10.10.5',type:'ap',parentId:'router',enabled:true,pinned:true};
 const virtual={id:newDeviceId(httpCrypto),name:'Switch Tầng 2',ip:'',type:'switch',parentId:'router',enabled:false,pinned:true,virtual:true};
 assert.equal(validateDevices([ip,virtual]),null);
 assert.notEqual(ip.id,virtual.id);
 assert.equal(new Set(Array.from({length:1000},()=>newDeviceId(httpCrypto))).size,1000);
});
