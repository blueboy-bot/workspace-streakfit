// Real Chromium workflows against the built site, including a Pages-style subpath.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

const version = require('../package.json').version;
const cacheVersion='v'+version.replaceAll('.','');
const dir = process.env.STREAKFIT_DIST || '/workspace/streakfit-preview/pages-v'+version;
const resultFile = process.env.STREAKFIT_RESULT || '/workspace/streakfit-preview/pwa-v'+version+'-results.json';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css',
  '.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const results = [];

(async () => {
  let server;
  const nextVersion=version.split('.').map(Number);nextVersion[2]++;const next=nextVersion.join('.'),nextCache=nextVersion.join('');
  const broken=nextVersion.slice();broken[2]++;const brokenCache=broken.join('');
  let updateRelease = version.replaceAll('.','');
  let origin;
  if (process.env.STREAKFIT_URL) origin = process.env.STREAKFIT_URL;
  else {
    server = http.createServer(async (req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const isUpdateTest = pathname.startsWith('/update-check/');
      let relative = pathname.replace(/^\/(workspace-streakfit|update-check)\//, '/').slice(1) || 'index.html';
      if (relative.endsWith('/')) relative += 'index.html';
      const file = path.resolve(dir, relative);
      if (!file.startsWith(path.resolve(dir) + path.sep)) { res.writeHead(403); res.end(); return; }
      try {
        if (isUpdateTest && updateRelease===brokenCache && relative==='modules/insights.js') {
          res.writeHead(404); res.end('Deliberately incomplete update'); return;
        }
        let data = await fs.readFile(file);
        if (isUpdateTest && relative==='sw.js') data = Buffer.from(data.toString().replace(cacheVersion, 'v'+updateRelease));
        if (isUpdateTest && relative==='index.html') data = Buffer.from(data.toString().replace('STREAKFIT v'+version, 'STREAKFIT v'+(updateRelease===nextCache?next:version)));
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        res.end(data);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
  }
  const launchOptions = {executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']};
  // Public-site checks use the cloud's configured network proxy with normal TLS validation.
  const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (process.env.STREAKFIT_URL && new URL(origin).hostname !== '127.0.0.1' && proxyServer) {
    launchOptions.proxy = {server: proxyServer, bypass: 'localhost,127.0.0.1'};
  }
  if (process.env.STREAKFIT_BROWSER_DATA_HOME) {
    launchOptions.env = {...process.env, XDG_DATA_HOME: process.env.STREAKFIT_BROWSER_DATA_HOME};
  }
  const browser = await chromium.launch(launchOptions);
  try {
    const bases = process.env.STREAKFIT_URL ? [origin] : [origin+'/', origin+'/workspace-streakfit/'];
    for (const base of bases) for (const viewport of [{width:390,height:844}, {width:1366,height:900}]) {
      const context = await browser.newContext({viewport, acceptDownloads:true});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(base);
        assert.equal(await page.locator('#setup-question').innerText(), '你想怎么健身？');
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
        assert.equal(scope, base);
        const manifestURL = await page.locator('link[rel=manifest]').getAttribute('href');
        const manifest = await (await page.request.get(new URL(manifestURL,base).href)).json();
        assert.equal(new URL(manifest.start_url, base).href, base);
        assert.equal(new URL(manifest.scope, base).href, base);
        assert.equal(manifest.display, 'standalone');
        for (const icon of manifest.icons) {
          const response = await page.request.get(new URL(icon.src,base).href);
          assert.equal(response.status(),200);
          assert.match(response.headers()['content-type'],/image\/png/);
        }
        await page.locator('[data-setup-choice=goal][data-choice-value="建立运动习惯"]').click();
        await page.locator('#setup-next').click();
        assert.equal(await page.locator('#setup-question').innerText(), '先确认适合开始运动');
        await page.selectOption('[name=safetySymptoms]','no');
        await page.selectOption('[name=safetyReview]','no');
        await page.locator('#setup-next').click();
        await page.locator('[data-setup-choice=experience][data-choice-value="初学者"]').click();
        await page.locator('#setup-next').click();
        await page.locator('[data-setup-choice=place][data-choice-value="家中"]').click();
        await page.locator('#setup-next').click();
        await page.fill('[name=minutes]','15');
        await page.locator('#setup-next').click();
        await page.locator('#generate-plan').click();
        assert.equal(await page.locator('#dialog').evaluate(el => el.open),false);
        await page.locator('[data-page=progress]').click();
        assert.equal(await page.locator('#bodyweight-trend').evaluate(el => el.open),false);
        assert.equal(await page.locator('#bodyweight-trend .trend').isVisible(),false);
        const xpBefore = await page.locator('.stat').first().innerText();
        await page.locator('#bodyweight').fill('75');
        await page.locator('h1').click();
        const savedWeight = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('streakfit-v1')).history).some(d => d.bodyweight===75));
        assert.equal(savedWeight,true);
        assert.equal(await page.locator('.stat').first().innerText(),xpBefore);
        await page.locator('#bodyweight-trend summary').click();
        assert.equal(await page.locator('#bodyweight-trend .trend').isVisible(),true);
        assert.match(await page.locator('#bodyweight-trend .trend').innerText(),/75/);
        await page.reload();
        await page.locator('[data-page=progress]').click();
        assert.equal(await page.locator('#bodyweight-trend .trend').isVisible(),false);
        assert.equal(await page.locator('#bodyweight').inputValue(),'75');

        const downloaded = page.waitForEvent('download');
        await page.locator('[data-export]').click();
        const download = await downloaded;
        const backupFile = await download.path();
        const backup = JSON.parse(await fs.readFile(backupFile,'utf8'));
        assert.equal(backup.format,'streakfit-backup');
        await page.locator('#bodyweight').fill('80');
        await page.locator('h1').click();
        const beforeRestore = await page.evaluate(() => localStorage.getItem('streakfit-v1'));
        await page.locator('#restore-file').setInputFiles(backupFile);
        await page.locator('[data-confirm-restore]').waitFor();
        // Preview must not replace current records before confirmation.
        assert.equal(await page.evaluate(() => localStorage.getItem('streakfit-v1')),beforeRestore);
        await page.locator('[data-cancel-restore]').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('streakfit-v1')),beforeRestore);
        assert.equal(await page.locator('[data-confirm-restore]').count(),0);
        await page.locator('#restore-file').setInputFiles(backupFile);
        await page.locator('[data-confirm-restore]').waitFor();
        await page.locator('[data-confirm-restore]').click();
        assert.equal(await page.locator('#bodyweight').inputValue(),'75');
        assert.equal(await page.evaluate(() => localStorage.getItem('streakfit-before-restore')),beforeRestore);
        await page.locator('#restore-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"bad":true}')});
        await page.waitForFunction(() => document.querySelector('#restore-preview').textContent.includes('无法读取'));
        assert.equal(await page.locator('[data-confirm-restore]').count(),0);
        assert.equal(await page.locator('#bodyweight').inputValue(),'75');

        await context.setOffline(true);
        await page.goto(base+'index.html?offline-check=1');
        await page.locator('[data-page=path]').click();
        assert.ok((await page.locator('#content').innerText()).length>20);
        await page.locator('[data-page=learn]').click();
        assert.ok((await page.locator('#content').innerText()).length>20);
        await page.locator('[data-page=progress]').click();
        assert.equal(await page.locator('.training-calendar').count(),1);
        assert.equal(await page.locator('#bodyweight').inputValue(),'75');
        assert.equal(await page.locator('#bodyweight-trend .trend').isVisible(),false);
        await page.reload();
        assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);
        assert.deepEqual(errors,[]);
        const width = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
        assert.ok(width.scroll<=width.viewport+1,JSON.stringify(width));
        results.push({base,viewport,passed:['onboarding','manifest-and-icons','scoped-service-worker','weight-hidden-by-default','weight-no-xp','weight-opt-in','json-export','restore-preview-cancel-and-confirm','pre-restore-copy','invalid-backup-rejection','offline-index-query','offline-navigation','offline-reload','no-horizontal-overflow'],errors});
      } finally { await context.close(); }
    }
    if (server) {
      const context = await browser.newContext();
      let page = await context.newPage();
      const base = origin+'/update-check/';
      await page.goto(base);
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await page.evaluate(async()=>{
        await caches.open('streakfit-shell-/other-app/-v0001');
      });
      updateRelease=nextCache;
      await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
      await page.waitForFunction(async()=>!!(await navigator.serviceWorker.ready).waiting);
      assert.equal(await page.evaluate(async()=> (await navigator.serviceWorker.ready).active.state),'activated');
      await page.reload();
      assert.ok((await page.locator('footer').innerText()).includes('v'+version));
      await page.close();
      page=await context.newPage();
      await page.goto(base);
      await page.waitForFunction(async()=>!(await navigator.serviceWorker.ready).waiting);
      await page.reload();
      assert.ok((await page.locator('footer').innerText()).includes('v'+next));
      let keys = await page.evaluate(()=>caches.keys());
      assert.ok(keys.includes('streakfit-shell-/update-check/-v'+nextCache));
      assert.ok(!keys.includes('streakfit-shell-/update-check/-'+cacheVersion));
      assert.ok(keys.includes('streakfit-shell-/other-app/-v0001'));
      updateRelease=brokenCache;
      await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
      await page.waitForFunction(async()=> !(await navigator.serviceWorker.ready).installing);
      assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.ready).waiting),false);
      await context.setOffline(true);
      await page.reload();
      assert.ok((await page.locator('footer').innerText()).includes('v'+next));
      await page.locator('#close').click();
      await page.locator('[data-page=learn]').click();
      assert.ok((await page.locator('#content').innerText()).length>20);
      await context.close();
      results.push({base,passed:['update-waits-for-open-windows','new-version-after-close','old-version-cache-cleanup','other-app-cache-preserved','incomplete-update-not-activated','offline-keeps-working-version']});
    }
    await fs.writeFile(resultFile,JSON.stringify({passed:results.length,results},null,2));
    console.log('Real Chromium workflows passed:',results.length,'Results:',resultFile);
  } finally { await browser.close(); if(server) await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
