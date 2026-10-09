import {initializeLanguage,localizeDocument} from './modules/localization.js';
initializeLanguage();
import {initialWorkspaceKey,startAccounts} from './modules/accounts-ui.js';
import {isolateLocalRecords} from './modules/local-integrity.js';
import {createExperienceToolkit} from './modules/experience-toolkit.js';
import {behaviourAchievements,monthCells,trainingCSV,bestPerformance} from './modules/insights.js';
import {parseBackupData} from './modules/backup.js';
import {generatePrescription} from './modules/planning.js';
import {toKilograms,fromKilograms} from './modules/units.js';
import {participationPoints} from './modules/rewards.js';
import {learningCourses,chooseMovementLesson} from './modules/learning.js';
let key=typeof initialWorkspaceKey==='function'?initialWorkspaceKey(localStorage):'streakfit-v1';
let accounts=null;
const dateKey=()=>new Date().toLocaleDateString('en-CA');
let state,storageError='',loadError=false,rawStoredData='',storageDirty=false,pendingMealRecord=null,dataRecoveryIssues=[];
try{rawStoredData=localStorage.getItem(key)||'';state=rawStoredData?JSON.parse(rawStoredData):{};if(!state||typeof state!=='object'||Array.isArray(state)||state.profile&&(typeof state.profile!=='object'||Array.isArray(state.profile))||state.history&&(typeof state.history!=='object'||Array.isArray(state.history)))throw Error('Invalid data');}catch{state={};loadError=true;storageError='原有数据无法读取，尚未覆盖。请先导出原始备份，再导入有效备份恢复。';}
state.profile ||= {name:'新朋友',goal:'建立运动习惯',days:'2',place:'家中 · 无器械',minutes:'15',scheduleMode:'cycle',trainDays:'1',restDays:'2',cyclePreset:'1/2',scheduleStart:dateKey()};
state.history ||= {};state.history[dateKey()] ||= {water:0,protein:false,vegetables:false,sleep:0,sets:{},rest:false};
const today=()=>{const d=state.history[dateKey()] ||= {water:0,protein:false,vegetables:false,sleep:0,sets:{},rest:false};if(state.rewardPolicyStart&&dateKey()>=state.rewardPolicyStart)d.rewardPolicy=2;return d;};
let workoutToolsOpen=false,workoutAddOpen=false,nutritionPanelOpen=false,videoPanelOpen=false,videoSettingsOpen=false,mealStatus='';
let selectedWorkoutDate=null,trainingMode='edit',sessionIndex=0,restUntil=0,restPausedMs=0,restHeldByWorkout=false,restAlertSent=false,restAudio=null,calendarOffset=0;
function workoutDateKey(){return selectedWorkoutDate||dateKey();}
function workoutDate(){return new Date(workoutDateKey()+'T12:00:00');}
function isPreview(){return workoutDateKey()!==dateKey();}
function isPast(){return workoutDateKey()<dateKey();}
function isFuture(){return workoutDateKey()>dateKey();}
function workoutDay(){const date=workoutDateKey();if(date>dateKey())state.plannedWorkouts ||= {};if(date<dateKey())return state.history[date]||{sets:{},logs:{},exerciseIds:[],historyMissing:true};if(date>dateKey())return state.plannedWorkouts[date] ||= {water:0,protein:false,vegetables:false,sleep:0,sets:{},rest:false,planGoal:state.profile.goal};const d=today(),draft=state.plannedWorkouts?.[date];if(draft&&!Object.values(d.logs||{}).some(sets=>sets.length)){for(const key of ['exerciseIds','workoutTitle','targets','cardioTargets','sessionEntries','cycle','mobilityTargets','trainingPreferences','manualOrder','specialtyMain'])if(draft[key]!==undefined)d[key]=draft[key];delete state.plannedWorkouts[date];}return d;}
function openWorkoutDay(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00')))return false;selectedWorkoutDate=date;trainingMode=beginnerExperience()&&date===dateKey()?'train':'edit';sessionIndex=0;page='workout';globalThis.scrollTo?.(0,0);render();return true;}
function selectedPrescription(){if(isPast()){const d=workoutDay();return {ids:d.exerciseIds||Object.keys(d.logs||{}),entries:d.sessionEntries||[],targets:d.targets||{},title:d.workoutTitle||'历史训练记录',note:'历史记录只读，不重新生成或改动完成状态。'};}const plan=prescription(workoutDate());if(isPreview()&&schedule(workoutDate())!=='training')return {...plan,ids:[],entries:[],targets:{},durations:undefined,sets:0,estimated:0,title:'恢复日 · 轻松活动',note:'这一天原计划为恢复日，可以提前添加轻松活动，不要求完成力量训练。'};return plan;}
function updateStorageStatus(){const banner=document.querySelector('#storage-status');if(!banner)return;banner.hidden=!storageError;banner.textContent=storageError;banner.innerHTML=esc(storageError)+(storageError?`<div><button data-storage-retry>重试保存</button><button data-storage-export>导出当前页面备份</button>${loadError?'<button data-export-raw>导出原始数据</button><button data-repair-storage>保存可用数据并保留原始副本</button>':''}</div>`:'');}
function save(){if(loadError){storageDirty=true;updateStorageStatus();return false;}try{localStorage.setItem(key,JSON.stringify(state));storageError='';storageDirty=false;if(pendingMealRecord)mealStatus='已保存这餐；可继续添加下一餐。';pendingMealRecord=null;updateStorageStatus();accounts?.localSaved(state);return true;}catch{storageDirty=true;storageError='保存失败：当前修改仅在页面内，刷新可能丢失。请导出训练数据备份，并检查浏览器存储权限。';updateStorageStatus();return false;}}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moves=[['椅子深蹲','🪑','双脚与肩同宽；髋部向后坐；膝盖朝脚尖方向。'],['墙壁俯卧撑','🙌','双手撑墙；身体保持直线；缓慢屈肘再推回。'],['臀桥','〰','仰卧屈膝；脚掌贴地；抬髋时避免腰部过度后仰。']];
const trained=d=>d.exerciseIds ? d.exerciseIds.length>0&&d.exerciseIds.every(id=>catalog[id]?.mobility?(d.logs?.[id]||[]).filter(l=>l.mobilitySets).length>=(d.mobilityTargets?.[id]||2):catalog[id]?.kind==='cardio'?(d.logs?.[id]||[]).reduce((sum,l)=>sum+(l.minutes||0),0)>=cardioTarget(id,d):(d.logs?.[id]?.length||0)>=(exerciseTarget(id,d).sets)) : moves.every((_,i)=>(d.sets?.[i]||0)>=2);
function waterGoal(d){return Math.ceil((d.waterTarget||2)*4);}
const legacyPoints=d=>(trained(d)||d.rest?30:0)+(d.protein&&d.vegetables?20:0)+(d.water>=waterGoal(d)?15:0)+(d.sleep>=(d.sleepTarget||7)?15:0)+((trained(d)||d.rest)&&d.protein&&d.vegetables&&d.water>=waterGoal(d)&&d.sleep>=(d.sleepTarget||7)?20:0);
function points(d){return participationPoints(d,trained(d),legacyPoints(d));}
const total=()=>Object.values(state.history).reduce((a,d)=>a+points(d),0);
function streak(){let n=0,d=new Date();if(points(today())===0)d.setDate(d.getDate()-1);for(;n<10000;n++){if(!points(state.history[d.toLocaleDateString('en-CA')]||{sets:{}}))break;d.setDate(d.getDate()-1);}return n;}
let page='today';const content=document.querySelector('#content');
let lastRenderedPage=null;
const contentClickHandlers=[],contentClickCaptureHandlers=[],contentChangeHandlers=[];
function onContentClick(handler,capture=false){(capture?contentClickCaptureHandlers:contentClickHandlers).push(handler);}
function onContentChange(handler){contentChangeHandlers.push(handler);}
function render(){syncExperienceTheme();if(lastRenderedPage===page){nutritionPanelOpen=!!document.querySelector('#nutrition-panel')?.open;videoPanelOpen=!!document.querySelector('#video-management')?.open;videoSettingsOpen=!!document.querySelector('#video-settings')?.open;}else{nutritionPanelOpen=false;videoPanelOpen=false;videoSettingsOpen=false;mealStatus='';}if(lastRenderedPage===page&&page==='workout'){const tools=document.querySelector('#workout-tools'),add=document.querySelector('.add-tools');workoutToolsOpen=!!tools?.open;workoutAddOpen=!!add?.open;}else{workoutToolsOpen=false;workoutAddOpen=false;}if(lastRenderedPage!==page){globalThis.scrollTo?.(0,0);lastRenderedPage=page;}document.body?.classList?.toggle('focus-training',page==='workout'&&trainingMode==='train');document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const d=page==='workout'||page==='lesson'?workoutDay():today();d.sets ||= {};const xp=points(d);let body='';
if(page==='today')body=`<div class="greeting"><div><p class="eyebrow">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</p><h1>你好，${state.profile.name==='新朋友'?'新朋友':`<span data-user-content>${esc(state.profile.name)}</span>`} 🌤</h1><p>不用一次变得很强。今天，前进一点就好。</p></div><div class="badges"><div class="badge">✦ ${weeklyGrowth().completed}<small>WEEKLY GROWTH</small></div><div class="badge">✦ LV. ${Math.floor(total()/100)+1}<small>${total()} TOTAL XP</small></div></div></div><div class="grid"><div><div class="hero"><span class="pill">FOUNDATION / WEEK 01</span><h2>今天，让习惯开始。</h2><p>${esc(state.profile.goal)} · 全身基础训练<br>3 个动作 · 2 组 / 动作 · 约 15 分钟</p><button class="primary" data-action="workout">${trained(d)?'查看已完成训练':'开始今日训练'} →</button></div><div class="section-head"><h3>你的每日任务</h3><span class="muted">小习惯，大改变</span></div><div class="tasks"><div class="card task"><span class="icon">🥗</span><p class="eyebrow">NUTRITION · +20 XP</p><h3>吃得好，练得好</h3><button data-action="protein">${d.protein?'✓':'○'} 蛋白质食物</button> <button data-action="vegetables">${d.vegetables?'✓':'○'} 蔬菜</button></div><div class="card task"><span class="icon">💧</span><p class="eyebrow">HYDRATION · +15 XP</p><h3>${(d.water*.25).toFixed(2)} / 2.0 L</h3><button data-action="water">+ 一杯水 · 250 ml</button> <button data-action="undo-water">撤回</button></div><div class="card task"><span class="icon">🌙</span><p class="eyebrow">SLEEP · +15 XP</p><h3>昨晚睡得怎么样？</h3><label>睡眠小时<input id="sleep" type="number" min="0" max="24" step="0.5" value="${d.sleep}" aria-describedby="sleep-feedback"></label><p id="sleep-feedback" role="alert" class="field-feedback"></p></div><div class="card task"><span class="icon">🌿</span><p class="eyebrow">RECOVERY · +30 XP</p><h3>休息也是计划的一部分</h3><label>实际完成的恢复安排<select id="recovery-kind"><option value="">请选择</option>${[['rest','按计划休息'],['walk','轻松散步'],['mobility','轻柔活动']].map(([v,label])=>`<option value="${v}" ${d.restActivity===v?'selected':''}>${label}</option>`).join('')}</select></label><p id="recovery-feedback" class="muted"></p><button data-action="rest">${d.rest?'✓ 已记录恢复日':'今天作为恢复日'}</button></div></div></div><div><div class="card"><p class="eyebrow">DAILY QUEST</p><h2>把今天的小事做好</h2><div class="xp">${xp} <span>/ 100 XP</span></div><progress max="100" value="${xp}"></progress><p>全部完成额外 +20 XP。训练和恢复任选其一，不重复计分。</p><div class="week">${Array.from({length:7},(_,i)=>{let dt=new Date();dt.setDate(dt.getDate()-6+i);let complete=points(state.history[dt.toLocaleDateString('en-CA')]||{sets:{}})>0;return `<div class="day">${dt.toLocaleDateString('zh-CN',{weekday:'short'})}<div class="dot ${complete?'done':''}">${complete?'✓':'·'}</div></div>`;}).join('')}</div></div><div class="coach"><p class="eyebrow">A LITTLE REMINDER</p><h3>${d.sleep>0&&d.sleep<7?'今天可以放慢一点。':'稳定比完美更重要。'}</h3><p>${d.sleep>0&&d.sleep<7?'昨晚休息较少，今天可选择恢复日或降低训练强度。':'任务只是提醒，不是必须达到的身体指标。饮水和睡眠需求因人而异，可按自身情况调整。'}</p><span class="muted">规则提示 · 尚未接入 AI 教练</span></div></div></div>`;
if(page==='workout')body=`<p class="eyebrow">TODAY’S SESSION</p><h1>全身基础 · 每个动作 2 组</h1><p>每组建议 8–10 次，组间休息 60–90 秒。按自身能力完成；出现疼痛时停止。</p><div class="card">${moves.map((m,i)=>`<div class="exercise"><div><h3>${m[1]} ${m[0]}</h3><p>${m[2]}</p><span class="muted">已记录 ${d.sets[i]||0} / 2 组</span></div><div><button data-set="${i}" ${d.sets[i]>=2?'disabled':''}>${d.sets[i]>=2?'✓ 完成':'+ 完成一组'}</button> <button data-unset="${i}">撤回</button></div></div>`).join('')}<p>${trained(d)?'🎉 今日训练已完成！+30 XP 已计入今日任务。':'按实际完成情况记录，进度会自动保存。'}</p><button class="primary" data-action="home">返回今日任务 →</button></div>`;
if(page==='path')body=`<p class="eyebrow">YOUR FITNESS JOURNEY</p><h1>先打基础，再慢慢变强。</h1><p>${esc(state.profile.goal)} · 每周 ${esc(state.profile.days)} 天 · ${esc(state.profile.place)} · 每次 ${esc(state.profile.minutes)} 分钟</p><p class="notice">目前仅开放 15 分钟无器械入门课。上述偏好已保存；完整个性化排课将在正式版本接入。</p>${['01 · 建立习惯 / 当前可体验','02 · 基础力量 / 规划中','03 · 稳定进阶 / 规划中','04 · 专属目标 / 规划中'].map((s,i)=>`<div class="path-node"><h3>${s}</h3><p>${i?'完成前一阶段后逐步增加难度，后续版本开放。':'从椅子深蹲、墙壁俯卧撑和臀桥开始。'}</p>${i?'':'<button class="primary" data-action="workout">进入今日训练 →</button>'}</div>`).join('')}`;
if(page==='learn')body=`<p class="eyebrow">MOVE WITH CONFIDENCE</p><h1>动作课堂</h1><p>先学会怎么做，再追求做多少。</p><p class="notice">当前为文字教学；真实的 10–30 秒动作视频待拍摄或获得授权后接入。</p><div class="learn-grid">${moves.map(m=>`<div class="card"><div class="illustration">${m[1]}</div><h3>${m[0]}</h3><p>${m[2]}</p><span class="muted">入门 · 无器械</span></div>`).join('')}</div>`;
if(page==='progress')body=`<p class="eyebrow">CONSISTENCY ADDS UP</p><h1>每一点努力，都算数。</h1><div class="tasks"><div class="card"><p>累计经验</p><div class="stat">${total()} XP</div></div><div class="card"><p>本周已完成训练</p><div class="stat">${weeklyGrowth().completed} 次</div></div></div><div class="section-head"><h3>真实的每一天</h3></div><div class="card">${Object.entries(state.history).sort(([a],[b])=>b.localeCompare(a)).map(([day,v])=>`<div class="exercise"><span>${esc(day)}</span><b>${points(v)} XP</b></div>`).join('')}</div><p>排行榜、好友和联赛将在后续版本开放，只比较习惯行为。</p>`;
content.innerHTML=enhance(body,d);if(storageDirty)content.innerHTML=content.innerHTML.replaceAll('进度已保存','进度仅暂存在页面').replaceAll('已保存的训练安排','暂存在页面的训练安排');if(page==='learn')content.innerHTML=learningPathPanel()+content.innerHTML;if(page==='today'){if(!beginnerExperience())content.innerHTML=safetyStatusPanel()+content.innerHTML;const badges=content.querySelector?.('.badges');if(badges){const w=weeklyGrowth();badges.innerHTML=`<div class="badge">${w.completed} / ${w.target}<small>本周训练</small></div><div class="badge">LV. ${Math.floor(total()/100)+1}<small>${total()} XP</small></div>`;}}if(page==='workout'){content.innerHTML=safetyStatusPanel()+comfortPanel()+content.innerHTML;syncWorkoutPauseUI();}if(page==='today'){decorateDailyTasks(d);content.innerHTML=backupReminderPanel()+content.innerHTML;}localizeDocument();}
const catalog={
 squat:{name:'椅子深蹲',cues:['髋部向后坐','膝盖朝脚尖','缓慢站起'],gear:'无器械'},
 push:{name:'墙壁俯卧撑',cues:['双手撑墙','身体保持直线','缓慢屈肘再推回'],gear:'无器械'},
 bridge:{name:'臀桥',cues:['脚掌贴地','收紧臀部抬髋','避免腰部过度后仰'],gear:'无器械'},
 dbpress:{name:'哑铃地板卧推',cues:['上臂轻触地面','手腕保持中立','控制下降速度'],gear:'哑铃'},
 row:{name:'哑铃划船',cues:['保持背部中立','肘部向髋部移动','避免甩动身体'],gear:'哑铃'},
 bench:{name:'Bench Press · 卧推',cues:['肩胛稳定贴凳','双脚稳固支撑','使用保护架或保护者'],gear:'杠铃及拉力器'},
 incline:{name:'Incline DB Press · 上斜哑铃卧推',cues:['凳面适度倾斜','手腕保持稳定','控制下降幅度'],gear:'杠铃及拉力器'},
 fly:{name:'绳索夹胸（Cable Fly）',cues:['肘部轻微弯曲','缓慢合拢双臂','避免过度拉伸'],gear:'杠铃及拉力器'},
 triceps:{name:'Triceps Pushdown · 三头下压',cues:['上臂靠近身体','肘部保持稳定','缓慢回到起点'],gear:'杠铃及拉力器'}
};
Object.assign(catalog,{
 reversefly:{name:'哑铃反向飞鸟',gear:'哑铃',cues:['髋部后移保持背部中立','肘部微屈向两侧打开','轻重量避免甩动']},
 pulldown:{name:'高位下拉',gear:'高位下拉机',cues:['大腿固定在垫下','拉向上胸而非颈后','缓慢回放']},
 bandrow:{name:'弹力带坐姿划船',gear:'弹力带',cues:['确认弹力带牢固且无破损','肘部向后拉','避免耸肩']},
 proneW:{name:'俯卧 W 提拉',gear:'无器械',cues:['俯卧双臂呈 W 形','轻抬手臂收拢肩胛','不抬头挤压颈部']},
 shoulderpress:{name:'哑铃肩推',gear:'哑铃',cues:['收紧腹部','手腕位于肘部上方','避免腰部过度后仰']},
 lateral:{name:'哑铃侧平举',gear:'哑铃',cues:['轻重量开始','肘部微屈','抬至舒适高度不耸肩']},
 wallslide:{name:'靠墙滑臂',gear:'无器械',cues:['背部轻靠墙','缓慢向上滑臂','保持无痛范围']},
 curl:{name:'哑铃弯举',gear:'哑铃',cues:['上臂靠近身体','不借力摆动','缓慢伸展肘部']},
 bandcurl:{name:'弹力带弯举',gear:'弹力带',cues:['确认踩住弹力带','保持肘部稳定','缓慢下放']},
 selfcurl:{name:'自阻力弯举',gear:'无器械',cues:['另一只手提供轻阻力','缓慢屈肘','两侧分别完成']},
 closepush:{name:'窄距墙壁俯卧撑',gear:'无器械',cues:['手距略窄于肩','肘部靠近身体','保持身体直线']},
 dbtriceps:{name:'哑铃三头后伸',gear:'哑铃',cues:['轻重量俯身','上臂保持稳定','缓慢伸肘不甩动']},
 goblet:{name:'哑铃杯式深蹲',gear:'哑铃',cues:['哑铃靠近胸前','膝盖跟随脚尖','下蹲至舒适深度']},
 legpress:{name:'腿举',gear:'腿举机',cues:['腰背贴住靠垫','膝盖朝脚尖方向','不锁死膝盖']},
 lunge:{name:'后撤箭步蹲',gear:'无器械',cues:['可扶墙保持平衡','向后小步落脚','前脚稳定支撑']},
 rdl:{name:'哑铃罗马尼亚硬拉',gear:'哑铃',cues:['膝盖微屈','髋部向后推','背部中立、哑铃靠近腿']},
 hinge:{name:'徒手髋铰链',gear:'无器械',cues:['膝盖微屈','臀部向后移','保持背部中立']},
 deadlift:{name:'杠铃硬拉',gear:'杠铃',cues:['杠铃贴近身体','躯干保持稳定','不熟悉动作时寻求现场指导']},
 hipthrust:{name:'哑铃臀桥',gear:'哑铃',cues:['哑铃稳定垫在髋部','脚掌贴地','收紧臀部而非过伸腰部']},
 calf:{name:'站姿提踵',gear:'无器械',cues:['扶墙保持平衡','缓慢抬起脚跟','控制下落']},
 dbcalf:{name:'哑铃提踵',gear:'哑铃',cues:['轻负重扶稳','脚跟缓慢上抬','避免弹跳']},
 deadbug:{name:'死虫式',gear:'无器械',cues:['仰卧保持躯干稳定','交替伸展对侧手脚','腰部不明显离地']},
 bird:{name:'鸟狗式',gear:'无器械',cues:['四点支撑','缓慢伸展对侧手脚','骨盆保持稳定']}
});
const muscleGroups=['胸部','背部','肩部','肱二头肌','肱三头肌','股四头肌','腘绳肌','臀部','小腿','核心'];
const groupChoices={胸部:['bench','dbpress','push'],背部:['pulldown','row','bandrow','proneW'],肩部:['shoulderpress','lateral','wallslide'],肱二头肌:['curl','bandcurl','selfcurl'],肱三头肌:['triceps','dbtriceps','closepush'],股四头肌:['legpress','goblet','squat','lunge'],腘绳肌:['deadlift','rdl','hinge'],臀部:['hipthrust','bridge'],小腿:['dbcalf','calf'],核心:['deadbug','bird']};
for(const [group,ids] of Object.entries(groupChoices))for(const id of ids)catalog[id].muscle=group;
catalog.dbbench={name:'哑铃卧推',gear:'哑铃',muscle:'胸部',cues:['肩胛稳定贴凳','手腕保持中立','控制下降速度，避免过度拉伸']};
Object.assign(catalog.incline,{muscle:'胸部',gear:'哑铃'});Object.assign(catalog.fly,{muscle:'胸部',gear:'龙门架 / 绳索器械'});Object.assign(catalog.reversefly,{muscle:'肩部'});
const mainstreamMoves=[["preacher", "牧师凳杠铃弯举", "肱二头肌", ["牧师凳", "杠铃"], ["上臂贴住斜垫", "不锁死肘关节", "缓慢下放"]], ["dbpreacher", "牧师凳哑铃弯举", "肱二头肌", ["牧师凳", "哑铃"], ["上臂贴垫", "不借力摆动", "两侧分别完成"]], ["altcurl", "哑铃交替弯举", "肱二头肌", ["哑铃"], ["上臂靠近身体", "交替屈肘转掌", "不摆动躯干"]], ["cablecurl", "绳索弯举", "肱二头肌", ["龙门架 / 绳索器械"], ["低位滑轮", "固定肘部位置", "控制回程"]], ["inclinecurl", "上斜哑铃弯举", "肱二头肌", ["哑铃", "训练凳"], ["背部贴凳", "肘部不向前甩", "避免过度伸展"]], ["concentration", "哑铃集中弯举", "肱二头肌", ["哑铃"], ["上臂靠大腿内侧", "不借力", "两侧分别练习"]], ["barcurl", "杠铃弯举", "肱二头肌", ["杠铃"], ["肘部稳定", "手腕保持舒适", "避免摆动"]], ["ropehammer", "绳索锤式弯举", "肱二头肌", ["龙门架 / 绳索器械"], ["使用绳索把手", "掌心相对", "上臂稳定"]], ["ropepush", "绳索三头下压", "肱三头肌", ["龙门架 / 绳索器械"], ["上臂靠近身体", "缓慢伸肘", "不耸肩"]], ["cableoverhead", "绳索过顶臂屈伸", "肱三头肌", ["龙门架 / 绳索器械"], ["固定上臂", "收紧躯干", "无痛范围屈伸"]], ["skullcrusher", "仰卧哑铃臂屈伸", "肱三头肌", ["哑铃", "训练凳"], ["上臂稳定", "控制下降", "避免砸向头部"]], ["closebench", "窄握杠铃卧推", "肱三头肌", ["杠铃", "训练凳", "深蹲架 / 保护架"], ["握距与肩接近", "肘部靠近躯干", "使用保护"]], ["dbfly", "哑铃飞鸟", "胸部", ["哑铃", "训练凳"], ["肘部微屈", "轻重量开始", "避免过深拉伸"]], ["chestmachine", "坐姿器械推胸", "胸部", ["推胸机"], ["调整座椅至胸部高度", "肩胛稳定", "控制回程"]], ["pecdeck", "蝴蝶机夹胸", "胸部", ["蝴蝶机"], ["调整把手", "肩部保持舒适", "不借力撞击"]], ["smithbench", "史密斯卧推", "胸部", ["史密斯机", "训练凳"], ["确认安全限位", "肩胛稳定", "选择舒适握距"]], ["inclinebar", "上斜杠铃卧推", "胸部", ["杠铃", "训练凳", "深蹲架 / 保护架"], ["适度倾斜凳面", "肩胛稳定", "使用保护"]], ["pushup", "标准俯卧撑", "胸部", [], ["躯干保持直线", "肘部不完全外张", "控制下降"]], ["barrow", "杠铃俯身划船", "背部", ["杠铃"], ["髋部后移", "背部中立", "不甩动杠铃"]], ["chestsupported", "胸托哑铃划船", "背部", ["哑铃", "训练凳"], ["胸部贴斜凳", "肘部向后拉", "不耸肩"]], ["pullup", "引体向上", "背部", ["单杠"], ["稳定肩胛", "不摆动借力", "控制下降"]], ["assistpull", "辅助引体向上", "背部", ["辅助引体机"], ["调整辅助重量", "保持躯干稳定", "控制下放"]], ["straightpull", "绳索直臂下拉", "背部", ["龙门架 / 绳索器械"], ["肘部微屈固定", "肩部向下拉", "不甩腰"]], ["machinerow", "坐姿器械划船", "背部", ["划船训练机"], ["胸部稳定", "肘部向后拉", "控制回程"]], ["barohp", "站姿杠铃推举", "肩部", ["杠铃", "深蹲架 / 保护架"], ["收紧腹部", "不后仰借力", "无痛范围推起"]], ["cablelateral", "绳索侧平举", "肩部", ["龙门架 / 绳索器械"], ["低位滑轮", "肘部微屈", "抬至舒适高度"]], ["facepull", "绳索面拉", "肩部", ["龙门架 / 绳索器械"], ["拉向面部两侧", "不耸肩", "轻重量控制"]], ["rearpec", "反向蝴蝶机", "肩部", ["蝴蝶机"], ["胸贴靠垫", "轻重量外展", "肩部保持舒适"]], ["shouldermachine", "器械肩推", "肩部", ["肩推机"], ["调整座椅高度", "背部贴垫", "不锁死肘部"]], ["barsquat", "杠铃背蹲", "股四头肌", ["杠铃", "深蹲架 / 保护架"], ["设置安全杆", "膝盖朝脚尖", "保持躯干稳定"]], ["frontsquat", "杠铃前蹲", "股四头肌", ["杠铃", "深蹲架 / 保护架"], ["肘部抬起", "杠铃稳定在肩前", "不熟悉时寻求指导"]], ["bulgarian", "保加利亚分腿蹲", "股四头肌", ["哑铃", "训练凳"], ["后脚轻放凳面", "前脚稳定", "两侧分别完成"]], ["legextension", "坐姿腿屈伸", "股四头肌", ["腿屈伸机"], ["调整关节轴线", "控制伸膝", "不甩动"]], ["hack", "哈克深蹲", "股四头肌", ["哈克深蹲机"], ["肩背贴垫", "设置限位", "膝盖朝脚尖"]], ["smithsquat", "史密斯深蹲", "股四头肌", ["史密斯机"], ["设置安全限位", "保持脚掌稳定", "选择舒适站位"]], ["legcurl", "坐姿腿弯举", "腘绳肌", ["腿弯举机"], ["固定大腿", "缓慢屈膝", "控制回程"]], ["barRdl", "杠铃罗马尼亚硬拉", "腘绳肌", ["杠铃"], ["髋部后移", "背部中立", "杠铃贴近腿"]], ["barhip", "杠铃臀推", "臀部", ["杠铃", "训练凳"], ["杠铃垫稳髋部", "肩背支撑稳定", "避免过伸腰部"]], ["cablekick", "绳索后踢腿", "臀部", ["龙门架 / 绳索器械"], ["使用脚踝绑带", "骨盆稳定", "不甩腰"]], ["abduction", "器械髋外展", "臀部", ["髋外展机"], ["调整靠垫", "控制外展", "不弹震"]], ["seatedcalf", "坐姿提踵", "小腿", ["坐姿提踵机"], ["前脚掌稳定", "缓慢抬跟", "控制下降"]], ["cablecrunch", "绳索卷腹", "核心", ["龙门架 / 绳索器械"], ["缓慢卷曲躯干", "不靠手臂拉绳", "控制回程"]], ["crunch", "徒手卷腹", "核心", [], ["轻抬肩胛", "不拉扯颈部", "缓慢回落"]], ["reversecrunch", "反向卷腹", "核心", [], ["骨盆缓慢卷起", "不甩腿借力", "控制下降"]]];
for(const [id,name,muscle,requirements,cues] of mainstreamMoves)catalog[id]={name,muscle,requirements,gear:requirements[0]||"无器械",cues};
const powerliftingMoves=[
 ['pausebench','暂停卧推','胸部',['杠铃','训练凳','深蹲架 / 保护架'],'technique',true,'底部控制与起推',['轻于常规卧推的重量开始','杠铃轻触胸部后稳定暂停 1–2 秒，不反弹','保持肩胛与脚部支撑，设置保护']],
 ['tempobench','节奏卧推','胸部',['杠铃','训练凳','深蹲架 / 保护架'],'technique',true,'下放控制与杠铃路径',['用轻重量练习','约 3 秒控制下放，不憋气拖延','保持稳定支撑，设置保护']],
 ['pausesquat','暂停深蹲','股四头肌',['杠铃','深蹲架 / 保护架'],'technique',true,'底部稳定与起身',['设置安全杆，使用轻于常规深蹲的重量','在可控制的底部暂停 1–2 秒，不松掉躯干','保持脚掌支撑后稳定起身']],
 ['temposquat','节奏深蹲','股四头肌',['杠铃','深蹲架 / 保护架'],'technique',true,'下蹲控制与姿势稳定',['先使用轻重量和安全杆','约 3 秒控制下降，保持躯干稳定','在可控制的深度起身，不追求额外深度']],
 ['pausedeadlift','离地暂停硬拉','腘绳肌',['杠铃'],'technique',true,'离地位置与躯干稳定',['使用明显轻于常规硬拉的重量','离地数厘米暂停约 1 秒，杠铃贴近腿','背部与髋位稳定后继续拉起，不猛拽']],
 ['pallof','绳索 Pallof 抗旋转推','核心',['龙门架 / 绳索器械'],'control',false,'抵抗躯干旋转',['滑轮约胸高，侧对器械站稳','缓慢推出双手，躯干保持朝前','每侧分别练习，不能稳定就减轻阻力']],
 ['bandpallof','弹力带 Pallof 抗旋转推','核心',['弹力带'],'control',false,'抵抗躯干旋转',['固定在可靠锚点，检查弹力带','侧对锚点，推出双手时保持躯干稳定','每侧分别练习，不把阻力换算成公斤']],
 ['splitSquat','哑铃分腿蹲','股四头肌',['哑铃'],'assistance',false,'单侧腿部力量与稳定',['分腿站稳，后脚留在地面','控制下降，前膝与脚尖方向一致','两侧分别完成，先使用可控制负重']]
];
for(const [id,name,muscle,requirements,powerRole,advanced,purpose,cues] of powerliftingMoves)catalog[id]={name,muscle,requirements,gear:requirements[0],powerRole,advanced,purpose,cues,perSide:['pallof','bandpallof','splitSquat'].includes(id)};
function experienceOptions(options){
 const level=beginnerExperience()&&state.profile.experience==='有规律训练经验'?'初学者':state.profile.experience;
 if(level==='有规律训练经验')return options;
 const novice=level==='初学者';
 const alternatives=novice?{bench:['chestmachine','dbpress'],incline:['chestmachine','dbpress'],dbbench:['chestmachine'],row:['chestsupported','machinerow','cablerow'],shoulderpress:['shouldermachine'],barsquat:['goblet','legpress'],frontsquat:['goblet'],deadlift:['rdl','hinge'],barRdl:['rdl','hinge'],bulgarian:['lunge','legpress'],barhip:['bridge','hipthrust'],cablecrunch:['deadbug','crunch']}:{bench:['dbbench'],row:['chestsupported','cablerow'],barsquat:['goblet','smithsquat'],barRdl:['rdl']};
 return [...new Set(options.flatMap(id=>[...(alternatives[id]||[]),id]))].filter(id=>catalog[id]&&!(alternatives[id]||[]).some(other=>supports(other)));
}
function supports(id,gear=selectedEquipment()){if(beginnerExperience()&&(['bench','deadlift','barsquat','frontsquat','barRdl','barohp'].includes(id)||catalog[id]?.variantOf==='bench'||catalog[id]?.advanced||catalog[id]?.detailed))return false;if(catalog[id]?.detailed&&(state.profile.experience!=='有规律训练经验'||state.profile.trainingRecency==='停练后重新开始'))return false;const requirements={bench:['杠铃','训练凳','深蹲架 / 保护架'],dbbench:['哑铃','训练凳'],incline:['哑铃','训练凳'],fly:['龙门架 / 绳索器械'],triceps:['龙门架 / 绳索器械'],deadlift:['杠铃']};if((id==='deadlift'||catalog[id]?.advanced)&&state.profile.experience!=='有规律训练经验')return false;return (catalog[id].requirements||requirements[catalog[id]?.variantOf||id]|| (catalog[id].gear==='无器械'?[]:[catalog[id].gear])).every(item=>gear.includes(item));}
Object.assign(catalog,{
 overheadtriceps:{name:'哑铃过顶臂屈伸',gear:'哑铃',muscle:'肱三头肌',cues:['轻重量双手握稳','上臂保持稳定','在无痛范围内屈伸肘部']},
 hammer:{name:'哑铃锤式弯举',gear:'哑铃',muscle:'肱二头肌',cues:['掌心相对','上臂保持稳定','不摆动身体借力']},
 cablerow:{name:'绳索坐姿划船',gear:'龙门架 / 绳索器械',muscle:'背部',cues:['双脚稳定支撑','肘部向后拉','避免躯干前后甩动']},
 bandfly:{name:'弹力带夹胸',gear:'弹力带',muscle:'胸部',cues:['确认固定点牢固','肘部微屈','控制回程幅度']},
 bandtriceps:{name:'弹力带三头下压',gear:'弹力带',muscle:'肱三头肌',cues:['确认上方固定点牢固','上臂靠近身体','缓慢伸肘回放']}
});
const exerciseVariants=[
 {
  "id": "pulldownWide",
  "variantOf": "pulldown",
  "name": "高位下拉（宽距正握）",
  "trainingFocus": "背阔肌为主，肩内收侧重",
  "cues": [
   "采用舒适的较宽正握，不追求极宽",
   "肘部向身体两侧下拉至上胸附近",
   "避免颈后下拉及大幅后仰"
  ],
  "attachment": "长直杆"
 },
 {
  "id": "pulldownNeutral",
  "variantOf": "pulldown",
  "name": "高位下拉（窄距中立握）",
  "trainingFocus": "背阔肌为主，肩伸侧重",
  "cues": [
   "使用窄距中立握把手，掌心相对",
   "肘部向髋部方向下拉",
   "保持躯干稳定，控制回放"
  ],
  "attachment": "窄距中立握把手"
 },
 {
  "id": "pulldownSupinated",
  "variantOf": "pulldown",
  "name": "高位下拉（反握）",
  "trainingFocus": "背阔肌为主，肱二头肌协同",
  "cues": [
   "掌心朝向自己，握距约肩宽",
   "保持手腕舒适，肘部靠近躯干",
   "先减轻重量，不靠甩动拉下"
  ],
  "attachment": "可反握的拉杆"
 },
 {
  "id": "pulldownSingle",
  "variantOf": "pulldown",
  "name": "单臂绳索高位下拉",
  "trainingFocus": "背阔肌为主，单侧控制",
  "cues": [
   "使用高位滑轮与单手把手",
   "保持肩胛和躯干稳定，肘向髋部拉",
   "左右分别完成，不侧屈借力"
  ],
  "requirements": [
   "龙门架 / 绳索器械"
  ],
  "gear": "龙门架 / 绳索器械",
  "attachment": "单手把手",
  "perSide": true
 },
 {
  "id": "cablerowWide",
  "variantOf": "cablerow",
  "name": "坐姿绳索划船（宽距正握）",
  "trainingFocus": "中斜方肌与菱形肌侧重",
  "cues": [
   "使用宽直杆，选择肩部舒适的握距",
   "肘部适度外展，拉向上腹至下胸",
   "控制肩胛回收，不耸肩或甩腰"
  ],
  "attachment": "宽直杆"
 },
 {
  "id": "cablerowSupinated",
  "variantOf": "cablerow",
  "name": "坐姿绳索划船（反握）",
  "trainingFocus": "背阔肌侧重，肱二头肌协同",
  "cues": [
   "约肩宽反握，保持手腕舒适",
   "肘部贴近躯干，拉向下腹",
   "不靠大幅前后摇摆完成"
  ],
  "attachment": "可反握的直杆"
 },
 {
  "id": "cablerowSingle",
  "variantOf": "cablerow",
  "name": "单臂坐姿绳索划船",
  "trainingFocus": "背阔肌侧重，单侧控制",
  "cues": [
   "使用单手把手，双脚稳固支撑",
   "肘部向髋部方向移动",
   "左右分别完成，避免扭转躯干"
  ],
  "attachment": "单手把手",
  "perSide": true
 },
 {
  "id": "barrowSupinated",
  "variantOf": "barrow",
  "name": "杠铃俯身划船（反握）",
  "trainingFocus": "背阔肌侧重，肱二头肌协同",
  "cues": [
   "反握约肩宽，先使用轻负重",
   "髋铰链俯身，肘部贴近躯干",
   "不猛拽杠铃或过度伸展手腕"
  ]
 },
 {
  "id": "chestsupportedWide",
  "variantOf": "chestsupported",
  "name": "胸托哑铃划船（正握宽肘）",
  "trainingFocus": "上背侧重，肩后束协同",
  "cues": [
   "胸部贴稳斜凳，掌心向后",
   "肘部适度外展，不追求极宽",
   "不耸肩，控制回放"
  ]
 },
 {
  "id": "pullupWide",
  "variantOf": "pullup",
  "name": "引体向上（宽距正握）",
  "trainingFocus": "背阔肌为主，肩内收侧重",
  "cues": [
   "选择可控制的较宽正握",
   "不摆动借力，向胸前方向拉起",
   "不强求下巴高度或颈后路径"
  ]
 },
 {
  "id": "chinup",
  "variantOf": "pullup",
  "name": "反握引体向上",
  "trainingFocus": "背阔肌为主，肱二头肌协同",
  "cues": [
   "反握约肩宽，保持手腕舒适",
   "稳定肩胛与躯干后拉起",
   "控制下降，避免摆动"
  ]
 },
 {
  "id": "benchWide",
  "variantOf": "bench",
  "name": "杠铃卧推（宽握）",
  "trainingFocus": "胸大肌为主，肩部负荷随握距变化",
  "cues": [
   "较常规稍宽即可，不追求极宽",
   "保持肩胛支撑，在舒适范围下降",
   "设置安全杆或使用保护者"
  ]
 },
 {
  "id": "dbbenchNeutral",
  "variantOf": "dbbench",
  "name": "哑铃卧推（中立握）",
  "trainingFocus": "胸大肌为主，肱三头肌协同",
  "cues": [
   "掌心相对，哑铃位于胸部两侧",
   "保持手腕与前臂稳定",
   "在肩部舒适范围控制下降"
  ]
 },
 {
  "id": "inclineNeutral",
  "variantOf": "incline",
  "name": "上斜哑铃卧推（中立握）",
  "trainingFocus": "胸大肌锁骨部侧重",
  "cues": [
   "使用适度倾斜凳面，掌心相对",
   "肩胛贴稳靠背，不耸肩",
   "控制下降，不追求额外深度"
  ]
 },
 {
  "id": "flyLow",
  "variantOf": "fly",
  "name": "绳索夹胸（低位向上）",
  "trainingFocus": "胸大肌锁骨部侧重",
  "cues": [
   "滑轮设置在较低位置，肘部微屈",
   "双手沿斜向上弧线合拢",
   "不用肩部前甩带动重量"
  ]
 },
 {
  "id": "flyHigh",
  "variantOf": "fly",
  "name": "绳索夹胸（高位向下）",
  "trainingFocus": "胸大肌胸肋部侧重",
  "cues": [
   "滑轮设置在较高位置，肘部微屈",
   "双手沿斜向下弧线合拢",
   "躯干稳定，不靠俯身压下重量"
  ]
 },
 {
  "id": "shoulderpressNeutral",
  "variantOf": "shoulderpress",
  "name": "哑铃肩推（中立握）",
  "trainingFocus": "三角肌前束为主，肱三头肌协同",
  "cues": [
   "掌心相对，选择肩部舒适路径",
   "收紧躯干，不后仰借力",
   "控制下降，避免强压肩部活动范围"
  ]
 },
 {
  "id": "cablelateralBehind",
  "variantOf": "cablelateral",
  "name": "绳索侧平举（身后起始）",
  "trainingFocus": "三角肌中束侧重",
  "cues": [
   "低位滑轮位于身后侧，使用轻重量",
   "肘部微屈，在舒适范围抬臂",
   "不强行拉向身后，不耸肩"
  ],
  "attachment": "单手把手",
  "perSide": true
 },
 {
  "id": "barcurlWide",
  "variantOf": "barcurl",
  "name": "杠铃弯举（宽握）",
  "trainingFocus": "肱二头肌为主，握距影响舒适度",
  "cues": [
   "采用舒适的较宽握距",
   "上臂稳定，不借力摆动",
   "握距不等同于单独隔离某一头"
  ]
 },
 {
  "id": "barcurlNarrow",
  "variantOf": "barcurl",
  "name": "杠铃弯举（窄握）",
  "trainingFocus": "肱二头肌为主，握距影响舒适度",
  "cues": [
   "采用舒适的较窄握距，不挤压手腕",
   "上臂稳定，控制屈伸",
   "握距不等同于单独隔离某一头"
  ]
 },
 {
  "id": "reversecurl",
  "variantOf": "barcurl",
  "name": "杠铃反握弯举",
  "trainingFocus": "肱桡肌与肱肌侧重",
  "cues": [
   "掌心向下，明显减轻重量",
   "手腕保持稳定，不过度背伸",
   "固定上臂，控制下放"
  ]
 },
 {
  "id": "reversecablecurl",
  "variantOf": "cablecurl",
  "name": "绳索反握弯举",
  "trainingFocus": "肱桡肌与肱肌侧重",
  "cues": [
   "低位滑轮配直杆，掌心向下",
   "先用轻阻力，保持手腕舒适",
   "不抬肘或摆动借力"
  ],
  "attachment": "直杆"
 },
 {
  "id": "cablecurlBehind",
  "variantOf": "cablecurl",
  "name": "身后绳索弯举（贝叶斯弯举）",
  "trainingFocus": "肱二头肌，肩伸位置练习",
  "cues": [
   "低位滑轮位于身后，使用单手把手",
   "上臂略在身后，不强求拉伸深度",
   "左右分别完成，不前后摆动身体"
  ],
  "attachment": "单手把手",
  "perSide": true
 },
 {
  "id": "tricepsV",
  "variantOf": "triceps",
  "name": "V形杆三头下压",
  "trainingFocus": "肱三头肌为主",
  "cues": [
   "使用V形杆，选择舒适的半中立握法",
   "上臂贴近躯干，缓慢伸肘",
   "不靠体重压下杆件"
  ],
  "attachment": "V形杆"
 },
 {
  "id": "tricepsSupinated",
  "variantOf": "triceps",
  "name": "反握直杆三头下压",
  "trainingFocus": "肱三头肌为主，握法影响舒适度",
  "cues": [
   "掌心向上，明显减轻重量",
   "固定上臂和手腕，控制伸肘",
   "握法不能单独隔离某一头"
  ],
  "attachment": "直杆"
 },
 {
  "id": "legpressNarrow",
  "variantOf": "legpress",
  "name": "腿举（窄距常规脚位）",
  "trainingFocus": "股四头肌侧重，臀部协同",
  "cues": [
   "采用舒适的较窄站距，不并拢双膝",
   "全脚掌贴板，膝盖跟随脚尖",
   "腰背贴垫，不追求过深屈髋"
  ]
 },
 {
  "id": "legpressHigh",
  "variantOf": "legpress",
  "name": "腿举（较高脚位）",
  "trainingFocus": "臀大肌侧重，股四头肌协同",
  "cues": [
   "双脚位置略高，按髋踝活动度调整",
   "全脚掌贴板，不让骨盆卷起离垫",
   "控制下降；脚位不能完全排除股四头肌"
  ],
  "muscle": "臀部"
 },
 {
  "id": "legextensionSingle",
  "variantOf": "legextension",
  "name": "单腿坐姿腿屈伸",
  "trainingFocus": "股四头肌，单侧控制",
  "cues": [
   "调整座椅与膝关节轴线",
   "左右分别轻负重伸膝",
   "控制回程，不甩动"
  ],
  "perSide": true
 },
 {
  "id": "legcurlSingle",
  "variantOf": "legcurl",
  "name": "单腿坐姿腿弯举",
  "trainingFocus": "腘绳肌，单侧控制",
  "cues": [
   "固定大腿与骨盆",
   "左右分别完成屈膝",
   "轻负重开始，控制回程"
  ],
  "perSide": true
 },
 {
  "id": "dbcalfSingle",
  "variantOf": "dbcalf",
  "name": "单腿哑铃提踵",
  "trainingFocus": "腓肠肌侧重，单侧控制",
  "cues": [
   "一手持哑铃，另一手扶稳",
   "左右分别缓慢抬跟",
   "控制下降，不弹跳"
  ],
  "perSide": true
 },
 {
  "id": "bridgeSingle",
  "variantOf": "bridge",
  "name": "单腿臀桥",
  "trainingFocus": "臀大肌侧重，单侧稳定",
  "cues": [
   "一脚稳固支撑，另一腿离地",
   "保持骨盆水平，控制抬髋",
   "左右分别完成，不过伸腰部"
  ],
  "perSide": true
 },
 {
  "id": "cablecrunchStanding",
  "variantOf": "cablecrunch",
  "name": "站姿绳索卷腹",
  "trainingFocus": "腹直肌，躯干屈曲",
  "cues": [
   "使用高位绳索，保持站位稳定",
   "缓慢卷曲躯干，不只做髋铰链",
   "不靠手臂下拉或屏息完成"
  ],
  "attachment": "绳索把手"
 }
];
for(const variant of exerciseVariants){const {id,...data}=variant;catalog[id]={...catalog[data.variantOf],...data,detailed:true};}
Object.assign(catalog.pulldown,{name:'高位下拉（常规正握）',trainingFocus:'背阔肌为主',attachment:'常规拉杆'});
Object.assign(catalog.cablerow,{name:'坐姿绳索划船（窄距中立握）',trainingFocus:'背阔肌侧重，肘部贴近躯干',attachment:'窄距中立握把手'});
Object.assign(catalog.triceps,{name:'直杆三头下压（正握）',trainingFocus:'肱三头肌为主',attachment:'直杆'});

catalog.proneY={detailed:true,name:'俯卧 Y 字上举',muscle:'背部',gear:'无器械',requirements:[],trainingFocus:'下斜方肌侧重，肩胛控制',cues:['俯卧双臂呈舒适的 Y 形，额头可垫毛巾','轻抬手臂，保持颈部放松，不耸肩','控制抬起与放下，腰部不借力，不强求高度']};
const sessionSlots={
 '推 · 胸肩三头':[
 {label:'水平推 · 胸部主项',options:['bench','dbbench','dbpress','push'],rest:120},
 {label:'上斜推 · 胸部辅助',options:['incline'],rest:120},
 {label:'垂直推 · 肩部主项',options:['shoulderpress','wallslide'],rest:120},
 {label:'肩外展 · 侧束',options:['lateral'],rest:90},
 {label:'肘伸 · 三头下压',options:['triceps','dbtriceps','bandtriceps','closepush'],rest:90},
 {label:'胸部孤立 · 夹胸',options:['fly','bandfly'],rest:90},
 {label:'过顶肘伸 · 三头辅助',options:['overheadtriceps'],rest:90},
 {label:'核心稳定',options:['deadbug','bird'],rest:60}],
 '拉 · 背部二头':[
 {label:'垂直拉 · 背阔肌',options:['pulldown'],rest:120},
 {label:'水平拉 · 背部主项',options:['row','cablerow','bandrow','proneW'],rest:120},
 {label:'肩后侧 · 后束',options:['reversefly'],rest:90},
 {label:'肘屈 · 二头主项',options:['curl','bandcurl','selfcurl'],rest:90},
 {label:'第二水平拉',options:['cablerow','bandrow'],rest:90},
 {label:'中立握肘屈',options:['hammer'],rest:90},
 {label:'核心稳定',options:['bird','deadbug'],rest:60}],
 '腿 · 臀腿核心':[
 {label:'膝主导 · 深蹲',options:['goblet','squat'],rest:120},
 {label:'髋主导 · 后侧链',options:['rdl','deadlift','hinge'],rest:120},
 {label:'臀部伸髋',options:['hipthrust','bridge'],rest:90},
 {label:'单腿稳定',options:['lunge'],rest:90},
 {label:'小腿跖屈',options:['dbcalf','calf'],rest:90},
 {label:'腿部辅助 · 腿举',options:['legpress'],rest:120},
 {label:'核心稳定',options:['deadbug','bird'],rest:60}]
};
sessionSlots['上肢力量']=[
 {label:'水平推 · 胸部主项',options:['bench','dbbench','dbpress','push'],rest:120},
 {label:'垂直拉 · 背部主项',options:['pulldown','row','bandrow','proneW'],rest:120},
 {label:'第二胸部动作',options:['incline','fly','bandfly','dbpress'],rest:90},
 {label:'水平拉 · 背部辅助',options:['row','cablerow','bandrow','proneW'],rest:120},
 {label:'肩部轮换 · 前束 / 侧束',options:['shoulderpress','wallslide'],rest:90},
 {label:'肘屈 · 二头辅助',options:['curl','bandcurl','selfcurl'],rest:90},
 {label:'肘伸 · 三头辅助',options:['triceps','dbtriceps','bandtriceps','closepush'],rest:90},
 {label:'核心稳定',options:['deadbug','bird'],rest:60}];
sessionSlots['下肢 + 核心']=[
 {label:'膝主导 · 主项',options:['goblet','squat'],rest:120},
 {label:'髋主导 · 主项',options:['rdl','deadlift','hinge'],rest:120},
 {label:'单腿稳定',options:['lunge'],rest:90},
 {label:'臀部伸髋',options:['hipthrust','bridge'],rest:90},
 {label:'腿部辅助',options:['legpress'],rest:120},
 {label:'小腿跖屈',options:['dbcalf','calf'],rest:90},
 {label:'核心稳定',options:['deadbug','bird'],rest:60}];
function rotatedSlots(title,at){const base=sessionSlots[title];if(!base)return null;const exposure=cycleContext(at).exposure;const variant=(state.profile.experience==='初学者'?Math.floor(exposure/2):exposure)%2;const slots=base.map(slot=>({...slot,options:[...slot.options]}));
 if(title==='上肢力量'){slots[2].options=variant?['fly','bandfly','incline','dbpress']:['incline','fly','bandfly','dbpress'];slots[4].options=variant?['lateral','wallslide']:['shoulderpress','lateral','wallslide'];slots[4].label=variant?'肩外展 · 侧束重点':'肩部推举或活动控制';if(variant)slots[3].options=['cablerow','row','bandrow','proneW'];}
 if(title==='推 · 胸肩三头'){const chest=slots.splice(5,1)[0];slots.splice(2,0,chest);const shoulder=slots.find(slot=>slot.label==='垂直推 · 肩部主项');shoulder.options=variant?['lateral','wallslide']:['shoulderpress','lateral','wallslide'];shoulder.label=variant?'肩外展 · 侧束重点':'垂直推 · 前束重点';const extra=slots.findIndex(slot=>slot.label==='肩外展 · 侧束');slots.splice(extra,1);}
 if(variant){for(const slot of slots){if(slot.options[0]==='curl')slot.options=['hammer','curl','bandcurl','selfcurl'];if(slot.options[0]==='deadbug')slot.options=['bird','deadbug'];if(slot.options[0]==='goblet')slot.options=['legpress','goblet','squat'];}}
 // Keep the strength main lift stable; vary compatible hypertrophy presses.
 if(variant&&state.profile.goal==='增肌与体型塑造'&&state.profile.experience!=='初学者'){const press=slots.find(slot=>slot.options[0]==='bench');if(press)press.options=['dbbench','bench','dbpress','push'];}
 const focus=state.profile.muscleFocus;
 if(title==='上肢力量'&&['chest','back'].includes(focus)){const extra=focus==='chest'?{label:'胸部重点 · 第三动作',options:['fly','incline','dbpress','bandfly'],rest:90}:{label:'背部重点 · 第三动作',options:['cablerow','row','bandrow','proneW'],rest:90};slots.splice(3,0,extra);if(focus==='back'){const pull=slots.splice(1,1)[0];slots.unshift(pull);const second=slots.findIndex(x=>x.label==='水平拉 · 背部辅助');slots.splice(2,0,slots.splice(second,1)[0]);}}
 const prioritized=focusMuscles[focus];if(prioritized&&focus!=='chest'&&focus!=='back')slots.sort((a,b)=>Number(b.options.some(id=>catalog[id]?.muscle===prioritized))-Number(a.options.some(id=>catalog[id]?.muscle===prioritized)));
 return slots;}
function requestedCount(){const n=Number(state.profile.exerciseCount);return Number.isInteger(n)&&n>=1&&n<=12?n:null;}
function fullBodySlots(at){
 const ordinal=trainingOrdinal(at),patterns=['胸部','股四头肌','背部','腘绳肌'],offset=ordinal%4;
 const groups=[...patterns.slice(offset),...patterns.slice(0,offset),'核心','臀部','肩部','肱二头肌','肱三头肌','小腿'];
 return groups.map(m=>({label:m+' · 全身轮换',options:[...groupChoices[m]],rest:90}));
}
function powerliftingSlots(slots,at){
 if(state.profile.goal!=='提升力量')return slots;
 const variants=cycleContext(at).exposure%2;
 const mapped=slots.map((slot,index)=>{
  const muscle=catalog[slot.options[0]]?.muscle;let options=[...slot.options],role=index===0?'main':'assistance',label=slot.label;
  if(muscle==='股四头肌')options=label.includes('单腿')?['splitSquat','bulgarian','lunge']:index===0?['barsquat','goblet','legpress','squat']:['legpress','goblet','squat'];
  if(muscle==='腘绳肌')options=index===0?['deadlift','barRdl','rdl','hinge']:['barRdl','rdl','legcurl','hinge'];
  if(muscle==='核心'){options=['pallof','bandpallof','deadbug','bird'];role='control';label='核心抗旋转 / 抗伸展';}
  if(label.includes('第二胸')||label.includes('胸部辅助')){options=['closebench','dbbench','pushup','push'];role='assistance';label='卧推相关力量辅助';}
  if(label.includes('水平拉')){options=['chestsupported','cablerow','row','bandrow','proneW'];role='assistance';label='上背支撑 · 划船辅助';}
  return {...slot,options,role,label,rest:role==='main'?180:90};
 });
 // One technical variant near the primary lift, not several heavy variations stacked.
 const first=mapped[0],kind=first?.options.includes('bench')?'bench':first?.options.includes('barsquat')?'squat':first?.options.includes('deadlift')?'deadlift':null;
 const variantId=kind==='bench'?(variants?'tempobench':'pausebench'):kind==='squat'?(variants?'temposquat':'pausesquat'):kind==='deadlift'?'pausedeadlift':null;
 if(variantId&&supports(variantId))mapped.splice(1,0,{label:catalog[variantId].purpose+' · 技术辅助',options:[variantId],role:'technique',rest:150});
 return mapped;
}
function templateSession(title,gear,minutes,limit,at){const source=title==='全身力量'?fullBodySlots(at):rotatedSlots(title,at);if(!source)return null;const slots=powerliftingSlots(source,at);const budget=Math.max(0,minutes-10);const maxMoves=state.profile.experience==='初学者'?Math.min(limit,5):limit;const used=new Set(),entries=[];let estimated=10;for(const slot of slots){let id=experienceOptions(slot.options).find(id=>supports(id,gear)&&!used.has(id));if(!id)continue;const preferred=state.exerciseReplacements?.[id];if(preferred&&replacementFamily(id)?.ids.includes(preferred)&&supports(preferred,gear)&&!used.has(preferred))id=preferred;const sets=state.exerciseTargets?.[id]?.sets||Math.min(goalTarget().sets,state.profile.experience==='有规律训练经验'?4:3);const cost=(sets*40+(sets-1)*slot.rest+90)/60;if(entries.length>=maxMoves||estimated-10+cost>budget)continue;entries.push({id,label:slot.label,rest:slot.rest,sets,role:slot.role});used.add(id);estimated+=cost;}return {ids:entries.map(e=>e.id),entries,estimated:Math.ceil(estimated),sets:4,title,powerlifting:state.profile.goal==='提升力量'};}
Object.assign(catalog,{
 warmwalk:{name:'轻松走 · 热身',gear:'无器械',muscle:'心肺',kind:'cardio',cues:['从轻松速度开始','逐渐增加步频','保持自然呼吸']},
 briskwalk:{name:'快走',gear:'无器械',muscle:'心肺',kind:'cardio',cues:['选择平坦安全路线','保持能说完整句子的强度','疲劳时降低步频']},
 march:{name:'原地踏步',gear:'无器械',muscle:'心肺',kind:'cardio',cues:['选择防滑地面','自然摆臂','不必追求高抬腿']},
 treadmill:{name:'跑步机快走',gear:'跑步机',muscle:'心肺',kind:'cardio',cues:['熟悉急停装置','从慢速开始','先调速度再考虑坡度']},
 bike:{name:'动感单车 · 稳态骑行',gear:'动感单车',muscle:'心肺',kind:'cardio',cues:['调整座椅高度','低阻力热身','保持能说话的节奏']},
 elliptical:{name:'椭圆机',gear:'椭圆机',muscle:'心肺',kind:'cardio',cues:['先用低阻力','身体直立','控制节奏不冲刺']},
 rowing:{name:'划船机 · 稳态',gear:'划船机',muscle:'心肺',kind:'cardio',cues:['先蹬腿再拉手柄','回程先伸臂再屈膝','保持背部中立']},
 cooldown:{name:'慢走 · 放松',gear:'无器械',muscle:'心肺',kind:'cardio',cues:['逐渐减速','呼吸缓慢恢复','不突然停止']}
});muscleGroups.push('心肺');groupChoices['心肺']=['briskwalk','march'];
function cardioPlan(at=new Date()){const p=state.profile,gear=selectedEquipment();const main=(p.cardioMode&&catalog[p.cardioMode]?.kind==='cardio'&&supports(p.cardioMode,gear)?p.cardioMode:null)||['treadmill','bike','elliptical','rowing'].find(id=>supports(id,gear))||(p.place==='户外 / 公园'?'briskwalk':'march');const available=Number(p.minutes)||15;const cap=p.experience==='有规律训练经验'?60:p.experience==='有一些经验 / 重新开始'?45:30;const frequency=p.scheduleMode==='cycle'?7*(Number(p.trainDays)||3)/((Number(p.trainDays)||3)+(Number(p.restDays)||1)):p.scheduleMode==='weekly'?weeklyDays().length:Number(p.days)||3;const weeklyBudget=p.experience==='有规律训练经验'?180:p.experience==='有一些经验 / 重新开始'?120:90;const duration=Math.min(available,cap,Math.max(10,Math.floor(weeklyBudget/frequency)));const warm=duration<=15?2:5,cool=warm;const prior=relevantEarlierDays(at).filter(x=>!x.planned&&x.record.logs?.[main]?.length).sort((a,b)=>b.date.localeCompare(a.date))[0];let mainDuration=duration-warm-cool;if(prior){const logs=prior.record.logs[main],completed=logs.reduce((n,l)=>n+(l.minutes||0),0),target=prior.record.cardioTargets?.[main]||mainDuration;mainDuration=Math.min(mainDuration,Math.max(1,completed+(completed>=target&&logs.every(l=>l.effort==='轻松')?2:0)));}return {title:'心肺耐力 · 稳态训练',ids:['warmwalk',main,'cooldown'],sets:0,durations:{warmwalk:warm,[main]:mainDuration,cooldown:cool},estimated:warm+mainDuration+cool,note:'稳态为默认方案，可选择心肺方式；时长结合每周频率与经验。仅根据同一方式的实际完成记录调整，不因日历推进自动加量。连续轻松完成后小幅增加，较吃力或未完成则保持或缩短。'};}
function cardioTarget(id,d=workoutDay()){if(isHistoricalRecord(d)&&!d.cardioTargets?.[id])return 15;return d.cardioTargets?.[id]||selectedPrescription().durations?.[id]||15;}
function mobilityCard(id,d){const m=catalog[id],target=d.mobilityTargets?.[id]||2,logs=d.logs?.[id]||[],done=logs.filter(l=>l.mobilitySets).length;return `<section class="card workout-card"><button data-lesson="${id}"><h3>${esc(m.name)} ▷</h3></button><button class="remove-exercise" data-remove-exercise="${id}">移除此动作</button>${orderControls(id)}<p>${target} 组 · ${esc(m.dose||'每侧 6–8 次，缓慢控制')} · 组间轻松休息 20–30 秒</p><p>保持无痛范围，不以心率或“中等强度”衡量。已记录 ${done} / ${target} 组</p><label>目标组数（可调整）<input id="mobility-target-${id}" type="number" min="1" max="5" value="${target}"></label><button data-save-mobility="${id}">保存目标</button><button class="primary" data-log-mobility="${id}" ${isPreview()?'disabled':''}>${done>=target?'记录额外一组':'完成一组'}</button><button data-remove-log="${id}" ${isPreview()?'disabled':''}>撤回</button>${logs.filter(l=>l.mobilitySets).map(()=>'<p class="set-row">✓ 一组活动度练习</p>').join('')}<p id="mobility-feedback-${id}" class="muted"></p></section>`;}
function cardioCard(id,d,plan){if(catalog[id].mobility)return mobilityCard(id,d);const m=catalog[id],target=cardioTarget(id,d),logs=d.logs?.[id]||[],done=logs.reduce((sum,l)=>sum+(l.minutes||0),0);return `<section class="card workout-card"><button data-lesson="${id}"><h3>${esc(m.name)} ▷</h3></button><button class="remove-exercise" data-remove-exercise="${id}">移除此动作</button>${orderControls(id)}<p>建议 ${target} 分钟 · ${m.intensity|| (id==='warmwalk'||id==='cooldown'?'轻松，RPE 2–3 / 10':'中等强度，RPE 4–6 / 10；能说完整句子')}</p><p>已记录 ${done} / ${target} 分钟</p><div class="set-input"><label>本次完成分钟<input id="cardio-minutes-${id}" type="number" min="1" max="180" value="${Math.max(1,target-done)}"></label><label>目标分钟（可自定义）<input id="cardio-target-${id}" type="number" min="1" max="180" value="${target}"></label><label>实际强度<select id="cardio-effort-${id}"><option ${id==='warmwalk'||id==='cooldown'?'selected':''}>轻松</option><option ${id==='warmwalk'||id==='cooldown'?'':'selected'}>中等</option><option>较吃力</option></select></label></div><button class="primary" data-log-cardio="${id}" ${isPreview()?'disabled':''}>记录时长</button> <button data-save-cardio="${id}">保存目标</button> <button data-remove-log="${id}" ${isPreview()?'disabled':''}>撤回上次记录</button>${logs.map(l=>`<p class="set-row">✓ ${l.minutes} 分钟 · ${esc(l.effort||'中等')}</p>`).join('')}<p id="cardio-feedback-${id}" class="muted"></p></section>`;}
let muscleFilter='全部',equipmentFilter='全部';
const defaultWeekdays={1:[2],2:[0,3],3:[0,2,4],4:[0,1,3,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
function dayIndex(at){const d=typeof at==='string'?at:at.toLocaleDateString('en-CA');return Date.parse(d+'T00:00:00Z')/86400000;}
function anchorDate(){return state.profile.scheduleStart||state.startDate||dateKey();}
function weeklyDays(){const p=state.profile;return p.weekdays?.length?p.weekdays.map(Number):defaultWeekdays[Number(p.days)]||[0,2,4];}
function schedule(at=new Date()){const p=state.profile;if(p.scheduleMode&&dayIndex(at)<dayIndex(anchorDate()))return 'pending';if(p.scheduleMode==='cycle'){const train=Number(p.trainDays)||3,rest=Number(p.restDays)||1;return ((dayIndex(at)-dayIndex(anchorDate()))%(train+rest)+(train+rest))%(train+rest)<train?'training':'recovery';}return weeklyDays().includes((at.getDay()+6)%7)?'training':'recovery';}
function trainingOrdinal(at){if(!state.profile.scheduleMode){const weekday=(at.getDay()+6)%7;let n=0;for(let i=0;i<weekday;i++){const d=new Date(at);d.setDate(d.getDate()-weekday+i);if(schedule(d)==='training'&&!lightDay(d))n++;}return n;}const delta=Math.max(0,dayIndex(at)-dayIndex(anchorDate()));const p=state.profile;if(p.scheduleMode==='cycle'){const train=Number(p.trainDays)||3,period=train+(Number(p.restDays)||1);return Math.floor(delta/period)*train+Math.min(delta%period,train);}const full=Math.floor(delta/7)*weeklyDays().length;let n=full;const start=new Date(anchorDate()+'T12:00:00');for(let i=0;i<delta%7;i++){const d=new Date(start);d.setDate(d.getDate()+i);if(schedule(d)==='training'&&!lightDay(d))n++;}return p.scheduleMode==='weekly'?n:Math.floor(delta/7)*Math.min(weeklyDays().length,4)+n-full;}
function scheduleSummary(){const p=state.profile;return p.scheduleMode==='cycle'?`练 ${p.trainDays} 天 / 休 ${p.restDays} 天 · 从 ${anchorDate()} 循环`:`每周 ${weeklyDays().map(i=>'周'+'一二三四五六日'[i]).join('、')}`;}

const equipmentByPlace={
 '家中':['哑铃','弹力带','瑜伽垫','壶铃','单杠','训练凳','跑步机','动感单车'],
 '健身房':['哑铃','杠铃','训练凳','深蹲架 / 保护架','硬拉台（Deadlift platform）','龙门架 / 绳索器械','腿举机','高位下拉机','史密斯机','牧师凳','推胸机','蝴蝶机','辅助引体机','划船训练机','肩推机','腿屈伸机','腿弯举机','哈克深蹲机','髋外展机','坐姿提踵机','单杠','跑步机','椭圆机','划船机','动感单车','瑜伽垫'],
 '户外 / 公园':['哑铃','壶铃','单杠','双杠','弹力带','瑜伽垫']
};
function equipmentOptions(place){return ['无器械 / 徒手',...(place==='多地点切换'?[...new Set(Object.values(equipmentByPlace).flat())]:equipmentByPlace[place]||equipmentByPlace['家中'])];}
function defaultEquipment(place){return place==='健身房'?['哑铃','杠铃','训练凳','深蹲架 / 保护架','龙门架 / 绳索器械','腿举机','高位下拉机','跑步机','动感单车']:['无器械 / 徒手'];}
function selectedEquipment(profile=state.profile){let items=profile.equipment;if(!Array.isArray(items))items=items==='杠铃及拉力器'?['杠铃','哑铃','训练凳','深蹲架 / 保护架','龙门架 / 绳索器械']:items?[items]:[];return items.filter(x=>equipmentOptions(profile.place).includes(x));}
const goalRules={
 '建立运动习惯':{sets:2,min:8,max:10,rest:60,note:'以短时、容易完成为先，不要求练满可用时间。'},
 '减脂与体重管理':{sets:3,min:10,max:15,rest:90,note:'力量与中等强度有氧组合，不以体重变化奖励 XP。'},
 '增肌与体型塑造':{sets:4,min:8,max:12,rest:90,note:'在动作稳定的基础上增加次数，达到上限后再评估负重。'},
 '提升力量':{sets:4,min:4,max:6,rest:180,note:'主项偏低次数、较充分休息；初学者先使用 6–8 次熟悉动作，不安排极限重量。'},
 '保持健康与精力':{sets:2,min:8,max:12,rest:90,note:'全身基础力量与轻松有氧组合，以恢复和持续活动为先。'}
};
Object.assign(catalog,{
 thoracic:{name:'胸椎旋转 · 活动度',gear:'无器械',muscle:'活动度',kind:'cardio',intensity:'轻柔、无痛范围，不屏息',cues:['四点支撑稳定骨盆','缓慢转动上背','保持无痛活动范围']},
 ankle:{name:'踝关节前移 · 活动度',gear:'无器械',muscle:'活动度',kind:'cardio',intensity:'轻柔、无痛范围，不屏息',cues:['脚跟保持贴地','膝盖朝脚尖方向前移','两侧分别完成']},
 hipmob:{name:'坐姿髋部旋转',gear:'无器械',muscle:'活动度',kind:'cardio',intensity:'轻柔、无痛范围，不屏息',cues:['坐稳可用手支撑','缓慢向两侧转动膝盖','不强压关节']}
});
Object.assign(catalog,{
 shoulderMob:{name:'肩部墙面滑臂 · 活动度',gear:'无器械',muscle:'活动度',kind:'cardio',cues:['背部稳定轻靠墙','缓慢滑臂','避免腰部过伸']},
 hamStretch:{name:'坐姿腿后侧伸展',gear:'无器械',muscle:'活动度',kind:'cardio',dose:'每侧保持 20–30 秒，不弹震',cues:['坐稳伸展一侧腿','髋部轻微前倾','只到轻微牵拉感']},
 calfStretch:{name:'扶墙小腿伸展',gear:'无器械',muscle:'活动度',kind:'cardio',dose:'每侧保持 20–30 秒，不弹震',cues:['双手扶墙','后脚脚跟贴地','缓慢前移身体']},
 hipFlexor:{name:'半跪姿髋前侧伸展',gear:'无器械',muscle:'活动度',kind:'cardio',dose:'每侧保持 20–30 秒，不弹震',cues:['膝下垫软垫','轻收骨盆','避免过伸腰部']}
});for(const id of ['thoracic','ankle','hipmob','shoulderMob','hamStretch','calfStretch','hipFlexor'])catalog[id].mobility=true;
muscleGroups.push('活动度');groupChoices['活动度']=['thoracic','ankle','hipmob'];
const strengthMainIds=new Set(['chestmachine','shouldermachine','chestsupported','machinerow','barsquat','frontsquat','barohp','smithbench','inclinebar','barRdl','barhip','barrow','bench','dbbench','dbpress','incline','push','row','cablerow','pulldown','goblet','squat','legpress','rdl','deadlift','hipthrust','shoulderpress']);
for(const variant of exerciseVariants)if(strengthMainIds.has(variant.variantOf))strengthMainIds.add(variant.id);
function defaultExerciseTarget(id){const target=goalTarget();return state.profile.goal==='提升力量'&&!strengthMainIds.has(id)?{sets:target.sets,min:8,max:12}:target;}
function goalTarget(){const rule=goalRules[state.profile.goal];if(!rule)return {sets:4,min:8,max:12};if(state.profile.goal==='提升力量'&&state.profile.experience!=='有规律训练经验')return {sets:rule.sets,min:6,max:8};return {sets:rule.sets,min:rule.min,max:rule.max};}
function cyclePanel(c){if(!c)return '';return `<div class="card cycle-panel"><p class="eyebrow">4 WEEK TRAINING BLOCK</p><h3>第 ${c.week} 周 · ${esc(c.phase)}${state.profile.goal==='提升力量'?' / '+esc(c.session):''}</h3><div class="week">${['基础积累','渐进建立','巩固表现','减量恢复'].map((name,i)=>`<div class="day"><div class="dot ${c.blockWeek===i+1?'done':''}">${i+1}</div>${name}</div>`).join('')}</div><p class="muted">RIR = 做完后估计还能完成的次数。手动目标优先，减量周不覆盖你的自定义。</p><p class="muted">周期方法原型 · 非职业选手原版训练表；参考资料待核验。</p></div>`;}
function completedRecordedWorkout(d){return !!d.exerciseIds?.length&&d.exerciseIds.every(id=>{const m=catalog[id],logs=d.logs?.[id]||[];if(!m)return false;if(m.mobility)return logs.filter(l=>l.mobilitySets).length>=(d.mobilityTargets?.[id]||2);if(m.kind==='cardio')return logs.reduce((n,l)=>n+(l.minutes||0),0)>=(d.cardioTargets?.[id]||15);return logs.length>=(d.targets?.[id]?.sets||d.targetSets||4);});}
function snapshotWorkoutTargets(d,p){d.targets ||= {};d.cardioTargets ||= {};d.mobilityTargets ||= {};for(const id of d.exerciseIds||p.ids){const m=catalog[id];if(m.mobility)d.mobilityTargets[id] ||= 2;else if(m.kind==='cardio')d.cardioTargets[id] ||= p.durations?.[id]||15;else d.targets[id] ||= {...(p.targets?.[id]||defaultExerciseTarget(id))};}d.sessionEntries ||= p.entries;}
function cycleContext(at=new Date()){
 const elapsed=Math.max(0,dayIndex(at)-dayIndex(anchorDate()));const week=Math.floor(elapsed/7)+1,blockWeek=(week-1)%4+1;
 const split=state.profile.split;const effectiveDays=state.profile.scheduleMode==='weekly'?weeklyDays().length:state.profile.scheduleMode==='cycle'?7*(Number(state.profile.trainDays)||3)/((Number(state.profile.trainDays)||3)+(Number(state.profile.restDays)||1)):Number(state.profile.days)||3;
 const patternLength=split==='ppl'?3:split==='upperlower'?2:split==='full'?1:effectiveDays<=3?1:effectiveDays<=4?2:3;
 const exposure=liftDayNames[state.profile.muscleFocus]?specialtyExposure(at,state.profile.muscleFocus):Math.floor(trainingOrdinal(at)/patternLength);const beginner=state.profile.experience==='初学者';
 const returning=state.profile.experience==='有一些经验 / 重新开始'&&state.profile.trainingRecency!=='近期持续训练'&&relevantEarlierDays(at).filter(({date,record,planned})=>!planned&&dayIndex(at)-dayIndex(date)<=42&&(record.exerciseIds?.length?completedRecordedWorkout(record):Object.values(record.logs||{}).reduce((n,logs)=>n+logs.length,0)>=3)).length<6;
 const session=beginner?'技术适应':returning?'回归适应':['重训练','训练量','技术轻练'][exposure%3];
 return {week,blockWeek,phase:['基础积累','渐进建立','巩固表现','减量恢复'][blockWeek-1],deload:blockWeek===4,session,exposure};
}
function periodizePlan(base,at){
 const p=state.profile,c=cycleContext(at),time=Number(p.minutes)||15,goal=p.goal;const result={...base,cycle:c,targets:{},durations:{...(base.durations||{})},entries:[],note:base.note||''};
 let elapsed=Math.min(5,time*.2);const ids=[],muscleSets={},recent=recentMuscleVolume(at),capacityNotes=[];const singleLimit=p.experience==='初学者'?6:10,weeklyLimit=p.experience==='初学者'?12:20;
 for(const id of base.ids){const timed=catalog[id].kind==='cardio';if(timed){let duration=base.durations?.[id]||15;if(goal==='提升心肺与耐力'){if(c.deload&&id!=='warmwalk'&&id!=='cooldown')duration=Math.max(1,Math.floor(duration*.65));}else if(c.deload&&goal!=='灵活性与日常活动能力')duration=Math.max(1,Math.floor(duration*.7));result.durations[id]=duration;ids.push(id);continue;}
 let target={...(base.targets?.[id]||defaultExerciseTarget(id))},rest=base.entries?.find(e=>e.id===id)?.rest||90;const entry=base.entries?.find(e=>e.id===id),role=entry?.role||catalog[id].powerRole;const main=role?role==='main':base.specialtyMain?id===base.specialtyMain:strengthMainIds.has(id);
 if(!base.targets?.[id]&&p.experience!=='有规律训练经验')target.sets=Math.min(target.sets,3);
 if(goal==='提升力量'&&main&&strengthMainIds.has(id)){if(p.experience==='初学者'||c.session==='回归适应'){target={sets:3,min:6,max:8};rest=120;}else if(c.session==='重训练'){target={sets:4,min:4,max:6};rest=180;}else if(c.session==='训练量'){target={sets:4,min:6,max:8};rest=150;}else{target={sets:3,min:6,max:8};rest=90;}}
 if(goal==='提升力量'&&role==='technique'){target={sets:3,min:3,max:5};rest=150;}else if(goal==='提升力量'&&role==='assistance'){target={sets:3,min:strengthMainIds.has(id)||id==='splitSquat'?6:8,max:strengthMainIds.has(id)||id==='splitSquat'?10:12};rest=90;}
 if(c.deload&&['提升力量','增肌与体型塑造','减脂与体重管理'].includes(goal)){target.sets=Math.max(1,Math.ceil(target.sets*.5));}
 target.rir=goal==='增肌与体型塑造'?(c.deload?4:p.experience==='初学者'?3:p.experience==='有一些经验 / 重新开始'?2:4-c.blockWeek):goal==='提升力量'?(c.deload||c.session==='技术轻练'||c.session==='回归适应'||p.experience==='初学者'?4:2):3;
 if(['deadbug','bird','proneW','wallslide','pallof','bandpallof'].includes(id)){target={...target,sets:Math.min(target.sets,3),min:6,max:8,rir:undefined,quality:true};rest=60;}if(goal==='提升力量'&&role==='technique')target.rir=c.deload?4:3;if(catalog[id].perSide)target.perSide=true;const custom=state.exerciseTargets?.[id];if(custom)target={...target,...custom};
 const muscle=catalog[id].muscle,used=muscleSets[muscle]||0,remaining=Math.min(singleLimit-used,weeklyLimit-(recent[muscle]||0)-used);
 if(!custom){if(remaining<=0){capacityNotes.push(muscle+'近期直接组数达到自动推荐上限');continue;}if(target.sets>remaining){target.sets=remaining;target.capacityAdjusted=true;capacityNotes.push(muscle+'推荐组数已按容量缩减');}}
 else if(target.sets>remaining){target.capacityWarning=true;capacityNotes.push(muscle+'自定义组数超过自动推荐范围');}
 const cost=(target.sets*35+(target.sets-1)*rest+60)/60;
 const cardioBudget=base.ids.filter(x=>catalog[x].kind==='cardio').reduce((n,x)=>n+(base.durations?.[x]||0),0);
 if(ids.filter(x=>catalog[x].kind!=='cardio').length&&elapsed+cost>time-cardioBudget)continue;
 let actualCost=cost;if(elapsed+cost>time-cardioBudget){if(custom){target.timeWarning=true;}else{const fitting=Math.floor(((time-cardioBudget-elapsed)*60-60+rest)/(35+rest));target.sets=Math.max(1,Math.min(target.sets,fitting));actualCost=(target.sets*35+(target.sets-1)*rest+60)/60;target.timeAdjusted=true;}}
 ids.push(id);muscleSets[muscle]=used+target.sets;elapsed+=actualCost;result.targets[id]=target;result.entries.push({id,sets:target.sets,rest,label:id==='wallslide'?'肩部活动控制 · 滑臂':base.entries?.find(e=>e.id===id)?.label||catalog[id].muscle,role});
 }
 result.capacityNotes=[...new Set(capacityNotes)];result.recoveryRecommended=base.ids.length>0&&!ids.length&&capacityNotes.length>0;if(result.capacityNotes.length)result.selectionInfo='已按近期实际训练量调整推荐容量。';if(result.recoveryRecommended){result.title='恢复建议 · 近期容量已达推荐范围';result.selectionInfo='当前部位近期直接组数已达自动推荐范围，建议恢复或改练其他部位。';}result.ids=ids;const timedTotal=ids.filter(id=>catalog[id].kind==='cardio').reduce((n,id)=>n+result.durations[id],0);result.estimated=Math.ceil((ids.every(id=>catalog[id].kind==='cardio')?0:elapsed)+timedTotal);
 if(!ids.some(id=>catalog[id].kind==='cardio')){delete result.durations;if(['减脂与体重管理','保持健康与精力'].includes(goal)&&ids.length)result.title=goal==='减脂与体重管理'?'体重管理 · 今日力量短课':'健康活动 · 今日力量短课';}
 const rule=goal==='提升力量'?`${c.deload?'减量恢复':c.session}：主项练习力量，暂停/节奏变式练习技术，相关辅助支撑主项能力；不把所有复合动作都当重主项。`:goal==='增肌与体型塑造'?`本周保留约 ${c.deload?4:p.experience==='初学者'?3:p.experience==='有一些经验 / 重新开始'?2:4-c.blockWeek} 次余力；减量周降低推荐组数，动作不要求力竭。`:goal==='提升心肺与耐力'?'稳态耐力递进；尚未加入可验证的间歇/阈值测试，强度以谈话测试控制。':goal==='减脂与体重管理'?'保持力量训练与有氧，第四周降低训练量，不自动扩大热量缺口。':'';
 result.preferenceNote=goalRules[goal]?`力量偏好：${liftDayNames[p.muscleFocus]|| (focusMuscles[p.muscleFocus]?focusMuscles[p.muscleFocus]+'专项':'均衡')} · ${requestedCount()?'希望 '+requestedCount()+' 个力量动作，实际 '+ids.filter(id=>catalog[id].kind!=='cardio').length+' 个。数量受当前训练分配、时间、经验与器械限制。':'动作数量自动推荐。'}`:'';result.note=[base.note,goalRules[goal]?`经验适配：${p.experience}；${p.experience==='初学者'?'优先稳定支撑与技术练习，基础动作默认不超过 3 组':p.experience==='有一些经验 / 重新开始'?'优先可控负重和基础辅助，基础动作默认不超过 3 组':'保留主项与相关辅助，按记录和周期递进'}`:'',rule,...result.capacityNotes].filter(Boolean).join(' ');if(result.capacityNotes.length)result.note+=' 自动推荐容量是产品默认规则，可按个人恢复情况手动调整，不是统一的专业上限。';if(p.muscleFocus==='arms'&&new Set(ids.map(id=>catalog[id].muscle)).size<2)result.note+=' 当前动作数量、预算或器械不足以同时覆盖二头和三头；可增加数量或手动补充另一侧动作。';return result;
}
const liftDayNames={deadlift_day:'硬拉日',squat_day:'深蹲日',bench_day:'卧推日'};
const focusMuscles={chest:'胸部',back:'背部',shoulders:'肩部',biceps:'肱二头肌',triceps:'肱三头肌',quadriceps:'股四头肌',hamstrings:'腘绳肌',glutes:'臀部',calves:'小腿',core:'核心',arms:'手臂'};
function focusOptions(at=workoutDate()){const savedFocus=state.profile.muscleFocus;state.profile.muscleFocus='balanced';let title;try{title=strengthPrescription(at).title;}finally{state.profile.muscleFocus=savedFocus;}const keys=title==='下肢 + 核心'||title==='腿 · 臀腿核心'?['quadriceps','hamstrings','glutes','calves','core']:title==='推 · 胸肩三头'?['chest','shoulders','triceps','arms']:title==='拉 · 背部二头'?['back','biceps','arms']:title==='上肢力量'?['chest','back','shoulders','biceps','triceps','arms']:Object.keys(focusMuscles);return [['balanced','均衡'],...[...new Set([...keys,'core'])].filter(key=>!['biceps','triceps'].includes(key)).map(key=>[key,focusMuscles[key]+'专项']),...(state.profile.goal==='提升力量'?Object.entries(liftDayNames):[])];}
function validDailyFocus(focus,at){return focusOptions(at).some(([key])=>key===focus)?focus:'balanced';}
const muscleExerciseOrder={
 胸部:['bench','pausebench','tempobench','dbbench','smithbench','inclinebar','incline','chestmachine','dbpress','pushup','push','fly','dbfly','pecdeck','bandfly'],
 背部:['pullup','assistpull','pulldown','barrow','row','chestsupported','cablerow','machinerow','bandrow','straightpull','proneW'],
 肩部:['barohp','shoulderpress','shouldermachine','lateral','cablelateral','reversefly','rearpec','facepull','wallslide'],
 肱二头肌:['barcurl','curl','altcurl','inclinecurl','preacher','dbpreacher','cablecurl','concentration','hammer','ropehammer','bandcurl','selfcurl'],
 肱三头肌:['closebench','skullcrusher','overheadtriceps','cableoverhead','triceps','ropepush','dbtriceps','bandtriceps','closepush'],
 股四头肌:['barsquat','pausesquat','temposquat','frontsquat','splitSquat','goblet','smithsquat','hack','legpress','bulgarian','lunge','legextension','squat'],
 腘绳肌:['deadlift','pausedeadlift','barRdl','rdl','legcurl','hinge'],臀部:['barhip','hipthrust','bridge','cablekick','abduction'],小腿:['dbcalf','seatedcalf','calf'],核心:['pallof','bandpallof','deadbug','bird','cablecrunch','crunch','reversecrunch']};
function exerciseOrderRank(id){const order=muscleExerciseOrder[catalog[id]?.muscle]||[];const rank=order.indexOf(id);if(rank<0&&catalog[id]?.variantOf)return exerciseOrderRank(catalog[id].variantOf);return rank<0?order.length:rank;}
function exerciseRoleText(id,d,plan){if(state.profile.goal!=='提升力量')return '';const role=(d.sessionEntries||plan.entries||[]).find(e=>e.id===id)?.role||catalog[id].powerRole;return {main:'主项 · 力量表现',technique:'技术变式 · 轻负重控制',assistance:'辅助 · 支撑主项能力',control:'核心稳定 · 不追求力竭'}[role]||'基础力量练习';}
function exerciseOrderNote(id){if(catalog[id].purpose)return catalog[id].purpose+'：'+(catalog[id].powerRole==='technique'?'用轻于主项的负重练习控制，不作为第二个重主项。':catalog[id].powerRole==='control'?'两侧分别控制，失去稳定就停止。':'辅助主项能力，不为填满时长增加疲劳。');if(['hammer','ropehammer'].includes(id))return '后段辅助：中立握弯举；先完成本次安排的常规弯举。';if(['fly','dbfly','pecdeck','bandfly','legextension','legcurl','cablekick','abduction'].includes(id))return '孤立辅助：安排在同肌群主要复合动作之后。';if(['reversefly','rearpec','facepull'].includes(id))return '肩后侧辅助：安排在本次肩部主项之后。';return '';}
function orderWorkoutIds(ids,prefs={},entries=[]){if(liftDayNames[prefs.muscleFocus]&&ids.length)return [ids[0],...orderWorkoutIds(ids.slice(1),{},entries)];const groups=[...new Set(ids.filter(id=>catalog[id]?.kind!=='cardio').map(id=>catalog[id]?.muscle))];if(!groups.length)return [...ids];const focus=focusMuscles[prefs.muscleFocus]||null;if(focus&&groups.includes(focus)){groups.splice(groups.indexOf(focus),1);groups.unshift(focus);}const roleRank=id=>({main:0,technique:1,assistance:2,control:3})[entries.find(entry=>entry.id===id)?.role]??2;return [...ids].sort((a,b)=>{const rank=id=>catalog[id]?.kind==='cardio'?(id==='warmwalk'?-1:groups.length):groups.indexOf(catalog[id]?.muscle);return rank(a)-rank(b)||(catalog[a]?.kind!=='cardio'&&catalog[b]?.kind!=='cardio'?(roleRank(a)-roleRank(b)||exerciseOrderRank(a)-exerciseOrderRank(b)):0);});}
function orderPlan(plan,prefs){if(plan.shoulderSession)return plan;const ids=orderWorkoutIds(plan.ids,prefs,plan.entries||[]);return {...plan,ids,...(plan.entries?{entries:[...plan.entries].sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id))}:{})};}
function prescription(at=new Date()){return generatePrescription(at,{state,dateKey,validDailyAdjustment,beginnerExperience,selectedEquipment,defaultEquipment,validDailyFocus,latestComfort,basePrescription,orderPlan,periodizePlan});}
function dailyPreferencePanel(d){if(isFuture()&&schedule(workoutDate())!=='training')return '<p class="muted">这一天是恢复日。可通过添加动作安排轻活动；专项排课用于训练日。</p>';if(state.profile.goal==='提升心肺与耐力')return `<section class="card"><h3>今天的心肺方式</h3><label>选择方式<select id="daily-cardio-mode">${['treadmill','bike','elliptical','rowing','briskwalk','march'].filter(id=>supports(id)).map(id=>`<option value="${id}" ${id===(d.trainingPreferences?.cardioMode||selectedPrescription().ids[1])?'selected':''}>${esc(catalog[id].name)}</option>`).join('')}</select></label><button data-apply-cardio>应用今天的心肺方式</button></section>`;if(!goalRules[state.profile.goal])return '';const prefs=d.trainingPreferences||{};return `<section class="card"><h3>这一天想怎么练？</h3><p>只调整 ${workoutDateKey()}，其他日期保持各自安排。部位专项只安排该部位；力量专项安排主项及相关辅助。其他动作可在下方手动添加。已记录的动作和组会保留。</p><div class="library-filters"><label>当天训练部位<select id="daily-focus">${focusOptions().map(([v,label])=>`<option value="${v}" ${validDailyFocus(prefs.muscleFocus,workoutDate())===v?'selected':''}>${label}</option>`).join('')}</select></label><label>希望的力量动作数量<select id="daily-count"><option value="auto">自动推荐</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${String(prefs.exerciseCount)===String(i+1)?'selected':''}>${i+1} 个动作</option>`).join('')}</select></label></div><label id="back-emphasis-field" ${prefs.muscleFocus==='back'&&detailedBackAvailable()?'':'hidden'}>背部训练侧重<select id="daily-back-emphasis">${[['auto','自动交替：背阔肌 / 上背'],['lat','背阔肌侧重'],['upper','中下斜方肌与上背侧重']].map(([value,label])=>`<option value="${value}" ${value===(prefs.backEmphasis||'auto')?'selected':''}>${label}</option>`).join('')}</select></label><button class="primary" data-apply-daily>应用到这一天的训练</button><p id="daily-feedback" class="muted">${esc(selectedPrescription().preferenceNote||'实际数量受时长、经验、近期容量和器械影响')} 可增加其他部位或手动调整，不要求练满可用时间。</p></section>`;}
function applyDailyPreferences(focus,count,backEmphasis='auto'){if(isPast())return false;if(!focusOptions().some(([key])=>key===focus)||!(count==='auto'||Number.isInteger(Number(count))&&Number(count)>=1&&Number(count)<=12))return false;const d=workoutDay();delete d.manualOrder;d.trainingPreferences={...d.trainingPreferences,muscleFocus:focus,exerciseCount:String(count),backEmphasis:['auto','lat','upper'].includes(backEmphasis)?backEmphasis:'auto'};const plan=selectedPrescription();const recorded=Object.keys(d.logs||{}).filter(id=>catalog[id]&&d.logs[id].length);d.exerciseIds=[...new Set([...plan.ids,...recorded])];d.workoutTitle=plan.title;d.specialtyMain=plan.specialtyMain||null;d.cycle=plan.cycle;d.sessionEntries=plan.entries;save();render();return true;}

function basePrescription(at=new Date()){
 const p=state.profile;if(p.goal==='提升心肺与耐力')return cardioPlan(at);
 if(p.goal==='灵活性与日常活动能力'){const time=Number(p.minutes)||15;const count=time<15?4:time<30?5:7;const ids=['thoracic','shoulderMob','hipmob','ankle','hamStretch','hipFlexor','calfStretch'].slice(0,count);return {title:'全身活动度 · 动态控制与伸展',ids,durations:Object.fromEntries(ids.map(id=>[id,2])),sets:2,estimated:ids.length*2,note:'动态活动每侧 6–8 次；静态伸展每侧 20–30 秒，默认各 2 组。覆盖上肢、脊柱、髋、腿与踝；不要求把可用时间练满。'};}
 let plan=strengthPrescription(at);const rule=goalRules[p.goal];if(!rule)return plan;
 const time=Number(p.minutes)||15,shortGoal=['建立运动习惯','保持健康与精力'].includes(p.goal),mixed=['减脂与体重管理','保持健康与精力'].includes(p.goal);
 const countLimit=Math.min(requestedCount()||12,shortGoal?3:p.experience==='初学者'?5:12);
 const sessionBudget=shortGoal?Math.min(time,30):time;
 let strengthBudget=sessionBudget;
 const cardioDuration=mixed&&p.muscleFocus==='balanced'&&time>=20?Math.min(20,Math.max(5,Math.floor(sessionBudget*.3))):0;strengthBudget-=cardioDuration;
 let estimated=Math.min(5,Math.max(1,strengthBudget*.2));const selected=[],entries=[];
 for(const id of plan.ids){if(selected.length>=countLimit)break;let target=state.exerciseTargets?.[id]||plan.targets?.[id]||(plan.specialtyMain&&id!==plan.specialtyMain?{sets:3,min:8,max:12}:defaultExerciseTarget(id));if(!state.exerciseTargets?.[id]&&!plan.targets?.[id]&&p.experience!=='有规律训练经验')target={...target,sets:Math.min(target.sets,3)};const rest=p.goal==='提升力量'?(plan.specialtyMain?(id===plan.specialtyMain?rule.rest:plan.entries.find(e=>e.id===id)?.rest||90):(strengthMainIds.has(id)?rule.rest:90)):(plan.entries?.find(e=>e.id===id)?.rest||rule.rest);const cost=(target.sets*35+(target.sets-1)*rest+60)/60;if(plan.specialtyMain===id&&estimated+cost>strengthBudget){selected.push(id);entries.push({id,sets:target.sets,rest,label:plan.entries.find(e=>e.id===id)?.label||catalog[id].muscle});estimated=strengthBudget;break;}if(estimated+cost>strengthBudget&&selected.length>0)break;if(estimated+cost>strengthBudget)continue;selected.push(id);estimated+=cost;entries.push({id,sets:target.sets,rest,label:plan.entries?.find(e=>e.id===id)?.label||catalog[id].muscle,role:plan.entries?.find(e=>e.id===id)?.role||catalog[id].powerRole});}
 if(!selected.length&&time>=10&&plan.ids.length){const id=plan.ids[0];selected.push(id);entries.push({id,sets:rule.sets,rest:rule.rest,label:catalog[id].muscle});estimated=Math.min(time,8);}
 const durations={};if(cardioDuration){const id=cardioPlan().ids[1];selected.push(id);durations[id]=cardioDuration;estimated+=cardioDuration;}
 return {...plan,title:p.goal==='建立运动习惯'?'习惯起步 · 短时基础':p.goal==='保持健康与精力'?'健康活动 · 力量与有氧':p.goal==='减脂与体重管理'?'体重管理 · 力量与有氧':p.goal==='提升力量'?plan.title+' · 力量重点':plan.title+' · 增肌重点',ids:selected,entries,targets:plan.specialtyMain?Object.fromEntries(selected.map(id=>[id,state.exerciseTargets?.[id]||(id===plan.specialtyMain?defaultExerciseTarget(id):{sets:3,min:8,max:12})])):plan.targets,sets:rule.sets,durations:Object.keys(durations).length?durations:undefined,estimated:Math.ceil(estimated),note:[rule.note,plan.note].filter(Boolean).join(' '),selectionInfo:plan.ids.length<6?'器械与当前训练分配限制了候选动作；请核对已勾选的器械。':selected.filter(id=>catalog[id].kind!=='cardio').length<plan.ids.length?'已按经验上限或组间休息预算缩减动作。':'已按当前器械、经验和时间预算选择动作。'};
}
function liftDaySession(at=new Date()){const focus=state.profile.muscleFocus,gear=selectedEquipment();const definitions={deadlift_day:{main:['deadlift','barRdl','rdl','hinge'],aux:[{label:'腿后侧 · 屈膝辅助',options:['legcurl']},{label:'臀部 · 锁定阶段辅助',options:['barhip','hipthrust','bridge']},{label:'上背稳定',options:['chestsupported','cablerow','row','bandrow','proneW']},{label:'髋铰链辅助',options:['rdl','barRdl','hinge']},{label:'核心稳定',options:['pallof','bandpallof','deadbug','bird']}]},squat_day:{main:['barsquat','goblet','squat'],aux:[{label:'单腿稳定',options:['splitSquat','bulgarian','lunge']},{label:'膝伸辅助',options:['legpress','legextension']},{label:'后侧链辅助',options:['legcurl','rdl','hinge']},{label:'核心稳定',options:['pallof','bandpallof','deadbug','bird']}]},bench_day:{main:['bench','dbbench','dbpress','push'],aux:[{label:'胸部辅助',options:['incline','chestmachine','pushup']},{label:'肘伸 · 三头辅助',options:['triceps','ropepush','dbtriceps','closepush']},{label:'上背与肩胛稳定',options:['chestsupported','cablerow','row','proneW']},{label:'核心稳定',options:['pallof','bandpallof','deadbug','bird']},{label:'肩后侧辅助',options:['facepull','reversefly']}]}};const definition=definitions[focus],main=experienceOptions(definition.main).find(id=>supports(id,gear));const entries=main?[{id:main,label:'主项 · '+catalog[main].name,rest:180,role:'main'}]:[],used=new Set(main?[main]:[]);const technique=focus==='bench_day'?(cycleContext(at).exposure%2?'tempobench':'pausebench'):focus==='squat_day'?(cycleContext(at).exposure%2?'temposquat':'pausesquat'):'pausedeadlift';if(main===definition.main[0]&&supports(technique)){entries.push({id:technique,label:catalog[technique].purpose+' · 技术辅助',rest:150,role:'technique'});used.add(technique);}for(const slot of definition.aux){if(slot.label==='髋铰链辅助'&&(used.has(technique)||['barRdl','rdl','hinge'].includes(main)))continue;const id=experienceOptions(slot.options).find(id=>supports(id,gear)&&!used.has(id));if(id){entries.push({id,label:slot.label,rest:slot.label==='髋铰链辅助'?120:90,role:catalog[id].muscle==='核心'?'control':'assistance'});used.add(id);}}const count=requestedCount()||6;const selected=entries.slice(0,state.profile.experience==='初学者'?Math.min(count,5):count);return {title:liftDayNames[focus]+(main!==definition.main[0]?' · 基础替代':''),ids:selected.map(e=>e.id),entries:selected,sets:4,specialtyMain:main,powerlifting:true,note:'主项 → 轻负重技术变式 → 相关辅助与核心稳定。暂停/节奏变式从较轻负重开始，不沿用主项重量；只安排一种技术变式，不追求力竭。'+(main!==definition.main[0]?'当前器械或经验不满足原主项要求，已显示可用的基础替代动作。':'')};}
function relevantEarlierDays(at){const date=at.toLocaleDateString('en-CA'),future=date>dateKey(),days=[];for(const [key,d] of Object.entries(state.history)){if(key<date)days.push({date:key,record:d,planned:false});}if(future){for(const [key,d] of Object.entries(state.plannedWorkouts||{})){if(key>=dateKey()&&key<date&&!actualWork(state.history[key]||{}))days.push({date:key,record:d,planned:true});}}return days;}
function actualWork(d){return Object.values(d.logs||{}).some(logs=>logs.length>0);}
function specialtyExposure(at,focus){const mains={deadlift_day:['deadlift','barRdl','rdl','hinge'],squat_day:['barsquat','goblet','squat'],bench_day:['bench','dbbench','dbpress','push']};return relevantEarlierDays(at).filter(({record:d,planned})=>d.trainingPreferences?.muscleFocus===focus&&(planned||(d.specialtyMain?[d.specialtyMain]:mains[focus]||[]).some(id=>d.logs?.[id]?.length>0))).length;}
function recentMuscleVolume(at){const volume={};for(const {date,record:d,planned} of relevantEarlierDays(at)){const gap=dayIndex(at)-dayIndex(date);if(gap>7||gap<=0)continue;const ids=planned?d.exerciseIds||[]:Object.keys(d.logs||{});for(const id of ids){if(!catalog[id]||catalog[id].kind==='cardio')continue;const n=planned?(d.targets?.[id]?.sets||4):(d.logs[id]?.length||0);volume[catalog[id].muscle]=(volume[catalog[id].muscle]||0)+n;}}return volume;}
const chestPressIds=new Set(['bench','dbbench','dbpress','incline','inclinebar','smithbench','chestmachine','pushup','push']);
for(const variant of exerciseVariants)if(chestPressIds.has(variant.variantOf))chestPressIds.add(variant.id);
function shoulderContext(at){let exposure=0,chestSets=0;for(const {date,record:d,planned} of relevantEarlierDays(at)){if(d.trainingPreferences?.muscleFocus==='shoulders'&&(planned||actualWork(d)))exposure++;if(dayIndex(at)-dayIndex(date)>7)continue;for(const id of chestPressIds){chestSets+=planned&&d.exerciseIds?.includes(id)?d.targets?.[id]?.sets||4:d.logs?.[id]?.length||0;}}return {variant:exposure%2?'B':'A',chestSets,forecast:at.toLocaleDateString('en-CA')>dateKey()};}
function shoulderSession(at){const context=shoulderContext(at),beginner=state.profile.experience==='初学者',sets=beginner?2:3;const push={label:'前束 · 肩推',options:['shoulderpress','shouldermachine','barohp'],target:{sets,min:6,max:10},rest:120},side={label:'侧束 · 外展',options:['lateral','cablelateral'],target:{sets,min:10,max:20},rest:90},rear={label:'后束 · 水平外展',options:['reversefly','rearpec','facepull'],target:{sets,min:10,max:20},rest:90};const slots=context.variant==='A'?[...(context.chestSets<6?[push]:[]),side,rear]:[side,rear,...(context.chestSets<6?[{...push,target:{sets:beginner?1:2,min:8,max:12}}]:[])];const limit=requestedCount()||3,entries=[],targets={};for(const slot of slots){const id=experienceOptions(slot.options).find(id=>supports(id));if(!id||entries.length>=limit)continue;entries.push({id,label:slot.label,rest:slot.rest,sets:slot.target.sets});targets[id]=slot.target;}if(!entries.length&&supports('wallslide')){entries.push({id:'wallslide',label:'无器械 · 肩部控制基础',rest:60,sets:2});targets.wallslide={sets:2,min:8,max:12};}return {title:'肩部专项 · '+context.variant+' 日',ids:entries.map(e=>e.id),entries,targets,sets,shoulderSession:context.variant,note:'A 日肩推 → 侧束 → 后束；B 日侧束 → 后束优先。'+(context.chestSets>=6?'近 7 天'+(context.forecast?'实际及未来预计':'实际完成')+'胸部推举达 '+context.chestSets+' 组，本日不再追加肩推。':context.variant==='B'?'近期纳入判断的胸部推举较少，可保留少量肩推。':'')+' 默认每个侧/后束动作 10–20 次，不叠加多个同类动作凑数量。器械不足时仅显示可完成项目；无器械肩部控制不等同于负重增肌课。'};}
function detailedBackAvailable(at=workoutDate()){return !beginnerExperience()&&state.profile.experience==='有规律训练经验'&&state.profile.trainingRecency!=='停练后重新开始'&&cycleContext(at).session!=='回归适应';}
function backSession(at){
 const p=state.profile,level=p.experience,beginner=level==='初学者',split=p.split||'auto';if(!detailedBackAvailable(at)){const ids=[...new Set(experienceOptions(['pulldown','chestsupported','cablerow','row','bandrow','proneW']))].filter(id=>supports(id));const selected=ids.slice(0,Math.min(requestedCount()||4,5));return {title:'背部专项 · 基础练习',ids:selected,sets:3,entries:selected.map(id=>({id,rest:90,label:'背部 · 基础拉力练习',role:'assistance'})),note:'基础垂直拉与水平拉，优先稳定支撑、可控负重与恢复，不细分握距或区域重点。'};}
 const spacing=split==='ppl'?3:split==='upperlower'||split==='auto'&&Number(p.days)>3?2:1;
 const ordinal=Math.floor(trainingOrdinal(at)/spacing);
 const earlier=relevantEarlierDays(at).filter(({record:d,planned})=>(planned?(d.exerciseIds||[]):Object.keys(d.logs||{}).filter(id=>d.logs[id].length)).some(id=>catalog[id]?.muscle==='背部')).length;
 const emphasis=p.backEmphasis==='lat'||p.backEmphasis==='upper'?p.backEmphasis:Math.max(ordinal,earlier)%2?'upper':'lat';
 const pools=emphasis==='lat'?[beginner?'pulldown':'pulldownNeutral','cablerow','pulldownWide','straightpull','cablerowSingle','chestsupported','bandrow','proneW']:['cablerowWide','chestsupportedWide','proneY','barrow','cablerow','pulldownWide','bandrow','proneW'];
 const ids=[...new Set(experienceOptions(pools))].filter(id=>supports(id));
 const limit=requestedCount()||Math.min(6,Math.max(1,Math.floor(Number(p.minutes)/10)));
 const selected=ids.slice(0,beginner?Math.min(5,limit):limit),targets={};
 for(const id of selected){const control=id==='proneY'||id==='proneW';targets[id]=control?{sets:2,min:10,max:15}:undefined;}
 for(const id of Object.keys(targets))if(!targets[id])delete targets[id];
 return {title:'背部专项 · '+(emphasis==='lat'?'背阔肌侧重':'上背与肩胛控制'),ids:selected,sets:4,targets,backEmphasis:emphasis,entries:selected.map((id,index)=>({id,rest:['proneY','proneW'].includes(id)?60:120,label:catalog[id].trainingFocus||'背部 · 拉力练习',role:['proneY','proneW'].includes(id)?'control':index===0?'main':'assistance'})),note:(p.backEmphasis==='lat'||p.backEmphasis==='upper'?'按当天选择安排。':'自动交替背阔肌侧重与上背/肩胛控制侧重。')+'同日可安排不同握法和路径的变体；宽握下拉仍训练背阔肌与大圆肌，不等于专练小圆肌。中斜方肌与菱形肌以可控划船侧重，下斜方肌加入 Y 字控制练习。推荐组数结合近期整个背部容量，不因增加变体而重复加量。'};
}
function isolatedSession(at){if(state.profile.muscleFocus==='back')return backSession(at);if(state.profile.muscleFocus==='shoulders')return shoulderSession(at);const focus=state.profile.muscleFocus,muscles=focus==='arms'?['肱二头肌','肱三头肌']:[focusMuscles[focus]];const gear=selectedEquipment();let ids=muscles.flatMap(m=>{const preferred={背部:['pulldown','pullup','assistpull','chestsupported','cablerow','machinerow','row','barrow','straightpull','bandrow','proneW'],胸部:['bench','incline','fly','dbbench','chestmachine','pecdeck','smithbench','dbfly','dbpress','pushup','push'],肱二头肌:['curl','hammer','cablecurl','preacher','altcurl','inclinecurl','concentration','barcurl','ropehammer','dbpreacher'],肱三头肌:['triceps','overheadtriceps','skullcrusher','ropepush','cableoverhead','closebench','dbtriceps','closepush']};const strengthPreferred={胸部:['bench',cycleContext(at).exposure%2?'tempobench':'pausebench','dbbench','incline','chestmachine','dbpress','pushup','push'],股四头肌:['barsquat',cycleContext(at).exposure%2?'temposquat':'pausesquat','splitSquat','goblet','legpress','squat'],腘绳肌:['deadlift','pausedeadlift','barRdl','rdl','legcurl','hinge'],核心:['pallof','bandpallof','deadbug','bird']};if(m==='背部'&&state.profile.experience==='有规律训练经验')preferred[m]=[cycleContext(at).exposure%2?'pulldownNeutral':'pulldownWide','cablerow','cablerowWide',...preferred[m]];const primary=(state.profile.goal==='提升力量'?strengthPreferred[m]:null)||preferred[m]||groupChoices[m]||[];return experienceOptions([...new Set([...primary,...Object.keys(catalog).filter(id=>catalog[id].muscle===m&&catalog[id].kind!=='cardio'&&(!catalog[id].advanced||state.profile.goal==='提升力量'&&primary.includes(id)))])]).filter(id=>supports(id,gear));});if(focus==='back'&&ids.some(id=>recordingMode(id)==='weighted'||['pullup','bandrow'].includes(id)))ids=ids.filter(id=>id!=='proneW');if(focus==='chest'){const weighted=ids.some(id=>recordingMode(id)==='weighted');ids=ids.filter(id=>weighted?!['push','pushup'].includes(id):id!==(state.profile.experience==='初学者'?'pushup':'push'));}if(focus==='arms'){const a=ids.filter(id=>catalog[id].muscle==='肱二头肌'),b=ids.filter(id=>catalog[id].muscle==='肱三头肌');ids=Array.from({length:Math.max(a.length,b.length)},(_,i)=>[a[i],b[i]]).flat().filter(Boolean);}if(focus==='back'){const vertical=ids.find(id=>['pulldown','pullup','assistpull'].includes(catalog[id]?.variantOf||id)),horizontal=ids.find(id=>['chestsupported','cablerow','machinerow','row','barrow','bandrow'].includes(catalog[id]?.variantOf||id));ids=[...new Set([vertical,horizontal,...ids].filter(Boolean))];}const limit=requestedCount()||Math.min(6,Math.max(1,Math.floor(Number(state.profile.minutes)/10)));ids=ids.slice(0,state.profile.experience==='初学者'?Math.min(limit,5):limit);return {title:focusMuscles[focus]+'专项',ids,sets:4,entries:ids.map((id,index)=>({id,rest:strengthMainIds.has(id)?120:90,label:catalog[id].purpose||catalog[id].muscle+' · 专项动作',role:state.profile.goal==='提升力量'?(index===0?'main':catalog[id].powerRole||'assistance'):undefined}))};}
function strengthPrescription(at=new Date()){if(state.profile.goal==='提升心肺与耐力')return cardioPlan(at);const p=state.profile;if(p.goal==='提升力量'&&liftDayNames[p.muscleFocus])return liftDaySession(at);if(focusMuscles[p.muscleFocus])return isolatedSession(at);const gear=selectedEquipment(p),days=p.scheduleMode==='cycle'?7*Number(p.trainDays)/(Number(p.trainDays)+Number(p.restDays)):p.scheduleMode==='weekly'?weeklyDays().length:Number(p.days)||3;const ordinal=trainingOrdinal(at);let groups,title;if(p.split==='full'||((!p.split||p.split==='auto')&&days<=3)){groups=['胸部','背部','股四头肌','腘绳肌','臀部','核心','肩部','肱二头肌','肱三头肌','小腿'];title='全身力量';}else if(p.split==='upperlower'||((!p.split||p.split==='auto')&&days<=4)){groups=ordinal%2===0?['胸部','背部','肩部','肱二头肌','肱三头肌']:['股四头肌','腘绳肌','臀部','小腿','核心'];title=ordinal%2===0?'上肢力量':'下肢 + 核心';}else{const splits=[['胸部','肩部','肱三头肌','核心'],['背部','肱二头肌','肩部','核心'],['股四头肌','腘绳肌','臀部','小腿','核心']];groups=splits[ordinal%3];title=['推 · 胸肩三头','拉 · 背部二头','腿 · 臀腿核心'][ordinal%3];}const minutes=Number(p.minutes)||15;const limit=requestedCount()||(minutes<30?2:minutes<45?4:minutes<=60?6:minutes<=90?8:10);if(title==='全身力量')groups=fullBodySlots(at).map(slot=>catalog[slot.options[0]].muscle);const template=templateSession(title,gear,minutes,limit,at);if(template?.ids.length)return template;const fallbackSlots=powerliftingSlots(groups.map(group=>({label:group,options:[...groupChoices[group]],rest:90})),at).slice(0,limit),entries=[],used=new Set();for(const slot of fallbackSlots){const options=[...slot.options],exposure=cycleContext(at).exposure;if(exposure%2&&p.goal&&['有一些经验 / 重新开始','有规律训练经验'].includes(p.experience)&&!(p.goal==='提升力量'&&slot.options.includes('bench')))options.push(options.shift());let id=experienceOptions(options).find(id=>supports(id,gear)&&!used.has(id));if(!id)continue;const preferred=state.exerciseReplacements?.[id];if(preferred&&replacementFamily(id)?.ids.includes(preferred)&&supports(preferred,gear)&&!used.has(preferred))id=preferred;used.add(id);entries.push({id,label:slot.label,rest:slot.rest,role:slot.role});}return {ids:entries.map(e=>e.id),entries,sets:4,title,powerlifting:p.goal==='提升力量'};}


function equipmentSummary(){return selectedEquipment().join('、')||'徒手训练';}
function equipmentMarkup(place,selected=[]){return equipmentOptions(place).map(item=>`<label class="equipment-choice"><input type="checkbox" name="equipment" value="${esc(item)}" ${selected.includes(item)?'checked':''}><span>${esc(item)}</span></label>`).join('');}
function refreshEquipment(place,selected=[]){document.querySelector('#equipment-options').innerHTML=equipmentMarkup(place,selected);document.querySelector('#equipment-note').innerHTML='健身房默认勾选常见器械，可按实际条件增减；家中和户外默认徒手。新设备已可记录；动作库覆盖主要肌群，计划只选用你具备器械的动作。杠铃硬拉仅供有规律训练经验且具备杠铃、合适杠铃片及获准落杠空间的用户；硬拉台不是必需设备，请先核对场地条件。';}

function previous(id){return Object.entries(state.history).filter(([day,d])=>day<workoutDateKey()&&d.logs?.[id]?.length).sort(([a],[b])=>b.localeCompare(a))[0];}
function hasWorkoutProgress(d){return Object.values(d.logs||{}).some(logs=>logs.length);}
function budgetExplanation(plan){const minutes=Number(plan.adjustment?.minutes||state.profile.minutes)||15;if(!plan.ids?.length)return '今天无需训练，可选择恢复安排。';if(state.profile.goal==='灵活性与日常活动能力')return `可用 ${minutes} 分钟是上限；本课按活动范围与控制练习推荐量安排约 ${plan.estimated} 分钟，无需长时间重复拉伸。`;if(state.profile.goal==='提升心肺与耐力')return `可用 ${minutes} 分钟是上限；时长结合 ${state.profile.experience}、每周训练频率和同一心肺方式的完成记录推荐，可逐步调整目标。`;return `可用 ${minutes} 分钟是上限；动作和组数结合经验、近期训练容量及恢复安排，不重复动作来填满时间。`;}
function sessionSummary(ids,d,plan){if(ids.length&&ids.every(id=>catalog[id].kind==='cardio')&&ids.every(id=>catalog[id].muscle==='活动度'))return `<div class="card"><h3>活动度专项</h3><p>覆盖肩、胸椎、髋、腿与踝 · 按组练习，记录每侧次数或保持秒数。</p></div>`;if(ids.length&&ids.every(id=>catalog[id].kind==='cardio'))return `<div class="card"><p class="eyebrow">CARDIO SESSION</p><p>热身 → 稳态心肺 → 放松 · 建议共 ${ids.reduce((sum,id)=>sum+cardioTarget(id,d),0)} 分钟</p><p>可用时间是上限，不自动要求 120 分钟有氧。先建立可持续时长，再根据恢复逐步调整。出现胸痛、眩晕或异常气促时停止。</p></div>`;const volume={};for(const id of ids){if(catalog[id].kind==='cardio')continue;const muscle=catalog[id].muscle;volume[muscle] ||= {moves:0,sets:0};volume[muscle].moves++;volume[muscle].sets+=exerciseTarget(id,d).sets;}const maxSingle=state.profile.experience==='初学者'?6:10,maxWeekly=state.profile.experience==='初学者'?12:20,recent=recentMuscleVolume(workoutDate());const warnings=Object.entries(volume).filter(([muscle,v])=>v.sets>maxSingle||v.sets+(recent[muscle]||0)>maxWeekly).map(([muscle])=>muscle);return `<div class="card"><p class="eyebrow">SESSION STRUCTURE</p>${warnings.length?`<p class="notice">${esc(warnings.join('、'))}的手动安排超过自动推荐容量范围。已保留你的设置，请结合近期训练与恢复调整。</p>`:''}<p>${Object.entries(volume).map(([muscle,v])=>`${esc(muscle)} ${v.moves} 动作 / ${v.sets} 组`).join(' · ')}</p><p class="muted">${plan.estimated&&!d.exerciseIds?`预计约 ${plan.estimated} 分钟（含约 10 分钟热身及组间休息）。`:''}组数为直接训练组数，复合动作还会间接训练其他肌群。按训练表现调整，不要求把时间练满。</p>${Number(state.profile.minutes)>=90?'<p class="muted">可用时间是上限。动作数量受时间、近期容量和训练目的影响，不重复动作来填满时长。</p>':''}</div>`;}
function displayedWorkoutIds(d,plan){return d.manualOrder||d.trainingPreferences?.muscleFocus==='shoulders'?[...(d.exerciseIds||plan.ids)]:orderWorkoutIds(d.exerciseIds||plan.ids,d.trainingPreferences,d.sessionEntries||plan.entries||[]);}
function currentWorkoutIds(){return displayedWorkoutIds(workoutDay(),selectedPrescription());}
function orderControls(id){const ids=currentWorkoutIds(),index=ids.indexOf(id);return `<div class="exercise-order"><span>第 ${index+1} 个动作</span><button data-move-up="${id}" aria-label="上移${esc(catalog[id].name)}" ${index<=0?'disabled':''}>↑ 上移</button><button data-move-down="${id}" aria-label="下移${esc(catalog[id].name)}" ${index===ids.length-1?'disabled':''}>↓ 下移</button></div>`;}
function moveWorkoutExercise(id,step){if(isPast())return false;if(![-1,1].includes(step))return false;const ids=currentWorkoutIds(),from=ids.indexOf(id),to=from+step;if(from<0||to<0||to>=ids.length)return false;[ids[from],ids[to]]=[ids[to],ids[from]];const d=workoutDay();d.manualOrder=true;saveWorkoutSelection(ids);render();return true;}

function saveWorkoutSelection(ids){if(isPast())return false;const d=workoutDay(),p=selectedPrescription();d.exerciseIds=[...ids];d.workoutTitle ||= p.title;d.cycle ||= p.cycle;d.specialtyMain ||= p.specialtyMain;d.sessionEntries ||= p.entries;return save();}
function addWorkoutExercise(id){if(!catalog[id]||!supports(id,workoutEquipment())||currentWorkoutIds().includes(id))return false;return saveWorkoutSelection([...currentWorkoutIds(),id]);}
function removeWorkoutExercise(id){const ids=currentWorkoutIds();if(!ids.includes(id))return false;return saveWorkoutSelection(ids.filter(other=>other!==id));}
let addMuscle='胸部';
function availableAdditions(){return Object.keys(catalog).filter(id=>supports(id,workoutEquipment())&&!currentWorkoutIds().includes(id));}
// Substitutions preserve the primary target and movement purpose, not just a broad body part.
const replacementFamilies=[
 {label:'胸大肌 · 水平推',ids:['bench','dbbench','dbpress','smithbench','chestmachine','pushup','push']},
 {label:'胸大肌锁骨部 · 上斜推',ids:['incline','inclinebar']},
 {label:'胸大肌 · 孤立水平内收',ids:['fly','pecdeck','dbfly','bandfly']},
 {label:'背阔肌 · 垂直拉',ids:['pulldown','pullup','assistpull']},
 {label:'背阔肌与上背 · 水平拉',ids:['row','barrow','chestsupported','cablerow','machinerow','bandrow']},
 {label:'背阔肌 · 直臂肩伸',ids:['straightpull']},
 {label:'肩胛稳定 · 控制练习',ids:['proneW']},
 {label:'三角肌前束为主 · 肩推',ids:['shoulderpress','barohp','shouldermachine']},
 {label:'三角肌中束 · 肩外展',ids:['lateral','cablelateral']},
 {label:'三角肌后束 · 后侧辅助',ids:['reversefly','rearpec','facepull']},
 {label:'肩部活动控制 · 滑臂',ids:['wallslide']},
 {label:'肱二头肌 · 常规弯举',ids:['curl','altcurl','barcurl','cablecurl','bandcurl','selfcurl','preacher','dbpreacher','inclinecurl','concentration']},
 {label:'肱肌与肱桡肌 · 中立握弯举',ids:['hammer','ropehammer']},
 {label:'肱三头肌 · 下压与后伸',ids:['triceps','ropepush','bandtriceps','dbtriceps']},
 {label:'肱三头肌长头侧重 · 臂屈伸',ids:['overheadtriceps','cableoverhead','skullcrusher']},
 {label:'肱三头肌 · 复合推',ids:['closebench','closepush']},
 {label:'股四头肌为主 · 双侧蹲与腿举',ids:['squat','goblet','barsquat','frontsquat','legpress','hack','smithsquat']},
 {label:'股四头肌与臀部 · 单侧蹲',ids:['lunge','bulgarian','splitSquat']},
 {label:'股四头肌 · 孤立伸膝',ids:['legextension']},
 {label:'腘绳肌与臀部 · 髋铰链',ids:['rdl','barRdl','hinge']},
 {label:'后侧链 · 硬拉主项',ids:['deadlift']},
 {label:'腘绳肌 · 孤立屈膝',ids:['legcurl']},
 {label:'臀大肌 · 桥式髋伸',ids:['bridge','hipthrust','barhip']},
 {label:'臀大肌 · 孤立髋伸',ids:['cablekick']},
 {label:'臀中肌与臀小肌 · 髋外展',ids:['abduction']},
 {label:'腓肠肌为主 · 直膝提踵',ids:['calf','dbcalf']},
 {label:'比目鱼肌侧重 · 屈膝提踵',ids:['seatedcalf']},
 {label:'腹直肌 · 躯干屈曲',ids:['crunch','cablecrunch','reversecrunch']},
 {label:'核心 · 抗伸展控制',ids:['deadbug']},
 {label:'核心 · 四点支撑稳定',ids:['bird']},
 {label:'核心 · 抗旋转',ids:['pallof','bandpallof']},
 {label:'卧推 · 暂停技术',ids:['pausebench']},
 {label:'卧推 · 节奏技术',ids:['tempobench']},
 {label:'深蹲 · 暂停技术',ids:['pausesquat']},
 {label:'深蹲 · 节奏技术',ids:['temposquat']},
 {label:'硬拉 · 离地暂停技术',ids:['pausedeadlift']},
 {label:'心肺 · 稳态有氧',ids:['briskwalk','march','treadmill','bike','elliptical','rowing']}
];
for(const variant of exerciseVariants){if(['reversecurl','reversecablecurl','flyLow','flyHigh','legpressHigh'].includes(variant.id))continue;const family=replacementFamilies.find(f=>f.ids.includes(variant.variantOf));if(family)family.ids.push(variant.id);}
replacementFamilies.push({label:'肱桡肌与肱肌 · 反握弯举',ids:['reversecurl','reversecablecurl']},{label:'胸大肌锁骨部 · 斜向孤立内收',ids:['flyLow']},{label:'胸大肌胸肋部 · 斜向孤立内收',ids:['flyHigh']},{label:'臀部侧重 · 腿举',ids:['legpressHigh']},{label:'下斜方肌侧重 · 肩胛控制',ids:['proneY']});
function replacementFamily(id){return replacementFamilies.find(family=>family.ids.includes(id));}
function replacementLabel(id){return replacementFamily(id)?.label||catalog[id]?.name||'目标动作';}
function replacementOptions(id){const ids=workoutDay().exerciseIds||selectedPrescription().ids;const candidates=replacementFamily(id)?.ids||[];return candidates.filter(other=>other!==id&&catalog[other].muscle===catalog[id]?.muscle&&supports(other,workoutEquipment())&&!ids.includes(other));}
function replaceExercise(oldId,newId,remember=false){if(isPast())return false;const d=workoutDay(),p=selectedPrescription(),ids=d.exerciseIds||p.ids;if(!ids.includes(oldId)||!replacementOptions(oldId).includes(newId))return false;const oldTarget=exerciseTarget(oldId,d);d.exerciseIds=ids.map(id=>id===oldId?newId:id);d.sessionEntries=(d.sessionEntries||p.entries||[]).map(entry=>entry.id===oldId?{...entry,id:newId}:entry);if(d.specialtyMain===oldId||p.specialtyMain===oldId)d.specialtyMain=newId;d.workoutTitle ||= p.title;d.targets ||= {};d.targets[newId] ||= {...oldTarget};if(catalog[newId].kind==='cardio'){d.cardioTargets ||= {};d.cardioTargets[newId] ||= cardioTarget(oldId,d);}if(remember&&!isPreview()){state.exerciseReplacements ||= {};state.exerciseReplacements[oldId]=newId;}return save();}
function exerciseTarget(id,d=workoutDay()){if(isHistoricalRecord(d)&&!d.targets?.[id])return legacyTarget(id,d);return d.targets?.[id]||(d.targetSets?{sets:d.targetSets,min:8,max:12}:state.exerciseTargets?.[id]||selectedPrescription().targets?.[id]||defaultExerciseTarget(id));}
function setExerciseTarget(id,sets,min,max){if(isPast())return false;if(!Number.isInteger(sets)||sets<1||sets>10||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>100||min>max)return false;const target={sets,min,max};workoutDay().targets ||= {};workoutDay().targets[id]=target;if(!isPreview()){state.exerciseTargets ||= {};state.exerciseTargets[id]=target;}return save();}
function resetExerciseTarget(id){if(isPast())return false;const d=workoutDay();snapshotWorkoutTargets(d,selectedPrescription());delete d.targetSets;delete d.targets?.[id];if(!isPreview())delete state.exerciseTargets?.[id];return save();}
// Stored mass is always kilograms. Display preference never rewrites historical mass.

function preferredMassUnit(){return state.profile.massUnit==='lb'?'lb':'kg';}
function massFromKg(value,unit=preferredMassUnit()){return fromKilograms(value,unit);}
function massToKg(value,unit=preferredMassUnit()){return toKilograms(value,unit);}
function massInput(value,unit=preferredMassUnit()){return value===''||value==null?'':Number(massFromKg(value,unit).toFixed(2));}
function formatMass(value){return `${massInput(value)} ${preferredMassUnit()}`;}
function setupMassFields(){const unit=setup.elements.namedItem('massUnit')?.value==='lb'?'lb':'kg',label=document.querySelector('#setup-bodyweight-label'),field=setup.elements.namedItem('bodyweight');if(label)label.textContent=`当前体重 ${unit}（可选）`;if(field){field.min=massInput(10,unit);field.max=massInput(500,unit);}}
function changeSetupMassUnit(){const field=setup.elements.namedItem('bodyweight'),unit=setup.elements.namedItem('massUnit').value==='lb'?'lb':'kg';if(field?.value?.trim()){const old=field.dataset?.massUnit||preferredMassUnit(),kg=field.dataset?.massKg!==undefined?Number(field.dataset.massKg):massToKg(Number(field.value),old);field.value=massInput(kg,unit);if(field.dataset)field.dataset.massKg=String(kg);}if(field?.dataset)field.dataset.massUnit=unit;setupMassFields();}
const singleDumbbellIds=new Set(['row','concentration','dbpreacher','goblet','hipthrust','dbcalf','overheadtriceps']);
for(const variant of exerciseVariants)if(singleDumbbellIds.has(variant.variantOf))singleDumbbellIds.add(variant.id);
function usesDumbbells(id){return catalog[id]?.gear==='哑铃'||catalog[id]?.requirements?.includes('哑铃');}
function weightLabel(id){return id==='assistpull'?`辅助重量 ${preferredMassUnit()}（越大越容易）`:usesDumbbells(id)?`单只哑铃重量 ${preferredMassUnit()}（${singleDumbbellIds.has(id)?'使用 1 只':'使用 2 只'}）`:`实际负重 ${preferredMassUnit()}（含杠铃 / 器械空载）`;}
function weightUnit(id){return usesDumbbells(id)?'per-dumbbell':'total';}
function logVolume(id,l){if(l.minutes||l.mobilitySets||!Number.isFinite(l.weight)||!Number.isFinite(l.reps))return 0;return l.weight*l.reps*(l.weightUnit==='per-dumbbell'?(singleDumbbellIds.has(id)?1:2)*(catalog[id]?.perSide?2:1):l.recordedSides===2?2:1);}
function recordingMode(id){const m=catalog[id];return (m.gear==='无器械'||id==='pullup'||m.variantOf==='pullup')?'bodyweight':m.gear==='弹力带'?'band':'weighted';}
function setupLabel(id){return ['push','closepush'].includes(id)?'双脚离墙距离 cm（可选）':recordingMode(id)==='band'?'弹力带阻力 / 规格（可选）':'动作版本 / 难度（可选）';}
function formatStrengthLog(id,l){return recordingMode(id)==='weighted'||l.weight>0?`${formatMass(l.weight)} × ${l.reps}${catalog[id]?.perSide?' 次 / 侧':''}${l.weightUnit==='per-dumbbell'?'（单只重量）':usesDumbbells(id)?'（旧重量口径）':''}`:`${l.reps} 次${catalog[id]?.perSide?' / 侧':''}${l.setup?' · '+esc(l.setup)+(['push','closepush'].includes(id)?' cm 离墙':''):''}`;}
function suggestion(id){const target=exerciseTarget(id);if(state.onboarded&&!canTrainToday())return {weight:'',reps:target.min,text:'当前已暂停训练，请先处理身体不适或完成运动前确认；不建议继续训练或加量。'};const current=workoutDay().logs?.[id]?.at(-1);if(current&&!current.minutes&&!current.mobilitySets)return {weight:current.weight||0,reps:Math.max(target.min,Math.min(target.max,current.reps)),setup:current.setup||'',text:'继续本次训练：沿用上一组记录，按疲劳情况调整。'};const prev=previous(id);if(id==='assistpull')return {weight:prev?.[1].logs[id].at(-1)?.weight||0,reps:target.min,text:'此处记录机器辅助重量，不是额外负重。辅助越大通常越容易；先选能稳定完成次数的辅助设置，再逐步评估减少辅助。'};if(recordingMode(id)!=='weighted'){const last=prev?.[1].logs[id].at(-1);return {weight:0,reps:Math.max(target.min,Math.min(target.max,last?.reps||target.min)),setup:last?.setup||'',text:`建议 ${target.sets} 组 × ${target.min}–${target.max} ${target.quality?'次 / 侧（控制动作）':'次'}。${target.quality?'保持呼吸与躯干稳定，失去控制就停止，不追求力竭。':''}${recordingMode(id)==='band'?'记录弹力带规格，不换算成公斤。':'不将体重换算为训练重量。'}先稳定完成次数，再调整动作难度；改变难度后重新评估次数。`};}if(!prev)return {weight:0,reps:target.min,text:`首次记录：建议 ${target.sets} 组 × ${target.min}–${target.max} ${target.perSide?'次 / 侧':'次'}，${target.rir?'保留约 '+target.rir+' 次余力，':''}${catalog[id].powerRole==='technique'?'此变式单独记录负重，不从常规主项复制重量。':''}${usesDumbbells(id)?'填写单只哑铃重量，按界面说明使用一只或两只；旧记录不自动换算。':''}先用轻重量试做 6–8 次，确认动作稳定，再小幅调整；热身试做不计工作组。器械空载和杠铃自身重量也计入实际负重。`};const [day,d]=prev;const list=d.logs[id],last=list.at(-1);if(dayIndex(workoutDateKey())-dayIndex(day)>21)return {weight:'',reps:target.min,text:`上次记录 ${day}：${formatMass(last.weight)} × ${last.reps}，仅作历史参考。间隔已超过 21 天，请通过轻重量热身重新评估当前负重，不直接沿用旧重量或增加次数。`};if(usesDumbbells(id)&&last.weightUnit!=='per-dumbbell')return {weight:'',reps:target.min,text:`历史记录 ${day}：${formatMass(last.weight)} × ${last.reps}，旧记录未标明单只或总重。请确认并按单只哑铃重量重新填写，不自动换算。`};const previousTarget=exerciseTarget(id,d);const ready=list.length>=previousTarget.sets&&list.every(x=>x.easy&&x.reps>=previousTarget.min);const topped=ready&&list.every(x=>x.reps>=previousTarget.max);const cycle=selectedPrescription().cycle;if(workoutDay().trainingPreferences?.dailyAdjustment?.readiness==='normal')return {weight:last.weight,reps:Math.max(target.min,Math.min(target.max,last.reps)),text:'今天状态一般：不自动增加次数或负重，保持动作稳定，按疲劳情况降低负重。'};const reps=Math.max(target.min,Math.min(target.max,ready?last.reps+1:last.reps));return {weight:last.weight,reps,text:`上次 ${day}：${formatMass(last.weight)} × ${last.reps}。${cycle?.deload||cycle?.session==='技术轻练'?'当前为轻练/减量，不自动追求加重。':ready&&last.reps<target.max?'各组均反馈轻松，可在目标范围内尝试 +1 次。':topped?'全部目标组轻松达到次数上限，下次可尝试最小可用重量增量；先确认动作质量。':ready?'保持当前负重，先让所有组稳定达到次数上限。':'先保持重量和次数，稳定动作。'}`};}

function lesson(id){const m=catalog[id];return `<div class="card"><p class="eyebrow">MOVEMENT CLASS</p><h2>${esc(m.name)}</h2><p>${esc(m.muscle)} · ${esc(m.gear)}</p>${m.trainingFocus?`<p>训练侧重：${esc(m.trainingFocus)}</p>`:''}${m.attachment?`<p>所需配件：${esc(m.attachment)}；请确认器械具备该把手。</p>`:''}${m.variantOf?'<p class="muted">握距、握法和动作路径会改变侧重与舒适度，多个肌群仍共同参与；变体负重独立记录，不直接沿用其他版本。</p>':''}${videoMarkup(id)}${foundationTeaching(id)}<h3>动作步骤</h3><ul>${m.cues.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><p>出现疼痛时停止；不熟悉负重动作时请寻求现场指导。</p></div>`;}
function visibleCatalogEntries(){return Object.entries(catalog).filter(([,m])=>!m.detailed||!beginnerExperience()&&state.profile.experience==='有规律训练经验'&&state.profile.trainingRecency!=='停练后重新开始');}
let selectedLesson='squat';
function enhance(body,d){if(page==='workout'&&isPast())return historicalView(d);const plan=page==='workout'||page==='lesson'?selectedPrescription():prescription();const at=page==='workout'||page==='lesson'?workoutDate():new Date();const recovery=schedule(at)!=='training'||lightDay(at)||d.rest||plan.recoveryRecommended;d.sleepTarget ||= Number(state.profile.sleepTarget)||7;
if(page==='today'){
 d.waterTarget ||= Number(state.profile.waterTarget)||2;body=body.replace(' / 2.0 L',' / '+d.waterTarget.toFixed(1)+' L');
 const ids=d.exerciseIds||plan.ids,sets=ids.filter(id=>catalog[id].kind!=='cardio').reduce((sum,id)=>sum+(d.targets?.[id]||plan.targets?.[id]||defaultExerciseTarget(id)).sets,0);
 const mobility=ids.length&&ids.every(id=>catalog[id].mobility),timed=ids.length&&ids.every(id=>catalog[id].kind==='cardio');
 const detail=mobility?'按组练习 · 每侧次数 / 保持时间':timed?'按分钟记录':`${sets} 个力量工作组${plan.durations?' · 含有氧':''}`;
 const hero=recovery?`<div class="hero"><span class="pill">RECOVERY / WEEK ${weekNumber()}</span><h2>今天，好好恢复。</h2><p>${plan.recoveryRecommended?'近期容量已达推荐范围，今天优先恢复。':'今天安排休息，散步或轻柔活动均可。'}<br>训练日：${esc(scheduleSummary())}</p><button class="primary" data-show-recovery>选择并记录恢复 →</button><button data-action="workout">查看 / 编辑可选训练</button></div>`:`<div class="hero"><span class="pill">TRAINING / WEEK ${weekNumber()}</span><h2>今天，完成你的计划。</h2><p>${esc(d.workoutTitle||plan.title)}<br>${ids.length} 个动作 · ${detail} · 可用 ${esc(plan.adjustment?.minutes||state.profile.minutes)} 分钟</p><button class="primary" data-action="workout">${trained(d)?'查看已完成训练':'开始今日训练'} →</button></div>`;
 body=body.replace(/<div class="hero">[\s\S]*?<\/div>/,hero);body+=nutritionPanel(d)+(beginnerExperience()?'':weeklyGoalPanel()+dailyAdjustmentPanel(d));if(hasWorkoutProgress(d)&&!trained(d))body=body.replace('今天，完成你的计划。','今天已开始，进度已保存。');body=body.replace('昨晚睡得怎么样？',`睡眠目标 ${d.sleepTarget} 小时`);body=body.replace('蛋白质食物',['素食','纯素','蛋奶素'].includes(state.profile.diet)?'豆类 / 豆制品':'蛋白质食物');if(d.rewardPolicy===2)body=body.replaceAll('NUTRITION · +20 XP','NUTRITION · 习惯记录').replaceAll('HYDRATION · +15 XP','HYDRATION · 习惯记录').replaceAll('SLEEP · +15 XP','SLEEP · 恢复参考').replaceAll('/ 100 XP','/ 55 XP').replaceAll('max="100"','max="55"').replace('全部完成额外 +20 XP。训练和恢复任选其一，不重复计分。','训练或恢复 +30、学习 +15、恢复反馈 +10 XP。每日不要求全部完成；生活目标不再额外计分。');if(beginnerExperience())return beginnerHome(body,d,plan,recovery);
}

if(page==='path'){return (beginnerExperience()?beginnerRouteHeader():'')+compactRoute(plan,recovery);}

if(page==='workout'){const ids=displayedWorkoutIds(d,plan);const full=`<div class="compact-workout"><p class="eyebrow">${workoutDateKey()} / WEEK ${plan.cycle?.week||weekNumber()} / ${recovery?'恢复日 · 可选轻训练':'训练日'}</p><h1>${esc(d.workoutTitle||plan.title)}</h1>${!isPreview()?`<button class="primary" data-start-session>${recovery?'开始可选轻活动':'开始训练'} · 简洁模式 →</button>`:''}${isPreview()?'<p class="notice">提前查看 / 编辑计划：修改只应用于这个日期，不记完成或 XP。到当天再记录训练。</p>':''}<button data-back-route>← 返回我的路线</button>${isPreview()?'<button data-refresh-future>按当前目标重新生成此日期</button>':''}<p class="session-meta">${ids.length} 个动作 · 预计 ${ids.length?(plan.estimated||'—'):0} 分钟</p><button class="compact-adjust" data-open-workout-tools>＋ 添加动作 / 调整计划</button>${ids.map(id=>{if(catalog[id].kind==='cardio')return cardioCard(id,d,plan);const m=catalog[id],hint=suggestion(id),target=exerciseTarget(id,d),logs=d.logs?.[id]||[];return `<section class="card workout-card"><button class="exercise-heading" data-lesson="${id}"><h3>${esc(m.name)} ▷</h3><span class="muted">${esc(m.muscle)}${m.trainingFocus?' · '+esc(m.trainingFocus):''}</span></button><button class="remove-exercise" data-remove-exercise="${id}">移除此动作</button>${orderControls(id)}<p class="eyebrow">${esc((d.sessionEntries||plan.entries||[]).find(entry=>entry.id===id)?.label||m.muscle)} · 建议休息 ${(d.sessionEntries||plan.entries||[]).find(entry=>entry.id===id)?.rest||90} 秒</p><p class="eyebrow">${esc(exerciseRoleText(id,d,plan))}</p><details class="exercise-guidance" ${exerciseOrderNote(id)?'':'hidden'}><summary>训练顺序说明</summary><p>${esc(exerciseOrderNote(id))}</p></details>${hint.weight===''?`<p class="notice">${esc(hint.text)}</p>`:`<details class="exercise-guidance"><summary>动作与负重建议</summary><p>${esc(hint.text)}</p></details>`}${!supports(id,workoutEquipment())?'<p class="notice">此动作为原计划记录，入门模式不继续推荐；可在编辑计划中替换，原记录保留。</p>':''}<span class="muted">${logs.length} / ${target.sets} 组 · 建议 ${target.min}–${target.max} ${target.quality||target.perSide?'次 / 侧':'次'} / 组 · ${recordingMode(id)==='weighted'?(hint.weight===''?'待评估':formatMass(hint.weight)):recordingMode(id)==='band'?'弹力带阻力':'徒手动作'}${target.rir?' · RIR '+target.rir:''}${target.timeAdjusted?' · 已按时间预算缩减组数':''}${target.timeWarning?' · 自定义训练量超过可用时间，请调整':''}</span>${recentSetSummary(id,hint)}<div class="set-input">${recordingMode(id)==='weighted'?`<label>${weightLabel(id)}<input id="weight-${id}" type="number" required inputmode="decimal" min="0" max="${massInput(500)}" step="any" value="${massInput(hint.weight)}"></label>`:`<label>${setupLabel(id)}<input id="setup-${id}" ${['push','closepush'].includes(id)?'type="number" min="0" max="300" step="1"':'type="text" maxlength="80"'} value="${esc(hint.setup||'')}"></label>`}<label>${target.quality||target.perSide?'每侧次数':'次数'}<input id="reps-${id}" type="number" required inputmode="numeric" min="1" max="100" value="${hint.reps}"></label><label>完成感受<select id="effort-${id}"><option value="normal">适中 / 较难</option><option value="easy">轻松、动作稳定</option></select></label></div><button class="primary" data-log="${id}" ${isPreview()||!supports(id,workoutEquipment())?'disabled':''}>${logs.length>=target.sets?'记录额外一组':'记录一组'}</button> <button data-remove-log="${id}" ${isPreview()?'disabled':''}>撤回最后一组</button><p id="log-feedback-${id}" role="alert" class="field-feedback"></p><details class="exercise-edit"><summary>编辑动作 · 替换 / 组次</summary><details class="target-settings"><summary>替换动作</summary><label>${esc(replacementLabel(id))} · 可用器械<select id="replace-${id}">${replacementOptions(id).map(other=>`<option value="${other}">${esc(catalog[other].name)} · ${esc(catalog[other].gear)}</option>`).join('')||'<option value="">暂无匹配的替代动作</option>'}</select></label><label class="equipment-choice"><input id="remember-replace-${id}" type="checkbox" ${isPreview()?'disabled':''}>后续计划也优先用这个动作</label><button data-replace="${id}" ${replacementOptions(id).length?'':'disabled'}>确认替换</button><p class="muted">替换后使用新动作自己的训练历史；原动作已记录的组保留在成长记录中。</p></details><details class="target-settings"><summary>自定义组数与次数</summary><div class="set-input"><label>目标组数<input id="target-sets-${id}" type="number" min="1" max="10" value="${target.sets}"></label><label>次数下限<input id="target-min-${id}" type="number" min="1" max="100" value="${target.min}"></label><label>次数上限<input id="target-max-${id}" type="number" min="1" max="100" value="${target.max}"></label></div><button data-save-target="${id}">保存此动作目标</button><button data-reset-target="${id}">恢复当前推荐目标</button><p id="target-feedback-${id}" class="muted">${isPreview()?'仅应用于这个日期':'应用于今天和后续训练'}，不修改已记录的组。</p></details></details>${logs.map((l,i)=>`<p class="set-row">✓ 第 ${i+1} 组 · ${l.mobilitySets?'1 组活动度':l.minutes?l.minutes+' 分钟':formatStrengthLog(id,l)} · ${l.easy?'轻松':'适中 / 较难'}</p>`).join('')}</section>`;}).join('')}${!ids.length?`<p class="notice">${plan.recoveryRecommended?'当前部位近期容量已达推荐范围，建议恢复；也可以展开当天设置选择其他部位。':'当前没有训练动作，可检查器械或添加动作。'}</p><button data-action="home">查看今日恢复任务</button>`:''}<details id="workout-tools" class="plan-tools" ${workoutToolsOpen?'open':''}><summary>调整计划与训练说明</summary><p class="muted">当前目标：${esc(state.profile.goal)}${d.planGoal&&d.planGoal!==state.profile.goal?' · 此日期保存于旧目标：'+esc(d.planGoal):''}</p><p>${esc(plan.preferenceNote||'')}</p><p class="muted">${ids.every(id=>catalog[id].kind==='cardio')?'按活动阶段完成，保持可控强度。':d.manualOrder?'当前使用你手动调整的顺序，仅应用于这个日期。':'默认按肌群连续训练，同一肌群主项在前、辅助在后；可用动作旁的上移 / 下移调整。'}</p><details class="plan-tools"><summary>${state.profile.goal==='提升心肺与耐力'?'调整心肺方式与目标':state.profile.goal==='灵活性与日常活动能力'?'调整活动度练习与目标':'调整当天部位、动作数量与周期'}</summary><p>${esc(plan.note||'')}</p>${dailyPreferencePanel(d)}${cyclePanel(d.cycle||plan.cycle)}</details><details class="plan-notes"><summary>查看器械与排课依据</summary><p class="muted">${esc(plan.selectionInfo||'')} 训练经验：${esc(state.profile.experience||'未设置')} · 器械：${esc(equipmentSummary())}</p></details><p>${ids.length} 个动作 · 预计 ${ids.length?(plan.estimated||'—'):0} 分钟 · 可用 ${esc(plan.adjustment?.minutes||state.profile.minutes)} 分钟</p><p class="muted">${esc(budgetExplanation(plan))}</p><details class="plan-notes"><summary>训练容量概览</summary>${sessionSummary(ids,d,plan)}</details><details class="card workout-card add-tools" ${workoutAddOpen?'open':''}><summary>＋ 添加动作 · 自定义训练</summary><p>按器械筛选，支持添加不同肌群动作。移除不会删除已记录的组。</p><div class="library-filters"><label>先选择肌群<select id="add-muscle">${muscleGroups.map(group=>`<option ${group===addMuscle?'selected':''}>${esc(group)}</option>`).join('')}</select></label><label>再选择动作<select id="add-exercise">${availableAdditions().filter(id=>catalog[id].muscle===addMuscle).map(id=>`<option value="${id}">${esc(catalog[id].name)} · ${esc(catalog[id].gear)}</option>`).join('')||'<option value="">此肌群暂无可添加动作，请核对器械或选择其他肌群</option>'}</select></label></div><button class="primary" data-add-exercise ${availableAdditions().some(id=>catalog[id].muscle===addMuscle)?'':'disabled'}>＋ 添加动作</button><p class="muted">仅调整 ${workoutDateKey()} 的训练。力量动作按当前目标、经验与周期推荐组数和次数；心肺活动按分钟记录；活动度按组与每侧次数或保持秒数练习，均可自定义。</p></details>${d.exerciseIds?'<p class="notice">此日期使用已保存的训练安排；动作仍可手动调整，未来日期可按当前目标重新生成。</p>':''}<p>${state.profile.goal==='灵活性与日常活动能力'?'轻柔活动，不追求疼痛或极限幅度。':plan.durations?'有氧保持可说话的强度；力量训练按每个动作的休息建议。':'按每个动作的休息建议，先保证动作稳定。'}${recovery?'今天不要求训练，恢复任务同样计入 XP。':''}</p></details><p>${trained(d)?'🎉 训练已完成，+30 XP 已计入。':hasWorkoutProgress(d)?'✓ 训练进度已保存；完成整课后计入训练 XP。':'按实际完成情况记录。'}</p><button class="primary" data-action="home">返回今日任务 →</button></div>`;return trainingMode==='train'&&!isPreview()?trainingView(full,d,plan):full;}
if(page==='lesson')return lesson(selectedLesson)+lessonChecklist(selectedLesson)+`<button class="primary" data-action="workout">返回训练</button><button class="secondary" data-action="learn">返回动作课堂</button>`;
if(page==='learn')return `<p class="eyebrow">MOVEMENT LIBRARY / ${visibleCatalogEntries().length} MOVES</p><h1>全身动作课堂</h1><p>覆盖胸、背、肩、手臂、臀腿、小腿与核心。视频待接入。</p><div class="library-filters"><label>肌群<select id="muscle-filter">${['全部',...muscleGroups].map(x=>`<option ${muscleFilter===x?'selected':''}>${x}</option>`).join('')}</select></label><label>器械<select id="gear-filter">${['全部',...new Set(Object.values(catalog).map(m=>m.gear))].map(x=>`<option ${equipmentFilter===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="learn-grid">${visibleCatalogEntries().filter(([,m])=>(muscleFilter==='全部'||m.muscle===muscleFilter)&&(equipmentFilter==='全部'||m.gear===equipmentFilter)).map(([id,m])=>`<button class="card" data-lesson="${id}"><div class="illustration">▷</div><p class="eyebrow">${esc(m.muscle)}</p><h3>${esc(m.name)}</h3><p>${esc(m.gear)}</p></button>`).join('')||'<p>这个组合暂无动作，请换一个筛选条件。</p>'}</div>`;

if(page==='progress'){const entries=Object.entries(state.history).sort(([a],[b])=>b.localeCompare(a));return `<p class="eyebrow">TRACKING</p><h1>记录表现，看见进步。</h1>${weeklyReportPanel()}${achievementsPanel()}${calendarPanel()}${personalRecordsPanel()}${reminderSettingsPanel()}${nutritionPanel(d)}${backupPanel()}<details class="card" id="video-management" ${videoPanelOpen?'open':''}><summary>教学素材管理（有使用权限的视频）</summary><label>动作<select id="manage-video-exercise">${Object.entries(catalog).map(([id,m])=>`<option value="${id}" ${id===selectedLesson?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>${videoSettings(selectedLesson)}</details><div class="tasks"><div class="card"><p>累计经验</p><div class="stat">${total()} XP</div></div><div class="card"><p>本周训练参与</p><div class="stat">${weeklyGrowth().completed} 次</div></div></div><div class="section-head"><h3>可选体重记录 · 仅自己可见</h3></div><div class="card"><label>今日体重 ${preferredMassUnit()}（可选）<input id="bodyweight" type="number" min="${massInput(10)}" max="${massInput(500)}" step="any" value="${massInput(d.bodyweight??state.profile.bodyweightKg??'')}" aria-describedby="bodyweight-feedback"></label><p id="bodyweight-feedback" role="alert" class="field-feedback"></p><p>可以不填，不奖励 XP。趋势默认收起，想看时再打开。</p><details id="bodyweight-trend"><summary>查看体重趋势（可选）</summary><div class="trend">${entries.filter(([,v])=>v.bodyweight).reverse().map(([day,v])=>`<div>${day}<b>${formatMass(v.bodyweight)}</b></div>`).join('')||'暂无记录'}</div></details></div><div class="section-head"><h3>训练与生活记录</h3></div>${entries.map(([day,v])=>{const logs=Object.entries(v.logs||{});const volume=logs.reduce((sum,[id,sets])=>sum+sets.reduce((n,l)=>n+logVolume(id,l),0),0);return `<div class="card workout-card"><h3>${day} · ${points(v)} XP</h3><p>训练容量 ${massInput(volume)} ${preferredMassUnit()}·次（旧记录保留原重量口径） · 饮水 ${(v.water*.25).toFixed(2)} L · 睡眠 ${v.sleep} h · ${v.protein?'蛋白质 ✓':'蛋白质未记录'} · ${v.vegetables?'蔬菜 ✓':'蔬菜未记录'}</p>${(v.meals||[]).map(m=>`<p>${esc(m.kind)} · ${esc(m.portion)} · ${esc(mealFeedback(m))}</p>`).join('')}${logs.map(([id,sets])=>`<p>${esc(catalog[id]?.name||id)}：${sets.map(l=>`${l.mobilitySets?'1 组活动度':l.minutes?l.minutes+' 分钟':formatStrengthLog(id,l)}`).join(' / ')}</p>`).join('')}</div>`;}).join('')}`;}
return body;}
function lightDay(at=new Date()){if(state.profile.scheduleMode)return false;return Number(state.profile.days)>=5&&[1,3,5].includes((at.getDay()+6)%7)&&schedule(at)==='training';}
function weekNumber(){return Math.max(1,Math.floor((new Date(dateKey())-new Date(state.startDate||dateKey()))/604800000)+1);}
onContentClick(e=>{const b=e.target.closest('button');if(!b)return;const d=workoutDay();if(b.dataset.lesson){selectedLesson=b.dataset.lesson;page='lesson';render();}if(b.dataset.log){if(isPreview()||!canRecordWorkout())return;const id=b.dataset.log;if(!supports(id,workoutEquipment()))return;const p=selectedPrescription();const weightField=document.querySelector('#weight-'+id),repsField=document.querySelector('#reps-'+id);if((weightField&&weightField.value.trim()==='')||repsField.value.trim()===''){weightField?.reportValidity();repsField.reportValidity();return;}const weight=recordingMode(id)==='weighted'?massToKg(Number(weightField.value)):0,reps=Number(repsField.value);const setupField=document.querySelector('#setup-'+id);if(setupField&&!setupField.checkValidity()) {setupField.reportValidity();return;}const setup=setupField?.value.trim().slice(0,80)||'';if(!Number.isFinite(weight)||weight<0||weight>500||!Number.isInteger(reps)||reps<1||reps>100){weightField?.reportValidity();repsField.reportValidity();const feedback=document.querySelector('#log-feedback-'+id);if(feedback)feedback.textContent=`未记录：次数请填写 1–100 的整数，负重请填写 0–${massInput(500)} ${preferredMassUnit()}。`;return;}const recordedTarget=exerciseTarget(id,d);snapshotWorkoutTargets(d,p);d.targets ||= {};for(const exerciseId of (d.exerciseIds||p.ids)){if(catalog[exerciseId].kind!=='cardio')d.targets[exerciseId] ||= {...exerciseTarget(exerciseId,d)};}d.targets[id] ||= {...recordedTarget};d.exerciseIds ||= p.ids;d.workoutTitle ||= p.title;d.cycle ||= p.cycle;d.specialtyMain ||= p.specialtyMain;d.sessionEntries ||= p.entries;d.targetSets ||= p.sets;d.logs ||= {};d.logs[id] ||= [];d.logs[id].push({weight,reps,setup,weightUnit:weightUnit(id),enteredUnit:preferredMassUnit(),enteredWeight:recordingMode(id)==='weighted'?Number(weightField.value):0,recordedSides:catalog[id].perSide?2:1,easy:document.querySelector('#effort-'+id).value==='easy'});save();if(trainingMode==='train'&&state.reminders?.autoRest!==false)startRest((d.sessionEntries||p.entries||[]).find(x=>x.id===id)?.rest||90);render();}if(b.dataset.removeLog&&!isPreview()){d.logs?.[b.dataset.removeLog]?.pop();save();render();}});
onContentChange(e=>{if(e.target.id==='bodyweight'){const value=massToKg(Number(e.target.value));if(e.target.value.trim()===''||!Number.isFinite(value)||value<10||value>500){showFieldError(e.target,'bodyweight-feedback',`未保存：体重请填写 ${massInput(10)}–${massInput(500)} ${preferredMassUnit()}。`,massInput(today().bodyweight??state.profile.bodyweightKg??''));return;}today().bodyweight=value;save();render();}});
onContentClick(e=>{let b=e.target.closest('button');if(!b)return;if(!b.dataset.action&&b.dataset.set===undefined&&b.dataset.unset===undefined)return;let d=today();if(b.dataset.set!==undefined)d.sets[b.dataset.set]=Math.min(2,(d.sets[b.dataset.set]||0)+1);if(b.dataset.unset!==undefined)d.sets[b.dataset.unset]=Math.max(0,(d.sets[b.dataset.unset]||0)-1);let a=b.dataset.action;if(a==='workout'){if(page!=='lesson')selectedWorkoutDate=null;page='workout';}if(a==='home'){selectedWorkoutDate=null;page='today';}if(a==='learn'){selectedWorkoutDate=null;page='learn';}if(a==='protein'||a==='vegetables')d[a]=!d[a];if(a==='rest'){if(d.rest)d.rest=false;else{const activity=document.querySelector('#recovery-kind')?.value;if(!['rest','walk','mobility'].includes(activity)){const feedback=document.querySelector('#recovery-feedback');if(feedback)feedback.textContent='请选择你实际完成的恢复安排，再记录恢复日。';return;}d.restActivity=activity;d.rest=true;}}if(a==='water')d.water=Math.min(40,d.water+1);if(a==='undo-water')d.water=Math.max(0,d.water-1);save();render();});
onContentChange(e=>{if(e.target.id==='sleep'){const value=Number(e.target.value);if(e.target.value.trim()===''||!Number.isFinite(value)||value<0||value>24){showFieldError(e.target,'sleep-feedback','未保存：睡眠时长请填写 0–24 小时。',today().sleep);return;}today().sleep=value;save();render();}});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{selectedWorkoutDate=null;page=b.dataset.page;render();});
const dialog=document.querySelector('#dialog');const setup=document.querySelector('#setup');
function refreshScheduleForm(){const split=setup.elements.namedItem('split');if(split?.closest)split.closest('label').hidden=['提升心肺与耐力','灵活性与日常活动能力'].includes(setup.elements.namedItem('goal').value);const cycle=setup.elements.scheduleMode?.value==='cycle';document.querySelector('#weekly-settings').hidden=cycle;document.querySelector('#cycle-settings').hidden=!cycle;}
setup.addEventListener('change',e=>{if(e.target.name==='scheduleMode'||e.target.name==='goal')refreshScheduleForm();if(e.target.name==='cyclePreset'&&e.target.value!=='custom'){const [train,rest]=e.target.value.split('/');setup.elements.trainDays.value=train;setup.elements.restDays.value=rest;}if(e.target.name==='trainDays'||e.target.name==='restDays')setup.elements.cyclePreset.value='custom';});
setup.addEventListener('click',e=>{const b=e.target.closest('[data-weekdays]');if(!b)return;document.querySelectorAll('[name=weekdays]').forEach(input=>input.checked=b.dataset.weekdays==='work'?Number(input.value)<5:b.dataset.weekdays==='weekend'?Number(input.value)>=5:false);});
function compactRoute(plan,recovery){const start=new Date(anchorDate()+'T12:00:00');const weeks=Array.from({length:4},(_,week)=>`<details class="route-week" ${week===Math.max(0,Math.min(3,Math.floor((Date.parse(dateKey())-Date.parse(anchorDate()))/604800000)))?'open':''}><summary>第 ${week+1} 周<span>查看课程</span></summary>${Array.from({length:7},(_,offset)=>{const dt=new Date(start);dt.setDate(dt.getDate()+week*7+offset);const day=dt.toLocaleDateString('en-CA'),kind=schedule(dt),draft=state.plannedWorkouts?.[day],record=state.history[day],p=kind==='training'&&!lightDay(dt)?prescription(dt):null;const title=record?.workoutTitle||draft?.workoutTitle||p?.title||(kind==='pending'?'尚未开始':'恢复日');const count=(record?.exerciseIds||draft?.exerciseIds||p?.ids||[]).length;return `<button class="route-day compact-day ${day===dateKey()?'route-today':''}" data-open-day="${day}"><span>${dt.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}<small>${dt.toLocaleDateString('zh-CN',{weekday:'short'})}</small></span><div><b>${esc(title)}</b><small>${kind==='training'?count+' 个动作':'休息 / 轻松活动'}${points(record||{sets:{}})>0?' · 已有记录':draft?' · 已调整':''}</small></div><span>${day===dateKey()?'今天':record&&completedRecordedWorkout(record)?'已完成':kind==='training'?(day>dateKey()?'待训练':'查看'):'恢复'}</span></button>`;}).join('')}</details>`).join('');return `<div class="compact-route"><p class="eyebrow">YOUR PATH · 4 WEEK PLAN</p><h1>我的路线</h1><p>${esc(state.profile.goal)} · 每次 ${esc(state.profile.minutes)} 分钟</p><button class="primary" data-action="${recovery?'home':'workout'}">${recovery?'今日恢复任务':'开始今日训练'} →</button><details class="plan-notes"><summary>计划说明与器械</summary><p>${esc(scheduleSummary())}</p><p>${esc(equipmentSummary())}</p>${cyclePanel(plan.cycle)}<p>可用时间是上限；按实际训练与恢复调整，不要求练满。</p></details>${weeks}<details class="plan-notes"><summary>后续阶段</summary><p>当前开放四周周期，后续进阶阶段尚未开放。</p></details></div>`;}
function trainingView(full,d,plan){const ids=displayedWorkoutIds(d,plan);if(!ids.length)return `<h1>今天没有自动安排动作</h1><p>可返回编辑计划手动添加动作，或选择恢复活动。</p><button data-edit-session>编辑计划</button>`;sessionIndex=Math.max(0,Math.min(sessionIndex,ids.length-1));const cards=[...full.matchAll(/<section class="card workout-card">[\s\S]*?<\/section>/g)].map(m=>m[0]);const id=ids[sessionIndex];return `<div class="session-mode"><p class="eyebrow">${workoutDateKey()} / TRAINING</p><h1 class="session-title">专注这一组</h1><p class="session-position">动作 ${sessionIndex+1} / ${ids.length} · ${trained(d)?'训练已完成':'按实际完成情况记录'}</p><progress max="${ids.length}" value="${ids.filter(x=>catalog[x].kind==='cardio'?catalog[x].mobility?(d.logs?.[x]||[]).length>=(d.mobilityTargets?.[x]||2):(d.logs?.[x]||[]).reduce((n,l)=>n+(l.minutes||0),0)>=cardioTarget(x,d):(d.logs?.[x]||[]).length>=exerciseTarget(x,d).sets).length}"></progress>${beginnerExperience()?`<div class="beginner-cues"><b>先看动作，再完成这一组</b><p>${catalog[id].cues.slice(0,2).map(esc).join(' · ')}</p><button data-lesson="${id}">查看完整教学 ▷</button></div>`:''}${cards[sessionIndex]||''}${restTimerPanel(id)}<div class="session-navigation"><button data-session-prev ${sessionIndex===0?'disabled':''}>← 上一动作</button><button data-session-next ${sessionIndex===ids.length-1?'disabled':''}>下一动作 →</button><button data-edit-session>编辑计划</button><button data-action="home">返回今日任务</button></div></div>`;}
onContentClick(e=>{if(!e.target.closest('[data-open-workout-tools]'))return;const tools=document.querySelector('#workout-tools');tools.open=true;const add=tools.querySelector('.add-tools');if(add)add.open=true;tools.scrollIntoView({behavior:'smooth',block:'start'});});
function updateRestClock(){const seconds=Math.max(0,Math.ceil((restPausedMs||(restUntil-Date.now()))/1000)),node=document.querySelector('#rest-clock'),button=document.querySelector('[data-pause-rest]');if(node)node.textContent=restPausedMs||restUntil?(seconds?`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'休息结束；按自身情况继续。'):'准备好后开始下一组';if(button){button.textContent=restPausedMs?'继续':'暂停';button.disabled=!restPausedMs&&(!restUntil||seconds===0);}if(restUntil&&seconds===0&&!restAlertSent){restAlertSent=true;notifyRestEnd();}}
if(typeof setInterval==='function')setInterval(()=>{if(restUntil)updateRestClock();checkDailyReminder();},1000);
onContentClick(e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-start-session')){if(!canRecordWorkout()){showSafetyOrComfort();return;}trainingMode='train';const d=workoutDay(),next=currentWorkoutIds().findIndex(id=>!trained({...d,exerciseIds:[id]}));sessionIndex=Math.max(0,next);render();}if(b.hasAttribute('data-edit-session')){trainingMode='edit';render();}if(b.hasAttribute('data-session-prev')){sessionIndex--;render();}if(b.hasAttribute('data-session-next')){sessionIndex++;render();}if(b.dataset.startRest){const d=workoutDay(),plan=selectedPrescription();const seconds=(d.sessionEntries||plan.entries||[]).find(x=>x.id===b.dataset.startRest)?.rest||90;startRest(seconds);}if(b.hasAttribute('data-stop-rest')){restUntil=0;restPausedMs=0;restHeldByWorkout=false;restAlertSent=true;updateRestClock();}});
function lessonChecklist(id){const m=catalog[id];if(m.kind==='cardio')return `<section class="card"><h3>开始前确认</h3><p>先检查场地与器械设置，再按课程目标逐步开始；记录实际完成${m.mobility?'组数':'分钟'}。</p></section>`;return `<section class="card"><h3>第一次练习：分步确认</h3><ol>${m.cues.map(cue=>`<li>${esc(cue)}</li>`).join('')}</ol><p>${recordingMode(id)==='weighted'?esc(weightLabel(id))+'；先轻重量试做，确认动作控制后再开始工作组。':esc(setupLabel(id))+'；先选择能控制的动作版本。'} ${m.perSide?'次数按每侧填写。':''}</p><p class="muted">文字检查清单不能替代动作示范；真实授权视频尚未接入。</p></section>`;}
function videoMarkup(id){const video=state.teachingVideos?.[id]||catalog[id]?.video;if(video&&/^https:\/\//.test(video.url))return `<video controls loop muted playsinline preload="metadata" src="${esc(video.url)}" aria-label="${esc(catalog[id].name)}教学"></video><p class="muted">来源：<span data-user-content>${esc(video.source||'User provided')}</span> · <span data-user-content>${esc(video.permission||'Permission details missing')}</span></p>`;return '<div class="video-placeholder">▷<p>文字教学 · 真实授权视频尚未接入</p></div>';}
function videoSettings(id){const current=state.teachingVideos?.[id]||{};return `<details class="target-settings" id="video-settings" ${videoSettingsOpen?'open':''}><summary>接入动作教学视频</summary><p>仅添加有权使用的 HTTPS 视频直链；填写来源和授权说明。</p><label>视频地址<input id="video-url" type="url" value="${esc(current.url||'')}" placeholder="https://…/exercise.mp4"></label><label>来源<input id="video-source" maxlength="120" value="${esc(current.source||'')}"></label><label>授权 / 使用权限说明<input id="video-permission" maxlength="200" value="${esc(current.permission||'')}"></label><button data-save-video="${id}">保存视频来源</button>${current.url?`<button data-remove-video="${id}">移除自定义视频 · 恢复文字教学</button>`:''}<p id="video-feedback" role="status"></p></details>`;}
onContentClick(e=>{const b=e.target.closest('[data-save-video]');if(!b)return;const url=document.querySelector('#video-url').value.trim(),source=document.querySelector('#video-source').value.trim(),permission=document.querySelector('#video-permission').value.trim();const status=document.querySelector('#video-feedback');try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!source||!permission)throw Error();state.teachingVideos ||= {};state.teachingVideos[b.dataset.saveVideo]={url,source,permission};save();render();const feedback=document.querySelector('#video-feedback');if(feedback)feedback.textContent='视频来源已保存；请自行核对播放与使用权限。';}catch{status.textContent='请输入 HTTPS 视频直链、来源和使用权限说明。';}});
function revealAdvancedSetup(){document.querySelector('#advanced-setup').open=true;}
function isHistoricalRecord(d){return Object.entries(state.history).some(([date,record])=>date<dateKey()&&record===d);}
function legacyTarget(id,d){return {sets:d.targetSets||4,min:8,max:12,legacy:true};}
function migrateHistoricalTargets(){for(const [date,d] of Object.entries(state.history)){d.sets ||= {};d.logs ||= {};if(date>=dateKey())continue;d.targets ||= {};d.cardioTargets ||= {};for(const id of d.exerciseIds||Object.keys(d.logs)){if(!catalog[id])continue;if(catalog[id].kind==='cardio'){if(!catalog[id].mobility)d.cardioTargets[id] ||= 15;}else d.targets[id] ||= legacyTarget(id,d);}}}
function historicalView(d){const ids=d.exerciseIds||Object.keys(d.logs||{});return `<p class="eyebrow">${workoutDateKey()} / 历史记录</p><h1>${esc(d.workoutTitle||'当天实际训练')}</h1><p>只读查看当时记录，不用今天的设置重算计划。</p><button data-back-route>← 返回路线</button><p>${d.historyMissing?'这一天没有实际训练记录。':points(d)+' XP · 已保存的历史记录'}</p>${ids.map(id=>`<section class="card workout-card"><h3>${esc(catalog[id]?.name||id)}</h3>${(d.logs?.[id]||[]).map(l=>`<p>${l.mobilitySets?'活动度 1 组':l.minutes?l.minutes+' 分钟':formatStrengthLog(id,l)}</p>`).join('')||'<p>未记录完成组。</p>'}</section>`).join('')}`;}
function mealFeedback(meal){const missing=[!meal.protein&&'蛋白质食物',!meal.vegetables&&'蔬菜',!meal.staple&&'主食'].filter(Boolean);return missing.length?'这餐尚未记录：'+missing.join('、')+'。可补充餐食结构记录；份量需结合个人需求。':'这餐已记录蛋白质、蔬菜和主食；这是结构反馈，不代表热量或营养已达标。';}
function saveMealRecord(kind,protein,vegetables,staple,portion){if(!['早餐','午餐','晚餐','加餐'].includes(kind)||!['偏少','适中','偏多'].includes(portion)||(today().meals?.length||0)>=100&&!pendingMealRecord)return false;const d=today(),record={kind,protein:!!protein,vegetables:!!vegetables,staple:!!staple,portion};d.meals ||= [];if(pendingMealRecord?.day===d&&d.meals.includes(pendingMealRecord.record))Object.assign(pendingMealRecord.record,record);else{d.meals.push(record);pendingMealRecord={day:d,record};}return save();}
function nutritionPanel(d){return `<details class="card" id="nutrition-panel" ${nutritionPanelOpen?'open':''}><summary>记录餐食结构与份量</summary><p>无需计算卡路里；记录实际进食，帮助回顾习惯，不以吃少或体重下降奖励 XP。</p><label>餐次<select id="meal-kind">${['早餐','午餐','晚餐','加餐'].map(x=>`<option>${x}</option>`).join('')}</select></label><label><input type="checkbox" id="meal-protein">蛋白质食物（豆制品、蛋、奶、鱼肉等）</label><label><input type="checkbox" id="meal-vegetables">蔬菜</label><label><input type="checkbox" id="meal-staple">主食（谷物、薯类等）</label><label>相对平常的份量<select id="meal-portion"><option>适中</option><option>偏少</option><option>偏多</option></select></label><button data-save-meal>保存这餐</button><p id="meal-feedback" role="status" class="muted">${esc(mealStatus)}</p>${(d.meals||[]).map((m,i)=>`<p>${esc(m.kind)} · ${esc(m.portion)}：${esc(mealFeedback(m))}<button data-remove-meal="${i}">撤回</button></p>`).join('')}</details>`;}
onContentClick(e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-save-meal')){const saved=saveMealRecord(document.querySelector('#meal-kind').value,document.querySelector('#meal-protein').checked,document.querySelector('#meal-vegetables').checked,document.querySelector('#meal-staple').checked,document.querySelector('#meal-portion').value);mealStatus=saved?'已保存这餐；可继续添加下一餐。':storageDirty?'保存失败，这餐仅暂存在页面；输入已保留，可重试或导出备份。':'未记录：当天最多保存 100 餐，请检查餐次和份量。';if(saved)render();else document.querySelector('#meal-feedback').textContent=mealStatus;}if(b.hasAttribute('data-remove-meal')){const i=Number(b.dataset.removeMeal);if(Number.isInteger(i)&&i>=0){today().meals?.splice(i,1);mealStatus='已撤回这餐。';save();render();}}});
function backupPanel(){return `<section class="card"><label>每日饮水目标 L<input id="water-goal" type="number" min="0.5" max="5" step="0.25" value="${today().waterTarget||state.profile.waterTarget||2}" aria-describedby="water-goal-feedback"></label><p id="water-goal-feedback" role="alert" class="field-feedback"></p><p class="muted">按个人需求调整，不是统一饮水处方；只影响今天及后续目标。</p><h3>训练数据备份</h3><p>包含你的训练记录和计划，保存在当前浏览器。备份文件可用于恢复或换设备。</p><button data-export>一键导出完整备份 JSON</button><button data-export-csv>导出训练 CSV</button><p>上次确认保存备份：${esc(state.backupConfirmedAt||'尚未确认')}</p>${state.backupRequestedAt?'<button data-confirm-backup>我已成功保存备份文件</button>':''}<p class="muted">下载请求不能证明文件已保存；保存后请确认。照片包含在JSON备份中，CSV仅含训练日志，重量统一为kg，并单独标明单只哑铃或总负重口径。</p><button data-retry-save>重试保存</button><label>读取备份文件<input id="restore-file" type="file" accept="application/json,.json"></label><div id="restore-preview"></div><p id="backup-feedback" role="status" class="muted"></p></section>`;}
function downloadData(filename,value){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
function exportData(){downloadData('STREAKFIT-data-'+dateKey()+'.json',loadError?rawStoredData:{format:'streakfit-backup',version:1,data:state});if(!loadError){state.backupRequestedAt=dateKey();save();render();}}
let pendingRestore=null;
function parseBackup(text){return parseBackupData(text,{goalRules,dayIndex,catalog});}
function restoreBackup(){if(!pendingRestore)return false;const before=state;const next=pendingRestore;try{localStorage.setItem(key==='streakfit-v1'?'streakfit-before-restore':key+':before-restore',loadError?rawStoredData:JSON.stringify(before));localStorage.setItem(key,JSON.stringify(next));}catch{storageError='恢复失败：无法保存新数据，原有记录未替换。';updateStorageStatus();return false;}state=next;state.plannedWorkouts ||= {};state.history[dateKey()] ||= {sets:{},logs:{},water:0,sleep:0};loadError=false;storageError='';pendingRestore=null;selectedWorkoutDate=null;migrateHistoricalTargets();const persisted=save();page='progress';render();return persisted;}
onContentClick(e=>{if(e.target.closest('[data-export]'))exportData();if(e.target.closest('[data-retry-save]')){const success=save();const feedback=document.querySelector('#backup-feedback');if(feedback)feedback.textContent=success?'已保存到当前浏览器。':'保存未成功，请查看上方提示。';}if(e.target.closest('[data-confirm-restore]'))restoreBackup();});
onContentChange(async e=>{if(e.target.id!=='restore-file')return;const node=document.querySelector('#restore-preview');try{const file=e.target.files[0];if(!file)return;pendingRestore=parseBackup(await file.text());node.innerHTML=`<p>备份包含 ${Object.keys(pendingRestore.history).length} 天记录。恢复会替换当前记录，并保留恢复前副本。</p><button data-confirm-restore>确认恢复这份备份</button><button data-cancel-restore>取消恢复</button>`;}catch(error){pendingRestore=null;node.textContent='无法读取：'+error.message;}});
const setupSteps=[['goal','你想怎么健身？'],['safety','先确认适合开始运动'],['experience','你之前有没有训练过？'],['place','你通常在哪里训练？'],['minutes','每次能留多少时间？'],['review','准备好开始了吗？']];
let setupWizard=false,setupStep=0,setupDraftActive=false;
function refreshSetupChoices(){for(const button of document.querySelectorAll('[data-setup-choice]'))button.setAttribute('aria-pressed',String(setup.elements.namedItem(button.dataset.setupChoice).value===button.dataset.choiceValue));for(const button of document.querySelectorAll('[data-setup-schedule]')){const value=button.dataset.setupSchedule,preset=setup.elements.cyclePreset.value,mode=setup.elements.scheduleMode.value;button.setAttribute('aria-pressed',String(value.startsWith('weekly')?mode==='weekly'&&setup.elements.days.value===value.slice(6):mode==='cycle'&&preset===value));}}
function setupReviewMarkup(){const value=name=>setup.elements.namedItem(name)?.value||'';const chosen=Array.from(document.querySelectorAll('#equipment-options input:checked'),n=>n.value);return `<p>${esc(value('goal'))} · ${esc(value('experience'))}</p><p>${esc(value('place'))} · 每次 ${esc(value('minutes'))} 分钟</p><p>${value('scheduleMode')==='cycle'?`练 ${esc(value('trainDays'))} 天 / 休 ${esc(value('restDays'))} 天`:`每周 ${esc(value('days'))} 天`} · 从 ${esc(value('scheduleStart'))} 开始</p><p>重量单位 ${esc(value('massUnit'))} · 年龄 ${esc(value('age')||'暂未填写')} · 体重 ${value('bodyweight')?esc(value('bodyweight'))+' '+esc(value('massUnit')):'暂未填写'}</p><p class="muted">器械：${esc(chosen.join('、')||'尚未选择')}。可在下面核对实际可用设备。</p><p class="muted">确认后才保存设置；已记录的训练保留。年龄、体重不用于自动推算训练重量。</p>`;}
function showSetupStep(focus=true){if(!document.createElement)return;const [field,title]=setupSteps[setupStep];dialog.classList.toggle('setup-wizard',setupWizard);document.querySelector('#setup-question').textContent=setupWizard?title:'快速编辑你的计划';document.querySelector('#setup-step-count').textContent=setupWizard?`第 ${setupStep+1} 步 / 共 ${setupSteps.length} 步`:'修改所需项目，确认后保存';document.querySelector('#setup-step-progress').hidden=!setupWizard;document.querySelector('#setup-step-progress').max=setupSteps.length;document.querySelector('#setup-step-progress').value=setupStep+1;for(const section of document.querySelectorAll('[data-onboarding-field]'))section.hidden=setupWizard&&section.dataset.onboardingField!==field&&!(field==='review'&&['massUnit','age','bodyweight','schedule'].includes(section.dataset.onboardingField));for(const node of document.querySelectorAll('[data-onboarding-extra]'))node.hidden=setupWizard&&field!=='review';document.querySelector('#setup-review').hidden=!setupWizard||field!=='review';if(field==='review')document.querySelector('#setup-review-summary').innerHTML=setupReviewMarkup();document.querySelector('#setup-wizard-controls').hidden=!setupWizard;document.querySelector('#setup-back').disabled=setupStep===0;document.querySelector('#setup-next').hidden=field==='review';document.querySelector('#setup-skip').hidden=!['age','bodyweight'].includes(field);document.querySelector('#generate-plan').hidden=setupWizard&&field!=='review';document.querySelector('#generate-plan').textContent=state.onboarded?'保存计划设置 →':'生成我的入门路线 →';document.querySelector('#setup-quick-edit').hidden=!setupWizard;document.querySelector('#setup-restart').hidden=setupWizard;refreshSetupChoices();dialog.scrollTop=0;if(focus)document.querySelector('#setup-question').focus();}
function validateSetupStep(){const name=setupSteps[setupStep][0],field=setup.elements.namedItem(name),value=field?.value?.trim()||'';let message='';if(name==='safety'&&!readSafetyAnswers())message='请回答两项运动前确认，可以选择不确定。';if(name==='minutes'&&(!Number.isFinite(Number(value))||Number(value)<10||Number(value)>180||!value))message='请填写 10–180 分钟。';if(name==='age'&&value&&(!Number.isInteger(Number(value))||Number(value)<1||Number(value)>120))message='年龄请填写 1–120 岁的整数，或选择暂不填写。';if(name==='bodyweight'&&value){const kg=field.dataset?.massKg!==undefined?Number(field.dataset.massKg):massToKg(Number(value),setup.elements.massUnit.value);if(!Number.isFinite(kg)||kg<10||kg>500)message='请填写有效体重，或选择暂不填写。';}document.querySelector('#setup-feedback').textContent=message;if(message){field?.focus();return false;}return true;}
function nextSetupStep(){if(!validateSetupStep())return;setupStep=Math.min(setupSteps.length-1,setupStep+1);showSetupStep();}
function startSetupWizard(){setupWizard=true;setupStep=0;setupDraftActive=true;document.querySelector('#setup-feedback').textContent='';showSetupStep();}
function attemptGeneratePlan(){generatePlan();if(!document.createElement||!dialog.open||!setupWizard)return;if(!readSafetyAnswers()){setupStep=0;showSetupStep();return;}const message=document.querySelector('#setup-feedback').textContent;const field=message.includes('年龄')?'age':message.includes('体重')?'bodyweight':message.includes('重量单位')?'massUnit':null;if(field){setupWizard=false;showSetupStep();document.querySelector('#personal-settings').open=true;setup.elements.namedItem(field)?.focus();}else if(message){setupStep=setupSteps.length-1;showSetupStep();document.querySelector('#advanced-setup').open=true;}}
function planSettingsChanged(old,next){return ['goal','days','place','experience','trainingRecency','minutes','scheduleMode','cyclePreset','trainDays','restDays','scheduleStart','split','equipment','weekdays'].some(name=>{const normalize=v=>Array.isArray(v)?JSON.stringify([...v].sort()):String(v??'');return normalize(old[name])!==normalize(next[name]);});}
setup.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.setupChoice){const field=setup.elements.namedItem(b.dataset.setupChoice);field.value=b.dataset.choiceValue;field.dispatchEvent(new Event('change',{bubbles:true}));refreshSetupChoices();}if(b.dataset.setupSchedule){const value=b.dataset.setupSchedule;if(value.startsWith('weekly')){setup.elements.scheduleMode.value='weekly';setup.elements.days.value=value.slice(6);document.querySelectorAll('[name=weekdays]').forEach(n=>n.checked=false);}else{const [train,rest]=value.split('/');setup.elements.scheduleMode.value='cycle';setup.elements.trainDays.value=train;setup.elements.restDays.value=rest;setup.elements.cyclePreset.value=value;}setup.elements.scheduleStart.value ||= dateKey();refreshScheduleForm();updateSetupSummary();refreshSetupChoices();}if(b.id==='setup-next')nextSetupStep();if(b.id==='setup-back'){setupStep=Math.max(0,setupStep-1);document.querySelector('#setup-feedback').textContent='';showSetupStep();}if(b.id==='setup-skip'){const field=setup.elements.namedItem(setupSteps[setupStep][0]);field.value='';if(field.dataset)delete field.dataset.massKg;nextSetupStep();}if(b.id==='setup-quick-edit'){setupWizard=false;showSetupStep();}if(b.id==='setup-restart')startSetupWizard();});
setup.addEventListener('change',refreshSetupChoices);
setup.addEventListener('keydown',e=>{if(setupWizard&&e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();if(setupStep<setupSteps.length-1)nextSetupStep();else attemptGeneratePlan();}});
for(const type of ['input','change'])setup.addEventListener(type,()=>{if(setupWizard&&setupStep===setupSteps.length-1&&typeof queueMicrotask==='function')queueMicrotask(()=>document.querySelector('#setup-review-summary').innerHTML=setupReviewMarkup());});
function openSetup(){retainLegacyGoal();fillSafetyAnswers();if(!state.onboarded&&setupDraftActive&&document.createElement){dialog.showModal();showSetupStep();return;}document.querySelector('#advanced-setup').open=false;setup.elements.namedItem('age').value=state.profile.age??'';setup.elements.namedItem('massUnit').value=preferredMassUnit();const bodyField=setup.elements.namedItem('bodyweight'),bodyKg=today().bodyweight??state.profile.bodyweightKg;bodyField.value=massInput(bodyKg);if(bodyField.dataset){delete bodyField.dataset.massKg;if(bodyKg!==undefined)bodyField.dataset.massKg=String(bodyKg);bodyField.dataset.massUnit=preferredMassUnit();}setupMassFields();for(const [k,v] of Object.entries(state.profile)){if(k==='equipment'||k==='weekdays'||k==='bodyweightKg')continue;const field=setup.elements[k];if(field)field.value=k==='place'&&v==='家中 · 无器械'?'家中':k==='diet'&&v==='均衡饮食'?'不限制 / 均衡饮食':k==='diet'&&v==='素食'?'蛋奶素':k==='goal'&&v==='增肌'?'增肌与体型塑造':v;}refreshEquipment(setup.elements.place.value,selectedEquipment().length?selectedEquipment():defaultEquipment(setup.elements.place.value));setup.elements.scheduleStart.value ||= anchorDate();document.querySelectorAll('[name=weekdays]').forEach(input=>input.checked=(state.profile.weekdays||[]).map(String).includes(input.value));refreshScheduleForm();updateSetupSummary();dialog.showModal();setupWizard=!state.onboarded&&!!document.createElement;setupStep=0;setupDraftActive=true;showSetupStep();}
document.querySelector('#profile').onclick=openSetup;
setup.addEventListener('input',e=>{if(e.target.name==='bodyweight'&&e.target.dataset){delete e.target.dataset.massKg;e.target.dataset.massUnit=setup.elements.namedItem('massUnit').value;}});
setup.addEventListener('change',e=>{if(e.target.name==='massUnit')changeSetupMassUnit();if(e.target.name==='place'){refreshEquipment(e.target.value,defaultEquipment(e.target.value));}if(e.target.name==='equipment'){const checked=Array.from(document.querySelectorAll('#equipment-options input:checked'));if(e.target.checked){for(const input of checked)if(input!==e.target&&(e.target.value==='无器械 / 徒手'||input.value==='无器械 / 徒手'))input.checked=false;}}});
document.querySelector('#close').onclick=()=>dialog.close();function generatePlan(){const feedback=document.querySelector('#setup-feedback');feedback.textContent='正在生成路线…';try{const safety=readSafetyAnswers();if(!safety){feedback.textContent='请先完成运动前确认。';if(setupWizard){setupStep=setupSteps.findIndex(([name])=>name==='safety');showSetupStep();}return;}const profile={};for(const name of ['name','age','massUnit','bodyweight','goal','days','place','experience','trainingRecency','diet','mealStyle','dietNotes','sleepTarget','minutes','scheduleMode','cyclePreset','trainDays','restDays','scheduleStart','split']){const field=setup.elements.namedItem(name);profile[name]=field?field.value:'';}profile.name=String(profile.name).trim()||'新朋友';profile.massUnit=profile.massUnit||'kg';if(!['kg','lb'].includes(profile.massUnit)){feedback.textContent='请选择 kg 或 lb。';return;}if(profile.age!==''&&(!Number.isInteger(Number(profile.age))||Number(profile.age)<1||Number(profile.age)>120)){feedback.textContent='年龄请填写 1–120 岁的整数，或暂时留空。';return;}profile.age=profile.age===''?undefined:Number(profile.age);const bodyField=setup.elements.namedItem('bodyweight');const bodyKg=profile.bodyweight.trim()===''?undefined:bodyField?.dataset?.massKg!==undefined?Number(bodyField.dataset.massKg):massToKg(Number(profile.bodyweight),profile.massUnit);if(bodyKg!==undefined&&(!Number.isFinite(bodyKg)||bodyKg<10||bodyKg>500)){feedback.textContent='请填写有效体重（10–500 kg 或对应磅值），或暂时留空。';return;}profile.bodyweightKg=bodyKg;delete profile.bodyweight;const sleep=Number(profile.sleepTarget);if(profile.sleepTarget.trim()===''||!Number.isFinite(sleep)||sleep<6||sleep>10){feedback.textContent='请填写 6–10 小时之间的睡眠目标。';return;}profile.weekdays=Array.from(document.querySelectorAll('[name=weekdays]:checked'),input=>Number(input.value));if(profile.scheduleMode==='weekly'&&profile.weekdays.length)profile.days=String(profile.weekdays.length);if(profile.scheduleMode==='cycle'&&(!Number.isInteger(Number(profile.trainDays))||Number(profile.trainDays)<1||Number(profile.trainDays)>7||!Number.isInteger(Number(profile.restDays))||Number(profile.restDays)<1||Number(profile.restDays)>7)){feedback.textContent='训练和休息天数请分别输入 1–7 天。';return;}if(profile.scheduleMode&&(!/^\d{4}-\d{2}-\d{2}$/.test(profile.scheduleStart)||!Number.isFinite(Date.parse(profile.scheduleStart+'T00:00:00Z'))||new Date(profile.scheduleStart+'T00:00:00Z').toISOString().slice(0,10)!==profile.scheduleStart)){feedback.textContent='请选择计划开始日期。';return;}if(!profile.goal||!profile.place||(profile.scheduleMode!=='cycle'&&(!Number.isInteger(Number(profile.days))||Number(profile.days)<1||Number(profile.days)>7))||!Number.isFinite(Number(profile.minutes))||Number(profile.minutes)<10||Number(profile.minutes)>180){feedback.textContent='请重新选择目标、地点、每周天数和可用时间。';return;}profile.equipment=Array.from(document.querySelectorAll('#equipment-options input:checked'),input=>input.value).filter(x=>equipmentOptions(profile.place).includes(x));if(!profile.equipment.length){feedback.textContent='请选择实际可用的器械；只做徒手训练请明确勾选“无器械 / 徒手”。';revealAdvancedSetup();document.querySelector('#equipment-options').scrollIntoView?.({block:'center'});return;}const goalChanged=state.profile.goal!==profile.goal,planChanged=planSettingsChanged(state.profile,profile);const experienceChanged=state.profile.experience!==profile.experience||state.profile.trainingRecency!==profile.trainingRecency;state.profile=profile;if(experienceChanged)syncExperienceTheme(true);const current=today();if(current.exerciseIds&&planChanged&&(goalChanged||!Object.values(current.logs||{}).some(sets=>sets.length))){delete current.exerciseIds;delete current.workoutTitle;delete current.targetSets;delete current.sessionEntries;delete current.cycle;}state.onboarded=true;state.safety={...safety,checkedAt:dateKey()};activateFoundationRewards();today().sleepTarget=sleep;if(profile.bodyweightKg!==undefined)today().bodyweight=profile.bodyweightKg;state.startDate ||= dateKey();if(!save()){feedback.textContent='设置仅暂存在页面，尚未保存；输入已保留，请重试或导出备份。';return;}page='path';render();feedback.textContent='路线已生成';setupDraftActive=false;dialog.close();}catch(error){feedback.textContent='生成失败：'+(error.message||'未知错误')+'。请把这条提示发给我们。';}}
const {backupReminderPanel,startRest,unlockRestAudio,notifyRestEnd,checkDailyReminder,restTimerPanel,reminderSettingsPanel,achievementsPanel,calendarPanel,personalRecordsPanel}=createExperienceToolkit({getState:()=>state,getLoadError:()=>loadError,runtime:{get restUntil(){return restUntil;},set restUntil(value){restUntil=value;},get restPausedMs(){return restPausedMs;},set restPausedMs(value){restPausedMs=value;},get restAlertSent(){return restAlertSent;},set restAlertSent(value){restAlertSent=value;},get restAudio(){return restAudio;},set restAudio(value){restAudio=value;},get calendarOffset(){return calendarOffset;},set calendarOffset(value){calendarOffset=value;}},catalog,recordingMode,updateRestClock,dateKey,dayIndex,esc,save,render,trained,schedule,beginnerExperience,formatMass,weeklyGrowth,openWorkoutDay,content,today,onContentClick,onContentChange});
validateLocalRecords();migrateHistoricalTargets();if(state.onboarded)activateFoundationRewards();updateStorageStatus();document.querySelector('#generate-plan').onclick=attemptGeneratePlan;setup.onsubmit=e=>{e.preventDefault();if(setupWizard&&setupStep<setupSteps.length-1)nextSetupStep();else attemptGeneratePlan();};render();if(!state.onboarded)openSetup();const runtimeWarning=document.querySelector('#runtime-warning');if(runtimeWarning)runtimeWarning.style.display='none';

// Select existing numeric values so typing replaces them instead of appending.
document.addEventListener('click',event=>{const input=event.target;if(input?.tagName==='INPUT'&&input.type==='number'){input.select();}});
document.addEventListener('focusin',event=>{const input=event.target;if(input?.tagName==='INPUT'&&input.type==='number'){input.select();}});

onContentChange(e=>{if(e.target.id==='muscle-filter'){muscleFilter=e.target.value;render();}if(e.target.id==='gear-filter'){equipmentFilter=e.target.value;render();}});

onContentClick(e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.saveTarget||b.dataset.resetTarget;if(!id)return;if(b.dataset.resetTarget){resetExerciseTarget(id);render();return;}let sets=4,min=8,max=12;if(b.dataset.saveTarget){sets=Number(document.querySelector('#target-sets-'+id).value);min=Number(document.querySelector('#target-min-'+id).value);max=Number(document.querySelector('#target-max-'+id).value);}if(!setExerciseTarget(id,sets,min,max)){document.querySelector('#target-feedback-'+id).textContent=storageDirty&&Number.isInteger(sets)&&sets>=1&&sets<=10&&Number.isInteger(min)&&Number.isInteger(max)&&min>=1&&max<=100&&min<=max?'目标仅暂存在页面，保存未成功；输入已保留，请重试或导出备份。':'组数需为 1–10；次数需为 1–100 的整数，且下限不能大于上限。';return;}render();});

onContentClick(e=>{const b=e.target.closest('[data-replace]');if(!b)return;const id=b.dataset.replace,newId=document.querySelector('#replace-'+id).value;const remember=document.querySelector('#remember-replace-'+id).checked;if(replaceExercise(id,newId,remember))render();});

onContentClick(e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-add-exercise')){if(addWorkoutExercise(document.querySelector('#add-exercise').value))render();}if(b.dataset.removeExercise){if(removeWorkoutExercise(b.dataset.removeExercise))render();}});

onContentChange(e=>{if(e.target.id==='add-muscle'){addMuscle=e.target.value;render();}});

onContentClick(e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.logCardio||b.dataset.saveCardio;if(!id)return;if(b.dataset.logCardio&&(isPreview()||!canRecordWorkout()))return;const field=document.querySelector((b.dataset.logCardio?'#cardio-minutes-':'#cardio-target-')+id);const value=Number(field.value);if(!Number.isInteger(value)||value<1||value>180){document.querySelector('#cardio-feedback-'+id).textContent='请输入 1–180 的整数分钟。';return;}const d=workoutDay(),p=selectedPrescription();snapshotWorkoutTargets(d,p);d.cardioTargets ||= {};d.cardioTargets[id] ||= p.durations?.[id]||15;for(const exerciseId of (d.exerciseIds||p.ids)){if(catalog[exerciseId].kind==='cardio')d.cardioTargets[exerciseId] ||= p.durations?.[exerciseId]||15;}if(b.dataset.saveCardio)d.cardioTargets[id]=value;else{d.exerciseIds ||= p.ids;d.workoutTitle ||= p.title;d.cycle ||= p.cycle;d.logs ||= {};d.logs[id] ||= [];d.logs[id].push({minutes:value,effort:document.querySelector('#cardio-effort-'+id).value,weight:0,reps:0});}save();render();});

onContentClick(e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.openDay)openWorkoutDay(b.dataset.openDay);if(b.hasAttribute('data-back-route')){selectedWorkoutDate=null;page='path';render();}});

