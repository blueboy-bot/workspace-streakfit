const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
export function isolateLocalRecords(source,catalog){
 const issues=[];const bad=(path,reason)=>issues.push({path,reason});
 function collection(input,path){if(input===undefined)return {};if(!plain(input)){bad(path,'日期集合不是对象');return {};}const result={};
 for(const [date,raw]of Object.entries(input)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||!plain(raw)){bad(path+'.'+date,'日期记录无效');continue;}const d={...raw},prefix=path+'.'+date;
 const map=(name,valid)=>{if(d[name]===undefined)return;if(!plain(d[name])){bad(prefix+'.'+name,'记录不是对象');d[name]={};return;}d[name]=Object.fromEntries(Object.entries(d[name]).filter(([id,value])=>{const ok=valid(id,value);if(!ok)bad(prefix+'.'+name+'.'+id,'条目无效');return ok;}));};
 map('logs',(id,logs)=>!!catalog[id]&&Array.isArray(logs));
 for(const [id,logs]of Object.entries(d.logs||{})){d.logs[id]=logs.filter((l,i)=>{const ok=plain(l)&&['weight','reps','minutes','mobilitySets'].every(k=>l[k]===undefined||finite(l[k]));if(!ok)bad(prefix+'.logs.'+id+'.'+i,'训练组无效');return ok;});}
 if(d.exerciseIds!==undefined){if(!Array.isArray(d.exerciseIds)){bad(prefix+'.exerciseIds','动作列表不是数组');d.exerciseIds=Object.keys(d.logs||{});}else{d.exerciseIds=[...new Set(d.exerciseIds.filter(id=>{const ok=typeof id==='string'&&!!catalog[id];if(!ok)bad(prefix+'.exerciseIds','动作ID无效');return ok;}))];}}
 map('sets',(_,v)=>Number.isInteger(v)&&v>=0&&v<=1000);
 map('targets',(id,v)=>!!catalog[id]&&plain(v)&&Number.isInteger(v.sets)&&v.sets>=1&&v.sets<=10&&finite(v.min)&&finite(v.max)&&v.min>=1&&v.max>=v.min&&v.max<=100);
 for(const name of ['cardioTargets','mobilityTargets'])map(name,(id,v)=>!!catalog[id]&&finite(v)&&v>0);
 const list=(name,valid)=>{if(d[name]===undefined)return;if(!Array.isArray(d[name])){bad(prefix+'.'+name,'记录不是数组');d[name]=[];return;}d[name]=d[name].filter((item,i)=>{const ok=valid(item);if(!ok)bad(prefix+'.'+name+'.'+i,'条目无效');return ok;});};
 list('sessionEntries',e=>plain(e)&&!!catalog[e.id]&&(e.rest===undefined||finite(e.rest)));
 list('learnedMoves',id=>typeof id==='string'&&!!catalog[id]);
 list('meals',m=>plain(m)&&['早餐','午餐','晚餐','加餐'].includes(m.kind)&&['偏少','适中','偏多'].includes(m.portion)&&['protein','vegetables','staple'].every(k=>typeof m[k]==='boolean'));
 const comfort=c=>plain(c)&&['good','sore','pain','urgent'].includes(c.kind);
 list('comfortHistory',comfort);
 if(d.discomfort!==undefined){if(!comfort(d.discomfort)){bad(prefix+'.discomfort','身体反馈无效');delete d.discomfort;}else if(d.discomfort.note!==undefined&&typeof d.discomfort.note!=='string'){bad(prefix+'.discomfort.note','备注无效');d.discomfort={...d.discomfort,note:''};}}
 list('adjustmentHistory',a=>plain(a)&&Number.isInteger(a.minutes)&&a.minutes>=10&&a.minutes<=180&&['健身房','家中'].includes(a.place)&&['good','normal','tired'].includes(a.readiness));
 for(const name of ['water','sleep','waterTarget','sleepTarget','bodyweight','legacyXP','legacyCarryXP'])if(d[name]!==undefined&&!finite(d[name])){bad(prefix+'.'+name,'数值无效');delete d[name];}
 if(d.trainingPreferences!==undefined&&!plain(d.trainingPreferences)){bad(prefix+'.trainingPreferences','偏好无效');delete d.trainingPreferences;}
 if(d.personalRecord!==undefined&&(!plain(d.personalRecord)||typeof d.personalRecord.note!=='string'||d.personalRecord.waist!==undefined&&(!finite(d.personalRecord.waist)||d.personalRecord.waist<20||d.personalRecord.waist>300))){bad(prefix+'.personalRecord','个人记录无效');delete d.personalRecord;}
 if(d.targetSets!==undefined&&(!Number.isInteger(d.targetSets)||d.targetSets<1||d.targetSets>10)){bad(prefix+'.targetSets','目标组数无效');delete d.targetSets;}for(const name of ['protein','vegetables','rest','learnedBasics','recoveryFeedback','trainingPaused','sleepRecorded'])if(d[name]!==undefined&&typeof d[name]!=='boolean'){bad(prefix+'.'+name,'状态不是布尔值');delete d[name];}result[date]=d;
 }return result;}
 return {history:collection(source.history,'history'),plannedWorkouts:collection(source.plannedWorkouts,'plannedWorkouts'),issues};
}

