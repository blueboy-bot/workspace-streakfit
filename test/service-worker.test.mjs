import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function worker({failDownload=false}={}){
 const handlers={},calls=[],scope='https://example.test/streakfit/';
 const cache={addAll:async requests=>{calls.push('download');if(failDownload)throw Error('offline');},match:async url=>{calls.push(url);return 'cached';}};
 const self={registration:{scope},location:{origin:'https://example.test'},addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>calls.push('activate-ready'),clients:{claim:async()=>calls.push('claim')}};
 const caches={open:async()=>cache,keys:async()=>['streakfit-shell-/streakfit/-old','other-app-cache'],delete:async key=>calls.push('delete:'+key)};
 vm.runInNewContext(source,{self,caches,URL,Request,fetch:async request=>'network:'+request.url});
 return {handlers,calls};
}
test('complete-shell updates can activate with multiple app tabs, and failed downloads never activate',async()=>{
 const good=worker();let pending;good.handlers.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(good.calls,['download','activate-ready']);
 const bad=worker({failDownload:true});bad.handlers.install({waitUntil:p=>pending=p});await assert.rejects(pending,/offline/);assert.deepEqual(bad.calls,['download']);
 good.handlers.activate({waitUntil:p=>pending=p});await pending;assert.ok(good.calls.includes('claim'));assert.ok(good.calls.includes('delete:streakfit-shell-/streakfit/-old'));assert.ok(!good.calls.includes('delete:other-app-cache'));
});
test('cache routing respects explicit module versions while navigation and offline assets remain usable',async()=>{
 const a=worker();
 const request=async(url,mode)=>{let response;a.handlers.fetch({request:{method:'GET',url:'https://example.test/streakfit/'+url,mode},respondWith:p=>response=p});return response===undefined?'network-default':await response;};
 assert.equal(await request('app.js?v=0391-clean-art12'),'cached');
 assert.equal(await request('app.js?v=0391-minimum-four9'),'network-default');
 assert.equal(await request('modules/visual-planning.js?v=artwork10'),'cached');
 assert.equal(await request('modules/visual-planning.js?v=another-version'),'network-default');
 assert.equal(await request('?v=clean-art12','navigate'),'cached');
 assert.equal(await request('assets/exercises/supplement-bench.png'),'cached');
 assert.equal(await request('update.html?v=clean-art12','navigate'),'network-default');
});
