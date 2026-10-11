import re, json, base64
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=Path('/workspace/streakfit-preview/visual-v0.34.1-download');out.mkdir(exist_ok=True)
version=json.loads((root/'package.json').read_text())['version']
font_css=(root/'typography.css').read_text()
for file in (root/'assets/fonts').glob('*.woff2'):
 font_css=font_css.replace('./assets/fonts/'+file.name,'data:font/woff2;base64,'+base64.b64encode(file.read_bytes()).decode())
font_licenses='\n'.join(file.read_text() for file in (root/'assets/fonts').glob('*-OFL.txt'))
modules='\n'.join(re.sub(r'^import .*;$','',(root/'modules'/f'{name}.js').read_text().replace('export ',''),flags=re.M) for name in ['locales/en-ui','locales/en-movements','localization','units','rewards','learning','backup','planning','insights','experience-toolkit','local-integrity','account-rules','account-data','account-client','account-sync','accounts-ui'])
app=modules+'\n'+re.sub(r'^import .*;$', '', (root/'app.js').read_text(),flags=re.M)
app="globalThis.STREAKFIT_ACCOUNT_CONFIG="+json.dumps(json.loads((root/'account-config.json').read_text()))+";\n"+app
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>'+(root/'style.css').read_text()+'</style>').replace('<link rel="stylesheet" href="./foundation.css">','<style>'+(root/'foundation.css').read_text()+'</style>').replace('<link rel="stylesheet" href="./accounts.css">','<style>'+(root/'accounts.css').read_text()+'</style>').replace('<link rel="stylesheet" href="./visual.css">','<style>'+(root/'visual.css').read_text()+'</style>').replace('<script src="./preview-storage.js"></script>','<script>'+(root/'preview-storage.js').read_text()+'</script>').replace('<script type="module" src="./app.js"></script>','<script>'+app+'</script>').replace('<script type="module" src="./visual-refresh.js"></script>','<script>'+(root/'visual-refresh.js').read_text()+'</script>')
html=html.replace('<link rel="stylesheet" href="./typography.css">','<style>'+font_css+'</style>').replace('<link rel="preload" href="./assets/fonts/streakfit-han.woff2" as="font" type="font/woff2" crossorigin>','').replace('<link rel="preload" href="./assets/fonts/streakfit-ui.woff2" as="font" type="font/woff2" crossorigin>','').replace('</head>','<!-- Bundled font licenses\n'+font_licenses+'\n--></head>')
(out/'STREAKFIT.html').write_text(html)
english=html.replace('<script>'+app, '<script>globalThis.STREAKFIT_LANGUAGE="en";'+app)
(out/f'STREAKFIT-v{version}-English.html').write_text(english)
(out/f'STREAKFIT-v{version}.html').write_text(html)
with ZipFile(out/'streakfit-website.zip','w',ZIP_DEFLATED) as z:
 for file in ['index.html','app.js','style.css','foundation.css','accounts.css','visual.css','typography.css','visual-refresh.js','preview-storage.js','account-config.json','manifest.webmanifest','sw.js','server.mjs','package.json','README.md']:
  z.write(root/file,arcname=file)
 for folder in ['modules','assets','docs']:
  for file in (root/folder).rglob('*'):
   if file.is_file():z.write(file,arcname=str(file.relative_to(root)))
