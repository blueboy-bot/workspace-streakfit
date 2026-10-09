"""Build a static GitHub Pages directory without user data or workspace secrets."""
from pathlib import Path
import argparse, json, shutil

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='/workspace/streakfit-preview/pages-v'+json.loads((root / 'package.json').read_text())['version'])
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'app.js', 'style.css', 'foundation.css', 'accounts.css', 'account-config.json', 'manifest.webmanifest', 'sw.js']:
    shutil.copyfile(root / name, out / name)
for name in ['modules', 'assets']:
    shutil.copytree(root / name, out / name, dirs_exist_ok=True)
(out / '.nojekyll').write_text('')
version = json.loads((root / 'package.json').read_text())['version']
print(f'Built STREAKFIT {version} static website: {out}')
