// Presentation models only. Never mutate a plan or infer a performed set.
export function overviewProgress(id,day,{catalog,target,minutes}){
 const movement=catalog[id],logs=Array.isArray(day.logs?.[id])?day.logs[id]:[];
 if(movement.mobility){const goal=day.mobilityTargets?.[id]||2,done=logs.filter(log=>log.mobilitySets).length;return {kind:'mobility',goal,done,complete:done>=goal};}
 if(movement.kind==='cardio'){const goal=minutes(id,day),done=logs.reduce((sum,log)=>sum+(Number(log.minutes)||0),0);return {kind:'cardio',goal,done,complete:done>=goal};}
 const prescription=target(id,day);return {kind:'strength',goal:prescription.sets,min:prescription.min,max:prescription.max,perSide:!!(movement.perSide||prescription.perSide||prescription.quality),done:logs.length,complete:logs.length>=prescription.sets};
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
export const overviewArtwork={pulldown:1,row:2,lateral:3,shoulderpress:4,goblet:5,barRdl:6,curl:7,altcurl:7,ropepush:8,pushup:9,bridge:10,facepull:11,chestsupported:12,pulldownNeutral:13,cablerow:14,dbbench:16,fly:18,push:19,legpress:20,legextension:22,deadlift:24,rdl:25,splitSquat:26,barhip:27,dbcalf:28,deadbug:29,bird:30,straightpull:32,cablerowSingle:33,squat:34,dbpress:35};
// Exact IDs only. Do not apply a reviewed grip or attachment to other variants.
export const reviewedArtwork={
 pulldown:{file:'pulldown-reviewed.png',columns:2,rows:1,column:0,row:0,setup:true},
 cablerowSingle:{file:'equipment-reviewed.png',columns:2,rows:2,column:1,row:0},
 splitSquat:{file:'equipment-reviewed.png',columns:2,rows:2,column:0,row:1},
 barhip:{file:'posture-reviewed.png',columns:2,rows:2,column:0,row:0,crop:{x:3,y:3,width:621,height:540,sourceWidth:1254,sourceHeight:1254}},
 pulldownNeutral:{file:'positions-reviewed.png',columns:2,rows:2,column:0,row:0},
 facepull:{file:'positions-reviewed.png',columns:2,rows:2,column:1,row:0},
 deadbug:{file:'setups-reviewed.png',columns:2,rows:2,column:0,row:1,setup:true},
 bird:{file:'posture-reviewed.png',columns:2,rows:2,column:1,row:0,setup:true,crop:{x:630,y:3,width:621,height:540,sourceWidth:1254,sourceHeight:1254}},
 dbcalf:{file:'posture-reviewed.png',columns:2,rows:2,column:0,row:1,crop:{x:3,y:550,width:621,height:700,sourceWidth:1254,sourceHeight:1254}},
 pushup:{file:'posture-reviewed.png',columns:2,rows:2,column:1,row:1,crop:{x:630,y:550,width:621,height:700,sourceWidth:1254,sourceHeight:1254}},
 deadlift:{file:'overview-atlas-2.png',columns:4,rows:4,column:0,row:2,crop:{x:1,y:630,width:310,height:277,sourceWidth:1254,sourceHeight:1254}},
 rdl:{file:'overview-atlas-2.png',columns:4,rows:4,column:1,row:2,crop:{x:316,y:630,width:309,height:277,sourceWidth:1254,sourceHeight:1254}}
};

// Bench press still has unresolved visual issues; keep its labelled placeholder.
export const withheldArtwork=['bench'];
