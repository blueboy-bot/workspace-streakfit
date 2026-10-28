import {currentLanguage} from './localization.js';
let confirming=false;
// Promise-based confirmation, theme-aware and intentionally conservative on dismissal.
export function appConfirm({title,message,confirmText,cancelText,danger=false}={}){
 if(confirming)return Promise.resolve(false);
 confirming=true;const en=currentLanguage()==='en',opener=document.activeElement;
 const dialog=document.createElement('dialog');dialog.className='app-confirm';dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','app-confirm-title');dialog.setAttribute('aria-describedby','app-confirm-message');
 const heading=document.createElement('h2');heading.id='app-confirm-title';heading.textContent=title||(en?'Please confirm':'请确认');
 const body=document.createElement('p');body.id='app-confirm-message';body.textContent=message||'';
 const actions=document.createElement('div');actions.className='app-confirm-actions';
 const cancel=document.createElement('button');cancel.type='button';cancel.dataset.dialogCancel='';cancel.textContent=cancelText||(en?'Cancel':'取消');cancel.autofocus=true;
 const accept=document.createElement('button');accept.type='button';accept.className='primary';accept.dataset.dialogConfirm='';accept.dataset.danger=String(danger);accept.textContent=confirmText||(en?'Confirm':'确认');
 actions.append(cancel,accept);dialog.append(heading,body,actions);document.body.append(dialog);
 return new Promise(resolve=>{dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();confirming=false;resolve(accepted);queueMicrotask(()=>{if(opener?.isConnected)opener.focus();});},{once:true});cancel.onclick=()=>dialog.close('cancel');accept.onclick=()=>dialog.close('confirm');dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close('cancel');});dialog.showModal();});
}
