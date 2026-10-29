import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyShareModel,shareArtwork,dailyShareLayout,dailyShareDimensions,shareMuscleRegions,renderDailyShareCards} from '../modules/daily-share-card.js';
const catalog={pushup:{name:'俯卧撑',displayName:'俯卧撑 · Push-up',muscle:'胸部'},row:{name:'单臂划船',muscle:'背部',perSide:true},run:{name:'快走',kind:'cardio',muscle:'心肺'},mob:{name:'活动度',mobility:true,muscle:'活动度'},other:{name:'其他动作',muscle:'肩部'}};
test('shares actual logs, preserves variable reps and sides, excludes unperformed plans and all personal data',()=>{
 const day={exerciseIds:['pushup','row','other'],targets:{pushup:{sets:4,min:12}},bodyweight:80,photos:['private'],logs:{pushup:[{reps:10,weight:12,weightUnit:'per-dumbbell'},{reps:8,weight:10,weightUnit:'per-dumbbell'}],row:[{reps:11,recordedSides:2}],run:[{minutes:8},{minutes:6}],mob:[{mobilitySets:1}],other:[]}},before=structuredClone(day);
 const model=dailyShareModel(day,catalog,{date:'2026-10-27'});
 assert.equal(model.rows.length,4);assert.equal(model.sets,4);assert.equal(model.minutes,14);assert.match(model.rows[0].amount,/10 \/ 8/);assert.match(model.rows[1].amount,/每侧/);assert.equal(model.rows[0].weights,'');assert.equal(JSON.stringify(model).includes('private'),false);assert.deepEqual(day,before);
 const weighted=dailyShareModel(day,catalog,{showWeights:true,unit:'lb'});assert.match(weighted.rows[0].weights,/26.5 lb \/ 单只/);
});
test('empty, invalid and legacy counters do not invent performed reps, minutes or sets',()=>{
 const day={sets:{pushup:3},logs:{pushup:[null,{reps:0},{reps:NaN},{reps:-1},{reps:1.5}],run:[{minutes:Infinity},{minutes:0}],mob:[{mobilitySets:0}],unknown:[{reps:10}]}};
 assert.equal(dailyShareModel(day,catalog).rows.length,0);assert.equal(dailyShareModel({},catalog).complete,false);
});
test('card titles use explicit completion and exact art mapping, unknown variants have no substitute',()=>{
 const day={logs:{other:[{reps:10}],pushup:[{reps:8}]}};
 const model=dailyShareModel(day,catalog,{complete:false,language:'en'});assert.equal(model.complete,false);assert.equal(model.rows[0].art,null);assert.equal(model.rows[1].name,'Push-up');assert.equal(shareArtwork.closepush,undefined);
});

test('cards preserve the pictorial grid even when an exact exercise image is unavailable',()=>{assert.deepEqual(dailyShareLayout([{art:null}]),{columns:1,dataOnly:false,rowCount:1});assert.deepEqual(dailyShareLayout(Array.from({length:4},()=>({art:null}))),{columns:2,dataOnly:false,rowCount:2});assert.deepEqual(dailyShareLayout(Array.from({length:3},()=>({art:[0,0,'upper']}))),{columns:2,dataOnly:false,rowCount:2});});

test('single-card dimensions retain readable rows for every catalog-sized session and padded Story',()=>{
 for(let count=1;count<=138;count++){
  const rows=Array.from({length:count},()=>({})),card=dailyShareDimensions(rows),story=dailyShareDimensions(rows,{story:true});
  assert.equal(card.width,1080);assert.equal(card.rowCount,Math.ceil(count/card.columns));assert.equal(card.columns,count===1?1:count>=7?3:2);
  assert.ok((card.contentHeight-601)/card.rowCount>=360);assert.equal(card.offset,0);
  assert.ok(story.height>=1920);assert.ok(story.offset>=96);assert.equal(story.contentHeight,card.contentHeight);assert.ok(story.offset+story.contentHeight<=story.height);
 }
 assert.equal(dailyShareDimensions(Array(4).fill({})).height,1350);
 assert.ok(dailyShareDimensions(Array(6).fill({})).height>1350);
});

test('export draws every movement exactly once on one image, including sessions longer than four movements',async()=>{
 const saved=new Map(['document','Image','Path2D'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let labels=[];
 const ctx=new Proxy({measureText:text=>({width:String(text).length*6}),fillText:text=>labels.push(text),createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});
 try{
  globalThis.document={fonts:{load:async()=>{},ready:Promise.resolve()},createElement:()=>({getContext:()=>ctx})};
  globalThis.Image=class{set src(value){queueMicrotask(()=>this.onerror());}};
  globalThis.Path2D=class{};
  for(const count of [1,4,5,6,7,8,9,20,138])for(const story of [false,true]){
   const rows=Array.from({length:count},(_,i)=>({id:'move'+i,name:'Move'+i,amount:'4 sets × 8 reps',sets:4,muscle:'胸部',art:null}));
   const model={rows,muscles:['胸部'],sets:count*4,date:'2026-10-29',complete:true},before=JSON.stringify(model);labels=[];
   const cards=await renderDailyShareCards(model,{story});
   assert.equal(cards.length,1,`${count} movements, story=${story}`);
   for(const row of rows)assert.equal(labels.filter(label=>label===row.name).length,1,row.id);
   assert.equal(labels.some(label=>/^\d+ \/ \d+$/.test(label)),false);
   assert.equal(JSON.stringify(model),before);
  }
 }finally{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});

test('reference card muscle highlights follow logged body parts and ignore non-muscle activities',()=>{assert.deepEqual(shareMuscleRegions(['胸部','胸部','心肺','活动度','unknown']),['胸部']);assert.deepEqual(shareMuscleRegions(['股四头肌','腘绳肌','臀部','小腿']),['股四头肌','腘绳肌','臀部','小腿']);const model=dailyShareModel({targets:{pushup:{sets:4}},logs:{pushup:[{reps:12},{reps:12},{reps:12},{reps:12},{reps:9}],other:[]}},catalog);assert.deepEqual(shareMuscleRegions(model.muscles),['胸部']);assert.equal(model.sets,5);assert.match(model.rows[0].amount,/12 \/ 12 \/ 12 \/ 12 \/ 9/);assert.equal(model.demo,false);});
