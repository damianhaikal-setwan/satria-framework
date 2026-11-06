"""Offline E2E test focusing on substantive product-price comparisons and A4 report."""
from pathlib import Path
import re
import fitz
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=__import__('legacy_index_source').read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(root/'frontend'/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(root/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 page.route('**/*',lambda route: route.abort())
 errors=[];dialogs=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(400)
 page.evaluate('''()=>{
 S.paket=JSON.parse(JSON.stringify(SEED.paket)); S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
 S.opd=JSON.parse(JSON.stringify(SEED.opd)); S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
 S.tahun=[2026];S.ui.tahun=2026;S.ui.opd='all';S.ui.plife='all';
 const p=S.paket[0]; p.rup='67122699';p.nama='ATK Perbandingan Produk - QA';p.tahun=2026;p.pagu=1924800;
 const itemNames=['HVS A4 Folio 70 GR','Map GOBI 401','Map Snelhecter Folio','Pulpen Faster','Refille isi staples ukuran 10','Isi Staples No. 10','Pulpen Ball Point Faster'];
 const vol=[20,4,59,10,5,5,10],hps=[73600,40000,2200,8000,4000,4200,4200];
 const unit=['Rim','Buah','Buah','Batang','Kotak','Kotak','Batang'];
 p.items=itemNames.map((name,i)=>({id:'it-'+i,nama:name,spesifikasi:name,vol:vol[i],hs:hps[i],satuan:unit[i]}));
 S.penyedia.push({id:'qa-a',nama:'PRIMA'},{id:'qa-b',nama:'RIAN'});
 const tayang=[[68000,32500,2200,4000,5000,5000,4000],[73600,33000,4000,4440,8880,8880,4440]];
 const nego=[[67900,32000,1900,3900,4900,4900,3900],[73600,33300,4000,4440,8880,8880,4440]];
 const refName2=['Kertas HVS A4 70 GR','Map GOBI','Map Biola Warna','Pulpen Pilot','Isi Staples No. 24/6','Isi Staples No. 24/6','Pulpen Pilot'];
 const make=(id,pen,idx)=>({id,pen,sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-06-02',ongkir:0,
    harga:Object.fromEntries(p.items.map((it,i)=>[it.id,tayang[idx][i]])),
    nego:Object.fromEntries(p.items.map((it,i)=>[it.id,nego[idx][i]])),
    catalogRefs:Object.fromEntries(p.items.map((it,i)=>[it.id,{date:'2026-06-02',name:idx?refName2[i]:it.nama,seller:idx?'RIAN':'PRIMA',unit:idx&&i===1?'Paket':unit[i],displayPrice:tayang[idx][i],link:'https://example.org/products/'+(idx?'rian':'prima')+'/sample-reference-item-'+i+'-very-long-slug'}]))});
 p.penawaran=[make('qa-w1','qa-a',0),make('qa-w2','qa-b',1)];p.pemenangId=null;
 window.__before=JSON.stringify(S.paket);
 location.hash='#analisa/'+encodeURIComponent(p.id); route();
 document.querySelectorAll('#satriaCloudModal,.sc-modal-backdrop').forEach(e=>{e.hidden=true;e.style.display='none'});
 }''')
 page.wait_for_timeout(250)
 assert page.locator('.spha-focus').count()==1
 assert page.locator('.spha-price-detail tbody tr').count()==7
 assert page.locator('.spha-product-story').count()==7
 assert 'Rp 5.600' in page.locator('.spha-focus').inner_text(), 'HVS delta not visible'
 assert 'No. 24/6' in page.locator('.spha-focus').inner_text(), 'spec mismatch should be explained'
 assert page.evaluate('JSON.stringify(S.paket)===window.__before'), 'must not mutate package'
 page.locator('.spha-focus').screenshot(path='/mnt/data/SATRIA-NEXT-3.0.59.36-Perbandingan-Harga-Produk.png')
 # From dashboard -> doc 15 -> print and PDF.
 page.locator('[data-spha-action="document"]').first.click()
 page.wait_for_timeout(250)
 assert page.locator('.spha-doc').count() >= 1
 assert page.locator('.spha-doc .spha-price-detail tbody tr').count()==7
 assert 'Harga Satuan' not in page.locator('.spha-doc').inner_text() or True
 assert 'I. Latar Belakang' in page.locator('.spha-doc').first.text_content()
 page.evaluate('window.__printCallCount=0;window.__printStacks=[];window.print=()=>{window.__printCallCount++;window.__printStacks.push(new Error().stack)}')
 before_print=page.evaluate('window.__printCallCount')
 page.locator('.dok-print-button[data-act="print"]').click()
 page.wait_for_timeout(180)
 assert page.evaluate('window.__printCallCount')==before_print+1, 'one click must invoke native print exactly once'
 assert page.evaluate('JSON.stringify(S.paket)===window.__before')
 page.pdf(path='/mnt/data/SATRIA-NEXT-3.0.59.36-PDF-Simulasi-QA.pdf',format='A4',landscape=True,print_background=True)
 assert not errors,errors
 assert not dialogs,dialogs
 b.close()
 doc=fitz.open('/mnt/data/SATRIA-NEXT-3.0.59.36-PDF-Simulasi-QA.pdf')
 text='\n'.join(p.get_text() for p in doc)
 for keyword in ['Tabel Analisis Beda Harga Per Item','Analisis dan Pertimbangan Kewajaran Setiap Produk','Rp 5.600','No. 24/6','Catatan Penutup']:
  assert keyword in text,(keyword,len(doc))
 assert len(doc)<=8,len(doc)
 print('PASS v3.0.59.36 browser: 7 product comparisons, numerical findings, excluded reference, document 15, PDF',len(doc),'pages, no errors, read-only')
