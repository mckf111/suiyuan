import pathlib, sys
src=pathlib.Path('src'); s2=pathlib.Path('src2')
parts=[s2/'core.js', src/'data.js', s2/'base.js', s2/'mats.js', s2/'builders.js', s2/'figures.js', s2/'flora.js', s2/'ground.js', s2/'far.js', s2/'plant.js', s2/'garden.js', s2/'merge.js', s2/'assemble.js', src/'audio.js', s2/'app.js']
js='\n'.join(p.read_text() for p in parts)
html=(s2/'shell.html').read_text().replace('/*__APP__*/', js)
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'suiyuan2.html'); out.write_text(html)
print(out, len(html))
