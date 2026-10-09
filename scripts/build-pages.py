"""Build a static GitHub Pages directory without user data or workspace secrets."""
from pathlib import Path
import argparse, json, shutil

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='/workspace/streakfit-preview/pages-v'+json.loads((root / 'package.json').read_text())['version'])
parser.add_argument('--language',choices=['zh','en'],default='zh')
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'app.js', 'style.css', 'foundation.css', 'accounts.css', 'account-config.json', 'manifest.webmanifest', 'sw.js']:
    shutil.copyfile(root / name, out / name)
for name in ['modules', 'assets']:
    shutil.copytree(root / name, out / name, dirs_exist_ok=True)
if args.language=='en':
    index=out/'index.html'
    index.write_text(index.read_text().replace('<script type="module" src="./app.js"></script>','<script>globalThis.STREAKFIT_LANGUAGE="en";</script><script type="module" src="./app.js"></script>'))
    manifest=json.loads((out/'manifest.webmanifest').read_text())
    manifest.update(lang='en',start_url='./?lang=en')
    (out/'manifest.webmanifest').write_text(json.dumps(manifest,indent=2)+'\n')
(out / '.nojekyll').write_text('')
version = json.loads((root / 'package.json').read_text())['version']
print(f'Built STREAKFIT {version} static website: {out}')
