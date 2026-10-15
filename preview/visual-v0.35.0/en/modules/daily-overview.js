// Presentation models only. Never mutate a plan or infer a performed set.
export function overviewProgress(id,day,{catalog,target,minutes}){
 const movement=catalog[id],logs=Array.isArray(day.logs?.[id])?day.logs[id]:[];
 if(movement.mobility){const goal=day.mobilityTargets?.[id]||2,done=logs.filter(log=>log.mobilitySets).length;return {kind:'mobility',goal,done,complete:done>=goal};}
 if(movement.kind==='cardio'){const goal=minutes(id,day),done=logs.reduce((sum,log)=>sum+(Number(log.minutes)||0),0);return {kind:'cardio',goal,done,complete:done>=goal};}
 const prescription=target(id,day);return {kind:'strength',goal:prescription.sets,min:prescription.min,max:prescription.max,perSide:!!movement.perSide,done:logs.length,complete:logs.length>=prescription.sets};
}
export function overviewResume(ids,progress,lastId){
 if(ids.includes(lastId)&&!progress[lastId]?.complete)return lastId;
 return ids.find(id=>!progress[id]?.complete)||ids[0]||null;
}
export function overviewTitle(ids,catalog,fallback){
 const moves=ids.map(id=>catalog[id]).filter(Boolean),groups=[...new Set(moves.map(m=>m.muscle))];
 if(!moves.length)return '今日计划';
 if(moves.every(m=>m.mobility))return '今天练活动度';
 if(moves.every(m=>m.kind==='cardio'))return '今天练心肺';
 const names={'胸部':'今天练胸','背部':'今天练背','肩部':'今天练肩','肱二头肌':'今天练手臂','肱三头肌':'今天练手臂','股四头肌':'今天练腿','腘绳肌':'今天练腿','臀部':'今天练臀腿','小腿':'今天练小腿','核心':'今天练核心'};
 const title=String(fallback||'').replace(/ · (增肌重点|力量重点)$/,'');
 if(/^(背部专项|拉 · 背部二头)$/.test(title))return '今天练背';
 if(groups.length===1&&names[groups[0]])return names[groups[0]];
 if(groups.every(g=>['肱二头肌','肱三头肌'].includes(g)))return '今天练手臂';
 return String(fallback||'今日计划').replace(/ · (增肌重点|力量重点)$/,'');
}
// Each mapped image depicts this movement, not every grip or equipment variant.
export const overviewArtwork={bench:0,pulldown:1,row:2,lateral:3,shoulderpress:4,goblet:5,barRdl:6,curl:7,altcurl:7,ropepush:8,pushup:9,bridge:10,facepull:11,chestsupported:12,pulldownNeutral:13,cablerow:14,dbbench:16,incline:17,fly:18,push:19,legpress:20,legcurl:21,legextension:22,deadlift:24,rdl:25,splitSquat:26,barhip:27,dbcalf:28,deadbug:29,bird:30,straightpull:32,cablerowSingle:33,squat:34,dbpress:35};
