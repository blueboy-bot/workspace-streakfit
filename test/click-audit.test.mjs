import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../test-support/helper.mjs';

test('replacing a strength main keeps it before technical assistance and preserves manual order',()=>{
 const a=app();
 a.run(`state.profile={goal:'提升力量',experience:'有规律训练经验',place:'健身房',equipment:defaultEquipment('健身房'),minutes:'90',scheduleMode:'cycle',scheduleStart:dateKey(),trainDays:'1',restDays:'1',split:'ppl'};today().trainingPreferences={muscleFocus:'bench_day',exerciseCount:'6'};page='workout';`);
 assert.equal(a.run(`selectedPrescription().ids.includes('bench')`),true);
 assert.equal(a.run(`replaceExercise('bench','dbbench')`),true);
 assert.equal(a.run(`workoutDay().sessionEntries.find(e=>e.id==='dbbench').role`),'main');
 assert.equal(a.run(`currentWorkoutIds()[0]`),'dbbench');
 assert.equal(a.run(`currentWorkoutIds().indexOf('dbbench')<currentWorkoutIds().indexOf('pausebench')`),true);
 a.run(`moveWorkoutExercise('dbbench',1)`);
 assert.equal(a.run(`currentWorkoutIds()[1]`),'dbbench');
});

test('future recovery day explains light activity instead of exposing ineffective specialty controls',()=>{
 const a=app();
 a.run(`state.profile={goal:'增肌与体型塑造',experience:'有规律训练经验',place:'健身房',equipment:defaultEquipment('健身房'),minutes:'60',scheduleMode:'cycle',scheduleStart:dateKey(),trainDays:'1',restDays:'1'};const future=new Date();future.setDate(future.getDate()+1);openWorkoutDay(future.toLocaleDateString('en-CA'));`);
 assert.equal(a.run(`content.innerHTML.includes('id="daily-focus"')`),false);
 assert.equal(a.run(`content.innerHTML.includes('这一天是恢复日')`),true);
 assert.equal(a.run(`content.innerHTML.includes('data-add-exercise')`),true);
 assert.equal(a.run(`points(today())`),0);
});
