from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=__import__('legacy_index_source').read_index()
# The sandbox blocks file:// and 127.0.0.1 navigation. Assemble an offline
# document with only bundled assets, then run it in Chromium about:blank.
html=re.sub(r'<script\s+src="https?://[^\"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+ (root/'frontend'/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(root/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':900})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda route:route.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(900)
 print('page errors initial:',errors[:5]);print('module?',page.evaluate('typeof window.SATRIA_PRICE_ANALYSIS'))
 print('S?',page.evaluate('typeof S'));print('Seed',page.evaluate('({p:S.ui.page,count:S.paket.length,doc:S.ui.dok})'))
 assert not errors,errors[:3]
 assert page.evaluate('typeof window.SATRIA_PRICE_ANALYSIS')=='object'
 page.evaluate("""() => {
   S.paket = JSON.parse(JSON.stringify(SEED.paket));
   S.penyedia = JSON.parse(JSON.stringify(SEED.penyedia));
   S.opd = JSON.parse(JSON.stringify(SEED.opd));
   S.pejabat = JSON.parse(JSON.stringify(SEED.pejabat));
   S.tahun = [2026];
   S.ui.tahun=2026; S.ui.opd='all'; S.ui.plife='all'; S.ui.ptab='nego';
   const pkg=S.paket[0],i=pkg.items[0];i.hs=100000;i.vol=1;pkg.pagu=120000;
   pkg.tglNego='2026-10-05';
   pkg.penawaran=[{id:'test-w1',pen:'y1',sumberHarga:'Katalog',tanggalHarga:'2026-10-01',ongkir:0,harga:{[i.id]:95000},nego:{[i.id]:90000},catalogRefs:{[i.id]:{name:'Produk A',seller:'Penyedia Contoh 1',link:'https://example.org/a',date:'2026-10-01',displayPrice:95000,unit:i.satuan,spec:'Spesifikasi katalog'}}},{id:'test-w2',pen:'y2',sumberHarga:'Katalog',tanggalHarga:'2026-10-01',ongkir:0,harga:{[i.id]:98000},nego:{[i.id]:97000},catalogRefs:{[i.id]:{name:'Produk B',seller:'Penyedia Contoh 2',link:'https://example.org/b',date:'2026-10-01',displayPrice:98000,unit:i.satuan,spec:'Spesifikasi katalog'}}}];
   pkg.pemenangId='test-w1';window.__originalState=JSON.stringify(S.paket);
   location.hash='#paket/'+S.paket[0].id;route();
 }""")
 page.wait_for_timeout(200)
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop').forEach(e=>{e.hidden=true;e.style.display='none'})")
 print('analysis button',page.locator('[data-spha-action="open"]').count())
 assert page.locator('[data-spha-action="open"]').count()==1
 page.locator('[data-spha-action="open"]').click()
 page.wait_for_timeout(200)
 print('analysis hero',page.locator('.spha-hero').count(),'tables',page.locator('.spha-table').count(),'route',page.evaluate('S.ui.page'))
 print('HERO COLOR',page.evaluate("getComputedStyle(document.querySelector('.spha-hero h2')).color"))
 assert page.locator('.spha-hero').count()==1
 assert 'Analisis Kewajaran Harga' in page.locator('.s4-module-head h2').inner_text()
 assert page.locator('.spha-table').count()>=3
 assert page.evaluate('S.ui.page')=='analisa'
 assert page.locator('.spha-metric').count()==4
 assert 'Penyedia Contoh 2' in page.locator('.spha-page').inner_text()
 assert 'Rp 96.500' in page.locator('.spha-page').inner_text() or '96.500' in page.locator('.spha-page').inner_text() # median of 95k & 98k
 page.screenshot(path=str(root/'docs'/'PREVIEW-SMART-PRICE-DASHBOARD-3.0.59.33.png'),full_page=True)
 page.locator('[data-spha-action="document"]').click()
 page.wait_for_timeout(200)
 print('doc type',page.evaluate('S.ui.dok'),'report',page.locator('[data-spha-document]').count())
 print('doc inspect',page.evaluate("(() => {const e=document.querySelector('.doc-analisa'),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {inner:e.innerText.length,text:e.innerText.slice(0,300),html:e.innerHTML.length,rect:[r.x,r.y,r.width,r.height],color:c.color,visibility:c.visibility,display:c.display,opacity:c.opacity,children:e.children.length}})()"))
 print('doc raw',page.evaluate("document.querySelector('.doc-analisa').innerHTML.slice(0,800)"))
 assert page.evaluate('S.ui.dok')=='analisa'
 assert page.locator('[data-spha-document]').count()==1
 assert page.locator('.doc-analisa').count()==1
 prepared=page.evaluate('window.SATRIA_DOK_PRINT.prepare()')
 inspection=page.evaluate('window.SATRIA_DOK_PRINT.inspect()')
 assert prepared and inspection and inspection['tables']>=4,inspection
 assert inspection['rows']>=6,inspection
 assert inspection['pageFormat']=='A4 landscape',inspection
 assert 'KERTAS KERJA ANALISIS PERBANDINGAN DAN KEWAJARAN HARGA PRODUK' in page.locator('#satria-print-root').inner_text()
 page.evaluate('window.SATRIA_DOK_PRINT.clear()')
 print('print prep',page.evaluate('window.SATRIA_DOK_PRINT?.prepare?.()'))
 print('print inspect',page.evaluate('window.SATRIA_DOK_PRINT?.inspect?.()'))
 assert page.evaluate("document.querySelector('#satria-print-root')?.textContent.includes('KERTAS KERJA ANALISIS PERBANDINGAN DAN KEWAJARAN HARGA PRODUK')")
 page.pdf(path='/mnt/data/_qa_price_analysis_333.pdf',format='A4',landscape=True,print_background=True)
 page.evaluate('window.SATRIA_DOK_PRINT?.clear?.()')
 assert '3.0.59.36' in page.locator('#hPemda').inner_text()
 page.locator('.doc-analisa').scroll_into_view_if_needed()
 page.wait_for_timeout(600)
 print('doc after scroll',page.evaluate("document.querySelector('.doc-analisa').innerText.slice(0,100)"))
 assert page.evaluate('JSON.stringify(S.paket)===window.__originalState'), 'Analysis navigation must not write to packet state'
 assert not errors,errors[:4]
 page.screenshot(path=str(root/'docs'/'PREVIEW-SMART-PRICE-ANALYSIS-3.0.59.33.png'),full_page=True)
 # Additional integration test with two distinct offers, without altering shipped seed.
 page.evaluate("""() => {
   const p=S.paket[0], i=p.items[0];
   const prove=(id,pen,price,nego)=>({id,pen,harga:{[i.id]:price},nego:{[i.id]:nego},ongkir:0,
     sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-10-01',
     catalogRefs:{[i.id]:{name:i.nama,seller:pen==='qa1'?'CV Uji A':'CV Uji B',
       unit:i.satuan,displayPrice:price,date:'2026-10-01',link:'https://example.org/ref/'+id}}});
   S.penyedia.push({id:'qa1',nama:'CV Uji A'},{id:'qa2',nama:'CV Uji B'});
   p.penawaran=[prove('q1','qa1',85000,82000),prove('q2','qa2',90000,87000)];
   p.pemenangId=''; S.ui.opd='all';
   location.hash='#analisa/'+encodeURIComponent(p.id);route();
 }""")
 page.wait_for_timeout(180)
 assert page.locator('.spha-hero').count()==1
 result=page.evaluate('window.SATRIA_PRICE_ANALYSIS.getAnalysis(S.paket[0])')
 assert len(result['offers'])==2,result
 assert result['items'][0]['average']==87500,result['items']
 assert result['comparativeItems']==1,result['comparativeItems']
 assert not errors,errors[:3]
 # A different OPD must not expose the package through direct analysis navigation.
 page.evaluate("""() => {S.ui.opd='unassigned-qa';route()}""")
 page.wait_for_timeout(100)
 assert 'Tidak ada paket e-Purchasing yang dapat diakses' in page.locator('#main').inner_text()
 print('PASS additional browser cases: multi-provider analysis, scoped route, no page errors')
 browser.close()
print('PASS Chromium: Nego button -> analysis page -> document preview, no JS error')
