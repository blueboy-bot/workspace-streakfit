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
 return {date:options.date||'',complete:!!options.complete,en,dark:!!options.dark,colorFamily:options.colorFamily||'green',rows,sets:rows.reduce((n,r)=>n+r.sets,0),minutes:rows.reduce((n,r)=>n+r.minutes,0),muscles:[...new Set(rows.map(r=>r.muscle).filter(Boolean))]};
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
// Layout depends on recorded content, so one movement never occupies one corner of a four-cell sheet.
export function dailyShareLayout(rows){
 const dataOnly=rows.every(row=>!row.art),columns=rows.length===1||dataOnly?1:2;
 return {columns,dataOnly,rowCount:Math.ceil(rows.length/columns)};
}
function shareCutout(image){
 if(!image)return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const white=Math.min(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);pixels.data[i+3]*=Math.min(1,(225-white)/25);}
 ctx.putImageData(pixels,0,0);return canvas;
}
export async function renderDailyShareCards(model,{story=false}={}){
 await document.fonts?.ready;
 const upper=model.rows.some(r=>r.art?.[2]==='upper')?await loadShareImage(new URL('../assets/exercises/share-blue-upper.png',import.meta.url).href):null;
 const lower=model.rows.some(r=>r.art?.[2]==='lower')?await loadShareImage(new URL('../assets/exercises/share-blue-lower.png',import.meta.url).href):null;
 const images={upper:model.dark?shareCutout(upper):upper,lower:model.dark?shareCutout(lower):lower};
 const canvases=[],pages=Math.ceil(model.rows.length/4),bg=model.dark?'#111c18':'#ffffff',ink=model.dark?'#f0f5f1':'#14221b',muted=model.dark?'#acbeb3':'#596171',accent=model.dark?(model.colorFamily==='blue'?'#a9d9ff':'#b6e86b'):'#1555ff',line=model.dark?'#34463c':'#dce3e0';
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1350;
  const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,canvas.height);
  ctx.save();ctx.translate(0,story?245:0);
  ctx.fillStyle=ink;ctx.font='900 italic 44px system-ui';ctx.fillText('STREAKFIT',60,80);
  ctx.fillStyle=accent;ctx.fillRect(60,100,160,6);
  ctx.font=`900 ${model.en?56:78}px system-ui`;ctx.fillStyle=ink;ctx.fillText(shareText(model,model.complete?'今日训练完成':'本次训练记录',model.complete?'WORKOUT COMPLETE':'WORKOUT RECORDED'),60,204);
  ctx.fillStyle=muted;ctx.font='500 25px system-ui';ctx.fillText(model.date+(pages>1?`  /  ${page+1} of ${pages}`:''),62,252);
  ctx.fillStyle=accent;ctx.font='700 30px system-ui';ctx.fillText(`${model.rows.length} ${shareText(model,'个动作','exercises')}  ·  ${model.sets} ${shareText(model,'组记录','sets logged')}${model.minutes?`  ·  ${model.minutes} ${shareText(model,'分钟有氧','cardio min')}`:''}`,62,303);
  const pageRows=model.rows.slice(page*4,page*4+4),layout=dailyShareLayout(pageRows),rowHeight=740/layout.rowCount;
  for(let index=0;index<pageRows.length;index++){
   const row=pageRows[index],single=pageRows.length===1,wide=layout.columns===1||(pageRows.length===3&&index===2),x=60+(index%layout.columns)*490,y=350+Math.floor(index/layout.columns)*rowHeight,width=wide?960:470;
   ctx.fillStyle=model.dark?'#1c2b23':'#f4f6f7';ctx.fillRect(x,y,width,rowHeight-18);
   ctx.fillStyle=accent;ctx.font='700 24px system-ui';ctx.fillText(String(page*4+index+1).padStart(2,'0'),x+25,y+45);
   const art=row.art,img=art?images[art[2]]:null,hasImage=!!(art&&img);
   if(hasImage){
    const sw=img.width/2,sh=img.height/2,sx=art[2]==='upper'&&art[1]===1?(art[0]===0?0:img.width*.45):art[0]*sw,cropWidth=art[2]==='upper'&&art[1]===1?img.width*(art[0]===0?.45:.55):sw;
    const h=single?420:Math.min(rowHeight*.49,300),w=Math.min(width-70,h*1.25);
    ctx.drawImage(img,sx,art[1]*sh,cropWidth,sh,x+(width-w)/2,y+40,w,h);
   }
   const textY=hasImage?y+(single?500:rowHeight*.58):y+(single?125:60);
   ctx.fillStyle=ink;lines(ctx,row.name,x+28,textY,width-56,single?54:30,2);
   ctx.fillStyle=accent;lines(ctx,row.amount,x+28,textY+(single?100:54),width-56,single?36:24,layout.dataOnly&&!single?1:2);
   if(row.weights){ctx.fillStyle=muted;lines(ctx,row.weights,x+28,textY+(single?165:96),width-56,layout.dataOnly&&!single?18:20,1);}
   if(!hasImage&&single){ctx.fillStyle=accent;ctx.font='850 200px system-ui';ctx.fillText(String(row.kind==='cardio'?row.minutes:row.sets),x+40,y+490);ctx.font='600 40px system-ui';ctx.fillText(shareText(model,row.kind==='cardio'?'分钟已记录':'组已记录',row.kind==='cardio'?'MIN LOGGED':'SETS LOGGED'),x+300,y+465);ctx.fillStyle=muted;ctx.font='500 23px system-ui';ctx.fillText(shareText(model,'实际完成 · '+(row.muscle||'训练'),'LOGGED WORK · '+(model.en?'':row.muscle)),x+28,y+rowHeight-48);}
  }
  ctx.fillStyle=muted;ctx.font='600 23px system-ui';ctx.fillText(shareText(model,'本次训练涉及部位','TRAINED AREAS'),62,1145);
  const names={'胸部':'Chest','背部':'Back','肩部':'Shoulders','核心':'Core','臀部':'Glutes','股四头肌':'Quads','腘绳肌':'Hamstrings','肱二头肌':'Biceps','肱三头肌':'Triceps','心肺':'Cardio','活动度':'Mobility','小腿':'Calves'};
  ctx.fillStyle=accent;lines(ctx,model.muscles.map(m=>model.en?(names[m]||m):m).join(' · '),62,1195,950,27,2);
  ctx.fillStyle=muted;ctx.font='21px system-ui';ctx.fillText(shareText(model,'为今天的自己，留下一份记录。','A record of showing up for yourself.'),62,1300);
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
 return {open(){opener=document.activeElement;const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);dialog.innerHTML=`<div class="daily-share-heading"><h2>${t('我的训练分享卡','My workout share card')}</h2><button type="button" data-card-close aria-label="${t('关闭','Close')}">×</button></div><p>${t('记录今天的训练，保存或分享这一刻。','Keep a record of today. Save or share your workout.')}</p><div class="daily-share-options"><label>${t('图片比例','Image format')}<select data-card-format><option value="feed">4:5 · ${t('动态','Feed')}</option><option value="story">9:16 · Story</option></select></label><label><input type="checkbox" data-card-weights>${t('显示实际负重（默认隐藏）','Include actual weights (hidden by default)')}</label></div><p data-card-status role="status" aria-live="polite"></p><div data-card-previews></div><div class="daily-share-actions"><button type="button" data-card-save disabled>${t('保存 PNG','Save PNG')}</button><button type="button" data-card-share disabled>${t('分享图片','Share images')}</button><button type="button" data-card-retry>${t('重新生成','Regenerate')}</button></div>`;dialog.showModal();generate();}};
}
