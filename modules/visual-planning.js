import {MIN_STRENGTH_SETS,strengthTarget,enforcePlanStrengthMinimum} from './strength-protocol.js';
// Build the exact candidate used by both the comparison and Apply. No source mutation.
export function adjustedWorkoutDay(day,plan,value,{catalog,targetFor,defaultTarget,minutesFor=()=>15}){
 const next=JSON.parse(JSON.stringify(day)),logged=Object.keys(day.logs||{}).filter(id=>catalog[id]&&Array.isArray(day.logs[id])&&day.logs[id].length);
 const ids=[...new Set([...(plan.ids||[]),...logged])].filter(id=>catalog[id]);
 next.exerciseIds=ids;next.trainingPreferences={...next.trainingPreferences,dailyAdjustment:{...value}};
 next.targets={};next.cardioTargets={};next.mobilityTargets={};
 for(const id of ids){const m=catalog[id],recorded=logged.includes(id);
  if(m.mobility)next.mobilityTargets[id]=recorded?(day.mobilityTargets?.[id]||2):(plan.mobilityTargets?.[id]||2);
  else if(m.kind==='cardio')next.cardioTargets[id]=recorded?(day.cardioTargets?.[id]||minutesFor(id,day)):(plan.durations?.[id]||15);
  else next.targets[id]=strengthTarget(recorded?targetFor(id,day):plan.targets?.[id]||defaultTarget(id));
 }
 next.sessionEntries=[...(plan.entries||[]),...(day.sessionEntries||[]).filter(e=>logged.includes(e.id)&&!(plan.entries||[]).some(x=>x.id===e.id))].map(e=>next.targets[e.id]?{...e,sets:next.targets[e.id].sets}:e);
 next.workoutTitle=plan.title;delete next.manualOrder;delete next.cycle;delete next.specialtyMain;delete next.targetSets;
 return next;
}
export function estimateOverviewMinutes(ids,progress,entries=[]){return ids.length?Math.ceil((entries.length?Math.max(...entries.map(e=>e.warmupMinutes??5)):5)+ids.reduce((sum,id)=>{const p=progress[id];if(p.kind==='cardio')return sum+p.goal;if(p.kind==='mobility')return sum+p.goal;const entry=entries.find(e=>e.id===id),rest=entry?.rest||90;return sum+(p.goal*(entry?.workSeconds??35*(p.perSide?2:1))+Math.max(0,p.goal-1)*rest+(entry?.transitionSeconds??60))/60;},0)):0;}

