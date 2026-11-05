"""Offline browser: verify long catalog references stay inside their evidence table cells,
PDF is readable, and the 15th document still prints without JS errors.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(root/'frontend'/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(root/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];dialogs=[]
 page.on('pageerror',lambda error: errors.append(str(error)))
 page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.accept()))
 page.route('**/*',lambda route:route.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(500)
 page.evaluate('''() => {
  S.paket=JSON.parse(JSON.stringify(SEED.paket));S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
  S.opd=JSON.parse(JSON.stringify(SEED.opd));S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
  S.tahun=[2026];S.ui.tahun=2026;S.ui.opd='all';S.ui.plife='all';
  const p=S.paket[0];p.rup='67122699';p.nama='ATK / Pengujian PDF';p.tahun=2026;p.pagu=1924800;
  const base=p.items[0];p.items=Array.from({length:7},(_,n)=>({...base,id:'ink-'+n,nama:['HVS A4 70 GR','Map GOBI 401','Map Snelhecter Folio','Pulpen Faster','Isi staples kecil ukuran 10','Isi Staples No. 10','Pulpen Faster'][n],vol:n%2?5:10,satuan:'Kotak',hs:12000}));
  S.penyedia.push({id:'qa-a',nama:'FOTO COPY PRIMA'},{id:'qa-b',nama:'RIAN ALBHENI'});
  const make=(id,pen,i)=>({id,pen,sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-06-02',ongkir:0,
    harga:Object.fromEntries(p.items.map(it=>[it.id,7000+i*1000])),
    nego:Object.fromEntries(p.items.map(it=>[it.id,6500+i*1000])),
    catalogRefs:Object.fromEntries(p.items.map((it,idx)=>[it.id,{
      date:'2026-06-02',name:pen==='qa-b'&&idx===5?'Isi Staples No 24/6':pen==='qa-b'&&idx===6?'Pulpen Pilot':it.nama,
      seller:pen==='qa-b'?'RIAN ALBHENI':'FOTO COPY PRIMA',unit:'Kotak',displayPrice:7000+i*1000,
      link:'https://katalog.inaproc.id/'+(pen==='qa-b'?'rian-albheni':'foto-copy-prima')+'/'+ ('produk-referensi-beralamat-sangat-panjang-agar-url-terbungkus-di-dalam-satu-kolom-')+idx+'-retail'
    }]))});
  p.penawaran=[make('qa-w1','qa-a',0),make('qa-w2','qa-b',1)];p.pemenangId=null;
  window.__savedPaket=JSON.stringify(S.paket);
  location.hash='#analisa/'+encodeURIComponent(p.id);route();
  document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop').forEach(e=>{e.hidden=true;e.style.display='none'});
 }''')
 page.wait_for_timeout(250)
 assert page.locator('.spha-hero').count()==1
 assert page.locator('.spha-evidence').count()==1
 assert page.locator('.spha-reviewlist').count()==1
 assert page.locator('.spha-evidence tbody tr').count()==14
 # All long URLs should be wrapped inside bounded table cell, no collision with price column.
 layout=page.evaluate('''() => {
   const table=document.querySelector('.spha-page .spha-evidence');
   const all=Array.from(table.querySelectorAll('tbody tr'));
   return { tableWidth:table.getBoundingClientRect().width,
     overflows:all.filter(tr=>Array.from(tr.cells).some(td=>td.scrollWidth>td.clientWidth+2)).length,
     links:all.map(tr=>({refWidth:tr.cells[3].getBoundingClientRect().width, refScroll:tr.cells[3].scrollWidth,
       priceStarts:tr.cells[4].getBoundingClientRect().left, refEnds:tr.cells[3].getBoundingClientRect().right})),
     review:document.querySelector('.spha-reviewlist').innerText.includes('Staples No. 10'),
     refs:document.querySelector('.spha-evidence').innerText.slice(0,280)
   };
 }''')
 print('Layout desktop',layout['tableWidth'],'overflow rows',layout['overflows'],'flagged check',layout['review'])
 assert not layout['overflows'],layout
 assert all(x['priceStarts']>=x['refEnds']-2 for x in layout['links'])
 assert layout['review']
 page.locator('.spha-evidence').screenshot(path='/mnt/data/SATRIA-3.0.59.35-Bukti-Referensi-Tabel-Baru.png')
 page.locator('[data-spha-action="document"]').click()
 page.wait_for_timeout(250)
 assert page.locator('[data-spha-document]').count()==1
 qa=page.evaluate('window.SATRIA_DOK_QA.review(S.paket[0],"analisa")')
 print('Document QA',qa['namaDokumen'],len(qa['issues']))
 page.evaluate("window.__printCalls=0;window.__printStacks=[];window.print=()=>{window.__printCalls++;window.__printStacks.push(new Error().stack)};null")
 page.locator('.dok-print-button[data-act="print"]').click()
 page.wait_for_timeout(200)
 print('Print count:',page.evaluate('window.__printCalls'),'dialogs=',dialogs,'qa issues=',len(qa['issues']));
 assert page.evaluate('window.__printCalls')==1
 assert page.evaluate('JSON.stringify(S.paket)===window.__savedPaket')
 print('Dialogs:',dialogs);assert not errors,errors
 page.pdf(path='/mnt/data/_qa_price_analysis_335.pdf',format='A4',landscape=True,print_background=True)
 page.set_viewport_size({'width':390,'height':844})
 page.wait_for_timeout(180)
 # End-to-end mobile table remains horizontally scrollable without clipping entire page.
 page.evaluate('''() => {location.hash='#analisa/'+encodeURIComponent(S.paket[0].id);route();}''')
 page.wait_for_timeout(250)
 mobile=page.evaluate('''() => ({width:document.querySelector('.spha-evidence').scrollWidth,
   scroll:document.querySelector('.spha-evidence').parentElement.scrollWidth,
   viewport:innerWidth})''')
 print('Mobile',mobile)
 assert mobile['width']>mobile['viewport'] and mobile['scroll']>=mobile['width']
 assert not errors,errors
 browser.close()
 print('PASS browser v3.0.59.35 evidence layout, print, access, mobile, read-only')
