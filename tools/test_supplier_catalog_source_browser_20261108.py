from pathlib import Path
import re,sys
sys.path.insert(0,str(Path('tools').resolve()))
from legacy_index_source import read_index
from playwright.sync_api import sync_playwright
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(Path('frontend')/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(Path('frontend')/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1280,'height':800})
 page.route('**/*',lambda route:route.abort())
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 data=page.evaluate('''() => {
  S.paket=JSON.parse(JSON.stringify(SEED.paket));
  S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
  S.opd=JSON.parse(JSON.stringify(SEED.opd));
  S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
  S.tahun=[2026];S.ui.tahun=2026;S.ui.opd='all';
  const p=S.paket[0];p.items=[{id:'qa1',nama:'Barang Satu',vol:1,hs:20000,satuan:'Unit'}];
  S.penyedia.push({id:'qa-store-a',nama:'TOKO A',link:'https://katalog.inaproc.id/toko-a'});
  S.penyedia.push({id:'qa-store-b',nama:'TOKO B',link:'https://katalog.inaproc.id/toko-b'});
  p.penawaran=[{id:'qa-w1',pen:'qa-store-a',sumberHarga:'https://katalog.inaproc.id/toko-a/produk-satu',tanggalHarga:'2026-11-08',harga:{qa1:18000},nego:{},catalogRefs:{qa1:{link:'https://katalog.inaproc.id/toko-a/produk-satu'}}},{id:'qa-w2',pen:'qa-store-b',sumberHarga:'https://katalog.inaproc.id/toko-b/produk-satu',tanggalHarga:'2026-11-08',harga:{qa1:19000},nego:{},catalogRefs:{qa1:{link:'https://katalog.inaproc.id/toko-b/produk-satu'}}}];
  const wrap=document.createElement('div');wrap.innerHTML=fNego(p);
  const fields=[...wrap.querySelectorAll('input[data-f="sumberHarga"]')].map(i=>({value:i.value,readonly:i.readOnly}));
  const links=[...wrap.querySelectorAll('a')].filter(a=>a.textContent.includes('Buka toko e-Katalog')).map(a=>a.href);
  const doc=survei(p);
  return {fields,links,docHasA:doc.includes('https://katalog.inaproc.id/toko-a'),docHasB:doc.includes('https://katalog.inaproc.id/toko-b')};
 }''')
 assert data['fields']==[{'value':'https://katalog.inaproc.id/toko-a','readonly':True},{'value':'https://katalog.inaproc.id/toko-b','readonly':True}],data
 assert data['links']==['https://katalog.inaproc.id/toko-a','https://katalog.inaproc.id/toko-b'],data
 assert data['docHasA'] and data['docHasB'],data
 assert not errors,errors[:4]
 print('PASS Browser: field source read-only per supplier, clickable master catalog links, survey document, zero page errors')
 b.close()
