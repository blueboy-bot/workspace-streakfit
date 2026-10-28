import test from 'node:test';
import assert from 'node:assert/strict';
import {installDoubleTapGuard} from '../modules/touch-gestures.js';
function setup(){
 const handlers=new Map(),options=new Map();
 const root={addEventListener(type,fn,opts){handlers.set(type,fn);options.set(type,opts);},removeEventListener(type){handlers.delete(type);}};
 const stop=installDoubleTapGuard(root),target={isConnected:true,clicks:0,click(){this.clicks++;},closest(selector){return selector.startsWith('input')?(this.editable?this:null):this;}};
 const point=(x=10,y=20,id=1)=>({identifier:id,clientX:x,clientY:y});
 const emit=(type,{time=0,touches=[],changedTouches=[],node=target,cancelable=true}={})=>{const event={timeStamp:time,touches,changedTouches,target:node,cancelable,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};handlers.get(type)?.(event);return event;};
 const tap=(time,{x=10,y=20,node=target,duration=40,cancelable=true}={})=>{emit('touchstart',{time,node,touches:[point(x,y)]});const end=emit('touchend',{time:time+duration,node,changedTouches:[point(x,y)],cancelable});if(!end.defaultPrevented)node.click();return end;};
 return {handlers,options,stop,target,point,emit,tap};
}
test('rapid stationary second tap cancels zoom while each tap still activates once',()=>{const h=setup();assert.equal(h.options.get('touchend').passive,false);assert.equal(h.tap(0).defaultPrevented,false);assert.equal(h.tap(150).defaultPrevented,true);assert.equal(h.tap(260).defaultPrevented,true);assert.equal(h.target.clicks,3);});
test('distant taps, slow taps, long presses and scrolling retain browser defaults',()=>{for(const variant of ['distance','time','long','scroll']){const h=setup();h.tap(0);if(variant==='scroll'){h.emit('touchstart',{time:100,touches:[h.point()]});h.emit('touchmove',{time:120,touches:[h.point(10,50)]});assert.equal(h.emit('touchend',{time:150,changedTouches:[h.point(10,50)]}).defaultPrevented,false);assert.equal(h.tap(190).defaultPrevented,false);}else assert.equal(h.tap(variant==='time'?800:100,variant==='distance'?{x:90}:variant==='long'?{duration:600}:{}).defaultPrevented,false);}});
test('pinch and cancelled touches never become a double tap',()=>{const h=setup();h.tap(0);h.emit('touchstart',{time:100,touches:[h.point(),h.point(50,60,2)]});h.emit('touchmove',{time:120,touches:[h.point(0,0),h.point(90,90,2)]});assert.equal(h.emit('touchend',{time:150,touches:[h.point()],changedTouches:[h.point(90,90,2)]}).defaultPrevented,false);assert.equal(h.emit('touchend',{time:170,changedTouches:[h.point()]}).defaultPrevented,false);assert.equal(h.tap(200).defaultPrevented,false);h.emit('touchcancel');assert.equal(h.tap(300).defaultPrevented,false);});
test('text editing retains native tap and double-click behavior',()=>{const h=setup();h.target.editable=true;assert.equal(h.tap(0).defaultPrevented,false);assert.equal(h.tap(100).defaultPrevented,false);assert.equal(h.emit('dblclick').defaultPrevented,false);assert.equal(h.target.clicks,2);});
test('fresh controls after a rerender receive the second click, detached ones do not',()=>{const h=setup();h.tap(0);h.target.isConnected=false;const fresh={...h.target,isConnected:true,clicks:0};assert.equal(h.tap(100,{node:fresh}).defaultPrevented,true);assert.equal(fresh.clicks,1);assert.equal(h.target.clicks,1);h.tap(210);assert.equal(h.target.clicks,1);});
test('desktop double-click zoom is cancelled and cleanup removes the handlers',()=>{const h=setup();assert.equal(h.emit('dblclick').defaultPrevented,true);h.stop();assert.equal(h.handlers.size,0);});
