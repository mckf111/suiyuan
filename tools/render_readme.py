# 渲染 README 配图：assets/readme/source/*.html → assets/readme/*.jpg
# 用法：先 npm ci（字体来自 node_modules），再 python tools/render_readme.py
# 原理：本地起静态服务，用 Chrome 无头模式按 2 倍分辨率截图，再转 JPG。
import os, sys, shutil, subprocess, tempfile, threading, functools, http.server
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'readme')
JOBS = [  # (版式页, 视口宽, 视口高, 输出文件)
    ('hero.html', 1200, 500, 'hero.jpg'),
    ('scenes.html', 1200, 576, 'scenes.jpg'),
    ('hero.html', 1280, 640, 'social-preview.jpg'),
]
CANDIDATES = [os.environ.get('CHROME', ''), r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', shutil.which('chrome') or '', shutil.which('google-chrome') or '']
chrome = next((c for c in CANDIDATES if c and os.path.exists(c)), None) or sys.exit('找不到 Chrome/Edge，可用环境变量 CHROME 指定')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=ROOT)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]

with tempfile.TemporaryDirectory() as tmp:
    for page, w, h, name in JOBS:
        png = os.path.join(tmp, name + '.png')
        subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                        f'--window-size={w},{h}', '--virtual-time-budget=15000', f'--user-data-dir={tmp}/profile',
                        f'--screenshot={png}', f'http://127.0.0.1:{port}/assets/readme/source/{page}'],
                       check=True, capture_output=True)
        im = Image.open(png).convert('RGB')
        # 社交预览图按 GitHub 建议尺寸 1280×640 输出，其余保留 2 倍清晰度
        if name == 'social-preview.jpg': im = im.resize((w, h), Image.LANCZOS)
        dst = os.path.join(OUT, name)
        im.save(dst, quality=86, optimize=True, progressive=True)
        print(f'{name}: {im.size[0]}×{im.size[1]}  {os.path.getsize(dst) / 1024:.0f} KB')
srv.shutdown()
