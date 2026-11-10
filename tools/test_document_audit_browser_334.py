"""Offline end-to-end acceptance: 15th document, click, QA export and A4 PDF.
No production cloud access or data mutation. All financial values are simulated.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
root=Path(__file__).resolve().parents[1]
html=__import__('legacy_index_source').read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(root/'frontend'/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(root/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 errors=[];dialogs=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.dismiss()))
 page.route('**/*',lambda route:route.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(650)
 assert page.evaluate("typeof window.SATRIA_DOK_QA")=='object'
 assert page.evaluate("window.SATRIA_DOK_QA.types.length")==15
 page.evaluate('''() => {
  S.paket=JSON.parse(JSON.stringify(SEED.paket));
  S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
  S.opd=JSON.parse(JSON.stringify(SEED.opd));
  S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
  S.tahun=[2026];
  S.ui.tahun=2026;S.ui.opd='all';S.ui.plife='all';
  const p=S.paket[0];p.rup='QA-2026-ATK';p.nama='Paket ATK Simulasi untuk Pengujian Dokumen';p.tahun=2026;p.pagu=5000000;
  const base=p.items[0];p.items=Array.from({length:7},(_,n)=>({...base,id:'qa-ink-'+(n+1),nama:'ATK contoh '+(n+1),vol:2,satuan:'Buah',hs:130000}));
  S.penyedia.push({id:'qa-supplier-a',nama:'CV Uji A'},{id:'qa-supplier-b',nama:'CV Uji B'});
  const make=(id,pen,each)=>({id,pen,sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-10-01',ongkir:0,
      harga:Object.fromEntries(p.items.map(i=>[i.id,each])),nego:Object.fromEntries(p.items.map(i=>[i.id,each-2000])),catalogRefs:{}});
  p.penawaran=[make('qa-w1','qa-supplier-a',120000),make('qa-w2','qa-supplier-b',125000)];
  S.ui.dpid=p.id;S.ui.dok='nodis';
  location.hash='#dok';route();
  window.__beforeQAState=JSON.stringify(S.paket);
  window.__printCalls=0;window.print=()=>{window.__printCalls++};
  document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop').forEach(e=>{e.hidden=true;e.style.display='none'});
 }''')
 page.wait_for_timeout(150)
 assert 'QA-2026-ATK' in page.locator('#selPaket').input_value() or 'QA-2026-ATK' in page.locator('#selPaket').locator('option:checked').inner_text()
 assert page.locator('.spha-quick [data-act="dtype"][data-tab="analisa"]').count()==1
 page.locator('.spha-quick [data-act="dtype"][data-tab="analisa"]').click()
 page.wait_for_timeout(320)
 assert page.evaluate("S.ui.dok")=='analisa'
 assert page.locator('.doc-analisa').count()==1
 assert 'Analisis Kewajaran Harga & Bukti' in page.locator('.satria-human-follow[aria-label="Panduan Dokumen Pengadaan"]').inner_text()
 qa=page.evaluate("window.SATRIA_DOK_QA.review(S.paket[0],'analisa')")
 print('QA 15th', {k:qa.get(k) for k in ['rup','namaDokumen','status','manualChecks']},'missing',len(qa['issues']))
 assert qa['rup']=='QA-2026-ATK' and not qa.get('error')
 assert len(qa['manualChecks'])==1 and qa['manualChecks'][0]['needsVerification']
 assert len(qa['issues'])>=1,'Missing catalog proof must be reported, but not block draft print'
 print('print dialogs before',dialogs)
 page.locator('.dok-print-button[data-act="print"]').click()
 page.wait_for_timeout(200)
 assert not dialogs,dialogs
 assert page.evaluate('window.__printCalls')==1,'Native print call must be invoked'
 report=page.evaluate('window.SATRIA_DOK_PRINT.inspect()')
 assert report and report['type']=='analisa' and report['pageFormat']=='A4 portrait'
 assert report['tables']>=3 and report['rows']>=20,report
 assert 'DRAF ANALISIS OTOMATIS' in page.locator('#satria-print-root').inner_text()
 assert 'bukti referensi' in page.locator('#satria-print-root').inner_text().lower()
 assert page.evaluate('JSON.stringify(S.paket)===window.__beforeQAState')
 page.pdf(path='/mnt/data/_qa_price_analysis_334.pdf',format='A4',landscape=False,print_background=True)
 page.locator('.doc-analisa').scroll_into_view_if_needed()
 page.wait_for_timeout(380)
 page.screenshot(path='/mnt/data/SATRIA-NEXT-3.0.59.36-Pratinjau-Perbaikan-Dokumen.png',full_page=True)
 print('Print:',report,'pagesize A4 portrait','zero browser dialogs')
 # Export all 15 review statuses; the old export for this exact RUP included only 14.
 export=page.evaluate('''async () => {
   const create=URL.createObjectURL.bind(URL);
   URL.createObjectURL=(blob)=>{window.__lastAuditBlob=blob;return create(blob)};
   S.ui.dok='semua';window.SATRIA_DOK_QA.report();
   const str=await window.__lastAuditBlob.text();
   S.ui.dok='analisa';
   return JSON.parse(str);
 }''')
 assert export['version']==page.evaluate('window.SATRIA_DOK_QA.version') and len(export['reviews'])==15
 entry=next(x for x in export['reviews'] if x['jenis']=='analisa')
 assert entry['rup']=='QA-2026-ATK' and entry['manualChecks'] and entry['issues']
 assert 'BUKTI' in entry['status'] or 'MENINJAU' in entry['status']
 print('QA JSON export:',len(export['reviews']),'docs; analysis issues:',len(entry['issues']))
 assert not errors,errors
 browser.close()
print('PASS Browser v3.0.59.36 — simulated RUP 7 items/2 suppliers, tab click, 15-doc QA, print, PDF, read-only')
