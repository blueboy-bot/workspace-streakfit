from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=Path('/workspace/streakfit-preview');out.mkdir(exist_ok=True)
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="/style.css">','<style>'+(root/'style.css').read_text()+'</style>').replace('<script type="module" src="/app.js"></script>','<script>'+(root/'app.js').read_text()+'</script>')
(out/'STREAKFIT.html').write_text(html)
(out/'STREAKFIT-v0.14.12.html').write_text(html)
with ZipFile(out/'streakfit-website.zip','w',ZIP_DEFLATED) as z:z.writestr('index.html',html)
