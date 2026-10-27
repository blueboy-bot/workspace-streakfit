import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyShareModel,shareArtwork,dailyShareLayout} from '../modules/daily-share-card.js';
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

test('single and missing-art summaries expand into full-width layouts; illustrated sessions use a grid',()=>{assert.deepEqual(dailyShareLayout([{art:null}]),{columns:1,dataOnly:true,rowCount:1});assert.deepEqual(dailyShareLayout(Array.from({length:4},()=>({art:null}))),{columns:1,dataOnly:true,rowCount:4});assert.deepEqual(dailyShareLayout(Array.from({length:3},()=>({art:[0,0,'upper']}))),{columns:2,dataOnly:false,rowCount:2});});
