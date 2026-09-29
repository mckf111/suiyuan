# 生成可直接部署的静态网站包（EdgeOne Pages / 任意静态托管）
# - three.js 自托管，不依赖 jsdelivr
# - 字体自托管，只带页面实际用到的字所在的分片（unicode-range 按需加载）
# 用法：python3 make_site.py <输出目录> [站点网址]
import os, re, sys, shutil, html

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SRC, 'site')
URL = sys.argv[2] if len(sys.argv) > 2 else 'https://suiyuan.caowenhu.com/'
NM = os.environ.get('NM', '/home/claude/deploy_npm/node_modules')
THREE = os.environ.get('THREE', NM + '/three')

page = open(os.path.join(SRC, 'suiyuan.html'), encoding='utf-8').read()
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)

# ---- three.js ----
tv = os.path.join(OUT, 'vendor/three')
for rel in ['build/three.module.min.js', 'examples/jsm/controls/OrbitControls.js',
            'examples/jsm/objects/Reflector.js', 'examples/jsm/utils/BufferGeometryUtils.js']:
    os.makedirs(os.path.dirname(os.path.join(tv, rel)), exist_ok=True)
    shutil.copy(os.path.join(THREE, rel), os.path.join(tv, rel))
page = page.replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', './vendor/three/build/three.module.min.js')
page = page.replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/', './vendor/three/examples/jsm/')
assert 'cdn.jsdelivr' not in page

# ---- 字体 ----
used = set(ord(c) for c in page if ord(c) > 127) | set(range(32, 127))
def ranges(s):
    out = []
    for part in s.split(','):
        part = part.strip()[2:]
        a, b = (part.split('-') + [None])[:2]
        out.append((int(a, 16), int(b or a, 16)))
    return out
fdir = os.path.join(OUT, 'fonts'); os.makedirs(fdir)
css_out = []; nfiles = 0; nbytes = 0
for pkg, weights in [('ma-shan-zheng', [400]), ('zcool-xiaowei', [400]), ('noto-serif-sc', [400, 500, 600])]:
    for w in weights:
        css = open(f'{NM}/@fontsource/{pkg}/{w}.css', encoding='utf-8').read()
        for block in re.findall(r'@font-face\s*{[^}]*}', css):
            ur = re.search(r'unicode-range:\s*([^;]+);', block)
            if ur and not any(a <= u <= b for a, b in ranges(ur.group(1)) for u in used): continue
            f = re.search(r'url\(\./files/([^)]+\.woff2)\)', block).group(1)
            shutil.copy(f'{NM}/@fontsource/{pkg}/files/{f}', os.path.join(fdir, f)); nfiles += 1; nbytes += os.path.getsize(os.path.join(fdir, f))
            block = re.sub(r'src:[^;]+;', f"src: url(./{f}) format('woff2');", block)
            css_out.append(block)
open(os.path.join(fdir, 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(css_out))
page = re.sub(r'<link rel="preconnect"[^>]*>\n?', '', page)
page = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="./fonts/fonts.css">', page)
assert 'googleapis' not in page

# ---- 贴图 ----
shutil.copytree(os.path.join(SRC, 'tex'), os.path.join(OUT, 'tex'))
for extra in ['share.jpg', 'favicon.png']:
    p = os.path.join(SRC, 'site_assets', extra)
    if os.path.exists(p): shutil.copy(p, os.path.join(OUT, extra))

# ---- 完整 HTML 文档 + 分享信息 ----
desc = '乾隆五十年仲春，袁枚亲自领你走一遍随园：柴门、竹径、小仓山房、双湖、南楼，再看它两百多年后的去处。网页即开即游，手机电脑都能看。'
head_extra = f'''<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="重游随园 · 乾隆五十年的南京">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{URL}share.jpg">
<meta property="og:url" content="{URL}">
<meta name="theme-color" content="#29251f">
<link rel="icon" href="./favicon.png">
'''
body_start = page.find('<style>')
head, rest = page[:body_start], page[body_start:]
# rest 里 <style> 之后到第一个非 head 元素之前都留在 head
m = re.search(r'</style>\s*', rest)
style, body = rest[:m.end()], rest[m.end():]
doc = f'<!doctype html>\n<html lang="zh-CN">\n<head>\n{head}{head_extra}{style}</head>\n<body>\n{body}\n</body>\n</html>\n'
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(doc)

tot = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
print(f'site -> {OUT}  fonts {nfiles} files {nbytes/1e6:.1f}MB  total {tot/1e6:.1f}MB')
