import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleSchedule} from '../modules/planning.js';
import {app} from '../test-support/helper.mjs';

test('all valid cycle pairs including one zero preserve dates and ordinals across months',()=>{
 const a=app();let checked=0;
 for(let train=0;train<=7;train++)for(let rest=0;rest<=7;rest++){
  if(!train&&!rest)continue;
  a.run(`state.profile={scheduleMode:'cycle',scheduleStart:'2026-10-28',trainDays:'${train}',restDays:'${rest}'};`);
  assert.equal(a.run(`schedule(new Date(2026,9,27))`),'pending');let ordinal=0;
  for(let i=0;i<60;i++){
   assert.equal(a.run(`trainingOrdinal(new Date(2026,9,28+${i}))`),ordinal,`${train}/${rest} ordinal ${i}`);
   const training=i%(train+rest)<train;
   assert.equal(a.run(`schedule(new Date(2026,9,28+${i}))`),training?'training':'recovery',`${train}/${rest} date ${i}`);
   if(training)ordinal++;checked++;
  }
 }
 assert.equal(checked,3780);
 assert.equal(cycleSchedule({trainDays:'0',restDays:'7'}).weekly,0);
 assert.equal(cycleSchedule({trainDays:'7',restDays:'0'}).weekly,7);
});

test('zero is explicit, legacy missing fields retain defaults, malformed cycles fail closed',()=>{
 assert.equal(cycleSchedule({}).train,3);assert.equal(cycleSchedule({}).rest,1);
 for(const pair of [[0,0],[-1,1],[1,-1],[1.5,1],[1,8],['',1],[null,1],[true,1]]){
  const value=cycleSchedule({trainDays:pair[0],restDays:pair[1]});assert.equal(value.valid,false);assert.equal(value.train,0);assert.equal(value.weekly,0);assert(value.period>0);
 }
 const a=app();a.run(`state.profile={scheduleMode:'cycle',trainDays:'0',restDays:'0',scheduleStart:dateKey()}`);
 assert.equal(a.run('schedule()'),'recovery');assert.equal(a.run('trainingOrdinal(new Date())'),0);
});

function settings(train,rest){const a=app();a.run(`state.onboarded=true;state.profile={...state.profile,goal:'建立运动习惯',place:'家中',experience:'初学者',minutes:'15',days:'3',scheduleMode:'cycle',scheduleStart:dateKey(),trainDays:'1',restDays:'1',equipment:['无器械 / 徒手']};today().exerciseIds=['squat'];today().logs={squat:[{weight:0,reps:8}]};const before=JSON.stringify(today().logs);const values={...state.profile,trainDays:${JSON.stringify(train)},restDays:${JSON.stringify(rest)},safetySymptoms:'no',safetyReview:'no'};setup.elements.namedItem=name=>Object.hasOwn(values,name)?{value:values[name]}:null;document.querySelectorAll=s=>s==='#equipment-options input:checked'?[{value:'无器械 / 徒手'}]:[];generatePlan()`);return a;}
test('plan save accepts one zero, preserves actual logs and rejects invalid input without replacing profile',()=>{
 for(const [train,rest] of [['0','7'],['7','0'],['1','0'],['0','1']]){
  const a=settings(train,rest);assert.equal(a.run('state.profile.trainDays'),train);assert.equal(a.run('state.profile.restDays'),rest);assert.equal(a.run('JSON.stringify(today().logs)===before'),true);assert.equal(a.run('document.querySelector("#setup-feedback").textContent'),'路线已生成');
 }
 for(const [train,rest] of [['0','0'],['','1'],['1',''],['-1','1'],['1.5','1'],['1','8']]){
  const a=settings(train,rest);assert.equal(a.run('state.profile.trainDays'),'1');assert.equal(a.run('state.profile.restDays'),'1');assert.match(a.run('document.querySelector("#setup-feedback").textContent'),/0–7/);assert.equal(a.run('JSON.stringify(today().logs)===before'),true);
 }
});

test('zero cycle backups round trip and invalid pairs cannot overwrite old saved state',()=>{
 for(const [train,rest] of [['0','7'],['7','0']]){
  const a=settings(train,rest),saved=a.saved();const copy=a.run('parseBackup(JSON.stringify(state))');assert.equal(copy.profile.trainDays,train);assert.equal(copy.profile.restDays,rest);assert.equal(JSON.stringify(copy.history),JSON.stringify(a.run('state.history')));
  for(const pair of [[0,0],[-1,1],[1,1.5],[1,8],['',1]])assert.throws(()=>a.run(`parseBackup(JSON.stringify({...state,profile:{...state.profile,trainDays:${JSON.stringify(pair[0])},restDays:${JSON.stringify(pair[1])}}}))`));
  assert.equal(a.saved(),saved);
 }
 const a=app();assert.doesNotThrow(()=>a.run('parseBackup(JSON.stringify(state))'));
});

test('weekly suggestions and plan frequency respect both zero boundaries without automatic XP',()=>{
 for(const [train,rest,expected] of [[0,7,0],[7,0,7]]){
  const a=app();a.run(`state.onboarded=true;state.safety={status:'ready'};state.profile={...state.profile,goal:'增肌与体型塑造',experience:'初学者',place:'家中',equipment:['无器械 / 徒手'],minutes:'30',scheduleMode:'cycle',scheduleStart:'2026-10-01',trainDays:'${train}',restDays:'${rest}',split:'auto'};state.history={};state.plannedWorkouts={};`);
  assert.equal(a.run('weeklyGrowth().suggested'),expected);assert.equal(a.run('total()'),0);assert.equal(a.run('Number.isFinite(cycleContext().exposure)'),true);
  a.run(`state.profile.goal='提升心肺与耐力'`);assert.equal(a.run('Number.isFinite(cardioPlan().estimated)'),true);assert.equal(a.run('total()'),0);
 }
});

test('zero rest days never bypass screening or pain stops',()=>{
 for(const status of ['review','urgent']){const a=settings('7','0');a.run(`state.safety.status='${status}'`);assert.equal(a.run('schedule()'),'training');assert.equal(a.run('canRecordWorkout()'),false);assert.equal(a.run('prescription().ids.length'),0);}
 const a=settings('7','0');a.run(`recordComfort('pain')`);assert.equal(a.run('canRecordWorkout()'),false);assert.equal(a.run('prescription().ids.length'),0);
});
