// Behavioural milestones never change XP or exercise difficulty.
export function behaviourAchievements(history,courses,isComplete,isRecovery,dateToday){
 const days=Object.entries(history).filter(([date])=>date<=dateToday).sort(([a],[b])=>a.localeCompare(b));
 const first=days.find(([,d])=>isComplete(d));
 const learned=new Set(days.flatMap(([,d])=>d.learnedMoves||[]));
 const recovery=days.find(([date,d])=>d.rest&&d.recoveryFeedback&&isRecovery(date));
 const squat=days.find(([,d])=>(d.logs?.squat||[]).some(l=>l.reps>=8));
 const stages=[['foundation',['control','patterns']],['habit',['logging','recovery']],['independent',['progression','adaptation']]];
 return [{id:'first',name:'第一次出发',description:'完成一次适合自己的训练或活动计划',earned:!!first,date:first?.[0]},
 {id:'explorer',name:'动作探索者',description:'阅读10个不同动作要点，阅读不等于技能认证',earned:learned.size>=10},
 {id:'recovery',name:'懂得恢复',description:'在计划恢复日记录恢复和身体感受',earned:!!recovery,date:recovery?.[0]},
 {id:'squat8',name:'第一次记录8次椅子深蹲',description:'以实际记录为准，不证明动作质量',earned:!!squat,date:squat?.[0]},
 ...stages.map(([id,ids],i)=>({id:'stage-'+id,name:['熟悉基础','建立习惯','独立训练知识'][i],description:'完成本阶段理解课程，不自动提高训练难度',earned:ids.every(id=>courses?.[id])}))];
}
export function monthCells(year,month){const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7,count=new Date(year,month+1,0).getDate();return [...Array(offset).fill(null),...Array.from({length:count},(_,i)=>`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)];}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function trainingCSV(history,catalog,modeOf=()=> 'weighted',translate=value=>value){const rows=[['日期','动作ID','动作名称','组序号','次数','重量','重量单位','重量口径','运动分钟','反馈','动作设置']];for(const [date,d] of Object.entries(history).sort(([a],[b])=>a.localeCompare(b)))for(const [id,logs] of Object.entries(d.logs||{}))logs.forEach((l,i)=>rows.push([date,id,catalog[id]?.name||id,i+1,l.reps??'',modeOf(id)!=='weighted'&&!l.weight?'':l.weight??'',modeOf(id)!=='weighted'&&!l.weight?'':'kg',modeOf(id)!=='weighted'&&!l.weight?'非负重记录':l.weightUnit==='per-dumbbell'?'单只哑铃':l.weightUnit==='total'?'总负重':l.weightUnit||'旧记录口径未确认',l.minutes??'',l.effort||(l.easy===undefined?'':l.easy?'轻松':'适中/较难'),l.setup||'']));return '\ufeff'+rows.map(row=>row.map((cell,i)=>csvCell(i===10?cell:translate(cell))).join(',')).join('\r\n');}
export function bestPerformance(history,catalog,dateToday){const grouped=new Map();for(const [date,d] of Object.entries(history))if(date<=dateToday)for(const [id,logs] of Object.entries(d.logs||{}))for(const l of logs){if(!Number.isFinite(l.weight)||l.weight<=0||!Number.isFinite(l.reps)||l.reps<1||l.minutes||l.mobilitySets)continue;const basis=l.weightUnit||'legacy',key=id+'|'+basis;const prior=grouped.get(key);if(!prior||l.weight>prior.weight||l.weight===prior.weight&&l.reps>prior.reps)grouped.set(key,{id,name:catalog[id]?.name||id,date,weight:l.weight,reps:l.reps,basis});}return [...grouped.values()];}