setup.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-equipment-all')||b.hasAttribute('data-equipment-clear')){const all=b.hasAttribute('data-equipment-all');document.querySelectorAll('#equipment-options input').forEach(input=>input.checked=all&&input.value!=='无器械 / 徒手');}});

onContentClick(e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.logMobility||b.dataset.saveMobility;if(!id)return;if(b.dataset.logMobility&&(isPreview()||!canRecordWorkout()))return;const d=workoutDay(),p=selectedPrescription();const target=Number(document.querySelector('#mobility-target-'+id).value);if(!Number.isInteger(target)||target<1||target>5){document.querySelector('#mobility-feedback-'+id).textContent='请输入 1–5 组的整数。';return;}d.mobilityTargets ||= {};d.mobilityTargets[id]=target;if(b.dataset.logMobility){if(isPreview()||!canRecordWorkout())return;d.logs ||= {};d.logs[id] ||= [];{d.exerciseIds ||= p.ids;d.workoutTitle ||= p.title;d.cycle ||= p.cycle;d.logs[id].push({mobilitySets:1,weight:0,reps:0});}}save();render();});

function refreshFuturePlan(){if(!isFuture())return false;state.archivedPlannedWorkouts ||= {};state.archivedPlannedWorkouts[workoutDateKey()] ||= [];if(state.plannedWorkouts?.[workoutDateKey()])state.archivedPlannedWorkouts[workoutDateKey()].push(state.plannedWorkouts[workoutDateKey()]);delete state.plannedWorkouts[workoutDateKey()];workoutDay();save();render();return true;}
onContentClick(e=>{if(e.target.closest('[data-refresh-future]'))refreshFuturePlan();});

