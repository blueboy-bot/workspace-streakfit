// Real UI clicks against mocked provider HTTP responses. This does not send OTPs.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.env.STREAKFIT_DIST||'/workspace/streakfit-preview/accounts-preview';
const a='11111111-2222-4333-8444-555555555555',b='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const records=new Map(),errors=[],events=[];
const server=http.createServer(async(req,res)=>{try{const name=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1);const data=await fs.readFile(path.join(root,name));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.webmanifest')?'application/manifest+json':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
async function mock(context){
  await context.route('**/account-config.json',async route=>{const raw=JSON.parse(await fs.readFile(path.join(root,'account-config.json'),'utf8'));raw.enabled=true;await route.fulfill({json:raw});});
  await context.route('https://*.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()),body=req.postDataJSON(),headers=req.headers(),uid=headers.authorization?.includes(a)?a:headers.authorization?.includes(b)?b:null;
    const response=(status,json)=>route.fulfill({status,json});
    events.push({path:url.pathname,action:body?.action,type:body?.type,channel:body?.phone?'phone':body?.email?'email':undefined});
    if(url.pathname==='/functions/v1/streakfit-account')return response(200,{status:'verification_required'});
    if(url.pathname==='/auth/v1/token'||url.pathname==='/auth/v1/verify'){
      if(url.pathname.endsWith('verify')&&body.token!=='123456')return response(400,{message:'验证码不正确'});
      const id=body.email==='second@example.com'?b:a;
      return response(200,{access_token:'token-'+id,refresh_token:'refresh-'+id,expires_in:3600,user:{id,email:body.email||'first@example.com'}});
    }
    if(url.pathname==='/auth/v1/user')return response(200,{id:uid});
    if(url.pathname==='/auth/v1/logout')return response(200,{});
    if(url.pathname==='/rest/v1/streakfit_user_data')return response(200,records.has(uid)?[records.get(uid)]:[]);
    if(url.pathname==='/rest/v1/rpc/save_streakfit_data'){
      if(!uid)return response(401,{message:'unauthorized'});
      const old=records.get(uid);if((old?.revision||0)!==body.expected_revision)return response(409,{message:'revision conflict'});
      const record={revision:(old?.revision||0)+1,data:body.payload,updated_at:new Date().toISOString()};records.set(uid,record);return response(200,{revision:record.revision});
    }
    return response(200,{});
  });
}
async function weight(page,value){await page.locator('[data-page=progress]').click();await page.locator('#bodyweight').fill(String(value));await page.locator('h1').click();}
async function login(page,email){await page.locator('#account-entry').click();await page.locator('#account-dialog [name=identity]').fill(email);await page.locator('#account-dialog [name=password]').fill('Abcdefgh123!');await page.locator('#account-dialog [type=submit]').click();}
async function waitRecord(uid,predicate){for(let i=0;i<80;i++){if(records.has(uid)&&predicate(records.get(uid)))return;await new Promise(r=>setTimeout(r,100));}throw Error('Expected cloud mock record not received');}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await mock(context);
    const guest={onboarded:true,profile:{name:'访客原始记录',goal:'建立运动习惯',experience:'初学者',days:'2',place:'家中 · 无器械',minutes:'15',scheduleMode:'cycle',trainDays:'1',restDays:'2',scheduleStart:'2026-10-09'},history:{},safety:{status:'ready',symptoms:'no',review:'no'}};
    await context.addInitScript(value=>{if(!localStorage.getItem('streakfit-v1'))localStorage.setItem('streakfit-v1',JSON.stringify(value));},guest);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#account-entry').click();await page.locator('[data-account=register]').click();
    await page.locator('#account-dialog [name=identity]').fill('first@example.com');await page.locator('#account-dialog [name=password]').fill('Abcdefgh111!');await page.locator('#account-dialog [name=confirm]').fill('Abcdefgh111!');await page.locator('#account-dialog [type=submit]').click();
    assert.match(await page.locator('#account-feedback').innerText(),/连续/);assert.equal(events.length,0);
    await page.locator('#account-dialog [name=password]').fill('Abcdefgh123!');await page.locator('#account-dialog [name=confirm]').fill('Abcdefgh123!');await page.locator('#account-dialog [type=submit]').click();
    await page.locator('#account-dialog [name=code]').fill('000000');await page.locator('#account-dialog [type=submit]').click();await page.locator('#account-feedback').filter({hasText:'验证码不正确'}).waitFor();
    await page.locator('#account-dialog [name=code]').fill('123456');await page.locator('#account-dialog [type=submit]').click();await page.locator('[data-account=import]').click();
    await waitRecord(a,r=>r.revision===1);assert.equal(records.get(a).data.profile.name,'访客原始记录');
    const savedGuest=await page.evaluate(()=>localStorage.getItem('streakfit-v1'));assert.equal(JSON.parse(savedGuest).profile.name,'访客原始记录');
    await weight(page,70);await waitRecord(a,r=>Object.values(r.data.history).some(d=>d.bodyweight===70));
    const context2=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await mock(context2);const page2=await context2.newPage();page2.on('pageerror',e=>errors.push(e.message));await page2.goto(base);await page2.locator('#close').click();await login(page2,'first@example.com');await page2.locator('#account-dialog').waitFor({state:'hidden'});
    await page2.locator('[data-page=progress]').click();assert.equal(await page2.locator('#bodyweight').inputValue(),'70');
    await context.setOffline(true);await weight(page,72);await weight(page2,74);await waitRecord(a,r=>Object.values(r.data.history).some(d=>d.bodyweight===74));
    await context.setOffline(false);await page.locator('[data-account=use-cloud]').waitFor();
    const localWeight=await page.evaluate(uid=>Object.values(JSON.parse(localStorage.getItem('streakfit-v1:'+uid)).history).find(d=>d.bodyweight)?.bodyweight,a);assert.equal(localWeight,72);
    await page.locator('[data-account=use-cloud]').click();await page.locator('[data-account=close]').click();await page.locator('[data-page=progress]').click();assert.equal(await page.locator('#bodyweight').inputValue(),'74');
    assert.ok(await page.evaluate(uid=>localStorage.getItem('streakfit-account-backup:'+uid+':before-cloud'),a));
    await page.locator('#account-entry').click();await page.locator('[data-account=logout]').click();await page.locator('#account-dialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('streakfit-v1')).profile.name),'访客原始记录');assert.equal(await page.evaluate(()=>localStorage.getItem('streakfit-account-session-v1')),null);
    await login(page,'second@example.com');await page.locator('[data-account=fresh]').click();await waitRecord(b,r=>r.revision>=1);assert.equal(records.get(b).data.profile.name,'新朋友');assert.ok(!Object.values(records.get(b).data.history).some(d=>d.bodyweight));
    await page.locator('#close').click();await page.locator('#account-entry').click();await page.locator('[data-account=change]').click();await page.locator('#account-dialog [name=password]').fill('Newpassword12!');await page.locator('#account-dialog [name=confirm]').fill('Newpassword12!');await page.locator('#account-dialog [type=submit]').click();await page.locator('[data-account=logout]').waitFor();
    const allStorage=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!allStorage.includes('Abcdefgh123!'));assert.ok(!allStorage.includes('Newpassword12!'));
    await page.locator('[data-account=logout]').click();await page.locator('#account-dialog').waitFor({state:'hidden'});await page.locator('#account-entry').click();await page.locator('[data-account=recover]').click();await page.locator('#account-dialog [name=identity]').fill('first@example.com');await page.locator('#account-dialog [type=submit]').click();await page.locator('#account-dialog [name=code]').fill('123456');await page.locator('#account-dialog [type=submit]').click();await page.locator('#account-dialog [name=password]').fill('Recovered12!');await page.locator('#account-dialog [name=confirm]').fill('Recovered12!');await page.locator('#account-dialog [type=submit]').click();await page.locator('#account-dialog').waitFor({state:'hidden'});assert.ok(events.some(e=>e.type==='recovery'));await page.reload();await page.locator('#account-entry').filter({hasText:'我的账号'}).waitFor();await page.locator('[data-page=progress]').click();assert.equal(await page.locator('#bodyweight').inputValue(),'74');
    const context3=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await mock(context3);const page3=await context3.newPage();page3.on('pageerror',e=>errors.push(e.message));await page3.goto(base);await page3.locator('#close').click();await page3.locator('#account-entry').click();await page3.locator('[data-account=register]').click();await page3.locator('[data-account=phone]').click();await page3.locator('#account-dialog [name=identity]').fill('+14165551234');await page3.locator('#account-dialog [name=password]').fill('Abcdefgh123!');await page3.locator('#account-dialog [name=confirm]').fill('Abcdefgh123!');await page3.locator('#account-dialog [type=submit]').click();await page3.locator('#account-dialog [name=code]').fill('123456');await page3.locator('#account-dialog [type=submit]').click();await page3.locator('#account-dialog').waitFor({state:'hidden'});assert.ok(events.some(e=>e.type==='sms'&&e.channel==='phone'));await context3.close();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    console.log('PASS: mobile registration validation, OTP errors, guest import, two-device sync, offline conflict, conflict backup, logout isolation, second-account separation and password update (mock provider).');
    await fs.writeFile('/workspace/streakfit-preview/accounts-v0.31.0-browser-results.json',JSON.stringify({provider:'mock',passed:true,errors,requests:events.length},null,2));await context.close();await context2.close();
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
