// Build the exact candidate used by both the comparison and Apply. No source mutation.
export function adjustedWorkoutDay(day,plan,value,{catalog,targetFor,defaultTarget,minutesFor=()=>15}){
 const next=JSON.parse(JSON.stringify(day)),logged=Object.keys(day.logs||{}).filter(id=>catalog[id]&&Array.isArray(day.logs[id])&&day.logs[id].length);
 const ids=[...new Set([...(plan.ids||[]),...logged])].filter(id=>catalog[id]);
 next.exerciseIds=ids;next.trainingPreferences={...next.trainingPreferences,dailyAdjustment:{...value}};
 next.targets={};next.cardioTargets={};next.mobilityTargets={};
 for(const id of ids){const m=catalog[id],recorded=logged.includes(id);
  if(m.mobility)next.mobilityTargets[id]=recorded?(day.mobilityTargets?.[id]||2):2;
  else if(m.kind==='cardio')next.cardioTargets[id]=recorded?(day.cardioTargets?.[id]||minutesFor(id,day)):(plan.durations?.[id]||15);
  else next.targets[id]={...(recorded?targetFor(id,day):plan.targets?.[id]||defaultTarget(id))};
 }
 next.sessionEntries=[...(plan.entries||[]),...(day.sessionEntries||[]).filter(e=>logged.includes(e.id)&&!(plan.entries||[]).some(x=>x.id===e.id))];
 next.workoutTitle=plan.title;delete next.manualOrder;delete next.cycle;delete next.specialtyMain;delete next.targetSets;
 return next;
}
export function estimateOverviewMinutes(ids,progress,entries=[]){return ids.length?Math.ceil(5+ids.reduce((sum,id)=>{const p=progress[id];if(p.kind==='cardio')return sum+p.goal;if(p.kind==='mobility')return sum+p.goal;const rest=entries.find(e=>e.id===id)?.rest||90;return sum+(p.goal*35+Math.max(0,p.goal-1)*rest+60)/60;},0)):0;}
export function setProgressMarkup(done,goal){
 if(!Number.isFinite(done)||!Number.isFinite(goal)||goal<=0)return '';
 const count=Math.min(10,Math.max(1,Math.ceil(goal))),filled=Math.min(count,Math.floor(Math.max(0,done)/goal*count));
 return `<span class="set-pips" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i class="${i<filled?'pip-filled':''}"></i>`).join('')}</span>`;
}

export const teachingKeyframes={
 pulldown:{row:0,frames:[{label:'起始位置',cue:'面向器械，大腿固定，双臂向上伸展。'},{label:'下拉位置',cue:'拉向上胸，肘部向下。'}]},
 chestsupported:{row:1,frames:[{label:'起始位置',cue:'胸部贴垫，手臂自然下垂。'},{label:'划船位置',cue:'肘部沿躯干向后，胸部不离垫。'}]}
};
