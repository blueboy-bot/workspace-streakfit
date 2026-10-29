import {supplementalArtwork} from './supplemental-artwork.js?v=artwork10';
import {overviewArtwork,reviewedArtwork} from './daily-overview.js?v=artwork10';
import {commonStrengthArtwork} from './visual-planning.js?v=artwork10';
// Read-only summaries: only submitted logs, never prescribed repetitions or loads.
import {fromKilograms} from './units.js';
export const shareArtwork={incline:[0,0,'finish',2,1,{x:50,y:150,width:800,height:700,sourceWidth:1774,sourceHeight:887}],ropepush:[1,0,'finish',2,1,{x:1110,y:0,width:610,height:845,sourceWidth:1774,sourceHeight:887}],bench:[0,0,'gym',2,3],chestsupported:[1,0,'gym',2,3],pulldown:[0,1,'gym',2,3],fly:[1,1,'gym',2,3],lateral:[0,2,'gym',2,3],curl:[1,2,'gym',2,3],pushup:[0,0,'upper',2,2,{x:20,y:268,width:580,height:245,sourceWidth:1254,sourceHeight:1254}],row:[1,0,'upper',2,2,{x:680,y:95,width:545,height:465,sourceWidth:1254,sourceHeight:1254}],shoulderpress:[0,1,'upper',2,2,{x:120,y:635,width:430,height:550,sourceWidth:1254,sourceHeight:1254}],deadbug:[1,1,'upper',2,2,{x:600,y:770,width:640,height:335,sourceWidth:1254,sourceHeight:1254}],squat:[0,0,'lower'],bridge:[1,0,'lower'],hinge:[0,1,'lower'],plank:[1,1,'lower']};
function shareMovementArt(id){
 const added=supplementalArtwork[id];if(added){const c=added.frames[added.thumbnail||0].crop;return [0,0,added.file,1,1,c];}
 if(shareArtwork[id])return shareArtwork[id];
 const common=commonStrengthArtwork[id];if(common){const c=common.frames[common.thumbnail||0].crop;return [0,0,common.file,1,1,c];}
 const r=reviewedArtwork[id];if(r)return [r.column,r.row,r.file,r.columns,r.rows,r.crop];
 if(Object.hasOwn(overviewArtwork,id)){const n=overviewArtwork[id],tile=n>=32?n-32:n%16,grid=n>=32?2:4;return [tile%grid,Math.floor(tile/grid),n>=32?'overview-atlas-3.png':n>=16?'overview-atlas-2.png':'overview-atlas.png',grid,grid];}
 return null;
}
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
export function dailyShareModel(day={},catalog={},options={}){
 const en=options.language==='en',rows=[];
 const ids=[...new Set([...(day.exerciseIds||[]),...Object.keys(day.logs||{})])];
 for(const id of ids){
  const move=catalog[id];if(!move)continue;
  const logs=(Array.isArray(day.logs?.[id])?day.logs[id]:[]).filter(log=>log&&typeof log==='object');
  const kind=move.mobility?'mobility':move.kind==='cardio'?'cardio':'strength';
  const valid=logs.filter(log=>kind==='mobility'?positive(log.mobilitySets):kind==='cardio'?positive(log.minutes):Number.isInteger(log.reps)&&log.reps>0);
  if(!valid.length)continue;
  const parts=String(move.displayName||move.name||id).split(' · '),name=en?(parts.at(-1)||move.name):parts[0];
  const perSide=kind==='strength'&&(valid.every(log=>log.recordedSides===2)||!!move.perSide||!!day.targets?.[id]?.perSide||!!day.targets?.[id]?.quality);
  let amount,sets=0,minutes=0;
  if(kind==='cardio'){minutes=valid.reduce((n,l)=>n+l.minutes,0);amount=`${minutes} ${en?'min logged':'分钟已记录'}`;}
  else if(kind==='mobility'){sets=valid.reduce((n,l)=>n+l.mobilitySets,0);amount=`${sets} ${en?'mobility sets':'组活动度记录'}`;}
  else{sets=valid.length;const reps=valid.map(l=>l.reps);amount=(perSide?(en?'Per side · ':'每侧'):'')+`${sets}${en?' sets':'组'}`+(new Set(reps).size===1?` × ${reps[0]}${en?' reps':'次'}`:` · ${reps.join(' / ')}${en?' reps':'次'}`);}
  const weights=options.showWeights&&kind==='strength'?valid.map(log=>{
   if(!positive(log.weight))return en?'No external load':'无外加负重';
   const amount=Math.round(fromKilograms(log.weight,options.unit)*10)/10;
   return `${amount} ${options.unit==='lb'?'lb':'kg'}${log.weightUnit==='per-dumbbell'?(en?' / dumbbell':' / 单只'):''}`;
  }):[];
  rows.push({id,name,english:en?'':parts.slice(1).join(' · '),kind,amount,sets,minutes,varyingReps:kind==='strength'&&new Set(valid.map(log=>log.reps)).size>1,weights:weights.length?[...new Set(weights)].join(' · '):'',muscle:move.muscle||'',art:shareMovementArt(id)});
 }
 return {date:options.date||'',demo:options.demo===true,complete:!!options.complete,en,dark:!!options.dark,colorFamily:options.colorFamily||'green',rows,sets:rows.reduce((n,r)=>n+r.sets,0),minutes:rows.reduce((n,r)=>n+r.minutes,0),muscles:[...new Set(rows.map(r=>r.muscle).filter(Boolean))]};
}
const shareText=(model,zh,en)=>model.en?en:zh;
function lines(ctx,text,x,y,width,size=25,maxLines=3){
 ctx.font=`600 ${size}px system-ui, sans-serif`;
 const chars=Array.from(String(text));let cursor=0;
 for(let row=0;row<maxLines&&cursor<chars.length;row++){
  let line='';
  while(cursor<chars.length&&ctx.measureText(line+chars[cursor]).width<=width)line+=chars[cursor++];
  if(row===maxLines-1&&cursor<chars.length){while(line&&ctx.measureText(line+'…').width>width)line=line.slice(0,-1);line+='…';}
  ctx.fillText(line,x,y+row*size*1.35);
 }
}
function loadShareImage(url){return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url;});}
// A session is one image. More movements add balanced rows instead of pages.
export function dailyShareLayout(rows){const columns=rows.length===1?1:rows.length>=7?3:2;return {columns,dataOnly:false,rowCount:Math.ceil(rows.length/columns)};}
export function dailyShareDimensions(rows,{story=false}={}){
 const layout=dailyShareLayout(rows),detailHeight=rows.some(row=>row.weights||row.varyingReps)?60:0;
 const contentHeight=Math.max(1350,601+layout.rowCount*((layout.columns===3?380:360)+detailHeight));
 const height=story?Math.max(1920,contentHeight+192):contentHeight;
 return {...layout,width:1080,height,contentHeight,offset:Math.floor((height-contentHeight)/2)};
}
function shareCutout(image){
 if(!image)return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],white=Math.min(r,g,b);const green=g>r*1.12&&g>b*1.08&&g-r>3;pixels.data[i+3]*=green?0:Math.min(1,(225-white)/25);}
 ctx.putImageData(pixels,0,0);return canvas;
}
const CARD_BLUE='#0750ff',CARD_INK='#080a0d',CARD_MUTED='#626975';
const CARD_UI='"Streakfit UI","Streakfit Han",system-ui,sans-serif';
const CARD_HAN='"Streakfit Han",system-ui,sans-serif';
function cardFont(ctx,size,weight=700,display=false){ctx.font=`${weight} ${size}px ${display?'"Streakfit Display",'+CARD_UI:CARD_HAN}`;}
function cardText(ctx,text,x,y,maxWidth,size,weight=700,color=CARD_INK,display=false){
 ctx.fillStyle=color;cardFont(ctx,size,weight,display);while(size>12&&ctx.measureText(text).width>maxWidth)cardFont(ctx,--size,weight,display);
 if(ctx.measureText(text).width>maxWidth){while(text&&ctx.measureText(text+'…').width>maxWidth)text=text.slice(0,-1);text+='…';}ctx.fillText(text,x,y);
}
function cardBrand(ctx,x,y,size,width){cardText(ctx,'STREAKFIT',x,y,width,size,900);ctx.strokeStyle=CARD_INK;ctx.lineWidth=1.2;ctx.strokeText('STREAKFIT',x,y);}
function cardRule(ctx,x1,y1,x2,y2){ctx.strokeStyle='#8c929c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
const MUSCLE_NAMES={'胸部':'Chest','背部':'Back','肩部':'Shoulders','核心':'Core','臀部':'Glutes','股四头肌':'Quads','腘绳肌':'Hamstrings','肱二头肌':'Biceps','肱三头肌':'Triceps','心肺':'Cardio','活动度':'Mobility','小腿':'Calves'};
export function shareMuscleRegions(muscles=[]){return [...new Set(muscles)].filter(m=>Object.hasOwn(MUSCLE_NAMES,m)&&!['心肺','活动度'].includes(m));}
function shareSessionName(model){
 const groups=model.muscles,upper=['胸部','背部','肩部','肱二头肌','肱三头肌'],lower=['股四头肌','腘绳肌','臀部','小腿'];
 if(groups.length===1)return model.en?(MUSCLE_NAMES[groups[0]]||groups[0])+' SESSION':groups[0]+'训练';
 if(groups.every(m=>upper.includes(m)||m==='核心'))return shareText(model,groups.includes('核心')?'上肢与核心':'上肢训练',groups.includes('核心')?'UPPER BODY & CORE':'UPPER BODY');
 if(groups.every(m=>lower.includes(m)||m==='核心'))return shareText(model,'下肢训练','LOWER BODY');
 return shareText(model,'本次训练','TRAINING SESSION');
}
// Schematic front/back anatomy. Only muscle groups attached to actual logged
// movements are highlighted; this is not a measurement of muscle activation.
function drawShareMuscles(ctx,muscles,x,y,width,height){
 const active=new Set(shareMuscleRegions(muscles));
 const body='M76 64 Q63 64 55 72 Q43 76 42 97 L34 142 L22 188 Q17 208 24 213 Q32 219 38 202 L49 169 L57 144 L67 114 L74 151 L69 180 Q61 199 64 225 L68 270 L64 304 L62 349 L54 368 Q51 377 65 377 L82 376 L88 351 L93 303 L96 268 L100 224 L104 268 L107 303 L112 351 L118 376 L135 377 Q149 377 146 368 L138 349 L136 304 L132 270 L136 225 Q139 199 131 180 L126 151 L133 114 L143 144 L151 169 L162 202 Q168 219 176 213 Q183 208 178 188 L166 142 L158 97 Q157 76 145 72 Q137 64 124 64 L112 57 L88 57 Z';
 const chest=['M72 81 Q85 73 98 82 L98 109 Q79 116 69 103 Z','M128 81 Q115 73 102 82 L102 109 Q121 116 131 103 Z'];
 const shoulders=['M58 76 Q68 70 73 79 L66 102 Q52 106 47 96 Q47 83 58 76 Z','M142 76 Q132 70 127 79 L134 102 Q148 106 153 96 Q153 83 142 76 Z'];
 const biceps=['M49 105 Q62 102 63 114 L53 144 Q43 146 42 137 Z','M151 105 Q138 102 137 114 L147 144 Q157 146 158 137 Z'];
 const quads=['M75 192 Q92 185 96 205 L88 262 Q79 274 71 262 L69 218 Z','M125 192 Q108 185 104 205 L112 262 Q121 274 129 262 L131 218 Z'];
 const calves=['M72 283 Q84 278 89 294 L82 335 Q77 348 69 336 L68 307 Z','M128 283 Q116 278 111 294 L118 335 Q123 348 131 336 L132 307 Z'];
 const back=['M75 78 L96 68 L99 100 L76 112 L68 97 Z','M125 78 L104 68 L101 100 L124 112 L132 97 Z','M70 110 L97 104 L95 153 L81 167 L74 140 Z','M130 110 L103 104 L105 153 L119 167 L126 140 Z'];
 const glutes=['M76 173 Q88 168 98 180 L97 202 Q80 214 70 201 Z','M124 173 Q112 168 102 180 L103 202 Q120 214 130 201 Z'];
 const scale=Math.min(width/410,height/395);
 ctx.save();ctx.translate(x+(width-410*scale)/2,y);ctx.scale(scale,scale);
 for(let side=0;side<2;side++){
  ctx.save();ctx.translate(side*210,0);
  const base=ctx.createLinearGradient(42,0,159,0);base.addColorStop(0,'#c4ced9');base.addColorStop(.48,'#f1f4f7');base.addColorStop(1,'#a7b5c5');
  ctx.fillStyle=base;ctx.strokeStyle='#9caebf';ctx.lineWidth=1;ctx.fill(new Path2D(body));ctx.stroke(new Path2D(body));
  ctx.beginPath();ctx.ellipse(100,29,18,24,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  const blue=ctx.createLinearGradient(55,0,143,0);blue.addColorStop(0,'#0041d5');blue.addColorStop(.5,'#4f94ff');blue.addColorStop(1,'#064cdb');
  const region=(group,paths)=>{ctx.fillStyle=active.has(group)?blue:'#c7d3df';ctx.strokeStyle='#eff4fa';ctx.lineWidth=1.3;for(const path of paths){const shape=new Path2D(path);ctx.fill(shape);ctx.stroke(shape);}};
  region('肩部',shoulders);region(side?'肱三头肌':'肱二头肌',biceps);region('小腿',calves);
  if(side){region('背部',back);region('臀部',glutes);region('腘绳肌',quads);}
  else{
   region('胸部',chest);region('股四头肌',quads);
   const abs=[];for(let i=0;i<4;i++){const top=116+i*13;abs.push(`M87 ${top} Q93 ${top-2} 98 ${top} L98 ${top+10} Q90 ${top+13} 85 ${top+8} Z`,`M113 ${top} Q107 ${top-2} 102 ${top} L102 ${top+10} Q110 ${top+13} 115 ${top+8} Z`);}region('核心',abs);
  }
  ctx.restore();
 }
 ctx.restore();
}
function shareMuscleMap(image,muscles){
 if(!image)return null;
 const regions={
  胸部:['M312 224 Q363 213 423 239 L422 319 Q386 348 325 327 Q297 301 312 224 Z','M548 224 Q497 213 437 239 L438 319 Q474 348 535 327 Q563 301 548 224 Z'],
  肩部:['M307 214 Q264 207 247 253 L244 306 L270 325 L307 271 L344 232 Z','M553 214 Q596 207 613 253 L616 306 L590 325 L553 271 L516 232 Z','M918 214 Q874 207 850 254 L842 304 L871 324 L911 271 L948 231 Z','M1130 214 Q1174 207 1198 254 L1206 304 L1177 324 L1137 271 L1100 231 Z'],
  核心:['M368 341 Q429 327 492 341 L503 394 L482 475 L430 536 L377 475 L356 394 Z'],
  背部:['M1006 157 L1042 157 L1084 192 L1134 218 L1133 273 L1150 315 L1120 411 L1091 468 L1024 512 L957 468 L928 411 L898 315 L915 273 L914 218 L964 192 Z'],
  肱二头肌:['M245 311 L282 294 L306 331 Q296 380 267 410 L224 424 L219 397 Z','M615 311 L578 294 L554 331 Q564 380 593 410 L636 424 L641 397 Z'],
  肱三头肌:['M845 304 L879 295 L905 327 L885 382 L856 420 L814 419 L809 391 Z','M1203 304 L1169 295 L1143 327 L1163 382 L1192 420 L1234 419 L1239 391 Z'],
  臀部:['M936 468 Q984 449 1019 494 L1020 569 Q988 621 936 615 L905 579 L908 522 Z','M1112 468 Q1064 449 1029 494 L1028 569 Q1060 621 1112 615 L1143 579 L1140 522 Z'],
  股四头肌:['M327 559 Q375 571 420 614 L409 708 L382 763 L352 776 Q313 747 304 679 L307 608 Z','M533 559 Q485 571 440 614 L451 708 L478 763 L508 776 Q547 747 556 679 L553 608 Z'],
  腘绳肌:['M921 610 Q971 628 1012 617 L1000 695 L967 773 L928 797 L907 738 L901 679 Z','M1127 610 Q1077 628 1036 617 L1048 695 L1081 773 L1120 797 L1141 738 L1147 679 Z'],
  小腿:['M324 784 L373 777 L377 836 L357 928 L329 983 L308 970 L307 882 Z','M536 784 L487 777 L483 836 L503 928 L531 983 L552 970 L553 882 Z','M908 801 L965 792 L979 844 L964 917 L928 1002 L897 986 L887 914 L889 853 Z','M1140 801 L1083 792 L1069 844 L1084 917 L1120 1002 L1151 986 L1161 914 L1159 853 Z']
 };
 const canvas=document.createElement('canvas'),mask=document.createElement('canvas');canvas.width=mask.width=image.width;canvas.height=mask.height=image.height;
 const ctx=canvas.getContext('2d'),m=mask.getContext('2d');ctx.drawImage(image,0,0);m.scale(image.width/1448,image.height/1086);m.fillStyle='#fff';
 for(const group of shareMuscleRegions(muscles))for(const path of regions[group]||[])m.fill(new Path2D(path));
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),marked=m.getImageData(0,0,mask.width,mask.height).data;
 for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3]||!marked[i+3])continue;const a=marked[i+3]/255,light=pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722;const blue=[light*.065,light*.38,Math.min(255,light*1.32)];for(let c=0;c<3;c++)pixels.data[i+c]=pixels.data[i+c]*(1-a)+blue[c]*a;}
 ctx.putImageData(pixels,0,0);return canvas;
}
function drawMuscleMap(ctx,image,muscles,x,y,width,height){
 if(!image){drawShareMuscles(ctx,muscles,x,y,width,height);return;}
 const scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,x+(width-w)/2,y,w,h);
}
function drawShareArtwork(ctx,row,images,x,y,width,height){
 const art=row.art,img=art?images[art[2]]:null;if(!art||!img)return false;
 const sw=img.width/(art[3]||2),sh=img.height/(art[4]||2);let sx=art[0]*sw,sy=art[1]*sh,cw=sw,ch=sh;
 if(art[5]){const c=art[5];sx=c.x*img.width/c.sourceWidth;sy=c.y*img.height/c.sourceHeight;cw=c.width*img.width/c.sourceWidth;ch=c.height*img.height/c.sourceHeight;}
 else if(art[2]==='gym'){const c=[[60,0,535,385],[700,0,440,390],[165,394,390,410],[695,394,525,415],[115,810,430,440],[785,810,340,440]][art[1]*2+art[0]];sx=c[0]*img.width/1254;sy=c[1]*img.height/1254;cw=c[2]*img.width/1254;ch=c[3]*img.height/1254;}
 const scale=Math.min(width/cw,height/ch),w=cw*scale,h=ch*scale;
 ctx.drawImage(img,sx,sy,cw,ch,x+(width-w)/2,y+height-h,w,h);return true;
}
export async function renderDailyShareCards(model,{story=false}={}){
 if(!model.rows.length)return [];
 await Promise.allSettled([document.fonts?.load('700 88px "Streakfit Han"'),document.fonts?.load('700 44px "Streakfit UI"'),document.fonts?.load('600 44px "Streakfit Display"')]);await document.fonts?.ready;
 const images={};
 for(const key of new Set(model.rows.filter(r=>r.art).map(r=>r.art[2]))){const file={upper:'share-blue-upper.png',lower:'share-blue-lower.png',gym:'share-blue-gym.png',finish:'share-blue-finish.png'}[key]||key;images[key]=shareCutout(await loadShareImage(new URL('../assets/exercises/'+file,import.meta.url).href));}
 const muscleImage=shareMuscleMap(await loadShareImage(new URL('../assets/exercises/share-muscle-neutral.png',import.meta.url).href),model.muscles);
 const layout=dailyShareDimensions(model.rows,{story});
  const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1080,canvas.height);
  ctx.translate(0,layout.offset);
  cardBrand(ctx,40,54,42,430);ctx.fillStyle=CARD_BLUE;ctx.fillRect(42,69,188,7);
  cardRule(ctx,575,66,1040,66);
  if(model.demo){ctx.textAlign='right';cardText(ctx,shareText(model,'示例数据 / DEMO','DEMO DATA'),1040,45,400,19,600,CARD_MUTED);ctx.textAlign='left';}
  const title=shareText(model,model.complete?'今日训练完成':'本次训练记录',model.complete?'WORKOUT COMPLETE':'WORKOUT RECORDED');
  cardText(ctx,title,40,174,595,model.en?46:91,900);
  if(!model.en)cardText(ctx,model.complete?'WORKOUT COMPLETE':'WORKOUT RECORDED',44,229,580,43,600,CARD_INK,true);
  cardText(ctx,[shareSessionName(model),model.date.replaceAll('-','.')].filter(Boolean).join('  ·  '),44,274,580,27,700);
  cardRule(ctx,660,106,660,268);cardRule(ctx,858,126,858,256);
  ctx.textAlign='center';cardText(ctx,String(model.rows.length),758,216,165,124,900,CARD_BLUE,true);cardText(ctx,shareText(model,'个动作','EXERCISES'),758,260,176,28,700);
  cardText(ctx,String(model.sets||model.minutes),960,216,165,124,900,CARD_BLUE,true);cardText(ctx,model.sets?shareText(model,'组记录','SETS LOGGED'):shareText(model,'分钟记录','MINUTES'),960,260,180,28,700);ctx.textAlign='left';
  const gridTop=301,footerTop=layout.contentHeight-300,rowHeight=(footerTop-gridTop)/layout.rowCount;
  cardRule(ctx,22,gridTop,1058,gridTop);
  let index=0;
  for(let gridRow=0;gridRow<layout.rowCount;gridRow++){
   const cells=Math.ceil((model.rows.length-index)/(layout.rowCount-gridRow)),width=1036/cells,y=gridTop+gridRow*rowHeight;
   for(let column=0;column<cells;column++,index++){
   const row=model.rows[index],x=22+column*width,compact=layout.columns===3;
   ctx.save();ctx.beginPath();ctx.rect(x+1,y+1,width-2,rowHeight-2);ctx.clip();
   const horizontal=['pushup','deadbug','bench','dbbench','dbpress','incline','chestsupported','bridge','hipthrust','barhip','rdl','barRdl'].includes(row.id),single=model.rows.length===1;
   const detailed=!!(row.weights||row.varyingReps);
   const maxArtW=compact?width-36:horizontal?width-34:width*.62,maxArtH=compact?rowHeight-(row.weights?242:detailed?212:177):horizontal?rowHeight*(single?.62:detailed?.36:.48):rowHeight-32;
   const artX=compact?x+18:horizontal?x+17:x+width*.37,artY=compact||horizontal?y+rowHeight-maxArtH-16:y+16;
   if(!drawShareArtwork(ctx,row,images,artX,artY,maxArtW,maxArtH)){
    drawShareMuscles(ctx,[row.muscle],artX,artY,maxArtW,maxArtH-18);
    cardText(ctx,shareText(model,'部位示意','MUSCLE AREA'),artX,y+rowHeight-18,maxArtW,17,500,CARD_MUTED);
   }
   cardText(ctx,String(index+1).padStart(2,'0'),x+23,y+(compact?56:97),width*.45,compact?57:102,900,'#d9dce1',true);
   const textWidth=compact?width-50:horizontal?(detailed?width*.66:width-45):width*.43,nameY=y+(compact?91:143);
   cardText(ctx,row.name,x+25,nameY,textWidth,compact?27:single?40:32,800);
   if(row.english)cardText(ctx,row.english.toUpperCase(),x+25,nameY+(compact?23:28),textWidth,compact?16:20,600,CARD_MUTED,true);
   ctx.fillStyle=CARD_BLUE;lines(ctx,row.amount,x+25,nameY+(row.english?(compact?52:64):compact?32:42),textWidth,compact?22:single?30:25,2);
   if(row.weights){ctx.fillStyle=CARD_MUTED;lines(ctx,row.weights,x+25,nameY+(row.english?(compact?104:118):compact?84:96),textWidth,compact?16:18,2);}
   ctx.restore();
   if(column<cells-1)cardRule(ctx,x+width,y,x+width,y+rowHeight);
   }
   cardRule(ctx,22,y+rowHeight,1058,y+rowHeight);
  }
  cardRule(ctx,22,footerTop,1058,footerTop);
  cardText(ctx,shareText(model,'本次训练涉及肌群 /','TRAINED MUSCLE GROUPS /'),44,footerTop+55,490,25,700);
  const muscleNames=model.muscles.map(m=>model.en?(MUSCLE_NAMES[m]||m):m);
  ctx.fillStyle=CARD_INK;lines(ctx,muscleNames.join(' · '),44,footerTop+105,500,34,2);
  cardRule(ctx,45,footerTop+163,490,footerTop+163);
  cardText(ctx,shareText(model,'为今天的自己，留下一份记录。','A record of showing up for yourself.'),45,footerTop+205,480,22,500,CARD_MUTED);
  cardBrand(ctx,44,footerTop+260,31,430);cardText(ctx,'MOVE AT YOUR OWN PACE.',46,footerTop+285,430,15,500,CARD_MUTED,true);
  drawMuscleMap(ctx,muscleImage,model.muscles,560,footerTop+12,475,275);
  cardText(ctx,shareText(model,'肌群示意','MUSCLE MAP'),970,layout.contentHeight-10,100,12,500,CARD_MUTED);
 return [canvas];
}
export function createDailyShareDialog({getModel}){
 const dialog=document.createElement('dialog');dialog.className='daily-share-dialog';dialog.setAttribute('aria-label','STREAKFIT · 训练分享卡');document.body.append(dialog);
 let urls=[],files=[],generation=0,opener=null;
 const release=()=>{urls.forEach(url=>URL.revokeObjectURL(url));urls=[];files=[];};
 dialog.addEventListener('close',()=>{generation++;release();opener?.focus?.();});
 function status(text){const node=dialog.querySelector('[data-card-status]');if(node)node.textContent=text;}
 async function generate(){
  const ticket=++generation,model=getModel({showWeights:dialog.querySelector('[data-card-weights]').checked});
  const t=(zh,en)=>shareText(model,zh,en);release();dialog.querySelector('[data-card-previews]').replaceChildren();dialog.querySelector('[data-card-save]').disabled=true;dialog.querySelector('[data-card-share]').disabled=true;
  status(t('正在生成图片…','Generating images…'));
  if(!model.rows.length){status(t('当天还没有实际训练记录。','No actual training records for this date.'));return;}
  try{
   const canvases=await renderDailyShareCards(model,{story:dialog.querySelector('[data-card-format]').value==='story'});
   const blobs=await Promise.all(canvases.map(canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG encoding failed')),'image/png'))));
   if(ticket!==generation||!dialog.open)return;
   files=blobs.map((blob,index)=>new File([blob],`STREAKFIT-${model.date}.png`,{type:'image/png'}));
   blobs.forEach((blob,index)=>{const url=URL.createObjectURL(blob);urls.push(url);const figure=document.createElement('figure'),img=document.createElement('img'),link=document.createElement('a');img.src=url;img.alt=t('完整训练分享卡','Complete workout share card');link.href=url;link.hidden=blobs.length===1;link.download=files[index].name;link.textContent=t(`保存第 ${index+1} 张 PNG`,`Save PNG ${index+1}`);figure.append(img,link);dialog.querySelector('[data-card-previews]').append(figure);});
   dialog.querySelector('[data-card-save]').disabled=false;dialog.querySelector('[data-card-share]').disabled=false;
   status(t(`${model.rows.length} 个动作 · 1 张完整训练卡`,`${model.rows.length} exercises · 1 complete card`));
  }catch{if(ticket===generation)status(t('图片生成失败，请重试。','Could not generate images. Please retry.'));}
 }
 dialog.addEventListener('change',generate);
 dialog.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.formatChoice){dialog.querySelector('[data-card-format]').value=button.dataset.formatChoice;dialog.querySelectorAll('[data-format-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));generate();return;}
  const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);
  if(button.hasAttribute('data-card-close'))dialog.close();
  if(button.hasAttribute('data-card-retry'))generate();
  if(button.hasAttribute('data-card-save'))dialog.querySelector('[data-card-previews] a')?.click();
  if(button.hasAttribute('data-card-share')){
   if(!files.length)return;
   if(!navigator.canShare?.({files})||!navigator.share){status(t('此浏览器不支持图片分享，请保存 PNG 后到社交平台发布。','Image sharing is unavailable. Save the PNG and post it in your social app.'));return;}
   try{await navigator.share({files,title:'STREAKFIT'});}catch(error){if(error.name!=='AbortError')status(t('未能分享，请保存图片后发布。','Sharing failed. Save the image and post it manually.'));}
  }
 });
 return {open(){opener=document.activeElement;const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);dialog.innerHTML=`<div class="daily-share-heading"><h2>${t('训练卡','Workout card')}</h2><button type="button" data-card-close aria-label="${t('关闭','Close')}">×</button></div><div class="daily-share-options"><div class="share-format-tabs" role="group" aria-label="${t('图片比例','Image format')}"><input type="hidden" data-card-format value="feed"><button type="button" data-format-choice="feed" aria-pressed="true">${t('完整卡片','Full card')}</button><button type="button" data-format-choice="story" aria-pressed="false">Story · ${t('留白','Padded')}</button></div><label><input type="checkbox" data-card-weights>${t('显示重量','Show weights')}</label></div><p data-card-status role="status" aria-live="polite"></p><div data-card-previews></div><div class="daily-share-actions"><button type="button" data-card-save disabled>${t('保存 PNG','Save PNG')}</button><button type="button" data-card-share disabled>${t('分享图片','Share images')}</button><button type="button" data-card-retry>${t('重新生成','Regenerate')}</button></div>`;dialog.showModal();generate();}};
}
