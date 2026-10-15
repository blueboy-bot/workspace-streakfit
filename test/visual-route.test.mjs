import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../test-support/helper.mjs';
import {translateText} from '../modules/localization.js';

function ready(){const a=app();a.run(`state.safety={status:'ready'};state.profile.goal='增肌与体型塑造';state.profile.experience='有规律训练经验';state.profile.place='健身房';state.profile.minutes='60';state.profile.scheduleMode='cycle';state.profile.trainDays='1';state.profile.restDays='1';state.profile.scheduleStart=dateKey();`);return a;}

test('route reads saved dates and exact variant artwork without writing plans, logs or XP',()=>{
 const a=ready();a.run(`const at=new Date(dateKey()+'T12:00:00');at.setDate(at.getDate()+2);const future=at.toLocaleDateString('en-CA');state.plannedWorkouts={[future]:{exerciseIds:['pulldownSingle','chestsupported'],manualOrder:true,targets:{pulldownSingle:{sets:2,min:6,max:8},chestsupported:{sets:3,min:8,max:12}},workoutTitle:'背部专项'}};var beforeRoute=JSON.stringify(state);var routeModel=routeDayPresentation(at);`);
 assert.equal(a.run('routeModel.ids.join(",")'),'pulldownSingle,chestsupported');
 assert.equal(a.run('routeModel.representative'),'chestsupported');
 assert.equal(a.run('routeModel.progress.pulldownSingle.goal'),2);
 assert.equal(a.run('JSON.stringify(state)===beforeRoute'),true);
 a.run(`page='path';render();`);assert.equal(a.run('JSON.stringify(state)===beforeRoute'),true);
 assert.equal(a.run(`(content.innerHTML.match(/data-route-card=/g)||[]).length`),7);
});

test('only real completed targets create completed status; recovery does not fabricate a workout',()=>{
 const a=ready();a.run(`state.history[dateKey()]={exerciseIds:['bench'],targets:{bench:{sets:2,min:8,max:12}},logs:{bench:[{weight:20,reps:8}]},sets:{}};var routeModel=routeDayPresentation(new Date());`);
 assert.equal(a.run('routeModel.status'),'已有记录');
 a.run(`state.history[dateKey()].logs.bench.push({weight:20,reps:8});routeModel=routeDayPresentation(new Date());`);assert.equal(a.run('routeModel.complete'),true);
 a.run(`state.history[dateKey()]={exerciseIds:[],rest:true,logs:{},sets:{}};routeModel=routeDayPresentation(new Date());`);
 assert.equal(a.run('routeModel.complete'),false);assert.equal(a.run('routeModel.status'),'已记录恢复');assert.equal(a.run('routeModel.recovery'),true);
});

test('future edited recovery dates preserve their chosen movement and zero actions stay empty',()=>{
 const a=ready();a.run(`var at=new Date();at.setDate(at.getDate()+1);var future=at.toLocaleDateString('en-CA');state.plannedWorkouts={[future]:{exerciseIds:['goblet'],targets:{goblet:{sets:2,min:8,max:12}}}};var routeModel=routeDayPresentation(at);`);
 assert.equal(a.run('routeModel.ids[0]'),'goblet');assert.equal(a.run('routeModel.recovery'),false);
 a.run(`state.plannedWorkouts[future].exerciseIds=[];routeModel=routeDayPresentation(at);`);assert.equal(a.run('routeModel.ids.length'),0);assert.equal(a.run('routeModel.recovery'),true);assert.equal(a.run('routeModel.complete'),false);
});

test('cardio minutes and mobility groups use their date targets, not today recorder context',()=>{
 const a=ready();a.run(`var at=new Date();at.setDate(at.getDate()+2);var future=at.toLocaleDateString('en-CA');state.plannedWorkouts={[future]:{exerciseIds:['warmwalk','ankle'],cardioTargets:{warmwalk:7},mobilityTargets:{ankle:3}}};var routeModel=routeDayPresentation(at);`);
 assert.equal(a.run('routeModel.progress.warmwalk.goal'),7);assert.equal(a.run('routeModel.progress.ankle.goal'),3);assert.equal(a.run('routeModel.progress.ankle.kind'),'mobility');assert.equal(a.run('routeModel.estimate'),15);
});

test('the active rolling four week block includes today even after the first 28 days',()=>{
 const a=ready();a.run(`var start=new Date();start.setDate(start.getDate()-70);state.profile.scheduleStart=start.toLocaleDateString('en-CA');page='path';render();`);
 assert.equal(a.run('dayIndex(new Date())-dayIndex(routeBlockStart())'),14);
 assert.equal(a.run('routeWeekIndex'),2);assert.equal(a.run('content.innerHTML.includes(\'aria-current="date"\')'),true);
 assert.equal(a.run(`(content.innerHTML.match(/data-route-week=/g)||[]).length`),4);
});

test('history uses saved targets and extra sets remain actual progress without changing XP',()=>{
 const a=ready();a.run(`var at=new Date();at.setDate(at.getDate()-1);var past=at.toLocaleDateString('en-CA');state.history[past]={exerciseIds:['bench'],targets:{bench:{sets:3,min:8,max:12}},logs:{bench:Array.from({length:4},()=>({weight:20,reps:8}))},sets:{}};var beforeRoute=JSON.stringify(state);var routeModel=routeDayPresentation(at);`);
 assert.equal(a.run('routeModel.progress.bench.done'),4);assert.equal(a.run('routeModel.progress.bench.goal'),3);assert.equal(a.run('routeModel.complete'),true);assert.equal(a.run('JSON.stringify(state)===beforeRoute'),true);
});

test('legacy history without exerciseIds shows only its actual movements, not a regenerated plan',()=>{
 const a=ready();a.run(`var at=new Date();at.setDate(at.getDate()-1);var past=at.toLocaleDateString('en-CA');state.history[past]={logs:{bench:[{weight:20,reps:8}]},sets:{}};var beforeRoute=JSON.stringify(state);var routeModel=routeDayPresentation(at);`);
 assert.equal(a.run('routeModel.ids.join(",")'),'bench');assert.equal(a.run('JSON.stringify(state)===beforeRoute'),true);
});

test('route dates translate completely and the view does not require tutorial text',()=>{
 for(const phrase of ['选择计划周','选择日期','计划设置与说明','已记录恢复','按自己的节奏休息','可查看或调整计划','查看今日计划 →','查看计划','未记录','下肢','臀腿','第 12 周','10月15日 · 周四','5 个动作 · 约 35 分钟'])assert(!/[\u3400-\u9fff]/.test(translateText(phrase)),phrase);
});
