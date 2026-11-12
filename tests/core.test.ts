import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { rates,clients,wanNames,ingestError,seconds } from '../lib/core.ts';
describe('telemetry',()=>{
 it('calculates bits/sec, rejects reboot, missing counters and stale samples',()=>{
 const a={resource:{uptime:'1h'},stats:[{name:'ether1','rx-byte':1000,'tx-byte':2000}]};
 const b={resource:{uptime:'1h30s'},stats:[{name:'ether1','rx-byte':4000,'tx-byte':8000}]};
 assert.deepEqual(rates(b,a,60000,30000).ether1,{rx:800,tx:1600});
 assert.equal(rates({...b,resource:{uptime:'5s'}},a,60000,30000).ether1.rx,null);
 assert.equal(rates(b,a,300000,30000).ether1.rx,null);
 assert.equal(rates(b,null,60000,null).ether1.rx,null);
 assert.equal(rates({...b,stats:[{name:'ether1','rx-byte':1}]},a,60000,30000).ether1.rx,null);
 });
 it('does not claim DHCP means online, retains static ARP and identifies bridge port',()=>{
 const c=clients({leases:[{address:'10.0.0.2',status:'bound','mac-address':'AA'}],arp:[{address:'10.0.0.3',status:'stale','mac-address':'BB',interface:'vlan10'}],hosts:[{'mac-address':'BB','on-interface':'ether3'}]});
 assert.equal(c[0].state,'DHCP còn hạn');assert.equal(c[1].state,'ARP đã cũ');assert.equal(c[1].port,'ether3');
 });
 it('deduplicates WAN interface and rejects unknown schemas',()=>{
 assert.deepEqual(wanNames({wanmembers:[{list:'WAN',interface:'pppoe-out1'}],pppoe:[{name:'pppoe-out1',disabled:false}]}),['pppoe-out1']);
 assert.ok(ingestError({schema:2}));assert.ok(ingestError({schema:1,kind:'section',section:'passwords'}));
 assert.equal(ingestError({schema:1,kind:'section',section:'arp',part:0,rows:[],generation:'a',final:true}),null);
 assert.equal(seconds('1w2d03:04:05'),788645);
 });
});
