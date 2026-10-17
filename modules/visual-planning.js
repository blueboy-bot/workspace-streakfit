// Build the exact candidate used by both the comparison and Apply. No source mutation.
export function adjustedWorkoutDay(day,plan,value,{catalog,targetFor,defaultTarget,minutesFor=()=>15}){
 const next=JSON.parse(JSON.stringify(day)),logged=Object.keys(day.logs||{}).filter(id=>catalog[id]&&Array.isArray(day.logs[id])&&day.logs[id].length);
 const ids=[...new Set([...(plan.ids||[]),...logged])].filter(id=>catalog[id]);
 next.exerciseIds=ids;next.trainingPreferences={...next.trainingPreferences,dailyAdjustment:{...value}};
 next.targets={};next.cardioTargets={};next.mobilityTargets={};
 for(const id of ids){const m=catalog[id],recorded=logged.includes(id);
  if(m.mobility)next.mobilityTargets[id]=recorded?(day.mobilityTargets?.[id]||2):(plan.mobilityTargets?.[id]||2);
  else if(m.kind==='cardio')next.cardioTargets[id]=recorded?(day.cardioTargets?.[id]||minutesFor(id,day)):(plan.durations?.[id]||15);
  else next.targets[id]={...(recorded?targetFor(id,day):plan.targets?.[id]||defaultTarget(id))};
 }
 next.sessionEntries=[...(plan.entries||[]),...(day.sessionEntries||[]).filter(e=>logged.includes(e.id)&&!(plan.entries||[]).some(x=>x.id===e.id))];
 next.workoutTitle=plan.title;delete next.manualOrder;delete next.cycle;delete next.specialtyMain;delete next.targetSets;
 return next;
}
export function estimateOverviewMinutes(ids,progress,entries=[]){return ids.length?Math.ceil(5+ids.reduce((sum,id)=>{const p=progress[id];if(p.kind==='cardio')return sum+p.goal;if(p.kind==='mobility')return sum+p.goal;const rest=entries.find(e=>e.id===id)?.rest||90;return sum+(p.goal*35*(p.perSide?2:1)+Math.max(0,p.goal-1)*rest+60)/60;},0)):0;}

