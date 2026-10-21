const SESSION='streakfit-session', ACTIVE='streakfit-active-user';
const panel=document.querySelector('#account-panel'), message=document.querySelector('#account-status');
let config, session, timer, busy=false, conflict=false;
const say=text=>{message.textContent=text;};
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const userKey=()=>`streakfit-v1:${session.user.id}`;
const metaKey=()=>`${userKey()}:sync`;
const meta=()=>read(metaKey(),{revision:0,dirty:false});
function storeMeta(value){localStorage.setItem(metaKey(),JSON.stringify(value));}
async function request(path,options={}){
 const response=await fetch(config.url+path,{...options,signal:AbortSignal.timeout(20000),headers:{apikey:config.anonKey,'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||config.anonKey}`,...options.headers}});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(value.message||value.msg||value.error_description||`请求失败 (${response.status})`);
 return value;
}
async function fresh(){
 if(!session)throw Error('请先登录');
 if(session.expires_at*1000>Date.now()+60000)return;
 const value=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
 session=value;localStorage.setItem(SESSION,JSON.stringify(value));
}
function changed(){if(!session)return;try{storeMeta({...meta(),dirty:true});clearTimeout(timer);timer=setTimeout(sync,900);say('已保存到本机，等待同步');}catch{say('本机存储空间不足，请导出记录备份');}}
async function sync(){
 if(!session||busy||conflict)return;
 busy=true;
 try{
  await fresh();
  const m=meta();
  const rows=await request('/rest/v1/streakfit_state?select=data,revision');
  const remote=rows[0];
  if(m.dirty){
   if((remote?.revision||0)!==m.revision)throw Error('SYNC_CONFLICT');
   const snapshot=localStorage.getItem(userKey());
   const revision=await request('/rest/v1/rpc/streakfit_save',{method:'POST',body:JSON.stringify({payload:JSON.parse(snapshot),expected_revision:m.revision})});
   const dirty=localStorage.getItem(userKey())!==snapshot;
   storeMeta({revision,dirty});say(dirty?'正在同步新记录…':'已同步到云端');
   if(dirty)timer=setTimeout(sync,900);
  }else if(remote&&remote.revision!==m.revision){
   // A local edit made while downloading must never be discarded.
   if(meta().dirty)throw Error('SYNC_CONFLICT');
   localStorage.setItem(userKey(),JSON.stringify(remote.data));storeMeta({revision:remote.revision,dirty:false});location.reload();
  }else say('已同步到云端');
 }catch(error){
  conflict=error.message.includes('SYNC_CONFLICT');
  say(conflict?'其他设备有新记录。本机记录已保留，请先导出备份，再读取云端。':`同步未完成，记录保留在本机：${error.message}`);
 }finally{busy=false;}
}
function exportData(){
 const data=localStorage.getItem(session?userKey():'streakfit-v1')||'{}';
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='streakfit-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelector('#account-toggle').onclick=()=>{panel.hidden=!panel.hidden;};
document.querySelector('#account-export').onclick=exportData;
document.querySelector('#account-sync').onclick=sync;
document.querySelector('#account-download').onclick=async()=>{
 if(!session||busy)return;
 if(!confirm('将先下载本机备份，再用云端记录替换当前账号的本机记录。继续？'))return;
 busy=true;
 try{await fresh();const rows=await request('/rest/v1/streakfit_state?select=data,revision');if(!rows[0])throw Error('云端暂无记录');exportData();localStorage.setItem(userKey()+':backup:'+Date.now(),localStorage.getItem(userKey())||'{}');localStorage.setItem(userKey(),JSON.stringify(rows[0].data));storeMeta({revision:rows[0].revision,dirty:false});location.reload();}catch(e){say(e.message);}finally{busy=false;}
};
document.querySelector('#account-import').onclick=()=>{
 if(!session||busy)return;
 const guest=read('streakfit-v1');if(!guest){say('没有游客记录可导入');return;}
 if(!confirm('用这台设备的游客记录替换当前账号记录？当前账号记录会先导出备份。'))return;
 exportData();localStorage.setItem(userKey(),JSON.stringify(guest));storeMeta({...meta(),dirty:true});location.reload();
};
document.querySelector('#account-logout').onclick=async()=>{
 if(busy)return;
 if(meta().dirty&&!confirm('还有未同步记录，将保留在本机的当前账号下。退出？'))return;
 try{await fresh();await request('/auth/v1/logout',{method:'POST'});}catch{}
 localStorage.removeItem(SESSION);localStorage.removeItem(ACTIVE);location.reload();
};
document.querySelector('#account-form').onsubmit=async event=>{
 event.preventDefault();const submit=event.submitter;submit.disabled=true;
 try{
  const form=new FormData(event.target),email=form.get('email'),password=form.get('password');
  const signup=submit.value==='signup';
  const result=await request(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  if(!result.access_token){say('注册成功，请检查邮箱并验证后登录。');return;}
  localStorage.setItem(SESSION,JSON.stringify(result));localStorage.setItem(ACTIVE,result.user.id);location.reload();
 }catch(error){say(`操作失败：${error.message}`);}finally{submit.disabled=false;}
};
try{
 const response=await fetch('./supabase-config.json');if(!response.ok)throw Error('配置尚未就绪');config=await response.json();
 if(!config.url||!config.anonKey)throw Error('配置尚未就绪');
 session=read(SESSION);
 if(session?.user?.id!==localStorage.getItem(ACTIVE)){session=null;localStorage.removeItem(ACTIVE);}
 document.querySelector('#account-form').hidden=!!session;
 document.querySelector('#account-controls').hidden=!session;
 if(session){document.querySelector('#account-email').textContent=session.user.email;window.addEventListener('streakfit-saved',changed);window.addEventListener('online',sync);window.addEventListener('focus',sync);say('正在连接云端…');await sync();}
 else say('游客模式：记录保存在本机。登录后可跨设备同步，游客记录可手动导入。');
}catch(error){say(`账号服务暂不可用：${error.message}。本地记录仍可使用。`);document.querySelector('#account-form').hidden=true;}
