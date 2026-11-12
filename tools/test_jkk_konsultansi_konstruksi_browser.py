#!/usr/bin/env python3
"""Integration browser SATRIA JKK: RUP selection, creation, persistence, privacy/read-only, PDF preview."""
from pathlib import Path
from urllib.parse import urlparse
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def fixture():
 return '''()=>{
  S.users=[{id:'qa-admin',nama:'QA Admin',role:'Admin',aktif:true},{id:'qa-viewer',nama:'QA Viewer',role:'Viewer',aktif:true}];
  S.ui.user='qa-admin';S.ui.tahun=2026;S.ui.opd='all';S.tahun=[2026];
  S.opd=[{id:'o1',nama:'Dinas PUPR',singkat:'DPUPR'},{id:'o2',nama:'Dinas Lain',singkat:'LAIN'}];
  S.unit=[];S.pejabat=[];S.penyedia=[];S.paket=[];
  S.rupBank=[
    {id:'r-jkk',rup:'100100',nama:'Perencanaan Gedung A',tahun:2026,opd:'o1',pagu:10000000,jenisPengadaan:'Jasa Konsultansi',metodePemilihan:'Pengadaan Langsung'},
    {id:'r-jasa-lain',rup:'100101',nama:'Konsultansi seleksi',tahun:2026,opd:'o1',pagu:20000000,jenisPengadaan:'Jasa Konsultansi',metodePemilihan:'Seleksi'},
    {id:'r-konstruksi',rup:'100102',nama:'Pekerjaan Fisik',tahun:2026,opd:'o1',pagu:10000000,jenisPengadaan:'Pekerjaan Konstruksi',metodePemilihan:'Pengadaan Langsung'},
    {id:'r-opd2',rup:'100103',nama:'Perencanaan Dinas Lain',tahun:2026,opd:'o2',pagu:10000000,jenisPengadaan:'Jasa Konsultansi',metodePemilihan:'Pengadaan Langsung'},
    {id:'r-2025',rup:'100104',nama:'Perencanaan Lama',tahun:2025,opd:'o1',pagu:10000000,jenisPengadaan:'Jasa Konsultansi',metodePemilihan:'Pengadaan Langsung'}
  ];
  location.hash='#jkk';render();
 }'''

