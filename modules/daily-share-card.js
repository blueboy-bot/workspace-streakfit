import {overviewArtwork,reviewedArtwork} from './daily-overview.js';
import {commonStrengthArtwork} from './visual-planning.js';
// Read-only summaries: only submitted logs, never prescribed repetitions or loads.
import {fromKilograms} from './units.js';
export const shareArtwork={incline:[0,0,'finish',2,1,{x:50,y:150,width:800,height:700,sourceWidth:1774,sourceHeight:887}],ropepush:[1,0,'finish',2,1,{x:1110,y:0,width:610,height:845,sourceWidth:1774,sourceHeight:887}],bench:[0,0,'gym',2,3],chestsupported:[1,0,'gym',2,3],pulldown:[0,1,'gym',2,3],fly:[1,1,'gym',2,3],lateral:[0,2,'gym',2,3],curl:[1,2,'gym',2,3],pushup:[0,0,'upper'],row:[1,0,'upper'],shoulderpress:[0,1,'upper'],deadbug:[1,1,'upper'],squat:[0,0,'lower'],bridge:[1,0,'lower'],hinge:[0,1,'lower'],plank:[1,1,'lower']};
function shareMovementArt(id){
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
  else{sets=valid.length;const reps=valid.map(l=>l.reps);amount=(perSide?(en?'Per side · ':'每侧 · '):'')+`${sets} ${en?'sets':'组'} · `+(new Set(reps).size===1?`${reps[0]} ${en?'reps / set':'次 / 组'}`:`${reps.join(' / ')} ${en?'reps':'次'}`);}
  const weights=options.showWeights&&kind==='strength'?valid.map(log=>{
   if(!positive(log.weight))return en?'No external load':'无外加负重';
   const amount=Math.round(fromKilograms(log.weight,options.unit)*10)/10;
   return `${amount} ${options.unit==='lb'?'lb':'kg'}${log.weightUnit==='per-dumbbell'?(en?' / dumbbell':' / 单只'):''}`;
  }):[];
  rows.push({id,name,english:en?'':parts.slice(1).join(' · '),kind,amount,sets,minutes,weights:weights.length?[...new Set(weights)].join(' · '):'',muscle:move.muscle||'',art:shareMovementArt(id)});
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
export function dailyShareLayout(rows){const columns=rows.length===1?1:2;return {columns,dataOnly:false,rowCount:Math.ceil(rows.length/columns)};}
function shareCutout(image){
 if(!image)return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],white=Math.min(r,g,b);const green=g>r*1.12&&g>b*1.08&&g-r>3;pixels.data[i+3]*=green?0:Math.min(1,(225-white)/25);}
 ctx.putImageData(pixels,0,0);return canvas;
}
export async function renderDailyShareCards(model,{story=false}={}){
 await document.fonts?.ready;
 const images={};
 for(const key of new Set(model.rows.filter(r=>r.art).map(r=>r.art[2]))){const file={upper:'share-blue-upper.png',lower:'share-blue-lower.png',gym:'share-blue-gym.png',finish:'share-blue-finish.png'}[key]||key;const img=await loadShareImage(new URL('../assets/exercises/'+file,import.meta.url).href);images[key]=shareCutout(img);}
 const canvases=[],pages=Math.ceil(model.rows.length/6),bg=model.dark?'#111c18':'#ffffff',ink=model.dark?'#f0f5f1':'#14221b',muted=model.dark?'#acbeb3':'#596171',accent=model.dark?(model.colorFamily==='blue'?'#a9d9ff':'#b6e86b'):'#1555ff';
 for(let page=0;page<pages;page++){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1350;
  const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,canvas.height);
  ctx.save();ctx.translate(0,story?245:0);
  ctx.fillStyle=ink;ctx.font='900 italic 44px system-ui';ctx.fillText('STREAKFIT',48,74);ctx.font='500 22px system-ui';ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(model.date,1032,70);ctx.textAlign='left';
  ctx.fillStyle=accent;ctx.fillRect(48,94,150,5);
  ctx.font=`900 ${model.en?56:78}px system-ui`;ctx.fillStyle=ink;ctx.fillText(shareText(model,model.complete?'今日训练完成':'本次训练记录',model.complete?'WORKOUT COMPLETE':'WORKOUT RECORDED'),48,180);
  if(pages>1){ctx.font='500 20px system-ui';ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(`${page+1} / ${pages}`,1032,240);ctx.textAlign='left';}
  ctx.fillStyle=accent;ctx.font='700 30px system-ui';ctx.fillText(`${model.rows.length} ${shareText(model,'个动作','exercises')}  ·  ${model.sets} ${shareText(model,'组记录','sets logged')}${model.minutes?`  ·  ${model.minutes} ${shareText(model,'分钟有氧','cardio min')}`:''}`,50,245);
  const pageRows=model.rows.slice(page*6,page*6+6),layout=dailyShareLayout(pageRows),rowHeight=820/layout.rowCount;
  for(let index=0;index<pageRows.length;index++){
   const row=pageRows[index],single=pageRows.length===1,wide=layout.columns===1||(pageRows.length===3&&index===2),x=48+(index%layout.columns)*501,y=285+Math.floor(index/layout.columns)*rowHeight,width=wide?984:483;
   ctx.fillStyle=model.dark?'#1c2b23':'#f4f6f7';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,width,rowHeight-18,20);else ctx.rect(x,y,width,rowHeight-18);ctx.fill();ctx.strokeStyle=model.dark?'#2c3e33':'#e4eae7';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle=accent;ctx.font='650 20px system-ui';ctx.fillText(String(page*6+index+1).padStart(2,'0'),x+20,y+36);
   const art=row.art,img=art?images[art[2]]:null,hasImage=!!(art&&img);
   if(hasImage){
    const sw=img.width/(art[3]||2),sh=img.height/(art[4]||2);let sx=art[0]*sw,sy=art[1]*sh,cw=sw,ch=sh;
    if(art[5]){const c=art[5];sx=c.x*img.width/c.sourceWidth;sy=c.y*img.height/c.sourceHeight;cw=c.width*img.width/c.sourceWidth;ch=c.height*img.height/c.sourceHeight;}
    else if(art[2]==='gym'){const c=[[60,0,535,385],[700,0,440,390],[165,394,390,410],[695,394,525,415],[115,810,430,440],[785,810,340,440]][art[1]*2+art[0]];sx=c[0]*img.width/1254;sy=c[1]*img.height/1254;cw=c[2]*img.width/1254;ch=c[3]*img.height/1254;}
    else if(art[2]==='upper'&&art[1]===1){sx=art[0]===0?0:img.width*.45;cw=img.width*(art[0]===0?.45:.55);}
    const maxH=single?420:rowHeight*(row.weights?.46:.58),maxW=width-60,scale=Math.min(maxW/cw,maxH/ch),w=cw*scale,h=ch*scale;
    ctx.drawImage(img,sx,sy,cw,ch,x+(width-w)/2,y+14,w,h);
   }else{ // Labelled body diagram keeps the pictorial card without inventing an exercise pose.
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x+width/2,y+rowHeight*.25,17,0,Math.PI*2);ctx.fill();ctx.fillRect(x+width/2-23,y+rowHeight*.25+25,46,55);ctx.lineWidth=12;ctx.strokeStyle=accent;ctx.beginPath();ctx.moveTo(x+width/2-23,y+rowHeight*.25+35);ctx.lineTo(x+width/2-52,y+rowHeight*.25+75);ctx.moveTo(x+width/2+23,y+rowHeight*.25+35);ctx.lineTo(x+width/2+52,y+rowHeight*.25+75);ctx.stroke();ctx.fillStyle=muted;ctx.font='16px system-ui';ctx.fillText(shareText(model,'部位示意 · 动作图待补','AREA DIAGRAM'),x+24,y+rowHeight*.57);
   }
   const textY=y+(single?500:rowHeight*(row.weights?.63:.73));
   ctx.fillStyle=ink;lines(ctx,row.name,x+28,textY,width-56,single?48:rowHeight<300?23:29,1);
   ctx.fillStyle=accent;lines(ctx,row.amount,x+28,textY+(single?100:rowHeight<300?34:50),width-56,single?36:rowHeight<300?18:23,1);
   if(row.weights){ctx.fillStyle=muted;lines(ctx,row.weights,x+28,textY+(single?165:rowHeight<300?63:91),width-56,rowHeight<300?16:20,1);}

  }
  ctx.fillStyle=muted;ctx.font='600 23px system-ui';ctx.fillText(shareText(model,'本次训练涉及部位','TRAINED AREAS'),50,1150);
  const names={'胸部':'Chest','背部':'Back','肩部':'Shoulders','核心':'Core','臀部':'Glutes','股四头肌':'Quads','腘绳肌':'Hamstrings','肱二头肌':'Biceps','肱三头肌':'Triceps','心肺':'Cardio','活动度':'Mobility','小腿':'Calves'};
  ctx.fillStyle=accent;lines(ctx,model.muscles.map(m=>model.en?(names[m]||m):m).join(' · '),50,1195,980,26,2);
  ctx.strokeStyle=model.dark?'#34463c':'#dce3df';ctx.beginPath();ctx.moveTo(48,1255);ctx.lineTo(1032,1255);ctx.stroke();ctx.fillStyle=muted;ctx.font='20px system-ui';ctx.fillText(shareText(model,'为今天的自己，留下一份记录。','A record of showing up for yourself.'),50,1300);ctx.font='600 15px system-ui';ctx.textAlign='right';ctx.fillText('MOVE AT YOUR OWN PACE',1032,1300);ctx.textAlign='left';
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
   blobs.forEach((blob,index)=>{const url=URL.createObjectURL(blob);urls.push(url);const figure=document.createElement('figure'),img=document.createElement('img'),link=document.createElement('a');img.src=url;img.alt=t(`训练分享卡，第 ${index+1} 张`,`Workout share card ${index+1}`);link.href=url;link.hidden=blobs.length===1;link.download=files[index].name;link.textContent=t(`保存第 ${index+1} 张 PNG`,`Save PNG ${index+1}`);figure.append(img,link);dialog.querySelector('[data-card-previews]').append(figure);});
   dialog.querySelector('[data-card-save]').disabled=false;dialog.querySelector('[data-card-share]').disabled=false;
   status(t(`已生成 ${files.length} 张`,`${files.length} cards ready`));
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
 return {open(){opener=document.activeElement;const model=getModel({}),t=(zh,en)=>shareText(model,zh,en);dialog.innerHTML=`<div class="daily-share-heading"><h2>${t('训练卡','Workout card')}</h2><button type="button" data-card-close aria-label="${t('关闭','Close')}">×</button></div><div class="daily-share-options"><label><select data-card-format aria-label="${t('图片比例','Image format')}"><option value="feed">4:5 · ${t('动态','Feed')}</option><option value="story">9:16 · Story</option></select></label><label><input type="checkbox" data-card-weights>${t('显示重量','Show weights')}</label></div><p data-card-status role="status" aria-live="polite"></p><div data-card-previews></div><div class="daily-share-actions"><button type="button" data-card-save disabled>${t('保存 PNG','Save PNG')}</button><button type="button" data-card-share disabled>${t('分享图片','Share images')}</button><button type="button" data-card-retry>${t('重新生成','Regenerate')}</button></div>`;dialog.showModal();generate();}};
}