onContentClick(e=>{if(e.target.closest("[data-apply-daily]"))applyDailyPreferences(document.querySelector("#daily-focus").value,document.querySelector("#daily-count").value,document.querySelector("#daily-back-emphasis")?.value||'auto');});

onContentClick(e=>{const up=e.target.closest("[data-move-up]"),down=e.target.closest("[data-move-down]");if(up)moveWorkoutExercise(up.dataset.moveUp,-1);if(down)moveWorkoutExercise(down.dataset.moveDown,1);});

onContentChange(e=>{if(e.target.id!=='water-goal')return;const n=Number(e.target.value);if(e.target.value.trim()===''||!Number.isFinite(n)||n<.5||n>5){showFieldError(e.target,'water-goal-feedback','未保存：饮水目标请填写 0.5–5 L。',today().waterTarget||state.profile.waterTarget||2);return;}today().waterTarget=n;state.profile.waterTarget=n;save();render();});

onContentChange(e=>{if(e.target.id==='manage-video-exercise'){selectedLesson=e.target.value;render();}});
onContentClick(e=>{if(e.target.closest('[data-show-recovery]'))document.querySelector('#recovery-kind')?.scrollIntoView?.({block:'center',behavior:'smooth'});if(e.target.closest('[data-apply-cardio]')&&!isPast()){const mode=document.querySelector('#daily-cardio-mode').value;if(!['treadmill','bike','elliptical','rowing','briskwalk','march'].includes(mode)||!supports(mode))return;const d=workoutDay();d.trainingPreferences={...d.trainingPreferences,cardioMode:mode};const plan=selectedPrescription();d.exerciseIds=[...new Set([...plan.ids,...Object.keys(d.logs||{}).filter(id=>d.logs[id].length)])];d.workoutTitle=plan.title;save();render();}});
function updateSetupSummary(){const node=document.querySelector('#setup-schedule-summary');if(!node)return;const days=Array.from(document.querySelectorAll('[name=weekdays]:checked'),x=>Number(x.value));node.textContent=setup.elements.scheduleMode?.value==='cycle'?`按日期循环：练 ${setup.elements.trainDays.value} 天 / 休 ${setup.elements.restDays.value} 天`:`训练日：${(days.length?days:defaultWeekdays[Number(setup.elements.days?.value)||3]).map(i=>'周'+'一二三四五六日'[i]).join('、')}；今天${(days.length?days:defaultWeekdays[Number(setup.elements.days?.value)||3]).includes((new Date().getDay()+6)%7)?'为训练日':'为恢复日'}。可在更多设置调整。`;}
setup.addEventListener('change',updateSetupSummary);
setup.addEventListener('click',e=>{if(e.target.closest('[data-start-today]')){setup.elements.scheduleMode.value='cycle';setup.elements.trainDays.value='1';setup.elements.restDays.value='1';setup.elements.scheduleStart.value=dateKey();setup.elements.cyclePreset.value='1/1';refreshScheduleForm();updateSetupSummary();}});
updateSetupSummary();
function previewDailyPreferences(focus,count,backEmphasis){const d=workoutDay(),old=d.trainingPreferences;d.trainingPreferences={...old,muscleFocus:focus,exerciseCount:String(count),backEmphasis:backEmphasis||old?.backEmphasis||'auto'};try{const p=selectedPrescription();return {moves:p.ids.filter(id=>catalog[id].kind!=='cardio').length,sets:Object.values(p.targets||{}).reduce((n,t)=>n+t.sets,0),minutes:p.estimated||0,note:p.recoveryRecommended?p.selectionInfo:(p.capacityNotes||[]).join('；')};}finally{if(old===undefined)delete d.trainingPreferences;else d.trainingPreferences=old;}}
onContentChange(e=>{if(!['daily-focus','daily-count','daily-back-emphasis'].includes(e.target.id)||isPast())return;const backField=document.querySelector('#back-emphasis-field');if(backField)backField.hidden=document.querySelector('#daily-focus').value!=='back'||!detailedBackAvailable();const p=previewDailyPreferences(document.querySelector('#daily-focus').value,document.querySelector('#daily-count').value,document.querySelector('#daily-back-emphasis')?.value);document.querySelector('#daily-feedback').textContent=`预览：可安排 ${p.moves} 个力量动作，共 ${p.sets} 组，约 ${p.minutes} 分钟。${p.note||'按时间、经验与器械选择，不要求练满可用时间。'} 尚未保存，点击应用确认。`;});