with sync_playwright() as api:
 browser=api.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None,args=['--no-sandbox'])
 for width in [390,1280]:
  page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
  errors=[];missing=[];dialogs=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.on('dialog',lambda dlg:(dialogs.append(dlg.message),dlg.accept()))
  def serve(route):
   url=urlparse(route.request.url)
   if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
    route.fulfill(status=200,body='',content_type='text/javascript');return
   if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com'):
    route.fulfill(status=200,body='',content_type='text/css');return
   file=(ROOT/url.path.lstrip('/')).resolve()
   if file.is_file() and ROOT.resolve() in file.parents:
    typ='text/javascript' if file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'text/html'
    route.fulfill(status=200,body=file.read_bytes(),content_type=typ);return
   missing.append(url.path);route.fulfill(status=404,body='missing')
  page.route('**/*',serve)
  html=(ROOT/'index.html').read_text(encoding='utf8').replace('<head>','<head><base href="https://satria.local/">',1)
  page.set_content(html,wait_until='domcontentloaded',timeout=30000)
  page.wait_for_timeout(250)
  page.evaluate(fixture())
  # Synthetic local data requires bypassing the cloud login overlay (no live credentials).
  page.add_style_tag(content='#satriaCloudModal{display:none!important}')
  assert page.locator('.jkk-page').count()==1
  assert page.locator('[data-jkk-rup-choose] option').count()==3, page.locator('[data-jkk-rup-choose]').inner_text()
  page.evaluate('''()=>{S.ui.opd='o1';render()}''')
  assert page.locator('[data-jkk-rup-choose] option').count()==2
  page.locator('[data-jkk-rup-choose]').select_option('r-jkk')
  assert page.locator('[data-jkk-create]').count()==1
  page.locator('[data-jkk-field="alokasi"]').fill('8000000')
  page.locator('[data-jkk-field="subjenis"]').select_option('Konstruksi')
  before=page.evaluate('''()=>JSON.stringify(S.rupBank)''')
  page.locator('[data-jkk-create]').click()
  page.wait_for_timeout(100)
  state=page.evaluate('''()=>({page:S.ui.page,id:S.ui.pid,p:S.paket.length,data:S.paket[0],rup:JSON.stringify(S.rupBank),html:document.querySelector('#main').innerText.slice(0,300)})''')
  assert state['p']==1,state
  assert state['rup']==before,'Bank RUP must remain bit-identical'
  assert state['data']['rupBankId']=='r-jkk'
  assert state['data']['pagu']==8000000
  assert state['data']['spseMonitoring']['method']=='Pengadaan Langsung'
  assert state['data']['kkJkk']['subjenis']=='Konstruksi'
  assert page.locator('[data-jkk-print]').count()==9
  page.locator('[data-jkk-clean-print]').check()
  clean=page.evaluate("""()=>SATRIA_JKK_DOCS.build('harga',{p:S.paket[0],r:S.rupBank[0],opd:'Dinas PUPR',instansi:'PEMDA',pp:'PP',nipPP:'',ppk:'PPK',kota:'Pontianak',printDate:'12 November 2026',supplier:'X'},{cleanPrint:true})""")
  assert 'DRAF KERJA SATRIA' not in clean
  assert '[belum diisi]' in clean
  page.locator('[data-jkk-section="base"] [data-jkk-field="bentuk"]').select_option('Perorangan')
  page.locator('[data-jkk-section="base"] [data-jkk-field="layanan"]').select_option('Perencanaan/perancangan')
  page.locator('[data-jkk-section="base"] [data-jkk-field="nomorPermintaan"]').fill('001/PPK/2026')
  page.locator('[data-jkk-section="base"] [data-jkk-save]').click()
  assert page.evaluate('''()=>S.paket[0].kkJkk.bentuk''')=='Perorangan'
  assert page.evaluate('''()=>S.paket[0].kkJkk.nomorPermintaan''')=='001/PPK/2026'
  page.locator('[data-jkk-section="reviu"] details').first.evaluate('(el)=>el.open=true')
  page.locator('[data-jkk-section="reviu"] [data-jkk-criterion-row]').first.locator('[data-jkk-col="status"]').select_option('Sesuai')
  page.locator('[data-jkk-section="reviu"] [data-jkk-save]').click()
  assert page.evaluate('''()=>S.paket[0].kkJkk.reviu['rev-01'].status''')=='Sesuai'
  page.locator('[data-jkk-section="evaluasi"] [data-jkk-field="namaPenyedia"]').fill('CV Penguji')
  page.locator('[data-jkk-section="evaluasi"] [data-jkk-save]').click()
  assert page.evaluate('''()=>S.paket[0].kkJkk.namaPenyedia''')=='CV Penguji'
  page.locator('[data-jkk-section="biaya"] [data-jkk-add]').click()
  assert page.locator('[data-jkk-price-row]').count()==1
  row=page.locator('[data-jkk-price-row]').first
  row.locator('[data-jkk-field="uraian"]').fill('Tenaga ahli perencana')
  row.locator('[data-jkk-field="volume"]').fill('2')
  row.locator('[data-jkk-field="harga"]').fill('1500000')
  row.locator('[data-jkk-field="penawaran"]').fill('1350000')
  row.locator('[data-jkk-field="negosiasi"]').fill('1300000')
  page.locator('[data-jkk-section="biaya"] [data-jkk-field="hpsPPK"]').fill('3330000')
  page.locator('[data-jkk-section="biaya"] [data-jkk-field="tarifPajak"]').fill('11')
  page.locator('[data-jkk-section="biaya"] [data-jkk-save]').click()
  costs=page.evaluate('''()=>({t:SATRIA_JKK_CORE.totals(S.paket[0].kkJkk),d:S.paket[0].kkJkk})''')
  assert costs['t']['hps']==3330000,costs
  assert costs['t']['offer']==2700000,costs
  assert isinstance(costs['d']['penawaran'],dict),'top-level eval data cannot be overwritten by price row'
  assert costs['d']['biaya'][0]['penawaran']=='1350000'
  # Existing parcel cannot be duplicated on the same RUP.
  page.evaluate('''()=>{location.hash='#jkk'}''')
  page.wait_for_timeout(100)
  page.locator('[data-jkk-rup-choose]').select_option('r-jkk')
  assert page.locator('[data-jkk-create]').count()==0
  # Read only still permits review and printable docs, but not edits.
  page.evaluate('''()=>{S.ui.user='qa-viewer';location.hash='#jkk/'+S.paket[0].id;render()}''')
  assert page.locator('.jkk-detail').count()==1
  assert page.locator('[data-jkk-section="base"] [data-jkk-field="bentuk"]').is_disabled()
  assert page.locator('[data-jkk-section="base"] [data-jkk-save]').is_disabled()
  assert page.locator('[data-jkk-print]').count()==9
  assert not page.evaluate('''()=>canWrite()''')
  assert page.evaluate('''()=>S.paket.length''')==1
  assert not missing,(width,missing)
  assert not errors,(width,errors)
  print(f'PASS JKK {width}px: RUP strict filter; create; avoid duplicate; save stage 1-4; HPS; Viewer read-only; 9 document outputs; no errors.')
  page.close()
 browser.close()
