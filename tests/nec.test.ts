import {test} from 'node:test';
import assert from 'node:assert/strict';
import snmp from 'net-snmp';
import {collectNEC,normalizeNEC,validateNECConfig} from '../server/nec-snmp';
import {rates} from '../lib/core';
import {createSocket} from 'node:dgram';
async function freeUDP(){const s=createSocket('udp4');await new Promise<void>(resolve=>s.bind(0,'127.0.0.1',resolve));const port=(s.address() as any).port;await new Promise<void>(resolve=>s.close(resolve));return port;}
test('NEC validates read-only connection inputs and retains an unchanged community',()=>{
 const old={enabled:false,host:'192.168.1.1',port:161,community:'private-monitoring'};
 assert.deepEqual(validateNECConfig({...old,community:''},old),old);
 for(const host of ['127.0.0.1','0.0.0.0','224.0.0.1','169.254.169.254','192.168.1.1;reboot','https://example.com'])assert.throws(()=>validateNECConfig({...old,host}));
 for(const port of [0,65536,1.2])assert.throws(()=>validateNECConfig({...old,port}));
 assert.throws(()=>validateNECConfig({...old,community:''}));
});
test('NEC rates preserve Counter64 precision and discard resets/discontinuities',()=>{
 const make=(rx:string,uptime:number,epoch='0')=>({resource:{uptime:uptime+'s'},stats:[{name:'GigaEthernet0.1',ifIndex:4,counterBits:64,counterEpoch:epoch,'rx-byte':rx,'tx-byte':rx}]});
 const before=make('9007199254740993',100),after=make('9007199254741993',130);
 assert.equal(rates(after,before,40000,10000)['GigaEthernet0.1'].rx,1000*8/30);
 assert.equal(rates(make('1',130),before,40000,10000)['GigaEthernet0.1'].rx,null);
 assert.equal(rates(make('9007199254741993',130,'1'),before,40000,10000)['GigaEthernet0.1'].rx,null);
 assert.equal(rates(make('9007199254741993',1),before,40000,10000)['GigaEthernet0.1'].rx,null);
 const missing=normalizeNEC({uptime:1000},{1:{2:Buffer.from('GE0'),3:6,7:1,8:1}},{});assert.equal(missing.stats[0]['rx-byte'],null);assert.equal(missing.resource['cpu-load'],null);
});
test('NEC performs real UDP SNMPv2c GET/BULK against an agent and handles timeouts',async()=>{
 const port=await freeUDP(),agent=snmp.createAgent({port,address:'127.0.0.1',accessControlModelType:snmp.AccessControlModelType.Simple},()=>{});
 try{agent.getAuthorizer().addCommunity('nec-test-only');const mib=agent.getMib();
 const scalar=(name:string,oid:string,type:any,value:any)=>{mib.registerProvider({name,oid,type:snmp.MibProviderType.Scalar,scalarType:type,maxAccess:snmp.MaxAccess['read-only']});mib.setScalarValue(name,value);};
 scalar('sysDescr','1.3.6.1.2.1.1.1',snmp.ObjectType.OctetString,'NEC IX2106 10.5.13');scalar('sysUpTime','1.3.6.1.2.1.1.3',snmp.ObjectType.TimeTicks,360000);scalar('sysName','1.3.6.1.2.1.1.5',snmp.ObjectType.OctetString,'NEC-fixture');
 const table=(name:string,oid:string,columns:any[],values:any[])=>{mib.registerProvider({name,oid,type:snmp.MibProviderType.Table,maxAccess:snmp.MaxAccess['not-accessible'],tableColumns:columns.map(([number,type])=>({number,name:name+number,type,maxAccess:snmp.MaxAccess['read-only']})),tableIndex:[{columnName:name+'1'}]});mib.addTableRow(name,values);};
 table('ifTable','1.3.6.1.2.1.2.2.1',[[1,snmp.ObjectType.Integer],[2,snmp.ObjectType.OctetString],[3,snmp.ObjectType.Integer],[7,snmp.ObjectType.Integer],[8,snmp.ObjectType.Integer]],[1,'GigaEthernet0.1',23,1,1]);
 // ifXTable index is supplied separately, its first column is the interface name.
 mib.registerProvider({name:'ifX',oid:'1.3.6.1.2.1.31.1.1.1',type:snmp.MibProviderType.Table,maxAccess:snmp.MaxAccess['not-accessible'],tableColumns:[{number:1,name:'ifName',type:snmp.ObjectType.OctetString,maxAccess:snmp.MaxAccess['read-only']},{number:6,name:'ifHCInOctets',type:snmp.ObjectType.Counter64,maxAccess:snmp.MaxAccess['read-only']},{number:10,name:'ifHCOutOctets',type:snmp.ObjectType.Counter64,maxAccess:snmp.MaxAccess['read-only']}],tableIndex:[{foreign:'ifTable',columnName:'ifTable1'}]});
 mib.addTableRow('ifX',[1,'GigaEthernet0.1',Buffer.from('0020000000000001','hex'),Buffer.from('0020000000000002','hex')]);
 const data=await collectNEC({host:'127.0.0.1',port,community:'nec-test-only',enabled:true});assert.equal(data.identity,'NEC-fixture');assert.equal(data.stats[0].name,'GigaEthernet0.1');assert.equal(data.stats[0].running,true);assert.equal(data.stats[0]['rx-byte'],'9007199254740993');assert.equal(data.resource.uptime,'3600s');
 await assert.rejects(collectNEC({host:'127.0.0.1',port,community:'wrong',enabled:true}),/SNMP/);
 }finally{agent.close();}
});
