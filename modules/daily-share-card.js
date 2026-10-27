// Read-only summaries: only submitted logs, never prescribed repetitions or loads.
import {fromKilograms} from './units.js';
export const shareArtwork={pushup:[0,0,'upper'],row:[1,0,'upper'],shoulderpress:[0,1,'upper'],deadbug:[1,1,'upper'],squat:[0,0,'lower'],bridge:[1,0,'lower'],hinge:[0,1,'lower'],plank:[1,1,'lower']};
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
  else{sets=valid.length;const reps=valid.map(l=>l.reps);amount=(perSide?(en?'Per side · ':'每侧 · '):'')+`${sets} ${en?'sets':'组'} · `+(new Set(reps).size===1?`${reps[0]} ${en?'reps / set':'次 / 组'}`:`${reps.join(' / ')} ${en?'reps':'次'}`);}
  const weights=options.showWeights&&kind==='strength'?valid.map(log=>{
   if(!positive(log.weight))return en?'No external load':'无外加负重';
   const amount=Math.round(fromKilograms(log.weight,options.unit)*10)/10;
   return `${amount} ${options.unit==='lb'?'lb':'kg'}${log.weightUnit==='per-dumbbell'?(en?' / dumbbell':' / 单只'):''}`;
  }):[];
  rows.push({id,name,english:en?'':parts.slice(1).join(' · '),kind,amount,sets,minutes,weights:weights.length?[...new Set(weights)].join(' · '):'',muscle:move.muscle||'',art:shareArtwork[id]||null});
 }
 return {date:options.date||'',complete:!!options.complete,en,rows,sets:rows.reduce((n,r)=>n+r.sets,0),minutes:rows.reduce((n,r)=>n+r.minutes,0),muscles:[...new Set(rows.map(r=>r.muscle).filter(Boolean))]};
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
export async function renderDailyShareCards(model,{story=false}={}){
 await document.fonts?.ready;
 const upper=await loadShareImage(new URL('../assets/exercises/share-blue-upper.png',import.meta.url).href);
 const lower=model.rows.some(r=>r.art?.[2]==='lower')?await loadShareImage(new URL('../assets/exercises/share-blue-lower.png',import.meta.url).href):null;
 const canvases=[],pages=Math.ceil(model.rows.length/4);
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1350;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1080,canvas.height);
  // Story adds safe top/bottom margins without stretching type or illustrations.
  ctx.save();ctx.translate(0,story?260:0);
  ctx.fillStyle='#111';ctx.font='900 italic 44px system-ui';ctx.fillText('STREAKFIT',48,65);
  ctx.fillStyle='#1555ff';ctx.fillRect(48,82,180,7);
  ctx.font=`900 ${model.en?58:84}px system-ui`;ctx.fillStyle='#111';ctx.fillText(shareText(model,model.complete?'今日训练完成':'本次训练记录',model.complete?'WORKOUT COMPLETE':'WORKOUT RECORDED'),48,182);
  ctx.font='600 23px system-ui';ctx.fillStyle='#596171';ctx.fillText(`${model.date}  /  ${page+1} — ${pages}`,50,226);
  const stats=`${model.rows.length} ${shareText(model,'个动作','exercises')}  ·  ${model.sets} ${shareText(model,'组记录','sets logged')}${model.minutes?`  ·  ${model.minutes} ${shareText(model,'分钟有氧','cardio min')}`:''}`;
  ctx.fillStyle='#1555ff';ctx.font='700 28px system-ui';ctx.fillText(stats,50,274);
  ctx.strokeStyle='#c7ccd4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(48,302);ctx.lineTo(1032,302);ctx.stroke();
  const pageRows=model.rows.slice(page*4,page*4+4);
  for(let index=0;index<pageRows.length;index++){
   const row=pageRows[index],x=48+(index%2)*500,y=320+Math.floor(index/2)*400;
   ctx.fillStyle='#e4e8ee';ctx.font='900 60px system-ui';ctx.fillText(String(page*4+index+1).padStart(2,'0'),x+10,y+60);
   const art=row.art,img=art?.[2]==='lower'?lower:upper;
   if(art&&img){const sw=img.width/2,sh=img.height/2;const sx=art[2]==='upper'&&art[1]===1?(art[0]===0?0:img.width*.45):art[0]*sw;const cropWidth=art[2]==='upper'&&art[1]===1?img.width*(art[0]===0?.45:.55):sw;ctx.drawImage(img,sx,art[1]*sh,cropWidth,sh,x+60,y+6,350,260);}
   else{ctx.fillStyle='#f0f4ff';ctx.fillRect(x+100,y+65,280,155);ctx.fillStyle='#1555ff';ctx.font='700 26px system-ui';ctx.fillText(shareText(model,'实际训练记录','ACTUAL RECORD'),x+122,y+148);}
   ctx.fillStyle='#111';lines(ctx,row.name,x+12,y+287,460,27,2);
   ctx.fillStyle='#1555ff';lines(ctx,row.amount,x+12,y+351,460,22,2);
   if(row.weights){ctx.fillStyle='#576173';lines(ctx,row.weights,x+12,y+385,460,16,1);}
   ctx.strokeStyle='#e0e3e9';ctx.beginPath();ctx.moveTo(x,y+398);ctx.lineTo(x+480,y+398);ctx.stroke();
  }
  ctx.fillStyle='#111';ctx.font='700 28px system-ui';ctx.fillText(shareText(model,'本次训练涉及部位','TRAINED AREAS'),50,1170);
  const muscles=model.en?model.muscles.map(m=>({'胸部':'Chest','背部':'Back','肩部':'Shoulders','核心':'Core','臀部':'Glutes','股四头肌':'Quads','腘绳肌':'Hamstrings','肱二头肌':'Biceps','肱三头肌':'Triceps','心肺':'Cardio','活动度':'Mobility','小腿':'Calves'}[m]||m)):model.muscles;
  ctx.fillStyle='#1555ff';lines(ctx,muscles.join(' · '),50,1214,980,24,2);
  ctx.fillStyle='#666';ctx.font='20px system-ui';ctx.fillText(shareText(model,'为今天的自己，留下一份记录。','A record of showing up for yourself.'),50,1300);ctx.font='700 17px system-ui';ctx.fillText('STREAKFIT / MOVE AT YOUR OWN PACE',650,1300);
  ctx.restore();canvases.push(canvas);
 }return canvases;
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
   files=blobs.map((blob,index)=>new File([blob],`STREAKFIT-${model.date}-${index+1}.png`,{type:'image/png'}));
   blobs.forEach((blob,index)=>{const url=URL.createObjectURL(blob);urls.push(url);const figure=document.createElement('figure'),img=document.createElement('img'),link=document.createElement('a');img.src=url;img.alt=t(`训练分享卡，第 ${index+1} 张`,`Workout share card ${index+1}`);link.href=url;link.download=files[index].name;link.textContent=t(`保存第 ${index+1} 张 PNG`,`Save PNG ${index+1}`);figure.append(img,link);dialog.querySelector('[data-card-previews]').append(figure);});
   dialog.querySelector('[data-card-save]').disabled=false;dialog.querySelector('[data-card-share]').disabled=false;
   status(t(`已生成 ${files.length} 张卡片。仅包含实际训练记录，不含姓名、身体或账号信息。`,`${files.length} cards ready. Actual workout logs only; no name, body or account information.`));
  }catch{if(ticket===generation)status(t('图片生成失败，请重试。','Could not generate images. Please retry.'));}
 }
 dialog.addEventListener('change',generate);
 dialog.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);
  if(button.hasAttribute('data-card-close'))dialog.close();
  if(button.hasAttribute('data-card-retry'))generate();
  if(button.hasAttribute('data-card-save')){dialog.querySelector('[data-card-previews] a')?.click();if(files.length>1)status(t('第一张已开始下载，其余图片请点击各图下方的保存链接。','First download started. Save remaining images using their links.'));}
  if(button.hasAttribute('data-card-share')){
   if(!files.length)return;
   if(!navigator.canShare?.({files})||!navigator.share){status(t('此浏览器不支持图片分享，请保存 PNG 后到社交平台发布。','Image sharing is unavailable. Save the PNG and post it in your social app.'));return;}
   try{await navigator.share({files,title:'STREAKFIT'});}catch(error){if(error.name!=='AbortError')status(t('未能分享，请保存图片后发布。','Sharing failed. Save the image and post it manually.'));}
  }
 });
 return {open(){opener=document.activeElement;const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);dialog.innerHTML=`<div class="daily-share-heading"><h2>${t('我的训练分享卡','My workout share card')}</h2><button type="button" data-card-close aria-label="${t('关闭','Close')}">×</button></div><p>${t('蓝色模型 · 黑色背心与短裤。动作图为静态示意。','Blue models · black tank tops and shorts. Static exercise illustrations.')}</p><div class="daily-share-options"><label>${t('图片比例','Image format')}<select data-card-format><option value="feed">4:5 · ${t('动态','Feed')}</option><option value="story">9:16 · Story</option></select></label><label><input type="checkbox" data-card-weights>${t('显示实际负重（默认隐藏）','Include actual weights (hidden by default)')}</label></div><p data-card-status role="status" aria-live="polite"></p><div data-card-previews></div><div class="daily-share-actions"><button type="button" data-card-save disabled>${t('保存 PNG','Save PNG')}</button><button type="button" data-card-share disabled>${t('分享图片','Share images')}</button><button type="button" data-card-retry>${t('重新生成','Regenerate')}</button></div>`;dialog.showModal();generate();}};
}
