import {accountIdentity,passwordIssues,publicAccountConfig} from './account-rules.js';
export class AccountError extends Error {
  constructor(message,status=0){super(message);this.status=status;}
}
export function createAccountClient(raw,{fetcher=globalThis.fetch,storage=globalThis.localStorage}={}) {
  const config=publicAccountConfig(raw);
  if(!config) throw Error('账户服务尚未连接。');
  const sessionKey='streakfit-account-session-v1';
  let session=null,refreshing=null,sessionGeneration=0;
  try { session=JSON.parse(storage.getItem(sessionKey)||'null'); } catch { /* invalid session is not workout data */ }
  if(session && (!session.user?.id || !session.access_token || !session.refresh_token)) session=null;
  async function request(path,{body,token,method=body?'POST':'GET'}={}) {
    let response;
    try { response=await fetcher(config.projectUrl+path,{method,cache:'no-store',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)}); }
    catch { throw new AccountError('暂时无法连接账号服务，本机记录会保留。'); }
    const data=await response.json().catch(()=>null);
    if(!response.ok) throw new AccountError(response.status===429?'请求过于频繁，请稍后再试。':response.status===401?'登录已过期，或账号与密码不正确。':data?.message||data?.msg||data?.error_description||'请求未完成，请稍后重试。',response.status);
    return data;
  }
  function remember(data) {
    if(!data?.access_token || !data?.refresh_token || !/^[0-9a-f-]{36}$/i.test(data.user?.id||'')) throw Error('账号服务返回了无效会话。');
    const next={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),user:{id:data.user.id,email:data.user.email,phone:data.user.phone}};
    storage.setItem(sessionKey,JSON.stringify(next));session=next;return session.user;
  }
  async function token(){
    if(!session)throw new AccountError('请先登录。',401);
    if(session.expires_at*1000>Date.now()+60000)return session.access_token;
    if(!refreshing){const epoch=sessionGeneration,uid=session.user.id;refreshing=request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}}).then(data=>{if(epoch!==sessionGeneration||session?.user.id!==uid)throw new AccountError('账号已退出或切换。',401);remember(data);return session.access_token;}).finally(()=>refreshing=null);}
    return refreshing;
  }
  return {
    sessionKey,get user(){return session?.user||null;},
    async restore(){if(!session)return null;const user=await request('/auth/v1/user',{token:await token()});if(user.id!==session.user.id)throw Error('账号身份不一致。');return session.user;},
    async signup(identity,password){const id=accountIdentity(identity);const issues=passwordIssues(password);if(issues.length)throw Error(issues.join('；'));return request('/functions/v1/streakfit-account',{body:{action:'signup',channel:id.channel,identity:id.value,password}});},
    async login(identity,password){const id=accountIdentity(identity);return remember(await request('/auth/v1/token?grant_type=password',{body:{[id.channel]:id.value,password}}));},
    async verify(identity,code,recovery=false){const id=accountIdentity(identity);if(!/^\d{6}$/.test(code))throw Error('请输入 6 位验证码。');return remember(await request('/auth/v1/verify',{body:{[id.channel]:id.value,token:code,type:id.channel==='phone'?'sms':recovery?'recovery':'signup'}}));},
    async resend(identity){const id=accountIdentity(identity);return request('/auth/v1/resend',{body:{[id.channel]:id.value,type:id.channel==='phone'?'sms':'signup'}});},
    async recover(identity){const id=accountIdentity(identity);return request(id.channel==='phone'?'/auth/v1/otp':'/auth/v1/recover',{body:{[id.channel]:id.value,...(id.channel==='phone'?{create_user:false}:{})}});},
    async changePassword(password){const issues=passwordIssues(password);if(issues.length)throw Error(issues.join('；'));await request('/functions/v1/streakfit-account',{token:await token(),body:{action:'change-password',password}});},
    async readData(uid=session?.user.id){const access=await token();if(uid!==session.user.id)throw new AccountError('账号已切换，请重新打开。',401);const rows=await request('/rest/v1/streakfit_user_data?user_id=eq.'+uid+'&select=revision,data,updated_at',{token:access});return rows?.[0]||null;},
    async writeData(revision,data,uid=session?.user.id){const access=await token();if(uid!==session.user.id)throw new AccountError('账号已切换，请重新打开。',401);return request('/rest/v1/rpc/save_streakfit_data',{token:access,body:{expected_revision:revision,payload:data}});},
    async logout(){const access=session?.access_token;sessionGeneration++;session=null;storage.removeItem(sessionKey);if(access){try{await request('/auth/v1/logout?scope=local',{token:access});}catch{/* clear this device even offline */}}}
  };
}