// A saved status is not enough: the underlying answers must agree with it.
export function screeningAllowsTraining(safety){return safety?.status==='ready'&&safety.symptoms==='no'&&safety.review==='no';}
export function persistUnchangedWorkspace(storage,key,expected,next){
 if((storage.getItem(key)||'')!==expected){const error=new Error('其他页面的记录已变化，本页尚未覆盖。请先导出本页备份，再刷新读取已保存的记录。');error.code='WORKSPACE_CHANGED';throw error;}
 storage.setItem(key,next);return next;
}
export function consistentEasySets(logs,target){
 if(!Array.isArray(logs)||!Number.isInteger(target?.sets)||logs.length<target.sets)return false;
 const last=logs.at(-1);if(!last||!Number.isFinite(last.weight))return false;
 return logs.every(log=>log.easy===true&&Number.isInteger(log.reps)&&log.reps>=target.min&&log.weight===last.weight&&log.weightUnit===last.weightUnit);
}
export function currentRecordedWeight(log,{dumbbell=false}={}){
 if(!Number.isFinite(log?.weight)||log.weight<0)return '';
 if(dumbbell&&log.weightUnit!=='per-dumbbell')return '';
 return log.weight;
}

// Compatibility for hypertrophy-v1: secondary-muscle accounting accidentally
// leaked half-set allowances into generated targets. Recognize the generator's
// exact metadata before repairing; never coerce arbitrary malformed records.
export function normalizeGeneratedSetTargets(source,catalog){
 if(!plain(source))return {data:source,repairs:[]};
 const data=JSON.parse(JSON.stringify(source)),repairs=[];
 for(const collection of ['history','plannedWorkouts']){
  if(!plain(data[collection]))continue;
  for(const [date,d] of Object.entries(data[collection])){
   if(!plain(d)||!plain(d.targets)||!Array.isArray(d.sessionEntries))continue;
   for(const [id,target] of Object.entries(d.targets)){
    if(!catalog[id]||!plain(target)||!Number.isFinite(target.sets)||target.sets<1||target.sets>10||target.sets%1!==.5)continue;
    if(!Number.isInteger(target.min)||!Number.isInteger(target.max)||target.min<1||target.max<target.min||target.max>100)continue;
    const entry=d.sessionEntries.find(e=>plain(e)&&e.id===id);
    if(!entry||entry.sets!==target.sets||entry.transitionSeconds!==90||![45,90].includes(entry.workSeconds)||![60,90,150].includes(entry.rest)||![2,3].includes(target.rir)||d.targetScopes?.[id]==='day')continue;
    const sets=Math.floor(target.sets);
    repairs.push({path:collection+'.'+date+'.targets.'+id+'.sets',before:target.sets,after:sets});
    target.sets=sets;entry.sets=sets;
   }
  }
 }
 return {data,repairs};
}