// A conservative edit of the visible workout, not a new template or a fitness test.
// Keep at least four sets per strength movement; omit whole movements when time is short.
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
   const t=strengthTarget(basis.targets[oldId]);
   if(value.readiness==='normal'&&!recorded(id)){
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
   while(cost()>value.minutes&&plan.targets[id].sets>MIN_STRENGTH_SETS)plan.targets[id].sets--;
   if(plan.targets[id].sets!==basis.targets[id]?.sets)changes[id]={reason:'main-time'};
   if(cost()>value.minutes)remove(id);
  }else if(plan.durations[id]&&id!=='warmwalk'&&id!=='cooldown'){
   plan.durations[id]=Math.max(1,plan.durations[id]-(cost()-value.minutes));changes[id]={reason:'duration'};
  }
 }
 for(const map of ['targets','durations','mobilityTargets'])for(const id of Object.keys(plan[map]))if(!plan.ids.includes(id))delete plan[map][id];
 plan.adjustmentMainIds=plan.entries.filter(e=>e.adjustmentPrimary&&plan.ids.includes(e.id)).map(e=>e.id);
 plan.entries=plan.entries.filter(e=>plan.ids.includes(e.id)).map(({adjustmentPrimary,...e})=>({...e,...(plan.targets[e.id]?{sets:plan.targets[e.id].sets}:{})}));
 if(!plan.ids.length&&basis.ids.length){plan.insufficientTime=true;plan.note='每个力量动作至少4组，当前时间不足以安排完整动作，请增加时间。';}
 plan.remainingMinutes=cost();plan.estimated=plan.remainingMinutes;plan.overBudget=plan.remainingMinutes>value.minutes;plan.adjustmentChanges=changes;plan.adjustment=value;
 return enforcePlanStrengthMinimum(plan,catalog);
}
export function setProgressMarkup(done,goal){
 if(!Number.isFinite(done)||!Number.isFinite(goal)||goal<=0)return '';
 const count=Math.min(10,Math.max(1,Math.ceil(goal))),filled=Math.min(count,Math.floor(Math.max(0,done)/goal*count));
 return `<span class="set-pips" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i class="${i<filled?'pip-filled':''}"></i>`).join('')}</span>`;
}

// Exact movement IDs only; independently reviewed key positions, not motion certification.
export const commonStrengthArtwork={
 "hammer": {
  "file": "common-arms.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "掌心相对，手臂自然下垂。",
    "crop": {
     "x": 2,
     "y": 2,
     "width": 621,
     "height": 582,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   },
   {
    "label": "弯举位置",
    "cue": "上臂靠近躯干，屈肘抬起哑铃。",
    "crop": {
     "x": 631,
     "y": 2,
     "width": 621,
     "height": 582,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   }
  ]
 },
 "reversefly": {
  "file": "common-arms.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "屈髋俯身，双臂自然下垂。",
    "crop": {
     "x": 2,
     "y": 592,
     "width": 621,
     "height": 660,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   },
   {
    "label": "打开位置",
    "cue": "躯干保持稳定，双臂向两侧打开。",
    "crop": {
     "x": 631,
     "y": 592,
     "width": 621,
     "height": 660,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   }
  ]
 },
 "lunge": {
  "file": "common-lunge.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "站立准备",
    "cue": "双脚站稳，双手置于髋部。",
    "crop": {
     "x": 2,
     "y": 524,
     "width": 621,
     "height": 728,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   },
   {
    "label": "后撤下蹲",
    "cue": "向后迈步下蹲，前脚全掌着地。",
    "crop": {
     "x": 631,
     "y": 524,
     "width": 621,
     "height": 728,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   }
  ]
 },
 "incline": {
  "file": "common-incline.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "下放位置",
    "cue": "头背贴凳，哑铃位于上胸两侧。",
    "crop": {
     "x": 2,
     "y": 579,
     "width": 621,
     "height": 673,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   },
   {
    "label": "推起位置",
    "cue": "手腕保持稳定，向上推起哑铃。",
    "crop": {
     "x": 632,
     "y": 579,
     "width": 620,
     "height": 673,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   }
  ]
 },
 "chestmachine": {
  "file": "common-machines.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "背部贴垫，握把与胸部大致同高。",
    "crop": {
     "x": 2,
     "y": 2,
     "width": 605,
     "height": 580,
     "sourceWidth": 1223,
     "sourceHeight": 1286
    }
   },
   {
    "label": "推出位置",
    "cue": "向前推出握把，肩膀不耸起。",
    "crop": {
     "x": 615,
     "y": 2,
     "width": 606,
     "height": 580,
     "sourceWidth": 1223,
     "sourceHeight": 1286
    }
   }
  ]
 },
 "shouldermachine": {
  "file": "common-machines.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "背部贴垫，手腕位于肘部上方。",
    "crop": {
     "x": 2,
     "y": 592,
     "width": 605,
     "height": 692,
     "sourceWidth": 1223,
     "sourceHeight": 1286
    }
   },
   {
    "label": "推起位置",
    "cue": "向上推起握把，避免腰部过度后仰。",
    "crop": {
     "x": 615,
     "y": 592,
     "width": 606,
     "height": 692,
     "sourceWidth": 1223,
     "sourceHeight": 1286
    }
   }
  ]
 },
 "barsquat": {
  "file": "common-squat-pullup.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "站立准备",
    "cue": "杠铃稳放上背，双脚站稳。",
    "crop": {
     "x": 2,
     "y": 2,
     "width": 604,
     "height": 558,
     "sourceWidth": 1222,
     "sourceHeight": 1287
    }
   },
   {
    "label": "下蹲位置",
    "cue": "脚掌保持着地，膝盖朝脚尖方向。",
    "crop": {
     "x": 616,
     "y": 2,
     "width": 604,
     "height": 558,
     "sourceWidth": 1222,
     "sourceHeight": 1287
    }
   }
  ]
 },
 "pullup": {
  "file": "common-squat-pullup.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "悬垂位置",
    "cue": "双手正握环握横杆，双脚离地。",
    "crop": {
     "x": 2,
     "y": 568,
     "width": 604,
     "height": 717,
     "sourceWidth": 1222,
     "sourceHeight": 1287
    }
   },
   {
    "label": "上拉位置",
    "cue": "屈肘向上拉，避免甩动或伸颈凑杆。",
    "crop": {
     "x": 616,
     "y": 568,
     "width": 604,
     "height": 717,
     "sourceWidth": 1222,
     "sourceHeight": 1287
    }
   }
  ]
 },
 "legcurl": {
  "file": "common-legcurl-plank.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "大腿固定，滚垫贴小腿后侧。",
    "crop": {
     "x": 2,
     "y": 2,
     "width": 762,
     "height": 562,
     "sourceWidth": 1536,
     "sourceHeight": 1024
    }
   },
   {
    "label": "屈膝位置",
    "cue": "屈膝向后下方卷动，臀部保持贴垫。",
    "crop": {
     "x": 772,
     "y": 2,
     "width": 762,
     "height": 562,
     "sourceWidth": 1536,
     "sourceHeight": 1024
    }
   }
  ]
 },
 "bird": {
  "file": "common-bird.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "四点支撑",
    "cue": "双手与双膝支撑，背部保持自然中立。",
    "crop": {
     "x": 4,
     "y": 70,
     "width": 616,
     "height": 1070,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   },
   {
    "label": "对侧伸展",
    "cue": "右臂与左腿对侧伸展，避免腰背后仰。",
    "crop": {
     "x": 633,
     "y": 70,
     "width": 616,
     "height": 1070,
     "sourceWidth": 1254,
     "sourceHeight": 1254
    }
   }
  ]
 },
 "hipthrust": {
  "file": "common-hipthrust.png",
  "thumbnail": 1,
  "frames": [
   {
    "label": "起始位置",
    "cue": "头肩贴地，双手扶稳髋部哑铃。",
    "crop": {
     "x": 3,
     "y": 150,
     "width": 961,
     "height": 550,
     "sourceWidth": 1942,
     "sourceHeight": 809
    }
   },
   {
    "label": "抬髋位置",
    "cue": "脚掌贴地抬髋，避免腰部过度后仰。",
    "crop": {
     "x": 978,
     "y": 150,
     "width": 961,
     "height": 550,
     "sourceWidth": 1942,
     "sourceHeight": 809
    }
   }
  ]
 }
};

export const teachingKeyframes={
 ...commonStrengthArtwork,
 chestsupported:{row:1,frames:[{label:'起始位置',cue:'胸部贴垫，手臂自然下垂。'},{label:'划船位置',cue:'肘部沿躯干向后，胸部不离垫。'}]}
};

export function estimateRemainingOverviewMinutes(ids,progress,entries=[]){
 const active=ids.filter(id=>progress[id].goal>progress[id].done);
 const warm=active.some(id=>progress[id].kind==='strength')?(entries.length?Math.max(...entries.map(e=>e.warmupMinutes??5)):5):0;
 return Math.ceil(warm+active.reduce((n,id)=>{const p=progress[id],left=p.goal-p.done;if(p.kind!=='strength')return n+left;const entry=entries.find(e=>e.id===id),rest=entry?.rest||90;return n+(left*(entry?.workSeconds??35*(p.perSide?2:1))+Math.max(0,left-1)*rest+(p.done?0:entry?.transitionSeconds??60))/60;},0));
}
