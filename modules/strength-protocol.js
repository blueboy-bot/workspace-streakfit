// Product rule selected by the user, not a universal exercise prescription.
// Targets have a floor; submitted logs always retain the actual work performed.
export const MIN_STRENGTH_SETS=4;
export const isStrengthMovement=move=>!!move&&!move.mobility&&move.kind!=='cardio';
export function strengthTarget(target={}){return {...target,sets:Math.max(MIN_STRENGTH_SETS,Number.isInteger(target.sets)?target.sets:MIN_STRENGTH_SETS)};}
export function enforcePlanStrengthMinimum(plan,catalog,defaultTarget=()=>({sets:MIN_STRENGTH_SETS,min:8,max:12})){
 const next={...plan,targets:{...plan.targets}};
 for(const id of plan.ids||[])if(isStrengthMovement(catalog[id]))next.targets[id]=strengthTarget(next.targets[id]||{...defaultTarget(id),sets:plan.sets||MIN_STRENGTH_SETS});
 if((plan.ids||[]).some(id=>isStrengthMovement(catalog[id])))next.sets=Math.max(MIN_STRENGTH_SETS,plan.sets||MIN_STRENGTH_SETS);
 if(plan.entries)next.entries=plan.entries.map(e=>isStrengthMovement(catalog[e.id])?{...e,sets:next.targets[e.id]?.sets||strengthTarget(e).sets}:{...e});
 return next;
}
export function enforceDayStrengthMinimum(day,catalog){
 let changed=false;
 const ids=[...new Set([...(day.exerciseIds||[]),...Object.keys(day.targets||{}),...Object.keys(day.logs||{})])].filter(id=>isStrengthMovement(catalog[id]));
 for(const id of ids){
  const old=day.targets?.[id];
  if(old&&old.sets<MIN_STRENGTH_SETS){day.targets[id]=strengthTarget(old);changed=true;}
  else if(!old&&day.targetSets&&day.targetSets<MIN_STRENGTH_SETS){day.targets ||= {};day.targets[id]=strengthTarget({sets:day.targetSets,min:8,max:12});changed=true;}
 }
 if(ids.length&&day.targetSets&&day.targetSets<MIN_STRENGTH_SETS){day.targetSets=MIN_STRENGTH_SETS;changed=true;}
 if(day.sessionEntries)day.sessionEntries=day.sessionEntries.map(e=>{
  if(!isStrengthMovement(catalog[e.id]))return e;
  const sets=day.targets?.[e.id]?.sets||strengthTarget(e).sets;
  if(e.sets===sets)return e;changed=true;return {...e,sets};
 });
 return changed;
}
