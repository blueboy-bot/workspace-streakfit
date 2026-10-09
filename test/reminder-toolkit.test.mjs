import test from 'node:test';import assert from 'node:assert/strict';import {createExperienceToolkit}from'../modules/experience-toolkit.js';
test('real toolkit module starts rest through injected clock and default daily reminder time is saved',async()=>{const state={reminders:{sound:false}},runtime={},changes=[];let clocks=0,saves=0;const kit=createExperienceToolkit({getState:()=>state,getLoadError:()=>false,runtime,onContentClick(){},onContentChange(h){changes.push(h)},updateRestClock(){clocks++},save(){saves++}});const start=Date.now();kit.startRest(90);assert.ok(runtime.restUntil>=start+90000);assert.equal(runtime.restAlertSent,false);assert.equal(clocks,1);await changes[0]({target:{dataset:{reminder:'daily'},checked:true,id:''}});assert.equal(state.reminders.time,'18:00');assert.equal(state.reminders.daily,true);assert.equal(saves,1);});
test('rest pause freezes time, resumes the remaining duration, and survives panel rendering',t=>{
 let now=100000,updates=0;const runtime={restUntil:0,restPausedMs:0};
 t.mock.method(Date,'now',()=>now);
 const kit=createExperienceToolkit({getState:()=>({}),getLoadError:()=>false,runtime,onContentClick(){},onContentChange(){},updateRestClock(){updates++}});
 kit.startRest(90);now+=12500;kit.toggleRestPause();
 assert.equal(runtime.restUntil,0);assert.equal(runtime.restPausedMs,77500);
 now+=600000;assert.match(kit.restTimerPanel('bench'),/01:18/);assert.match(kit.restTimerPanel('bench'),/data-pause-rest >继续/);
 kit.toggleRestPause();assert.equal(runtime.restPausedMs,0);assert.equal(runtime.restUntil,now+77500);
 now+=77501;kit.toggleRestPause();assert.equal(runtime.restPausedMs,0);assert.match(kit.restTimerPanel('bench'),/data-pause-rest disabled>暂停/);
 assert.equal(updates,4);
});

test('adjusting paused rest keeps it paused, while reset and a new rest clear the pause',t=>{
 let now=100000;const runtime={},handlers=[];
 t.mock.method(Date,'now',()=>now);
 const kit=createExperienceToolkit({getState:()=>({}),getLoadError:()=>false,runtime,onContentClick(h){handlers.push(h)},onContentChange(){},updateRestClock(){}});
 const click=(attribute,value)=>handlers[0]({target:{closest:()=>({dataset:attribute==='data-rest-shift'?{restShift:value}:{},hasAttribute:name=>name===attribute})}});
 kit.startRest(90);now+=10000;kit.toggleRestPause();
 click('data-rest-shift','15');assert.equal(runtime.restPausedMs,95000);assert.equal(runtime.restUntil,0);
 click('data-rest-shift','-15');assert.equal(runtime.restPausedMs,80000);assert.equal(runtime.restUntil,0);
 click('data-rest-shift','-1000');assert.equal(runtime.restPausedMs,1000);
 click('data-rest-reset');assert.equal(runtime.restPausedMs,0);assert.equal(runtime.restUntil,now+90000);
 kit.toggleRestPause();kit.startRest(120);assert.equal(runtime.restPausedMs,0);assert.equal(runtime.restUntil,now+120000);
});