function recentSetSummary(id,hint){if(recordingMode(id)!=='weighted')return '';const current=(workoutDay().logs?.[id]||[]).at(-1);const previous=current||Object.entries(state.history).filter(([date])=>date<workoutDateKey()).sort(([a],[b])=>b.localeCompare(a)).map(([,day])=>(day.logs?.[id]||[]).at(-1)).find(Boolean);return `<div class="load-comparison"><span>上一组<strong>${previous?esc(formatStrengthLog(id,previous)):'暂无记录'}</strong></span><span>本组参考<strong>${hint.weight===''?'重新评估负重':esc(formatMass(hint.weight))} · ${hint.reps} 次</strong></span></div>`;}

// Visual preferences are stored separately from training records and backups.
if(document.documentElement){syncExperienceTheme();for(const id of ['mode-select','color-select'])document.querySelector('#'+id)?.addEventListener('change',()=>{const mode=document.querySelector('#mode-select').value,family=document.querySelector('#color-select').value;if(!['beginner','experienced'].includes(mode)||!['green','blue'].includes(family))return;try{localStorage.setItem('streakfit-theme',(mode==='beginner'?'light-':'dark-')+family);localStorage.setItem('streakfit-view-mode',mode);localStorage.setItem('streakfit-theme-profile',experienceThemeKey());}catch{}if(id==='mode-select')refreshModeWorkouts();render();});}


