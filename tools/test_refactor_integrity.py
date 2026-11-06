#!/usr/bin/env python3
"""Static gate for SATRIA modular index. No network / cloud access needed."""
import json, re, subprocess
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'tools/refactor-assets.json').read_text(encoding='utf-8'))
html=(ROOT/'index.html').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
class Parse(HTMLParser):
 def __init__(self):super().__init__();self.entries=[]
 def handle_starttag(self,t,attrs):
  if t in ('script','link','style'):
   self.entries.append((t,dict(attrs)))
p=Parse();p.feed(html)
assets=[e['file'] for e in manifest['styles']+manifest['scripts']]
assert len(assets)==len(set(assets))
assert len(manifest['styles'])==22 and len(manifest['scripts'])==34
assert len([1 for t,a in p.entries if t=='link' and a.get('data-satria-refactor')=='style'])==22
assert len([1 for t,a in p.entries if t=='script' and a.get('data-satria-refactor')=='script'])==34
assert len([1 for t,a in p.entries if t=='script' and a.get('id')=='satriaEmbeddedSupabaseConfig' and not a.get('src')])==1
ref_scripts=[a['src'] for t,a in p.entries if t=='script' and a.get('data-satria-refactor')=='script']
ref_styles=[a['href'] for t,a in p.entries if t=='link' and a.get('data-satria-refactor')=='style']
assert ref_scripts==[e['file'] for e in manifest['scripts']]
assert ref_styles==[e['file'] for e in manifest['styles']]
for t,a in p.entries:
 if t=='script' and a.get('data-satria-refactor')=='script':
  assert 'async' not in a and 'defer' not in a and a.get('type','text/javascript') in ('text/javascript','')
for link in assets+['./frontend/refactor/maintenance/diagnostics.js','./frontend/satria-next4.js','./frontend/satria-operator-studio.js','./frontend/satria-price-analysis.js']:
 assert link in sw, 'sw precache missing '+link
 assert (ROOT/link.removeprefix('./')).is_file(), 'missing '+link
for f in (ROOT/'frontend/refactor/js').glob('*.js'):
 check=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
 assert check.returncode==0, f'{f}: {check.stderr}'
for f in [ROOT/'sw.js',ROOT/'frontend/refactor/maintenance/diagnostics.js']:
 check=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
 assert check.returncode==0, check.stderr
assert 'satria-v3.0.59.39-refactor-index-20261106' in sw
assert "if (request.mode === 'navigate')" in sw
assert (ROOT/'index.html').stat().st_size<40000
print(f'PASS index modular: {len(ref_scripts)} JS, {len(ref_styles)} CSS, urutan aman, cache terdaftar, sintaks valid')
