import pathlib, sys
# 构建 v4 页面：python build2.py [输出文件，默认 suiyuan.html]
root = pathlib.Path(__file__).resolve().parent
src = root / 'src'; s2 = root / 'src2'
parts=[s2/'core.js', src/'data.js', s2/'base.js', s2/'mats.js', s2/'builders.js', s2/'figures.js', s2/'flora.js', s2/'ground.js', s2/'far.js', s2/'plant.js', s2/'garden.js', s2/'merge.js', s2/'assemble.js', src/'audio.js', s2/'app.js']
js='\n'.join(p.read_text(encoding='utf-8') for p in parts)
html=(s2/'shell.html').read_text(encoding='utf-8').replace('/*__APP__*/', js)
out=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'suiyuan.html'
out.write_text(html, encoding='utf-8', newline='\n')
print(out, len(html))