function decorateDailyTasks(d){if(!content.querySelectorAll)return;const complete=[d.protein&&d.vegetables,d.water>=waterGoal(d),d.sleep>=(d.sleepTarget||7),trained(d)||d.rest];const cards=content.querySelectorAll('.task');cards.forEach((card,i)=>{if(!complete[i]||!card.insertAdjacentHTML)return;card.classList.add('task-complete');card.insertAdjacentHTML('beforeend','<span class="completion-label">✓ 已完成</span>');});const progressLabel=content.querySelector?.('.section-head .muted');if(progressLabel)progressLabel.textContent=complete.filter(Boolean).length+' / 4 已完成';}

function showFieldError(field,id,message,original){field.value=String(original);const feedback=document.querySelector('#'+id);if(feedback)feedback.textContent=message;}
const brandLink=document.querySelector('.brand');brandLink?.addEventListener('click',event=>{event.preventDefault();selectedWorkoutDate=null;page='today';render();});
onContentClick(event=>{if(!event.target.closest('[data-cancel-restore]'))return;pendingRestore=null;const preview=document.querySelector('#restore-preview');if(preview)preview.textContent='已取消恢复，当前记录未改变。';const file=document.querySelector('#restore-file');if(file)file.value='';});

onContentClick(event=>{const button=event.target.closest('[data-remove-video]');if(!button)return;delete state.teachingVideos?.[button.dataset.removeVideo];save();render();const feedback=document.querySelector('#video-feedback');if(feedback)feedback.textContent='已移除自定义视频，恢复文字教学。';});

