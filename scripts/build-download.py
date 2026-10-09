"""Build a browser-side download page, avoiding workspace artifact export."""
import base64,json
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=Path('/workspace/streakfit-preview')
version=json.loads((root/'package.json').read_text())['version']
name=f'STREAKFIT-v{version}'
html=out/f'{name}.html'
archive=out/f'{name}.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
    z.write(html,arcname=html.name)
    z.writestr('使用说明.txt','解压后用浏览器打开 HTML。本文件默认使用本机记录；账号功能需要网站后端完成配置并启用。手机文件预览可能不支持交互。')
files={p.name:base64.b64encode(p.read_bytes()).decode() for p in [html,archive]}
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Streakfit 文件下载</title><style>body{font:17px system-ui;background:#f4f8ef;color:#203a2e;margin:0;padding:28px}main{max-width:600px;margin:60px auto;background:white;padding:28px;border-radius:20px}button{display:block;font:inherit;background:#d6efa4;border:0;border-radius:12px;padding:18px;margin:18px 0;width:100%;cursor:pointer}small{line-height:1.7;color:#526351}p{line-height:1.7}</style><main><h1>保存 Streakfit VERSION</h1><p>文件已嵌入本页，请选择保存格式。</p><button id="html">保存网页文件 HTML</button><button id="zip">保存转发压缩包 ZIP</button><p id="status" role="status"></p><small>HTML 用浏览器打开；ZIP 先解压。若当前预览禁止下载，仍需使用其他文件交付渠道。</small></main><script>const files=FILES,name=NAME;function save(ext){const filename=name+'.'+ext,bytes=Uint8Array.from(atob(files[filename]),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:ext==='html'?'text/html':'application/zip'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);document.querySelector('#status').textContent='已向浏览器发起保存，请查看下载列表。若没有文件出现，可能是当前预览限制了下载。';}document.querySelector('#html').onclick=()=>save('html');document.querySelector('#zip').onclick=()=>save('zip');</script></html>'''
page=page.replace('VERSION',version).replace('FILES',json.dumps(files)).replace('NAME',json.dumps(name))
(out/'Streakfit-下载页面.html').write_text(page)
with ZipFile(archive) as z:assert z.testzip() is None
print(f'Built {name}.zip and browser download page')