// A conservative edit of the visible workout, not a new template or a fitness test.
// Accessory caps and time estimates are product defaults, not individual clinical limits.
export function prioritizeWorkoutAdjustment(basis,day,value,{catalog,available,family,mainIds}){
 const plan=JSON.parse(JSON.stringify(basis)),changes={},used=new Set(),seen=new Set();
 plan.ids=[];plan.entries=[];plan.targets={};plan.durations={};plan.mobilityTargets={};
 const recorded=id=>Array.isArray(day.logs?.[id])&&day.logs[id].length>0;
 const sourceEntry=id=>basis.entries?.find(e=>e.id===id)||{};
 const roots=id=>catalog[id].variantOf||id;
 const pattern=id=>{
  const root=roots(id);
  if(['bench','dbbench','dbpress','smithbench','chestmachine','pushup','push','incline','inclinebar'].includes(root))return 'press';
  if(['pulldown','pullup','assistpull'].includes(root))return 'vertical-pull';
  if(['row','barrow','chestsupported','cablerow','machinerow','bandrow'].includes(root))return 'horizontal-pull';
  return family(id)?.label||catalog[id].muscle;
 };
 for(const oldId of basis.ids){
  if(!catalog[oldId])continue;
  let id=oldId;
  if(recorded(id)&&!available(id))changes[oldId]={reason:'logged-equipment'};
  if(!available(id)&&!recorded(id)){
   id=(family(oldId)?.ids||[]).find(x=>catalog[x]&&catalog[x].muscle===catalog[oldId].muscle&&available(x)&&!used.has(x));
   if(!id){changes[oldId]={reason:'equipment'};continue;}
   changes[oldId]={reason:'replacement',to:id};
  }
  if(used.has(id))continue;
  const m=catalog[id],entry=sourceEntry(oldId),key=pattern(id);
  const eligible=entry.role==='main'||!basis.entries?.some(e=>e.role==='main')&&!['technique','control'].includes(entry.role)&&(mainIds.has(id)||mainIds.has(oldId));
  const strengthPrimary=!m.mobility&&m.kind!=='cardio'&&!seen.has(eligible?key:m.muscle)&&(eligible||!basis.ids.some(x=>mainIds.has(x)));
  const primary=strengthPrimary||m.kind==='cardio'&&!m.mobility&&id!=='warmwalk'&&id!=='cooldown'&&basis.ids.every(x=>catalog[x].kind==='cardio');
  if(value.readiness==='normal'&&!recorded(id)&&!primary&&eligible&&seen.has(key)){
   changes[oldId]={reason:'duplicate'};continue;
  }
  if(primary)seen.add(eligible?key:m.muscle);
  used.add(id);plan.ids.push(id);
  plan.entries.push({...entry,id,adjustmentPrimary:primary});
  if(m.mobility)plan.mobilityTargets[id]=basis.mobilityTargets?.[oldId]||2;
  else if(m.kind==='cardio')plan.durations[id]=basis.durations?.[oldId]||15;
  else{
   const t={...basis.targets[oldId]};
   if(value.readiness==='normal'&&!recorded(id)){
    if(!primary)t.sets=Math.min(t.sets,2);
    if(!t.quality)t.rir=Math.max(t.rir||0,3);
   }
   plan.targets[id]=t;
   if(t.sets!==basis.targets[oldId].sets)changes[oldId]={reason:'accessory',to:id};
  }
 }
 const remaining=id=>{
  const m=catalog[id],logs=day.logs?.[id]||[];
  if(m.mobility)return Math.max(0,plan.mobilityTargets[id]-logs.filter(l=>l.mobilitySets).length);
  if(m.kind==='cardio')return Math.max(0,plan.durations[id]-logs.reduce((n,l)=>n+(l.minutes||0),0));
  const n=Math.max(0,plan.targets[id].sets-logs.length);if(!n)return 0;
  const rest=plan.entries.find(e=>e.id===id)?.rest||90;
  return (n*35*(m.perSide?2:1)+Math.max(0,n-1)*rest+(logs.length?0:60))/60;
 };
 const cost=()=>Math.ceil((plan.ids.some(id=>catalog[id].kind!=='cardio'&&remaining(id)>0)?5:0)+plan.ids.reduce((n,id)=>n+remaining(id),0));
 const remove=id=>{plan.ids=plan.ids.filter(x=>x!==id);const source=Object.keys(changes).find(x=>changes[x].to===id)||id;changes[source]={reason:plan.entries.find(e=>e.id===id)?.adjustmentPrimary?'main-omit':'time'};};
 // Drop whole auxiliary exercises before changing the important work or its rest.
 for(const id of [...plan.ids].reverse()){
  if(cost()<=value.minutes)break;
  if(!recorded(id)&&!plan.entries.find(e=>e.id===id)?.adjustmentPrimary&&id!=='warmwalk'&&id!=='cooldown')remove(id);
 }
 for(const id of [...plan.ids].reverse()){
  if(cost()<=value.minutes)break;
  if(!recorded(id)&&plan.entries.find(e=>e.id===id)?.adjustmentPrimary&&plan.ids.filter(x=>plan.entries.find(e=>e.id===x)?.adjustmentPrimary).length>1)remove(id);
 }
 for(const id of [...plan.ids].reverse()){
  if(cost()<=value.minutes)break;
  if(recorded(id))continue;
  if(plan.targets[id]){
   while(cost()>value.minutes&&plan.targets[id].sets>1)plan.targets[id].sets--;
   if(plan.targets[id].sets!==basis.targets[id]?.sets)changes[id]={reason:'main-time'};
  }else if(plan.durations[id]&&id!=='warmwalk'&&id!=='cooldown'){
   plan.durations[id]=Math.max(1,plan.durations[id]-(cost()-value.minutes));changes[id]={reason:'duration'};
  }
 }
 for(const map of ['targets','durations','mobilityTargets'])for(const id of Object.keys(plan[map]))if(!plan.ids.includes(id))delete plan[map][id];
 plan.adjustmentMainIds=plan.entries.filter(e=>e.adjustmentPrimary&&plan.ids.includes(e.id)).map(e=>e.id);
 plan.entries=plan.entries.filter(e=>plan.ids.includes(e.id)).map(({adjustmentPrimary,...e})=>({...e,...(plan.targets[e.id]?{sets:plan.targets[e.id].sets}:{})}));
 plan.remainingMinutes=cost();plan.estimated=plan.remainingMinutes;plan.overBudget=plan.remainingMinutes>value.minutes;plan.adjustmentChanges=changes;plan.adjustment=value;
 return plan;
}
export function setProgressMarkup(done,goal){
 if(!Number.isFinite(done)||!Number.isFinite(goal)||goal<=0)return '';
 const count=Math.min(10,Math.max(1,Math.ceil(goal))),filled=Math.min(count,Math.floor(Math.max(0,done)/goal*count));
 return `<span class="set-pips" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i class="${i<filled?'pip-filled':''}"></i>`).join('')}</span>`;
}

export const teachingKeyframes={
 chestsupported:{row:1,frames:[{label:'起始位置',cue:'胸部贴垫，手臂自然下垂。'},{label:'划船位置',cue:'肘部沿躯干向后，胸部不离垫。'}]}
};

export function estimateRemainingOverviewMinutes(ids,progress,entries=[]){
 const active=ids.filter(id=>progress[id].goal>progress[id].done);
 const warm=active.some(id=>progress[id].kind==='strength')?5:0;
 return Math.ceil(warm+active.reduce((n,id)=>{const p=progress[id],left=p.goal-p.done;if(p.kind!=='strength')return n+left;const rest=entries.find(e=>e.id===id)?.rest||90;return n+(left*35*(p.perSide?2:1)+Math.max(0,left-1)*rest+(p.done?0:60))/60;},0));
}
