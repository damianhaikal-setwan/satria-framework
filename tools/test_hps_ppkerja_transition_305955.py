"""Offline browser regression against SATRIA's actual optimized Document Studio.
No live accounts, databases, external APIs or production package data.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, zipfile, io, re, xml.etree.ElementTree as ET
from legacy_index_source import read_index
ROOT=Path(__file__).resolve().parents[1]
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['pbj2026-policy.js','pbj2026-workspace.js','pbj2026-ppkerja-adapter.js','satria-hps-generator.js','satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>', '<script>\n'+(ROOT/'frontend'/name).read_text()+'\n</script>')
for name in ['pbj2026-workspace.css','satria-hps-generator.css','satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">', '<style>\n'+(ROOT/'frontend'/name).read_text()+'\n</style>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(3000)
 errors=[]
 page.route('**/*',lambda r:r.abort())
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(350)
 assert page.evaluate('typeof SATRIA_HPS_GENERATOR')=='object'
 assert page.evaluate('typeof SATRIA_PP_KERTAS_KERJA')=='object'
 assert page.evaluate('vDok.name')=='vDokOptimized'
 page.evaluate('''() => {
   const first=JSON.parse(JSON.stringify(SEED.paket[0]));
   first.id='hps-sim-a';first.rup='RUP-PP-SIM';first.nama='Perahu Simulasi';first.pagu=200000000;first.tahun=2026;
   first.jalurPengadaan='SPSE_MONITOR';first.spseMonitoring=satriaSpseNewModel();first.spseMonitoring.method='Pengadaan Langsung';
   first.items=[{id:'i1',nama:'Perahu karet arung jeram',spesifikasi:'Perahu, helm, dayung, pelampung',sat:'Set',vol:3,hs:42792000}];
   first.penawaran=[];
   const second=JSON.parse(JSON.stringify(first));second.id='hps-sim-b';second.rup='RUP-KATALOG';second.nama='Paket Katalog';
   delete second.spseMonitoring;second.jalurPengadaan='';second.metodePemilihan='E-Purchasing dengan Negosiasi Harga';
   S.paket=[first,second];S.users.push({id:'test-admin',nama:'Penguji Offline',role:'Admin',opd:'all',aktif:true});S.ui.user='test-admin';S.ui.tahun=2026;S.ui.opd='all';S.ui.dpid=first.id;S.ui.dok='nodis';S.ui.plife='all';
   S.ui.pid=first.id;location.hash='#spse/'+first.id;route();
 }''')
 page.wait_for_timeout(200)
 # Actual SPSE form preserves selection on change, even when the studio rerenders.
 assert page.locator('[data-pbj-basis]').count()==1
 assert page.locator('[data-hps-doc-panel]').count()==1
 assert page.locator('.pbj-kertas-kerja').count()==1
 page.locator('.pbj-panel details').first.evaluate('(el)=>el.open=true')
 page.locator('[data-pbj-start]').fill('2026-09-23')
 page.locator('[data-pbj-basis]').select_option('perlem-12-2021')
 assert page.locator('[data-pbj-basis]').input_value()=='perlem-12-2021', 'Dropdown unexpectedly reset on change'
 page.evaluate('render()')
 assert page.locator('[data-pbj-basis]').input_value()=='perlem-12-2021', 'Draft lost on normal re-render'
 assert 'belum disimpan' in page.locator('[data-pbj-unsaved]').text_content().lower()
 page.locator('.pbj-panel details').first.evaluate('(el)=>el.open=true')
 page.locator('[data-pbj-save]').evaluate('(e)=>e.click()')
 saved=page.evaluate('''() => ({date:P('hps-sim-a').tglMulaiPemilihan,basis:P('hps-sim-a').dasarRegulasi})''')
 assert saved=={'date':'2026-09-23','basis':'perlem-12-2021'},saved
 # HPS exported from package once; the source HPS unit is never modified.
 page.locator('.satria-hps-generator details').evaluate('(el)=>el.open=true')
 page.locator('[data-hps-doc-field="mode"]').select_option('excluded')
 page.locator('[data-hps-doc-field="tarif"]').fill('11')
 page.locator('[data-hps-doc-field="tempat"]').fill('Putussibau')
 page.locator('[data-hps-doc-field="tanggal"]').fill('2026-07-12')
 page.locator('[data-hps-doc-field="pptkNama"]').fill('Penyusun Uji')
 page.locator('[data-hps-doc-field="ppkNama"]').fill('Penetap Uji')
 model=page.evaluate("() => SATRIA_HPS_GENERATOR.evaluate(P('hps-sim-a'))")
 assert model['before']==128376000 and model['tax']==14121360 and model['total']==142497360,model
 assert model['errors']==[],model
 # Force a re-render: unsaved HPS settings must still be shown.
 page.evaluate('render()')
 page.locator('.satria-hps-generator details').evaluate('(el)=>el.open=true')
 assert page.locator('[data-hps-doc-field="tarif"]').input_value()=='11'
 assert page.locator('[data-hps-doc-field="mode"]').input_value()=='excluded'
 page.locator('[data-hps-doc-save]').evaluate('(e)=>e.click()')
 assert page.evaluate("() => P('hps-sim-a').hpsDokumen.tarif")=='11'
 assert page.evaluate("() => P('hps-sim-a').items[0].hs")==42792000,'HPS unit must not change'
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(el=>{el.hidden=true;el.style.display='none'})")
 page.locator('.satria-hps-generator').screenshot(path='/mnt/data/SATRIA_NEXT_3.0.59.55_TAMPILAN_GENERATOR_HPS.png')
 # Need to inspect the real XLSX bytes, its formulas, and printable HTML.
 b64=page.evaluate("""() => {const b=SATRIA_HPS_GENERATOR.xlsxBytes(P('hps-sim-a'));let out='';for(let i=0;i<b.length;i++)out+=String.fromCharCode(b[i]);return btoa(out)}""")
 data=base64.b64decode(b64)
 out='/mnt/data/SATRIA_HPS_SIMULASI_3.0.59.55.xlsx'
 Path(out).write_bytes(data)
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  assert z.testzip() is None
  files=z.namelist()
  assert 'xl/worksheets/sheet1.xml' in files and 'xl/styles.xml' in files
  sheet=z.read('xl/worksheets/sheet1.xml').decode()
  assert '<f>ROUND(D11*E11*$D$6/100,0)</f>' in sheet,sheet[-900:]
  assert '<f>D11*E11+F11</f>' in sheet
  assert '142497360' in sheet
  for name in files:
   if name.endswith('.xml') or name.endswith('.rels'):ET.fromstring(z.read(name))
 report=page.evaluate("() => SATRIA_HPS_GENERATOR.documentHtml(P('hps-sim-a'),SATRIA_HPS_GENERATOR.evaluate(P('hps-sim-a')))")
 assert '@page{size:A4 landscape' in report and 'Perahu karet arung jeram' in report and '142.497.360' in report
 assert 'Penyusun Uji' in report and 'Penetap Uji' in report
 pdf_preview=browser.new_page();pdf_preview.set_content(report,wait_until='load');pdf_preview.pdf(path='/mnt/data/SATRIA_HPS_SIMULASI_3.0.59.55.pdf',format='A4',landscape=True,print_background=True,prefer_css_page_size=True);pdf_preview.close()
 # E-purchasing does not ask for the unrelated Perlem 3/2026 transitional regime.
 page.evaluate("S.ui.dpid='hps-sim-b';location.hash='#dok';route()")
 assert page.locator('[data-pbj-basis]').count()==0, 'E-Purchasing should not present Perlem 3 transition selector'
 assert page.locator('[data-hps-doc-panel]').get_attribute('data-hps-doc-panel')=='hps-sim-b'
 assert page.locator('[data-pbj-print]').count()==0
 # An unprivileged user cannot save HPS configuration.
 page.evaluate("S.ui.user='cloud-login-required';render()")
 assert page.locator('[data-hps-doc-save]').count()==0
 assert not errors,errors
 browser.close()
print('PASS real SATRIA browser: transition dropdown durable/save, e-P separation, Kertas Kerja PP, HPS formula/tax/Excel/PDF, per-package/readonly, zero JavaScript errors')
