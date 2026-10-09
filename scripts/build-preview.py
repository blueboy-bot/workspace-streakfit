import re, json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=Path('/workspace/streakfit-preview');out.mkdir(exist_ok=True)
version=json.loads((root/'package.json').read_text())['version']
modules='\n'.join(re.sub(r'^import .*;$','',(root/'modules'/f'{name}.js').read_text().replace('export ',''),flags=re.M) for name in ['units','rewards','learning','backup','planning','insights','experience-toolkit','local-integrity','account-rules','account-data','account-client','account-sync','accounts-ui'])
app=modules+'\n'+re.sub(r'^import .*;$', '', (root/'app.js').read_text(),flags=re.M)
app="globalThis.STREAKFIT_ACCOUNT_CONFIG="+json.dumps(json.loads((root/'account-config.json').read_text()))+";\n"+app
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>'+(root/'style.css').read_text()+'</style>').replace('<link rel="stylesheet" href="./foundation.css">','<style>'+(root/'foundation.css').read_text()+'</style>').replace('<link rel="stylesheet" href="./accounts.css">','<style>'+(root/'accounts.css').read_text()+'</style>').replace('<script type="module" src="./app.js"></script>','<script>'+app+'</script>')
(out/'STREAKFIT.html').write_text(html)
(out/f'STREAKFIT-v{version}.html').write_text(html)
with ZipFile(out/'streakfit-website.zip','w',ZIP_DEFLATED) as z:
 for file in ['index.html','app.js','style.css','foundation.css','accounts.css','account-config.json','manifest.webmanifest','sw.js','server.mjs','package.json','README.md']:
  z.write(root/file,arcname=file)
 for folder in ['modules','assets','docs']:
  for file in (root/folder).rglob('*'):
   if file.is_file():z.write(file,arcname=str(file.relative_to(root)))
