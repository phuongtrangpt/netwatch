import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wanProbeTransition as step} from '../lib/wan-alerts';
test('WAN alerts confirm outages and never report first failed ping as recovery',()=>{
 let prior:any={status:'online',at:0,failures:0};
 const advance=(received:number,at:number)=>{const result=step(prior,{received},at);prior={...prior,...result,at};return result;};
 assert.equal(advance(0,30000).transition,null);
 assert.equal(advance(2,60000).transition,null,'One failed sample followed by success is not an outage');
 assert.equal(advance(0,90000).transition,null);
 assert.equal(advance(0,120000).transition,'offline');
 assert.equal(advance(0,150000).transition,null,'Repeated failure must not duplicate the alert');
 assert.equal(advance(0,400000).transition,null,'Stale samples reset confirmation, not the last confirmed state');
 assert.equal(advance(0,430000).transition,null,'Continuing outage after a gap must not duplicate the alert');
 assert.equal(advance(2,460000).transition,'online');
 assert.equal(advance(2,490000).transition,null);
});
test('WAN offline at first observation is reported after two failed probes',()=>{
 const first=step(null,{received:0,error:true},30000);
 assert.equal(first.transition,null);
 const second=step({...first,at:30000},{received:0},60000);
 assert.equal(second.transition,'offline');
});
