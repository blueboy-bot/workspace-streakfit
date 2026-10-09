import {accountIdentity,passwordIssues} from '../../../modules/account-rules.js';
export function createAccountGateway({url,anonKey,serviceKey,allowedOrigins,fetcher=fetch}) {
  return async request => {
    const origin=request.headers.get('Origin');
    const allowed=!origin||allowedOrigins.includes(origin);
    const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(origin&&allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if(!allowed)return reply(403,{message:'来源不允许。'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply(405,{message:'Method not allowed'});
    if(!url||!anonKey||!serviceKey)return reply(503,{message:'账号后端尚未配置。'});
    try {
      const text=await request.text();if(text.length>4096)return reply(413,{message:'请求过大。'});
      const body=JSON.parse(text),issues=passwordIssues(body.password);
      if(issues.length)return reply(400,{message:issues.join('；')});
      const api=async(path,payload,key,token=key,method='POST')=>{
        const r=await fetcher(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)});
        const data=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(Error(data?.message||data?.msg||data?.error_description||'请求未完成。'),{status:r.status});return data;
      };
      if(body.action==='change-password') {
        const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
        if(!token)return reply(401,{message:'请先验证身份。'});
        await api('/auth/v1/user',null,anonKey,token,'GET');
        await api('/auth/v1/user',{password:body.password},anonKey,token,'PUT');
        return reply(200,{status:'password_changed'});
      }
      if(body.action!=='signup')return reply(400,{message:'无效操作。'});
      const id=accountIdentity(body.identity,body.channel);
      const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serviceKey+':'+ip));
      const ipHash=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
      const ticket=await api('/rest/v1/rpc/reserve_streakfit_signup_ticket',{p_channel:id.channel,p_identity:id.value,p_ip_hash:ipHash},serviceKey);
      await api('/auth/v1/signup',{[id.channel]:id.value,password:body.password,data:{streakfit_signup_ticket:ticket}},anonKey);
      return reply(200,{status:'verification_required',channel:id.channel});
    }catch(error){return reply(error.status||400,{message:error.status===429?'请求过于频繁，请稍后再试。':error.status>=500?'账号服务暂时不可用，请稍后重试。':error.message||'请求未完成。'});}
  };
}
