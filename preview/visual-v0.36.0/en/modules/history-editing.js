import {toKilograms,fromKilograms} from './units.js';
export function historicalLogKind(id,log,catalog,recordingMode){
 if(log?.mobilitySets||catalog[id]?.mobility)return 'mobility';
 if(log?.minutes!==undefined||catalog[id]?.kind==='cardio')return 'cardio';
 return recordingMode(id)==='weighted'||Number(log?.weight)>0?'weighted':'bodyweight';
}
export function historicalWeightInput(weight,unit){return Number(fromKilograms(Number(weight)||0,unit).toFixed(6)).toString();}
export function updateHistoricalLogs(record,id,rows,{date,today,catalog,recordingMode,unit='kg',newWeightUnit='total',xp,now=new Date().toISOString()}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=today||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('只能修改已存在的历史日期。');
 if(!Object.hasOwn(catalog,id)||(!record.exerciseIds?.includes(id)&&!Object.hasOwn(record.logs||{},id)))throw Error('此日期没有这个动作。');
 if(!Array.isArray(rows)||rows.length>1000||!['kg','lb'].includes(unit)||!Number.isFinite(xp)||xp<0||xp>100)throw Error('历史记录格式无效。');
 const source=record.logs?.[id]||[],seen=new Set();let changed=rows.length!==source.length;
 const integer=(value,min,max,message)=>{if(String(value??'').trim()===''||!Number.isInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(message);return Number(value);};
 const logs=rows.map((row,index)=>{
  const originalIndex=Number(row.index);if(!Number.isInteger(originalIndex)||originalIndex< -1||originalIndex>=source.length||originalIndex>=0&&seen.has(originalIndex))throw Error('训练组引用无效。');if(originalIndex>=0)seen.add(originalIndex);
  const original=originalIndex<0?null:source[originalIndex],kind=historicalLogKind(id,original||source.at(-1),catalog,recordingMode);
  const next=original?{...original}:{weight:0,reps:0,effort:'unreported',easy:false};
  if(!original&&['weighted','bodyweight'].includes(kind)){next.recordedSides=catalog[id].perSide?2:1;next.enteredUnit=unit;next.enteredWeight=0;next.weightUnit=newWeightUnit;}
  if(kind==='mobility')next.mobilitySets=1;
  else if(kind==='cardio')next.minutes=integer(row.minutes,1,180,'时长请填写 1–180 的整数分钟。');
  else{
   next.reps=integer(row.reps,1,100,'次数请填写 1–100 的整数。');
   if(kind==='weighted'){
    const raw=String(row.weight??'').trim(),value=Number(raw);if(!raw||!Number.isFinite(value)||value<0||toKilograms(value,unit)>500)throw Error('请填写有效重量。');
    if(!original||raw!==historicalWeightInput(original.weight,unit)){next.weight=toKilograms(value,unit);next.enteredUnit=unit;next.enteredWeight=value;}
    if(!original)next.weightUnit=newWeightUnit;
   }else{
    const setup=String(row.setup??'').trim();if(setup.length>80)throw Error('动作设置最多 80 个字符。');
    if(['push','closepush'].includes(id)&&setup&&(!Number.isFinite(Number(setup))||Number(setup)<0||Number(setup)>300))throw Error('离墙距离请填写 0–300 cm，或留空。');
    next.setup=setup;
   }
  }
  if(!original||JSON.stringify(next)!==JSON.stringify(original)){next.editedAt=now;changed=true;}
  if(originalIndex!==index)changed=true;
  return next;
 });
 if(!changed)return {changed:false,record};
 const result=JSON.parse(JSON.stringify(record));result.logs ||= {};result.logs[id]=logs;result.legacyXP=xp;result.rewardPolicy=1;result.historyEditedAt=now;
 return {changed:true,record:result};
}
