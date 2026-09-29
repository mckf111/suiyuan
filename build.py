import pathlib
src=pathlib.Path('src')
js='\n'.join((src/f).read_text() for f in ['data.js','scene.js','audio.js','app.js'])
html=(src/'shell.html').read_text().replace('/*__APP__*/', js)
pathlib.Path('suiyuan.html').write_text(html)
print(len(html))
