import {accountIdentity,passwordIssues,publicAccountConfig} from './account-rules.js';
import {createAccountClient} from './account-client.js';
import {createAccountSync} from './account-sync.js';
import {canonicalAccountData} from './account-data.js';

export function initialWorkspaceKey(storage) {
  try { const id=JSON.parse(storage.getItem('streakfit-account-session-v1')||'null')?.user?.id;
    if(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||''))return 'streakfit-v1:'+id;
  } catch {} return 'streakfit-v1';
}
export function accountCloudData(value) {
  const data=structuredClone(value);delete data.progressPhotos;
  return data;
}
export function startAccounts({readState,replaceState,validate,freshState,onWorkspaceReady=()=>{},storage=localStorage,configPromise}) {
  const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=document.createElement('button');button.id='account-entry';button.textContent='登录 / 注册';
  document.querySelector('.header-actions')?.append(button);
  const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.className='account-dialog';document.body.append(dialog);
  let client=null,sync=null,activeUid=null,workspaceKey=initialWorkspaceKey(storage),view='login',channel='email',identity='',recovery=false,busy=false,available=false;
  let status='本机保存',statusDetail='',remoteConflict=null,debounce=null,resendUntil=0,configError='',generation=0;
  const describe=()=>client?.user?.email||client?.user?.phone||'登录 / 注册';
  function updateStatus(kind,message='') {
    status={synced:'已同步到账号',pending:'已保存本机 · 待同步',conflict:'其他设备有更新',offline:'离线使用本机记录'}[kind]||kind;
    statusDetail=message;button.textContent=activeUid?'我的账号':workspaceKey==='streakfit-v1'?'登录 / 注册':'账号 · 离线';
    const el=dialog.querySelector('[data-sync-status]');if(el)el.textContent=status+(message?'：'+message:'');
  }
  const closeButton='<button type="button" class="account-close" data-account="close" aria-label="关闭账号窗口">×</button>';
  function formPassword(confirm=false){return `<label>${view==='reset'?'新密码':'密码'}<input name="password" type="password" required autocomplete="${view==='login'?'current-password':'new-password'}" maxlength="72"></label><button type="button" data-account="show-password">显示密码</button>${confirm?'<label>再次输入密码<input name="confirm" type="password" required autocomplete="new-password" maxlength="72"></label><p class="muted">至少11个字符，含大小写字母、数字和符号；同一数字不能连续出现3次。</p><p data-password-feedback role="status"></p>':''}`;}
  function display() {
    const error='<p id="account-feedback" role="alert"></p>';
    const syncText=escape(status+(statusDetail?'：'+statusDetail:''));
    let html='';
    if(view==='loading')html='<h2>正在读取账号记录…</h2><p>本机记录与账号空间独立保存，请稍候。</p>';
    else if(view==='home')html=`<h2>我的账号</h2><p class="account-identity">${escape(describe())}</p><p data-sync-status role="status">${syncText}</p><p class="muted">资料、计划、训练与学习记录随账号同步。进度照保留在本机，JSON备份包含照片。</p><button class="primary" data-account="sync">立即同步</button><button data-account="change">修改密码</button><button data-account="logout">退出此设备</button>${error}`;
    else if(view==='import')html=`<h2>从哪里开始？</h2><p>这个账号还没有云端记录。是否把当前设备的访客记录导入账号？访客原始记录会保留。</p><button class="primary" data-account="import">导入本机访客记录</button><button data-account="fresh">建立新的账号计划</button>${error}`;
    else if(view==='conflict')html=`<h2>两台设备的记录有变化</h2><p>请先导出本机备份，再选择需要保留的版本。云端记录时间：${escape(remoteConflict?.updated_at||'未知')}。选择前不会覆盖本机训练。</p><button data-account="backup">导出本机备份</button><button data-account="use-cloud">使用云端记录</button><button data-account="use-local">用本机记录更新云端</button>${error}`;
    else if(view==='logout')html=`<h2>还有记录未同步</h2><p>退出后，未同步记录仍保留在这个账号的本机空间。再次登录同一账号后可继续同步。</p><button class="primary" data-account="sync">先同步</button><button data-account="logout-confirm">保留本机记录并退出</button>${error}`;
    else if(view==='verify')html=`<h2>验证${channel==='email'?'邮箱':'手机号'}</h2><p>请输入发送至 ${escape(identity)} 的6位验证码。</p><form data-account-form="verify"><label>验证码<input name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="primary" type="submit">验证并继续</button></form><button data-account="resend">重新发送验证码</button><button data-account="login">返回登录</button>${error}`;
    else if(view==='reset')html=`<h2>设置新密码</h2><form data-account-form="reset">${formPassword(true)}<button class="primary" type="submit">保存新密码</button></form>${error}`;
    else html=`<h2>${view==='register'?'创建账号':view==='recover'?'找回密码':'欢迎回来'}</h2><p>用邮箱或手机号登录，训练记录随账号保存。</p><div class="account-tabs"><button data-account="email" aria-pressed="${channel==='email'}">邮箱</button><button data-account="phone" aria-pressed="${channel==='phone'}">手机号</button></div><form data-account-form="${view}"><label>${channel==='email'?'邮箱地址':'手机号（含国家区号）'}<input name="identity" type="${channel==='email'?'email':'tel'}" autocomplete="username" value="${escape(identity)}" required maxlength="254" placeholder="${channel==='email'?'you@example.com':'+1 或 +86 开头'}"></label>${view==='recover'?'':formPassword(view==='register')}<button class="primary" type="submit" ${available?'':'disabled'}>${view==='register'?'注册并发送验证码':view==='recover'?'发送找回验证码':'登录'}</button></form>${error}${!available?`<p class="notice">${escape(configError||'账号服务尚未开通；当前记录继续保存在本机。')}</p>`:''}<div class="account-tabs"><button data-account="${view==='register'?'login':'register'}">${view==='register'?'已有账号，去登录':'创建账号'}</button><button data-account="recover">忘记密码</button></div>`;
    dialog.innerHTML=closeButton+html;
  }
  function show(next){view=next;display();if(!dialog.open)dialog.showModal();}
  function feedback(text){const el=dialog.querySelector('#account-feedback');if(el)el.textContent=text;}
  function setBusy(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=value);if(!value&&!available)dialog.querySelector('[type=submit]')?.setAttribute('disabled','');}
  function checkpoint(uid,reason,value){storage.setItem('streakfit-account-backup:'+uid+':'+reason,JSON.stringify(value));}
  function install(value,uid){
    const key=uid?'streakfit-v1:'+uid:'streakfit-v1';storage.setItem(key,JSON.stringify(value));
    workspaceKey=key;replaceState(value,key);activeUid=uid;
  }
  function localValue(key){const raw=storage.getItem(key);return raw?validate(JSON.parse(raw)):null;}
  function resolveConflict(remote){
    if(!remote||!Number.isSafeInteger(Number(remote.revision)))throw Error('无法读取云端版本，请稍后重新同步。');
    validate(remote.data);remoteConflict=remote;updateStatus('conflict');show('conflict');
  }
  function queue(){clearTimeout(debounce);debounce=setTimeout(()=>push(),1200);}
  async function push(){
    if(!sync||busy||remoteConflict)return;
    if(!navigator.onLine){updateStatus('offline');return;}
    await sync.flush();
    if(sync?.pending&&status==='已保存本机 · 待同步'&&!statusDetail)queue();
  }
  function createSync(uid){
    sync?.close();sync=createAccountSync({uid,storage,read:()=>client.readData(uid),write:(revision,data)=>client.writeData(revision,data,uid),onStatus:updateStatus,onConflict:resolveConflict});
  }
  async function bindUser({cached=false}={}){
    show('loading');const uid=client.user.id,epoch=++generation;createSync(uid);activeUid=uid;
    let local=null;
    try{
      try{local=localValue('streakfit-v1:'+uid);}catch{checkpoint(uid,'corrupt-original',storage.getItem('streakfit-v1:'+uid));}
      if(local)install(local,uid);else install(freshState(),uid);sync.attach(accountCloudData(readState()));
      const remote=await client.readData(uid);if(epoch!==generation)return;
      if(remote){
        const validated=validate(remote.data),revision=Number(remote.revision);
        if(!Number.isSafeInteger(revision)||revision<1)throw Error('云端数据版本无效。');
        if(local&&sync.pending&&revision===sync.revision){sync.changed(accountCloudData(readState()));updateStatus('pending');queue();}
        else if(local&&!sync.isClean(accountCloudData(local))&&canonicalAccountData(accountCloudData(local))!==canonicalAccountData(accountCloudData(validated))){resolveConflict(remote);}
        else {if(local)validated.progressPhotos=local.progressPhotos||[];install(validated,uid);sync.baseline(revision,accountCloudData(readState()));sync.attach(accountCloudData(readState()));updateStatus('synced');}
      } else if(local){sync.baseline(0);sync.changed(accountCloudData(readState()));queue();}
      else show('import');
    }catch(error){if(epoch!==generation)return;updateStatus('pending',error.message);if(!local&&!cached){feedback('暂时无法读取云端数据。联网后请点“立即同步”；未覆盖云端记录。');}}
    finally{if(view==='loading'){dialog.close();onWorkspaceReady();}}
  }
  async function refresh(){
    if(remoteConflict){resolveConflict(await client.readData(activeUid));return;}
    if(sync?.pending){await sync.flush();return;}
    const remote=await client.readData(activeUid);
    if(remote){const value=validate(remote.data);value.progressPhotos=readState().progressPhotos||[];install(value,activeUid);sync.baseline(Number(remote.revision),accountCloudData(value));sync.attach(accountCloudData(value));updateStatus('synced');}
    else if(!storage.getItem('streakfit-sync-v1:'+activeUid))show('import');
    else {sync.baseline(0);sync.changed(accountCloudData(readState()));await sync.flush();}
  }
  async function logout(){
    generation++;clearTimeout(debounce);sync?.close();sync=null;remoteConflict=null;
    await client.logout();const guest=localValue('streakfit-v1')||freshState();install(guest,null);updateStatus('本机保存');dialog.close();onWorkspaceReady();
  }
  button.addEventListener('click',()=>{show(remoteConflict?'conflict':activeUid?'home':'login');});
  dialog.addEventListener('cancel',event=>{if(busy||['loading','import','conflict'].includes(view))event.preventDefault();});
  dialog.addEventListener('input',event=>{if(event.target.name==='password'){const el=dialog.querySelector('[data-password-feedback]');if(el)el.textContent=passwordIssues(event.target.value).join('；')||'密码格式符合要求';}});
  dialog.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!available)return;const form=event.target,fields=new FormData(form),kind=form.dataset.accountForm;
    try{
      if(['login','register','recover'].includes(kind))identity=accountIdentity(fields.get('identity'),channel).value;
      if(kind==='register'||kind==='reset'){const issues=passwordIssues(fields.get('password'));if(issues.length)throw Error(issues.join('；'));if(fields.get('password')!==fields.get('confirm'))throw Error('两次输入的密码不一致。');}
      setBusy(true);feedback('正在处理…');
      if(kind==='register'){await client.signup(identity,fields.get('password'));recovery=false;resendUntil=Date.now()+60000;show('verify');}
      if(kind==='recover'){await client.recover(identity);recovery=true;resendUntil=Date.now()+60000;show('verify');}
      if(kind==='login'){await client.login(identity,fields.get('password'));form.reset();dialog.close();await bindUser();}
      if(kind==='verify'){await client.verify(identity,String(fields.get('code')),recovery);if(recovery)show('reset');else{dialog.close();await bindUser();}}
      if(kind==='reset'){await client.changePassword(fields.get('password'));form.reset();recovery=false;dialog.close();if(!activeUid)await bindUser();else show('home');}
    }catch(error){feedback(error.message);}finally{setBusy(false);}
  });
  dialog.addEventListener('click',async event=>{
    const action=event.target.closest('[data-account]')?.dataset.account;if(!action||busy)return;
    if(action==='close'){if(['loading','import','conflict'].includes(view)){feedback('请先选择数据来源，或退出账号后继续使用访客记录。');return;}dialog.close();return;}
    if(['login','register','recover'].includes(action)){show(action);return;}
    if(action==='email'||action==='phone'){channel=action;identity='';display();return;}
    if(action==='show-password'){dialog.querySelectorAll('input[name=password],input[name=confirm]').forEach(el=>el.type=el.type==='password'?'text':'password');event.target.textContent=event.target.textContent==='显示密码'?'隐藏密码':'显示密码';return;}
    try{
      setBusy(true);
      if(action==='resend'){if(Date.now()<resendUntil)throw Error('请等待 '+Math.ceil((resendUntil-Date.now())/1000)+' 秒后重试。');await (recovery?client.recover(identity):client.resend(identity));resendUntil=Date.now()+60000;feedback('验证码已重新发送，请检查邮箱或短信。');}
      if(action==='change')show('reset');
      if(action==='logout'){if(sync?.pending||remoteConflict)show('logout');else await logout();}
      if(action==='logout-confirm')await logout();
      if(action==='sync'){await refresh();if(view==='home'||view==='logout')feedback(sync?.pending?'仍有记录待同步，请查看同步状态。':'同步检查完成。');}
      if(action==='import'||action==='fresh'){
        const data=action==='import'?(localValue('streakfit-v1')||freshState()):freshState();
        install(data,activeUid);sync.baseline(0);sync.changed(accountCloudData(data));dialog.close();onWorkspaceReady();
      }
      if(action==='backup'){const url=URL.createObjectURL(new Blob([JSON.stringify({format:'streakfit-backup',version:1,data:readState()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='STREAKFIT-before-sync.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('备份下载已发起，请确认浏览器保存成功。');}
      if(action==='use-cloud'){const value=validate(remoteConflict.data);checkpoint(activeUid,'before-cloud',readState());value.progressPhotos=readState().progressPhotos||[];install(value,activeUid);sync.baseline(Number(remoteConflict.revision),accountCloudData(value));sync.attach(accountCloudData(value));remoteConflict=null;updateStatus('synced');show('home');}
      if(action==='use-local'){checkpoint(activeUid,'remote-conflict',remoteConflict.data);sync.baseline(Number(remoteConflict.revision));remoteConflict=null;sync.changed(accountCloudData(readState()));show('home');}
    }catch(error){feedback(error.message);}finally{setBusy(false);if(sync?.pending&&!remoteConflict)queue();}
  });
  globalThis.addEventListener('online',()=>{if(activeUid)refresh().catch(error=>updateStatus('pending',error.message));});
  globalThis.addEventListener('storage',event=>{if(event.key==='streakfit-account-session-v1'||event.key===workspaceKey){generation++;sync?.close();sync=null;clearTimeout(debounce);location.reload();}});
  async function bootstrap(){
    try{
      const raw=await configPromise;publicAccountConfig(raw);available=raw?.enabled===true;
      client=createAccountClient(raw,{storage});
      if(client.user){try{await client.restore();await bindUser({cached:true});}catch(error){if(error.status===401){await logout();}else{activeUid=client.user.id;createSync(activeUid);sync.attach(accountCloudData(readState()));updateStatus('offline',error.message);}}}
    }catch(error){configError='账号服务尚未连接：'+error.message;}
    updateStatus(status,statusDetail);
    if(dialog.open&&['login','register','recover'].includes(view)){
      const submit=dialog.querySelector('[type=submit]');if(submit)submit.disabled=!available;
      const note=dialog.querySelector('.notice');if(note){if(available)note.remove();else if(configError)note.textContent=configError;}
    }
  }
  const ready=bootstrap();
  return {ready,localSaved(value){if(!sync||!activeUid)return;sync.changed(accountCloudData(value));queue();}};
}
