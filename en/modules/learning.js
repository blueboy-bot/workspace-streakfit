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
