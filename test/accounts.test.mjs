import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordIssues,accountIdentity,publicAccountConfig} from '../modules/account-rules.js';
import {createAccountClient} from '../modules/account-client.js';
import {createAccountSync} from '../modules/account-sync.js';
import {canonicalAccountData} from '../modules/account-data.js';
import {initialWorkspaceKey,accountCloudData} from '../modules/accounts-ui.js';
import {createAccountGateway} from '../supabase/functions/_shared/gateway.js';
const uid='11111111-2222-4333-8444-555555555555';
const config={projectUrl:'https://medyzsxzbziliphytsgl.supabase.co',publishableKey:'sb_publishable_test'};
const memory=()=>{const items=new Map();return {getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key),items};};
const ok=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const session={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:uid,email:'person@example.com'}};
test('password boundaries and exact repeated-digit rule',()=>{
  for(const p of ['Abcdefg123!','Abcdefgh122!','Abcdefgh123!'])assert.deepEqual(passwordIssues(p),[]);
  for(const p of ['Abcdef123!','abcdefgh123!','ABCDEFGH123!','Abcdefghijk!','Abcdefgh1234','Abcdefgh111!','Abcdefgh9999!'])assert.ok(passwordIssues(p).length,p);
  assert.ok(passwordIssues('Ab1!'+'a'.repeat(69)).some(x=>x.includes('72')));
});
test('identity uses normalized email or international phone; browser refuses private keys',()=>{
  assert.deepEqual(accountIdentity(' PERSON@Example.COM '),{channel:'email',value:'person@example.com'});
  assert.deepEqual(accountIdentity('+1 (416) 555-1234','phone'),{channel:'phone',value:'+14165551234'});
  for(const id of ['4165551234','+0123456789','bad@','a b@example.com'])assert.throws(()=>accountIdentity(id));
  assert.throws(()=>publicAccountConfig({...config,publishableKey:'sb_secret_test'}));
  const jwt='e30.'+btoa(JSON.stringify({role:'service_role'}))+'.x';
  assert.throws(()=>publicAccountConfig({...config,publishableKey:jwt}));
  assert.throws(()=>publicAccountConfig({...config,projectUrl:'http://example.com'}));
});
test('workspace is account-bound; cloud snapshots omit photos and do not mutate originals',()=>{
  const storage=memory();assert.equal(initialWorkspaceKey(storage),'streakfit-v1');
  storage.setItem('streakfit-account-session-v1',JSON.stringify(session));assert.equal(initialWorkspaceKey(storage),'streakfit-v1:'+uid);
  storage.setItem('streakfit-account-session-v1',JSON.stringify({user:{id:'../../other'}}));assert.equal(initialWorkspaceKey(storage),'streakfit-v1');
  const state={profile:{},history:{},progressPhotos:[{data:'local-only'}]};assert.equal(accountCloudData(state).progressPhotos,undefined);assert.equal(state.progressPhotos.length,1);
});
test('registration gateway validates password before issuing any ticket or provider request',async()=>{
  let count=0;const gateway=createAccountGateway({url:config.projectUrl,anonKey:'anon',serviceKey:'service',allowedOrigins:['https://blueboy-bot.github.io'],fetcher:async()=>{count++;return ok({});}});
  const r=await gateway(new Request('https://gateway/',{method:'POST',body:JSON.stringify({action:'signup',identity:'person@example.com',password:'Abcdefgh111!'})}));
  assert.equal(r.status,400);assert.equal(count,0);
});
test('valid signup passes only one-use ticket to provider and returns no secrets or session',async()=>{
  const calls=[];const gateway=createAccountGateway({url:config.projectUrl,anonKey:'anon',serviceKey:'service',allowedOrigins:['https://blueboy-bot.github.io'],fetcher:async(url,options)=>{calls.push({url,options});return ok(calls.length===1?'one-use-ticket':session);}});
  const r=await gateway(new Request('https://gateway/',{method:'POST',headers:{Origin:'https://blueboy-bot.github.io'},body:JSON.stringify({action:'signup',channel:'email',identity:'Person@example.com',password:'Abcdefgh123!'})}));
  assert.equal(r.status,200);const result=await r.text();assert.ok(!result.includes('test-access'));assert.ok(!result.includes('service'));assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1].options.body).data.streakfit_signup_ticket,'one-use-ticket');assert.equal(JSON.parse(calls[0].options.body).p_ip_hash.length,64);
  assert.equal(calls[1].options.headers.apikey,'anon');
});
test('gateway rejects unknown origins; password update authenticates user before forwarding',async()=>{
  const calls=[];const gateway=createAccountGateway({url:config.projectUrl,anonKey:'anon',serviceKey:'service',allowedOrigins:['https://blueboy-bot.github.io'],fetcher:async(url,options)=>{calls.push(options);return ok({});}});
  const body=JSON.stringify({action:'change-password',password:'Abcdefgh123!'});
  assert.equal((await gateway(new Request('https://gateway/',{method:'POST',headers:{Origin:'https://evil.invalid'},body}))).status,403);
  assert.equal((await gateway(new Request('https://gateway/',{method:'POST',body}))).status,401);assert.equal(calls.length,0);
  assert.equal((await gateway(new Request('https://gateway/',{method:'POST',headers:{Authorization:'Bearer user-token'},body}))).status,200);
  assert.deepEqual(calls.map(x=>x.method),['GET','PUT']);assert.ok(calls.every(x=>x.headers.Authorization==='Bearer user-token'));
});
test('client uses verification endpoints, stores no passwords, and refuses another user write',async()=>{
  const storage=memory(),calls=[];const client=createAccountClient(config,{storage,fetcher:async(url,options)=>{calls.push({url,options});return ok(url.includes('signup')?{status:'verification_required'}:session);}});
  await client.signup('person@example.com','Abcdefgh123!');assert.equal(client.user,null);
  await assert.rejects(()=>client.verify('person@example.com','12345'));
  await client.verify('person@example.com','123456');assert.equal(JSON.parse(calls[1].options.body).type,'signup');
  assert.ok(!storage.getItem(client.sessionKey).includes('Abcdefgh123!'));
  await assert.rejects(()=>client.writeData(0,{profile:{},history:{}},'another-user'));
  await client.recover('+14165551234');assert.equal(JSON.parse(calls.at(-1).options.body).create_user,false);
  await client.logout();assert.equal(client.user,null);assert.equal(storage.getItem(client.sessionKey),null);
});
test('offline writes remain pending and recover after reload',async()=>{
  const storage=memory();let fail=true;
  const params={uid,storage,read:async()=>null,write:async()=>{if(fail)throw Error('offline');return {revision:1};}};
  const a=createAccountSync(params);a.changed({profile:{name:'a'},history:{}});await a.flush();assert.ok(a.pending);a.close();
  const b=createAccountSync(params);assert.ok(b.pending);b.attach({profile:{name:'a'},history:{}});fail=false;await b.flush();assert.equal(b.pending,false);assert.equal(b.revision,1);
});
test('revision conflict keeps local edits and blocks repeat overwrite until explicit choice',async()=>{
  const storage=memory();let calls=0,remote;
  const engine=createAccountSync({uid,storage,write:async()=>{calls++;throw Object.assign(Error('conflict'),{status:409});},read:async()=>({revision:3,data:{profile:{name:'cloud'},history:{}}}),onConflict:r=>remote=r});
  engine.baseline(1);engine.changed({profile:{name:'local'},history:{}});await engine.flush();assert.equal(remote.revision,3);assert.ok(engine.pending);await engine.flush();assert.equal(calls,1);
  engine.baseline(3);engine.changed({profile:{name:'local'},history:{}});await engine.flush();assert.equal(calls,2);
});
test('edits during upload remain pending; closed account cannot apply a late reply',async()=>{
  let finish;const states=[];const engine=createAccountSync({uid,storage:memory(),read:async()=>null,write:()=>new Promise(r=>finish=r),onStatus:x=>states.push(x)});
  engine.changed({version:1});const work=engine.flush();engine.changed({version:2});finish({revision:1});await work;assert.ok(engine.pending);assert.equal(engine.revision,1);
  const second=engine.flush();engine.close();const before=states.length;finish({revision:2});await second;assert.equal(states.length,before);
});
test('quota error and failed conflict read never claim synchronization success',async()=>{
  const states=[],storage=memory();storage.setItem=()=>{throw Error('quota');};
  const engine=createAccountSync({uid,storage,read:async()=>{throw Error('offline');},write:async()=>{throw Object.assign(Error(),{status:409});},onStatus:(...x)=>states.push(x)});
  engine.changed({profile:{},history:{}});assert.ok(engine.pending);await engine.flush();assert.ok(states.at(-1)[1].includes('读取'));assert.ok(!states.some(x=>x[0]==='synced'));
});
test('JSONB key ordering cannot cause a false conflict; a clean baseline detects local edits',async()=>{
  const a={profile:{name:'a',goal:'b'},history:{}},b={history:{},profile:{goal:'b',name:'a'}};
  assert.equal(canonicalAccountData(a),canonicalAccountData(b));
  const storage=memory(),engine=createAccountSync({uid,storage,read:async()=>null,write:async()=>({revision:1})});
  engine.baseline(1,a);assert.equal(engine.isClean(b),true);assert.equal(engine.isClean({...b,history:{today:{}}}),false);
  const reload=createAccountSync({uid,storage,read:async()=>null,write:async()=>({revision:2})});assert.ok(reload.isClean(b));
});
test('a late token refresh cannot restore a logged-out account session',async()=>{
  const storage=memory();storage.setItem('streakfit-account-session-v1',JSON.stringify({...session,expires_at:1}));
  let finish;const client=createAccountClient(config,{storage,fetcher:async url=>url.includes('refresh_token')?new Promise(r=>finish=r):ok({})});
  const restoring=client.restore();await client.logout();finish(ok(session));await assert.rejects(()=>restoring);
  assert.equal(client.user,null);assert.equal(storage.getItem(client.sessionKey),null);
});
