export function learningCourses(){return [
{id:'control',stage:'foundation',title:'先练稳，再加重',text:'先用容易控制的难度练习，保持呼吸；出现疼痛时停止。',question:'初次练习应该优先什么？',answers:['动作稳定与呼吸','尽快增加重量'],correct:0},
{id:'patterns',stage:'foundation',title:'认识基础动作',text:'坐蹲是下蹲模式，髋铰链是髋部向后移动；动作要点不等于已经掌握技能。',question:'髋铰链主要从哪里发起？',answers:['髋部向后移动','用腰弯曲触地'],correct:0,requires:['control']},
{id:'logging',stage:'habit',title:'学会记录一组',text:'记录实际完成的次数和负重。哑铃按界面要求填写单只重量；热身不计工作组。',question:'应该记录哪一个？',answers:['实际完成的次数','计划次数，即使没完成'],correct:0,requires:['patterns']},
{id:'recovery',stage:'habit',title:'恢复也是计划',text:'漏练不需要第二天加倍补练。疼痛时暂停，更新身体反馈；异常严重症状需要及时评估。',question:'漏练之后怎么办？',answers:['从合适的下一步继续','加倍补练'],correct:0,requires:['logging']},
{id:'progression',stage:'independent',title:'理解循序渐进',text:'先稳定完成目标次数，再评估小幅加量。睡眠不足、明显疲劳时降低负担；不以XP决定加重。',question:'什么时候考虑增加负重？',answers:['动作稳定且目标完成后评估','获得更多XP时'],correct:0,requires:['recovery']},
{id:'adaptation',stage:'independent',title:'根据生活调整',text:'可用时间变少时缩短计划，保留已经完成的记录；不强行把完整训练塞进更短时间。',question:'今天只有15分钟怎么办？',answers:['调整为可完成的小计划','赶时间完成全部组数'],correct:0,requires:['progression']}
];}

export function chooseMovementLesson(ids,history,catalog){
const familiar=new Set(Object.values(history).flatMap(d=>d.learnedMoves||[]));
const eligible=ids.filter(id=>catalog[id]?.cues?.length);
return eligible.find(id=>!familiar.has(id))||eligible[0]||null;
}

// Self-reported movement context, never a technical certification or XP source.
export function validCoachingData(data,catalog){
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x),date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00')),stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 if(data===undefined)return true;if(!plain(data)||!plain(data.movements||{})||Object.keys(data.movements||{}).length>200)return false;
 for(const [id,m]of Object.entries(data.movements||{})){if(!catalog[id]||!plain(m)||m.familiarity!==undefined&&!['frequent','learning','new','unknown'].includes(m.familiarity)||m.updatedAt!==undefined&&!stamp(m.updatedAt)||m.source!==undefined&&m.source!=='self'||m.feedback!==undefined&&(!plain(m.feedback)||!['easy','okay','control','unknown'].includes(m.feedback.value)||!stamp(m.feedback.at)||m.feedback.source!=='self'))return false;}
 const q=data.question;if(q!==undefined&&(!plain(q)||!date(q.day)||!catalog[q.id]||!['familiarity','feedback'].includes(q.kind)||!['open','answered','skipped'].includes(q.status)))return false;return true;
}
export function createProgressiveCoach({getState,dateKey,catalog,esc,save,canTrain,enabled=true}){
 let manual=null;
 const valid=()=>validCoachingData(getState().coaching,catalog),knowledge=id=>valid()?getState().coaching?.movements?.[id]:undefined;
 function ensure(){const s=getState();if(!valid())return null;s.coaching ||= {movements:{}};s.coaching.movements ||= {};return s.coaching;}
 function loadReview(id,last){const m=knowledge(id);const at=m?.feedback?.value==='control'?m.feedback.at:['new','learning'].includes(m?.familiarity)?m.updatedAt:null;return !!at&&(!last?.recordedAt||!Number.isFinite(Date.parse(last.recordedAt))||Date.parse(last.recordedAt)<=Date.parse(at));}
 function choose(id,hasLogs){const c=ensure();if(!c)return null;const q=c.question;if(q?.day===dateKey())return q.id===id&&q.status==='open'?q:null;if(!knowledge(id)?.familiarity||hasLogs&&!knowledge(id)?.feedback){c.question={day:dateKey(),id,kind:hasLogs?'feedback':'familiarity',status:'open'};save();return c.question;}return null;}
 function panel(id,hasLogs){if(!enabled||!canTrain()||!catalog[id]||catalog[id].kind==='cardio'||catalog[id].mobility)return '';const q=choose(id,hasLogs),m=knowledge(id),kind=manual?.id===id?manual.kind:q?.kind;
 const names={frequent:'经常练',learning:'做过但不熟',new:'没做过',unknown:'尚未确认'};
 const prompt=kind==='familiarity'?`<p>这个动作你熟悉吗？</p><div class="coach-options">${[['frequent','经常练'],['learning','做过但不熟'],['new','没做过']].map(([value,label])=>`<button data-coach-familiarity="${value}" data-movement="${id}">${label}</button>`).join('')}<button data-coach-skip="${id}">暂不回答</button></div>`:kind==='feedback'?`<p>这次动作感觉怎样？</p><div class="coach-options">${[['easy','轻松'],['okay','合适'],['control','难控制'],['unknown','说不准']].map(([value,label])=>`<button data-coach-feedback="${value}" data-movement="${id}">${label}</button>`).join('')}<button data-coach-skip="${id}">暂不回答</button></div><small>热身不计工作组；疼痛或明显不适时停止，并记录身体反馈。</small>`:'';
 const review=['new','learning'].includes(m?.familiarity)||m?.feedback?.value==='control';return `<div class="progressive-coach" data-coach-movement="${id}">${prompt?`<div class="coach-question" role="group" aria-label="动作了解">${prompt}</div>`:''}${review?`<p class="coach-hint">先看教学、轻负荷试做；难控制时先减轻负荷。<button data-lesson="${id}">查看动作教学</button></p>`:''}<details class="coach-preferences"><summary>动作提示与试做（可选）</summary><p>本人熟悉度：${names[m?.familiarity]||'尚未确认'}</p><button data-coach-open="familiarity" data-movement="${id}">修改熟悉度</button><button data-coach-open="feedback" data-movement="${id}">记录试做感受</button><p class="muted">仅用于这个动作的提示和负重重新确认，不代表技术认证，不增加 XP。</p></details></div>`;
 }
 function handle(button){const id=button.dataset.movement||button.dataset.coachSkip;if(!id||!catalog[id]||!canTrain())return false;const c=ensure();if(!c)return false;
 if(button.dataset.coachOpen){manual={id,kind:button.dataset.coachOpen};return true;}
 if(button.dataset.coachSkip){if(c.question?.id===id&&c.question.day===dateKey())c.question.status='skipped';manual=null;save();return true;}
 const familiar=button.dataset.coachFamiliarity,feedback=button.dataset.coachFeedback;
 if(!['frequent','learning','new','unknown'].includes(familiar)&&!['easy','okay','control','unknown'].includes(feedback))return false;
 const m=c.movements[id] ||= {};if(familiar){m.familiarity=familiar;m.source='self';m.updatedAt=new Date().toISOString();}if(feedback)m.feedback={value:feedback,at:new Date().toISOString(),source:'self'};
 if(c.question?.id===id&&c.question.day===dateKey())c.question.status='answered';manual=null;save();return true;
 }
 return {panel,handle,knowledge,loadReview};
}