// Experience determines guidance and training rules; palette brightness reflects it.
function experienceThemeKey(){return state.profile.experience==='有规律训练经验'&&state.profile.trainingRecency!=='停练后重新开始'?'experienced':'beginner';}
function beginnerExperience(){try{if(localStorage.getItem('streakfit-theme-profile')===experienceThemeKey()){const mode=localStorage.getItem('streakfit-view-mode');if(['beginner','experienced'].includes(mode))return mode==='beginner';}}catch{}return experienceThemeKey()==='beginner';}
function syncExperienceTheme(force=false){if(!document.documentElement)return;let stored='',profile='';try{stored=localStorage.getItem('streakfit-theme')||'';profile=localStorage.getItem('streakfit-theme-profile')||'';}catch{}const valid=['light-green','dark-green','light-blue','dark-blue'].includes(stored),family=valid&&stored.endsWith('blue')?'blue':'green',mode=experienceThemeKey();const theme=!force&&profile===mode&&valid?stored:(mode==='beginner'?'light-':'dark-')+family;if(force||profile!==mode)try{localStorage.removeItem('streakfit-view-mode');}catch{}const view=theme.startsWith('light-')?'beginner':'experienced';document.documentElement.dataset.theme=theme;document.documentElement.dataset.mode=view;const modeSelect=document.querySelector('#mode-select'),colorSelect=document.querySelector('#color-select');if(modeSelect)modeSelect.value=view;if(colorSelect)colorSelect.value=family;try{localStorage.setItem('streakfit-theme',theme);localStorage.setItem('streakfit-view-mode',view);localStorage.setItem('streakfit-theme-profile',mode);}catch{}}
function beginnerRouteHeader(){return `<section class="card beginner-journey"><p class="eyebrow">一步一步学会健身</p><h2>先熟悉，再巩固</h2><p>第 1 周熟悉动作 · 第 2–3 周练习巩固 · 第 4 周减量恢复</p><small>按反馈调整，完成日期或 XP 不会自动解锁更高难度。</small></section>`;}
function beginnerHome(body,d,plan,recovery){const taskDone=trained(d)||d.rest,learned=d.learnedBasics===true||!!d.learnedMoves?.length,restDone=!!d.recoveryFeedback,ids=d.exerciseIds||plan.ids;return `<div class="beginner-home">${safetyStatusPanel()}<p class="eyebrow">你好，${state.profile.name==='新朋友'?'新朋友':`<span data-user-content>${esc(state.profile.name)}</span>`} · 入门引导</p><h1>今天，完成一小步。</h1><p class="muted">第 ${weekNumber()} 周 · 稳定比完美更重要</p><section class="hero"><span class="pill">${recovery?'休息也是进步':'跟着指导完成'}</span><h2>${recovery?'今天，好好恢复':esc(d.workoutTitle||plan.title)}</h2><p>${recovery?'按计划休息，或选择轻松散步。':`${ids.length} 个动作 · 预计约 ${plan.estimated||state.profile.minutes} 分钟`}</p><button class="primary" ${recovery?'data-beginner-recovery':'data-beginner-start'}>${recovery?'记录今天的恢复':taskDone?'查看今日训练':'开始今天的训练'} →</button>${!recovery?'<button data-beginner-edit>调整今天的训练</button>':''}</section>${weeklyGoalPanel()}${learningPathPanel()}<details class="foundation-adjust" ${state.learningStage==='independent'?'open':''}><summary>时间或状态变了？</summary>${dailyAdjustmentPanel(d)}</details>${recovery?guidedRecoveryPanel(d):''}<section class="card journey-tasks"><h3>今天的三件小事 <small>${[taskDone,learned,restDone].filter(Boolean).length} / 3</small></h3><p>${taskDone?'✓':'○'} ${recovery?'按计划恢复':'完成今日训练'} · +30 XP</p><button data-beginner-learn>${learned?'✓':'○'} ${recovery?'学习恢复知识':'学习今日动作要点'} · +15 XP</button><button data-open-comfort>${restDone?'✓':'○'} 记录恢复感受 · +10 XP</button><p class="muted">记录参与，不比较重量或训练量；今天不必完成所有任务。</p></section>${dailyMovementLesson(ids,recovery)}<details class="beginner-habits"><summary>饮食、饮水与恢复记录</summary>${body}</details></div>`;}
onContentClick(event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-beginner-start')){if(!canRecordWorkout()){showSafetyOrComfort();return;}selectedWorkoutDate=null;trainingMode='train';const d=workoutDay(),next=currentWorkoutIds().findIndex(id=>!trained({...d,exerciseIds:[id]}));sessionIndex=Math.max(0,next);page='workout';render();}if(b.hasAttribute('data-beginner-edit')){selectedWorkoutDate=null;trainingMode='edit';page='workout';render();}if(b.hasAttribute('data-beginner-recovery')&&document.querySelector('#guided-recovery')){document.querySelector('#guided-recovery').scrollIntoView?.({block:'center',behavior:'smooth'});}else if(b.hasAttribute('data-beginner-recovery')||b.hasAttribute('data-record-sleep')){const details=document.querySelector('.beginner-habits');if(details)details.open=true;document.querySelector('#sleep')?.scrollIntoView?.({block:'center',behavior:'smooth'});}if(b.hasAttribute('data-beginner-learn'))document.querySelector('#beginner-learning')?.scrollIntoView?.({block:'center',behavior:'smooth'});if(b.dataset.basicsAnswer){const feedback=document.querySelector('#basics-feedback');if(b.dataset.basicsAnswer==='correct'){today().learnedBasics=true;const id=b.dataset.movement||chooseMovementLesson(today().exerciseIds||prescription().ids,state.history,catalog);if(id){today().learnedMoves ||= [];if(!today().learnedMoves.includes(id))today().learnedMoves.push(id);}save();render();}else if(feedback)feedback.textContent='先看这堂课的动作提示，保持控制，不忽略疼痛或明显不适。再试一次。';}});
function retainLegacyGoal(){const field=setup.elements.namedItem('goal'),goal=state.profile.goal;if(!document.createElement||!field?.options||!goal||[...field.options].some(o=>o.value===goal))return;const option=document.createElement('option');option.value=goal;option.textContent=goal+'（原有计划）';field.appendChild(option);}
function validDailyAdjustment(value){return !!value&&typeof value==='object'&&Number.isInteger(value.minutes)&&value.minutes>=10&&value.minutes<=180&&['健身房','家中'].includes(value.place)&&['good','normal','tired'].includes(value.readiness);}
function dailyAdjustmentPanel(d){const current=d.trainingPreferences?.dailyAdjustment,minutes=current?.minutes||Number(state.profile.minutes)||15,place=current?.place||(['健身房','家中'].includes(state.profile.place)?state.profile.place:'家中'),readiness=current?.readiness||(d.sleep>0&&d.sleep<6?'normal':'good');return `<details class="card daily-adjustment"><summary>今天时间或状态变了？</summary><p>只调整今天，先看建议再确认。</p><div class="library-filters"><label>今天可用分钟<input id="today-minutes" type="number" min="10" max="180" step="1" value="${minutes}" inputmode="numeric"></label><label>今天在哪里<select id="today-place">${['健身房','家中'].map(v=>`<option ${v===place?'selected':''}>${v}</option>`).join('')}</select></label><label>今天的状态<select id="today-readiness">${[['good','状态很好'],['normal','状态一般'],['tired','明显疲劳']].map(([v,label])=>`<option value="${v}" ${v===readiness?'selected':''}>${label}</option>`).join('')}</select></label></div><p class="muted">换地点时，健身房按常见器械、家中按徒手预览；请确认实际条件。睡眠不足时建议放轻，不仅凭睡眠数字判断。</p><button data-preview-today>预览今日建议</button><div id="today-adjustment-feedback" role="status"></div><button data-apply-today disabled>确认应用到今天</button></details>`;}
function previewTodayAdjustment(value){if(!validDailyAdjustment(value))return null;const priorPlanned=state.plannedWorkouts,existing=state.history[dateKey()],d=existing||{sets:{}};if(!existing)state.history[dateKey()]=d;const old=d.trainingPreferences;d.trainingPreferences={...old,dailyAdjustment:{...value}};try{return prescription();}finally{if(old===undefined)delete d.trainingPreferences;else d.trainingPreferences=old;if(!existing)delete state.history[dateKey()];if(priorPlanned===undefined)delete state.plannedWorkouts;}}
function applyTodayAdjustment(value){if(!validDailyAdjustment(value))return false;const d=today(),plan=previewTodayAdjustment(value);d.adjustmentHistory ||= [];d.adjustmentHistory.push({at:new Date().toISOString(),minutes:value.minutes,place:value.place,readiness:value.readiness});d.adjustmentHistory=d.adjustmentHistory.slice(-50);const logged=Object.keys(d.logs||{}).filter(id=>d.logs[id].length),targets={...plan.targets};for(const id of logged)if(d.targets?.[id])targets[id]={...d.targets[id]};d.trainingPreferences={...d.trainingPreferences,dailyAdjustment:{...value}};d.exerciseIds=[...new Set([...plan.ids,...logged])];d.targets=targets;d.cardioTargets={...(plan.durations||{}),...Object.fromEntries(logged.filter(id=>d.cardioTargets?.[id]).map(id=>[id,d.cardioTargets[id]]))};d.sessionEntries=[...plan.entries||[],...(d.sessionEntries||[]).filter(e=>logged.includes(e.id)&&!plan.ids.includes(e.id))];d.workoutTitle=plan.title;delete d.manualOrder;delete d.cycle;delete d.specialtyMain;return save();}
let todayAdjustmentPreview=null;
function dailyAdjustmentInput(){return {minutes:Number(document.querySelector('#today-minutes')?.value),place:document.querySelector('#today-place')?.value,readiness:document.querySelector('#today-readiness')?.value};}
onContentChange(event=>{if(['today-minutes','today-place','today-readiness'].includes(event.target.id)){todayAdjustmentPreview=null;const apply=document.querySelector('[data-apply-today]');if(apply)apply.disabled=true;const feedback=document.querySelector('#today-adjustment-feedback');if(feedback)feedback.textContent='选项已改变，请重新预览。';}});
onContentClick(event=>{if(event.target.closest('[data-preview-today]')){const value=dailyAdjustmentInput(),plan=previewTodayAdjustment(value),feedback=document.querySelector('#today-adjustment-feedback');todayAdjustmentPreview=null;if(!plan){if(feedback)feedback.textContent='请输入 10–180 的整数分钟。';return;}todayAdjustmentPreview={...value};if(feedback)feedback.innerHTML=`<p><b>${esc(plan.title)}</b> · ${plan.ids.length} 个动作 · 约 ${plan.estimated||0} 分钟</p><p>${value.readiness==='tired'?'建议休息或轻松散步，不要求补练。':value.readiness==='normal'?'减少工作组，不自动加重。':'按今天的时间、地点和近期记录安排。'}</p><p>${plan.ids.map(id=>esc(catalog[id].name)).join(' · ')}</p><p class="muted">已记录的组保留，不修改其他日期；记录过的动作可能来自原地点。</p>`;document.querySelector('[data-apply-today]').disabled=false;}if(event.target.closest('[data-apply-today]')){const value=dailyAdjustmentInput();if(!todayAdjustmentPreview||JSON.stringify(value)!==JSON.stringify(todayAdjustmentPreview))return;if(applyTodayAdjustment(value)){todayAdjustmentPreview=null;render();const details=document.querySelector('.daily-adjustment');if(details)details.open=true;const feedback=document.querySelector('#today-adjustment-feedback');if(feedback)feedback.textContent='已应用到今天。训练记录保留，恢复仍需按实际情况记录。';}}});

function workoutEquipment(){const prefs=state.history[workoutDateKey()]?.trainingPreferences||state.plannedWorkouts?.[workoutDateKey()]?.trainingPreferences;const a=prefs?.dailyAdjustment;return validDailyAdjustment(a)&&a.place!==state.profile.place?defaultEquipment(a.place):selectedEquipment();}

function guidedRecoveryPanel(d){return `<section class="card" id="guided-recovery"><h3>按实际情况记录恢复</h3><label>今天怎么恢复<select id="guided-recovery-kind"><option value="">请选择实际完成的安排</option><option value="rest">按计划休息</option><option value="walk">轻松散步</option><option value="mobility">轻柔活动</option></select></label><button data-guided-rest>${d.rest?'已记录 · 可调整':'记录恢复 · +30 XP'}</button><p id="guided-rest-feedback" role="status">${d.rest?'✓ '+esc({rest:'按计划休息',walk:'轻松散步',mobility:'轻柔活动'}[d.restActivity]||'已记录恢复'):''}</p></section>`;}
onContentClick(event=>{if(!event.target.closest('[data-guided-rest]'))return;const kind=document.querySelector('#guided-recovery-kind')?.value;if(!['rest','walk','mobility'].includes(kind)){document.querySelector('#guided-rest-feedback').textContent='请选择实际完成的恢复安排。';return;}today().rest=true;today().restActivity=kind;save();render();});

function refreshModeWorkouts(){for(const [date,d] of [[dateKey(),today()],...Object.entries(state.plannedWorkouts||{})]){if(date<dateKey()||!d.exerciseIds||Object.values(d.logs||{}).some(logs=>logs.length))continue;const plan=prescription(new Date(date+'T12:00:00'));d.exerciseIds=[...plan.ids];d.workoutTitle=plan.title;d.targets={...plan.targets};d.cardioTargets={...(plan.durations||{})};d.sessionEntries=plan.entries;d.cycle=plan.cycle;delete d.manualOrder;delete d.specialtyMain;}save();}

// Learning route: content prerequisites only; training and records stay available.
function courseUnlocked(course){return (course.requires||[]).every(id=>state.learningCourses?.[id]);}
function completeLearningCourse(id,answer){const course=learningCourses().find(c=>c.id===id);if(!course||!courseUnlocked(course)||Number(answer)!==course.correct)return false;state.learningCourses ||= {};state.learningCourses[id] ||= {completedAt:new Date().toISOString()};today().learnedBasics=true;return true;}
function learningPathPanel(){const courses=learningCourses(),done=courses.filter(c=>state.learningCourses?.[c.id]).length,next=courses.find(c=>!state.learningCourses?.[c.id]&&courseUnlocked(c));return `<section class="card learning-path"><h3>我的学习路线 · ${done} / ${courses.length}</h3><p class="muted">完成理解题逐步开放教学内容，XP不证明动作能力；训练、记录和计划编辑始终可用。</p>${['foundation','habit','independent'].map((stage,i)=>`<details ${stage===(next?.stage||'independent')?'open':''}><summary>Level ${i+1} · ${['熟悉基础','建立习惯','独立训练'][i]}</summary>${courses.filter(c=>c.stage===stage).map(c=>`<p>${state.learningCourses?.[c.id]?'✓':courseUnlocked(c)?'○':'待学习前课'} ${c.title}</p>`).join('')}</details>`).join('')}${next?`<details class="course-lesson"><summary>继续：${next.title}</summary><p>${next.text}</p><p><b>${next.question}</b></p>${next.answers.map((answer,i)=>`<button data-course-answer="${next.id}" data-answer="${i}">${answer}</button>`).join('')}<p id="course-feedback" role="status"></p></details>`:'<p>已完成基础理解课程。继续练习，实际动作可请现场教练评估。</p>'}</section>`;}

// Foundation experience: screening, discomfort, weekly participation and basic teaching.
function readSafetyAnswers(){const symptoms=setup.elements.namedItem('safetySymptoms')?.value,review=setup.elements.namedItem('safetyReview')?.value;if(!['no','yes','unsure'].includes(symptoms)||!['no','yes','unsure'].includes(review))return null;return {symptoms,review,status:symptoms==='yes'?'urgent':symptoms!=='no'||review!=='no'?'review':'ready'};}
function fillSafetyAnswers(){for(const [name,key] of [['safetySymptoms','symptoms'],['safetyReview','review']]){const field=setup.elements.namedItem(name);if(field)field.value=state.safety?.[key]||'';}}
function latestComfort(){const dates=Object.keys(state.history).filter(date=>date<=dateKey()&&state.history[date]?.discomfort).sort().reverse();return dates.length?{date:dates[0],...state.history[dates[0]].discomfort}:null;}
function canTrainToday(){return state.safety?.status==='ready'&&!['pain','urgent'].includes(latestComfort()?.kind);}
function showSafetyOrComfort(){if(canTrainToday()&&isWorkoutPaused()){if(page!=='workout'){selectedWorkoutDate=null;page='workout';render();}document.querySelector('[data-toggle-workout-pause]')?.focus?.();return;}if(['pain','urgent'].includes(latestComfort()?.kind))openComfort();else{openSetup();const section=document.querySelector('[data-onboarding-field=safety]');section?.scrollIntoView?.({block:'center'});}}
function safetyStatusPanel(){if(canTrainToday())return '';const urgent=state.safety?.status==='urgent'||latestComfort()?.kind==='urgent';return `<section class="notice safety-paused" role="status"><h3>${urgent?'先停止运动，及时寻求医疗帮助':'先确认身体情况，再开始训练'}</h3><p>${urgent?'胸痛、晕厥或异常严重气促需要及时医疗评估；症状严重或持续时联系当地急救服务。':'运动前确认尚未完成，或你报告了限制运动的情况、疼痛或明显不适。暂不开始训练或加量，先咨询合适的专业人士。'}</p><p>仍可查看记录、编辑计划和记录恢复感受。筛查不替代医疗判断。</p><button data-review-safety>更新运动前确认</button><button data-open-comfort>报告身体情况</button></section>`;}
function isWorkoutPaused(){return today().trainingPaused===true;}
function canRecordWorkout(){return canTrainToday()&&!isWorkoutPaused();}
function workoutControlIcon(kind){const shape=kind==='play'?'<path d="m9 5 11 7-11 7Z"/>':kind==='pause'?'<path d="M8 5v14M16 5v14"/>':'<path d="M12 21s-8-5-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 6-8 11-8 11Z"/><path d="M7 12h3l2-3 2 6 2-3h2"/>';
 return `<svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
function comfortPanel(){const blocked=!canTrainToday(),paused=isWorkoutPaused()||blocked,preview=isPreview();return `<section class="comfort-bar ${paused?'workout-is-paused':''}" aria-label="训练控制"><div class="workout-control-heading"><span class="workout-state" role="status"><span class="workout-state-dot" aria-hidden="true"></span>${preview?'查看计划':paused?'训练已暂停':'按自己的节奏训练'}</span>${!preview?`<button class="primary workout-pause-button" data-toggle-workout-pause>${workoutControlIcon(paused?'play':'pause')}${paused?'继续训练':'暂停训练'}</button>`:''}</div><button class="comfort-feedback-button" data-open-comfort>${workoutControlIcon('heart')}身体反馈</button><small>${blocked?'先更新身体情况，再决定是否继续。':isWorkoutPaused()?'已记录的组和当前输入已保留。':'疼痛时停止，不需要完成剩余训练。'}</small></section>`;}
function syncWorkoutPauseUI(){if(page!=='workout')return;const paused=!isPreview()&&(isWorkoutPaused()||!canTrainToday());document.querySelector('.session-mode')?.classList?.toggle('workout-is-paused',paused);
 for(const button of document.querySelectorAll('[data-log],[data-log-cardio],[data-log-mobility],[data-set],[data-start-rest],[data-pause-rest],[data-rest-shift],[data-rest-reset]')){
  if(paused){if(button.dataset.disabledBeforePause===undefined)button.dataset.disabledBeforePause=String(button.disabled);button.disabled=true;}
  else if(button.dataset.disabledBeforePause!==undefined){button.disabled=button.dataset.disabledBeforePause==='true';delete button.dataset.disabledBeforePause;}
 }
}
function refreshWorkoutControls(){const bar=document.querySelector('.comfort-bar');if(bar&&bar.outerHTML!==undefined)bar.outerHTML=comfortPanel();updateRestClock();syncWorkoutPauseUI();}
function toggleWorkoutPause(){if(isPreview())return false;if(!canTrainToday()){showSafetyOrComfort();return false;}const d=today();d.trainingPaused=!isWorkoutPaused();
 if(d.trainingPaused){const remaining=restUntil-Date.now();if(remaining>0){restPausedMs=remaining;restUntil=0;restHeldByWorkout=true;}}
 else if(restHeldByWorkout){const remaining=restPausedMs;restHeldByWorkout=false;if(remaining>0)startRest(remaining/1000);}
 const saved=save();refreshWorkoutControls();return saved;
}
function openComfort(){const dialog=document.querySelector('#comfort-dialog');if(!dialog)return;document.querySelector('#comfort-kind').value=latestComfort()?.kind||'';document.querySelector('#comfort-note').value=latestComfort()?.note||'';document.querySelector('#comfort-feedback').textContent='按实际感受记录；疼痛和明显不适会持续暂停训练，直到更新身体情况，不自动加量。';dialog.showModal();}
function recordComfort(kind,note=''){if(!['good','sore','pain','urgent'].includes(kind))return false;const d=today();d.discomfort={kind,note:String(note).slice(0,300),recordedAt:new Date().toISOString()};if(kind==='urgent')state.safety={...(state.safety||{}),status:'urgent',symptoms:'yes',review:state.safety?.review||'unsure',checkedAt:dateKey()};d.comfortHistory ||= [];if(d.comfortHistory.length<100)d.comfortHistory.push({...d.discomfort});d.recoveryFeedback=true;if(['pain','urgent'].includes(kind))d.trainingPaused=true;else if(state.safety?.status==='ready')d.trainingPaused=false;restUntil=0;restPausedMs=0;restHeldByWorkout=false;return save();}
function activateFoundationRewards(){if(state.rewardPolicyStart)return;for(const [date,d] of Object.entries(state.history)){if(date<dateKey())d.legacyXP=points(d);else if(date===dateKey())d.legacyCarryXP=points(d);}state.rewardPolicyStart=dateKey();today().rewardPolicy=2;save();}
function weeklyGrowth(){const start=new Date(dateKey()+'T12:00:00');start.setDate(start.getDate()-(start.getDay()+6)%7);let completed=0,suggested=0;for(let i=0;i<7;i++){const day=new Date(start);day.setDate(day.getDate()+i);const date=day.toLocaleDateString('en-CA');if(schedule(day)==='training')suggested++;if(date>dateKey())continue;const record=state.history[date];if(record&&trained(record))completed++;}return {completed,target:Number.isInteger(state.weeklyGoal)&&state.weeklyGoal>=1&&state.weeklyGoal<=7?state.weeklyGoal:suggested,suggested,start:start.toLocaleDateString('en-CA')};}
function weeklyGoalPanel(){const w=weeklyGrowth(),stage=['foundation','habit','independent'].includes(state.learningStage)?state.learningStage:'foundation';return `<section class="card weekly-growth"><p class="eyebrow">每周成长 · 按自己的节奏</p><h3>本周训练 ${w.completed} / ${w.target} 次</h3><progress max="${Math.max(1,w.target)}" value="${Math.min(w.completed,w.target)}"></progress><p>休息、学习和轻松活动同样有价值。中断后从下一步继续，不要求连续打卡。</p><details><summary>调整每周目标与成长阶段</summary><label>每周希望完成几次训练<select id="weekly-goal">${Array.from({length:7},(_,i)=>`<option value="${i+1}" ${i+1===w.target?'selected':''}>${i+1} 次</option>`).join('')}</select></label><small>本周排课建议 ${w.suggested} 次${state.weeklyGoal?'；当前使用手动目标':'；随计划自动更新'}。目标不自动增加排课。</small><button data-auto-weekly>恢复按计划建议</button><label>当前成长阶段<select id="journey-stage">${[['foundation','Level 1 · 熟悉基础'],['habit','Level 2 · 建立习惯'],['independent','Level 3 · 独立训练']].map(([v,label])=>`<option value="${v}" ${v===stage?'selected':''}>${label}</option>`).join('')}</select></label><small>自主选择，XP 不自动解锁或证明训练能力；记录和编辑始终可用。</small></details></section>`;}
function foundationTeaching(id){const standards={squat:['稳固椅子靠墙，双脚稳定','膝盖内扣、借力跌坐','扶稳或减小下蹲幅度'],push:['墙面稳固，双手约肩宽','腰部塌陷、耸肩','双脚更靠近墙面'],bridge:['仰卧屈膝，脚掌贴地','用腰部过度后仰代替抬髋','减小抬髋幅度'],hinge:['站稳，膝盖微屈','弯腰代替髋部向后移动','徒手练习较小幅度'],dbpress:['坐稳后安全转为仰卧，使用轻哑铃','甩动重量、手腕折弯','减轻重量或先练墙壁俯卧撑'],chestmachine:['调整座椅与把手，确认器械起始负重','肩部前顶、回程失控','减轻负重并缩小到舒适幅度'],pulldown:['固定大腿，使用可控负重','颈后下拉、明显后仰借力','减轻负重，拉向上胸'],rdl:['轻哑铃靠近腿，膝盖微屈','腰背弯曲、追求触地','先做徒手髋铰链'],deadbug:['仰卧，保持呼吸与躯干稳定','腰部明显拱起、屏气','一次只移动一只手或一条腿'],row:['扶稳支撑，轻重量开始','扭转躯干、甩动手臂','减轻负重或改用稳定支撑划船']};const item=standards[id];if(!item)return '';return `<section class="foundation-standard"><h3>基础教学要点</h3><p><b>开始前：</b>${esc(item[0])}</p><p><b>常见错误：</b>${esc(item[1])}</p><p><b>更容易的做法：</b>${esc(item[2])}</p><p><b>停止条件：</b>疼痛、眩晕或明显异常不适时停止；动作不确定时寻求现场指导。</p><p class="muted">采用设置、动作提示、常见错误、降低难度和停止条件五项教学标准。真实示范视频仍以已接入素材为准。</p><button data-learn-move="${id}">我已理解这些动作要点 · +15 XP</button></section>`;}
// One delegated handler owns all foundation feedback actions.
onContentClick(event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-toggle-workout-pause'))toggleWorkoutPause();if(b.hasAttribute('data-open-comfort'))openComfort();if(b.hasAttribute('data-review-safety'))openSetup();if(b.hasAttribute('data-auto-weekly')){delete state.weeklyGoal;save();render();}if(b.dataset.courseAnswer){const result=completeLearningCourse(b.dataset.courseAnswer,b.dataset.answer);const feedback=document.querySelector('#course-feedback');if(result){save();render();}else if(feedback)feedback.textContent='再看一下课程提示，试着选择更合适的做法。';}if(b.dataset.learnMove&&catalog[b.dataset.learnMove]){today().learnedMoves ||= [];if(!today().learnedMoves.includes(b.dataset.learnMove))today().learnedMoves.push(b.dataset.learnMove);save();render();}});
onContentChange(event=>{if(event.target.id==='weekly-goal'){const n=Number(event.target.value);if(Number.isInteger(n)&&n>=1&&n<=7){state.weeklyGoal=n;save();render();}}if(event.target.id==='journey-stage'&&['foundation','habit','independent'].includes(event.target.value)){state.learningStage=event.target.value;save();render();}});
document.querySelector('#comfort-dialog')?.addEventListener('click',event=>{if(event.target.closest('[data-close-comfort]'))document.querySelector('#comfort-dialog').close();if(event.target.closest('[data-save-comfort]')){if(!recordComfort(document.querySelector('#comfort-kind').value,document.querySelector('#comfort-note').value)){document.querySelector('#comfort-feedback').textContent=storageDirty?'仅暂存在页面，尚未保存；输入已保留，请重试或导出备份。':'请选择当前身体感受。';return;}document.querySelector('#comfort-dialog').close();render();}});
onContentClick(event=>{const record=event.target.closest('[data-log],[data-log-cardio],[data-log-mobility],[data-set],[data-start-session],[data-beginner-start]'),timer=event.target.closest('[data-start-rest],[data-pause-rest],[data-rest-shift],[data-rest-reset]');if(!record&&!(timer&&isWorkoutPaused())||canRecordWorkout())return;event.preventDefault();event.stopImmediatePropagation();showSafetyOrComfort();},true);

// Install one dispatcher per phase rather than one DOM listener per feature.
content.addEventListener('click',event=>{for(const handler of contentClickCaptureHandlers)handler(event);},true);
content.addEventListener('click',event=>{for(const handler of contentClickHandlers)handler(event);});
content.addEventListener('change',event=>{for(const handler of contentChangeHandlers)handler(event);});

setup.addEventListener('change',event=>{if(!['safetySymptoms','safetyReview'].includes(event.target.name))return;const answers=readSafetyAnswers(),feedback=document.querySelector('#setup-safety-status');if(feedback)feedback.textContent=answers?.status==='urgent'?'现在先停止运动。胸痛、晕厥或异常严重气促应及时寻求医疗帮助；严重或持续症状请联系当地急救服务。':answers?.status==='review'?'先咨询合适的专业人士；可以继续设置和查看计划，但暂不开始训练。':answers?'已完成运动前确认；开始后仍请留意身体感受。':'';});

function dailyMovementLesson(ids,recovery){const id=chooseMovementLesson(ids,state.history,catalog),move=id&&catalog[id];if(recovery||!move){const next=learningCourses().find(c=>!state.learningCourses?.[c.id]&&courseUnlocked(c));return `<section class="card beginner-lesson" id="beginner-learning"><h3>今天学一点恢复知识</h3><p>休息不需要补练，疼痛时及时更新身体反馈。</p><button data-action="learn">${next?'继续学习：'+esc(next.title):'复习学习路线'} →</button></section>`;}const known=Object.values(state.history).some(d=>d.learnedMoves?.includes(id));return `<section class="card beginner-lesson" id="beginner-learning"><h3>${known?'复习':'今天学'}：${esc(move.name)}</h3><p>${esc(move.cues[0])}</p><p>今天练这个动作，哪种做法更合适？</p><button data-basics-answer="wrong">赶快完成，忽略动作控制</button><button data-basics-answer="correct" data-movement="${id}">${esc(move.cues[0])}</button><button data-lesson="${id}">查看完整动作教学</button><p id="basics-feedback" role="status">${known?'已阅读要点；实际动作仍需练习和反馈。':''}</p></section>`;}
function weeklyReportPanel(){const w=weeklyGrowth(),start=new Date(w.start+'T12:00:00'),rows=[];let previous=0;for(let i=-7;i<7;i++){const date=new Date(start);date.setDate(date.getDate()+i);const key=date.toLocaleDateString('en-CA'),d=state.history[key];if(key>dateKey())continue;if(i<0){if(d&&trained(d))previous++;}else rows.push([key,d||{}]);}const read=[...new Set(rows.flatMap(([,d])=>d.learnedMoves||[]))],practiced=[...new Set(rows.flatMap(([,d])=>Object.entries(d.logs||{}).filter(([,logs])=>logs.length).map(([id])=>id)))],feedback=rows.filter(([,d])=>d.recoveryFeedback).length,adjustments=rows.flatMap(([date,d])=>(d.adjustmentHistory||[]).map(a=>({date,...a})));return `<section class="card weekly-report"><h2>本周小结</h2><button data-share-week>生成周总结分享卡</button><p id="share-feedback" role="status"></p><p>完成训练 ${w.completed} 次 · 本周目标 ${w.target} 次</p><p>上周完整周：${previous} 次；本周进行中，不直接判断升降。</p><p>恢复反馈 ${feedback} 天 · 阅读动作要点 ${read.length} 个 · 实际记录动作 ${practiced.length} 个</p><details><summary>动作学习与练习</summary>${[...new Set([...read,...practiced])].map(id=>`<p>${esc(catalog[id]?.name||id)} · ${read.includes(id)?'已阅读要点':'待阅读要点'} · ${practiced.includes(id)?'本周有练习记录':'本周暂无练习记录'}</p>`).join('')||'<p>从今天的动作教学开始。</p>'}<small>阅读或记录次数不代表技术熟练度，实际动作可寻求现场评估。</small></details><details><summary>计划为什么改变？</summary>${adjustments.map(a=>`<p>${esc(a.date)} · ${esc(a.minutes)} 分钟 · ${esc(a.place)} · ${a.readiness==='tired'?'明显疲劳，建议恢复':a.readiness==='normal'?'状态一般，减少负担':'根据时间与地点调整'}</p>`).join('')||'<p>本周暂无已记录的每日调整；旧版本的修改未记录原因。</p>'}</details></section>`;}

function validateLocalRecords(){if(!rawStoredData||loadError)return;const source=JSON.parse(rawStoredData),clean=isolateLocalRecords(source,catalog);state.history=clean.history;state.plannedWorkouts=clean.plannedWorkouts;for(const name of ['equipment','weekdays'])if(state.profile[name]!==undefined&&!Array.isArray(state.profile[name])){delete state.profile[name];clean.issues.push({path:'profile.'+name,reason:'不是数组'});}for(const name of ['exerciseTargets','exerciseReplacements','teachingVideos','learningCourses','achievementDates','reminders'])if(state[name]!==undefined&&(!state[name]||typeof state[name]!=='object'||Array.isArray(state[name]))){delete state[name];clean.issues.push({path:name,reason:'不是对象'});}if(state.progressPhotos!==undefined&&(!Array.isArray(state.progressPhotos)||state.progressPhotos.some(photo=>!photo||typeof photo.data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.data)))){state.progressPhotos=[];clean.issues.push({path:'progressPhotos',reason:'照片数据无效'});}state.history[dateKey()] ||= {sets:{},logs:{},water:0,protein:false,vegetables:false,sleep:0,rest:false};if(clean.issues.length){dataRecoveryIssues=clean.issues;loadError=true;storageError=`发现 ${clean.issues.length} 处损坏记录，已在当前页面隔离；原始数据尚未覆盖。请导出原始数据，或保存可用记录并保留原始副本。`;}}
function repairLocalStorage(){if(!loadError)return save();try{localStorage.setItem(key==='streakfit-v1'?'streakfit-corrupt-original':key+':corrupt-original',rawStoredData);localStorage.setItem(key,JSON.stringify(state));}catch{storageError='恢复失败：未能保存原始副本和可用记录，原始数据未覆盖；可先下载两份备份。';updateStorageStatus();return false;}loadError=false;storageDirty=false;storageError='';pendingMealRecord=null;updateStorageStatus();render();return true;}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-storage-retry')){if(save())render();}if(b.hasAttribute('data-storage-export'))downloadData('STREAKFIT-page-backup-'+dateKey()+'.json',{format:'streakfit-backup',version:1,data:state});if(b.hasAttribute('data-export-raw'))downloadData('STREAKFIT-original-'+dateKey()+'.json',rawStoredData);if(b.hasAttribute('data-repair-storage'))repairLocalStorage();});

// Authentication is separate from workout backups; each account uses its own workspace.
if(typeof document.createElement==='function') {
  accounts=startAccounts({
    readState:()=>state,
    validate:value=>parseBackupData(JSON.stringify(value),{goalRules,dayIndex,catalog}),
    freshState:()=>({profile:{name:'新朋友',goal:'建立运动习惯',experience:'初学者',days:'2',place:'家中 · 无器械',minutes:'15',scheduleMode:'cycle',trainDays:'1',restDays:'2',cyclePreset:'1/2',scheduleStart:dateKey()},history:{}}),
    replaceState:(value,workspace)=>{
      key=workspace;state=value;rawStoredData=JSON.stringify(value);loadError=false;storageError='';storageDirty=false;pendingMealRecord=null;pendingRestore=null;dataRecoveryIssues=[];
      selectedWorkoutDate=null;trainingMode='edit';sessionIndex=0;restUntil=0;restPausedMs=0;restHeldByWorkout=false;restAlertSent=false;page='today';lastRenderedPage=null;
      for(const modal of document.querySelectorAll('dialog:not(#account-dialog)'))modal.close();
      validateLocalRecords();migrateHistoricalTargets();today();updateStorageStatus();render();
      },
    onWorkspaceReady:()=>{if(!state.onboarded)openSetup();},
    configPromise:globalThis.STREAKFIT_ACCOUNT_CONFIG?Promise.resolve(globalThis.STREAKFIT_ACCOUNT_CONFIG):fetch('./account-config.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('配置暂不可用');return response.json();})
  });
}
