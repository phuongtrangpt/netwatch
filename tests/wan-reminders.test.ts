import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planWanReminders as plan,type WanCondition} from '../lib/wan-reminders';
const down:WanCondition={interface:'ether1',label:'FPT',state:'offline',reason:'Link down'};
test('WAN reminder intervals, recovery, stale observations and disabled mode',()=>{
 let p=plan({},[down],30,0);assert.equal(p.due.length,0);
 p=plan(p.next,[down],30,29*60000);assert.equal(p.due.length,0);
 p=plan(p.next,[down],30,30*60000);assert.equal(p.due.length,1);
 p=plan(p.next,[down],30,30*60000+30000);assert.equal(p.due.length,0);
 p=plan(p.next,[{...down,state:'unknown'}],30,90*60000);assert.equal(p.due.length,0);assert.ok(p.next.ether1);
 p=plan(p.next,[{...down,state:'online'}],30,91*60000);assert.deepEqual(p.next,{});
 p=plan(p.next,[down],60,92*60000);assert.equal(p.due.length,0);
 p=plan(p.next,[down],60,151*60000);assert.equal(p.due.length,0);
 p=plan(p.next,[down],60,152*60000);assert.equal(p.due.length,1);
 p=plan(p.next,[down],0,300*60000);assert.equal(p.due.length,0);
 p=plan(p.next,[down],30,301*60000);assert.equal(p.due.length,0,'Changing interval starts a new full interval');
 p=plan(p.next,[down],30,331*60000);assert.equal(p.due.length,1);
 assert.deepEqual(plan(p.next,[],30,332*60000).next,{},'Removing a WAN stops reminders');
});
test('multiple WAN incidents have independent clocks and survive restored state',()=>{
 const first=plan({},[down],30,0);
 const second=plan(JSON.parse(JSON.stringify(first.next)),[down,{...down,interface:'ether2'}],30,20*60000);
 const due=plan(second.next,[down,{...down,interface:'ether2'}],30,30*60000);
 assert.deepEqual(due.due.map(x=>x.interface),['ether1']);
 assert.deepEqual(plan({},[down],0,0).due,[]);
});
