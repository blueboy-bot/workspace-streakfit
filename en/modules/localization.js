import {englishUI} from './locales/en-ui.js';
import {movementPhrases} from './locales/en-movements.js';
const phrases={...englishUI,...movementPhrases};
const han=/[\u3400-\u9fff]/;
const escapePattern=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const phrasePattern=new RegExp(Object.keys(phrases).sort((a,b)=>b.length-a.length).map(escapePattern).join('|'),'g');
let language='zh';
const textSources=new WeakMap(),attributeSources=new WeakMap();
let observer;
export function uiText(text){return language==='en'?translateText(text):text;}
export function currentLanguage(){return language;}
export function translateText(source){
 const text=String(source);if(!han.test(text))return text;
 const trimmed=text.trim();if(phrases[trimmed])return text.replace(trimmed,phrases[trimmed]);
 let result=text.replace(/第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/g,'Step $1 of $2')
 .replace(/第\s*(\d+)\s*周/g,'Week $1').replace(/第\s*(\d+)\s*个动作/g,'Exercise $1')
 .replace(/练\s*(\d+)\s*天，休\s*(\d+)\s*天/g,'Train $1 days, rest $2 days')
 .replace(/每周\s*(\d+)\s*天/g,'$1 days/week');
 result=result.replace(/(\d+)月(\d+)日(?:星期([一二三四五六日]))?/g,(_,m,d,w)=>`${w?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][['日','一','二','三','四','五','六'].indexOf(w)]+', ':''}${['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m)-1]} ${d}`)
 .replace(/(\d{4})年(\d+)月/g,(_,y,m)=>`${['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m)-1]} ${y}`);
 result=result.replace(/(\d+)\s*个动作/g,'$1 exercises').replace(/(\d+)\s*个力量工作组/g,'$1 working sets');
 result=result.replace(phrasePattern,(key,offset,whole)=>{
 // Single-character labels are valid in isolation, never inside untranslated words.
 if(key.length===1&&(han.test(whole[offset-1]||'')||han.test(whole[offset+1]||'')))return key;
 return phrases[key];
 });
 return result.replace(/(kg|lb)\(/g,'$1 (').replace(/(\d)(sec|min)\b/g,'$1 $2').replace(/reps \/ sets\b/g,'reps / set').replace(/，/g,', ').replace(/：/g,': ').replace(/；/g,'; ').replace(/、/g,', ').replace(/。/g,'. ').replace(/（/g,'(').replace(/）/g,')');
}
function eligible(element){return !element.closest('script,style,textarea,[data-user-content],[contenteditable=true]');}
export function localizeDocument(){
 if(!globalThis.document?.documentElement)return;
 observer?.disconnect();
 try{
  document.documentElement.lang=language==='en'?'en':'zh-CN';
  // Preserve canonical values before changing labels on implicit-value options.
  document.querySelectorAll('option:not([value])').forEach(option=>option.setAttribute('value',option.value));
  const walker=document.createTreeWalker(document.documentElement,4);let node;
  while((node=walker.nextNode())){
   if(!eligible(node.parentElement))continue;
   const old=textSources.get(node),source=old&&node.nodeValue===old.last?old.source:node.nodeValue;
   const last=language==='en'?(node.parentElement.closest('.stat')&&/^\d+ 次$/.test(source.trim())?source.trim().replace(' 次',' workouts'):translateText(source)):source;
   textSources.set(node,{source,last});if(node.nodeValue!==last)node.nodeValue=last;
  }
  document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(element=>{
   if(!eligible(element))return;
   const records=attributeSources.get(element)||{};
   for(const name of ['placeholder','title','aria-label','alt']){
    if(!element.hasAttribute(name))continue;
    const current=element.getAttribute(name),old=records[name];
    const source=old&&current===old.last?old.source:current,last=language==='en'?translateText(source):source;
    records[name]={source,last};if(current!==last)element.setAttribute(name,last);
   }attributeSources.set(element,records);
  });
  const picker=document.querySelector('#language-select');if(picker)picker.value=language;
 }finally{observer?.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});}
}
export function setLanguage(value){
 language=value==='en'?'en':'zh';
 try{localStorage.setItem('streakfit-language',language);}catch{/* Display changes still work without storage. */}
 localizeDocument();
}
export function initializeLanguage(){
 if(!globalThis.document?.documentElement)return;
 let saved;try{saved=localStorage.getItem('streakfit-language');}catch{}
 const requested=new URL(globalThis.location.href).searchParams.get('lang');
 language=(requested||saved||globalThis.STREAKFIT_LANGUAGE)==='en'?'en':'zh';
 document.querySelector('#language-select')?.addEventListener('change',event=>setLanguage(event.target.value));
 observer=new MutationObserver(()=>localizeDocument());localizeDocument();
}
export function untranslatedText(){
 if(!globalThis.document?.documentElement)return [];
 const found=new Set(),walker=document.createTreeWalker(document.documentElement,4);let node;
 while((node=walker.nextNode()))if(eligible(node.parentElement)&&han.test(node.nodeValue))found.add((textSources.get(node)?.source||node.nodeValue).trim());
 document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(element=>{if(!eligible(element))return;for(const name of ['placeholder','title','aria-label','alt'])if(han.test(element.getAttribute(name)||''))found.add(attributeSources.get(element)?.[name]?.source||element.getAttribute(name));});
 return [...found];
}
