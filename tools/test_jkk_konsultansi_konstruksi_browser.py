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
  page.set_default_timeout(4000)
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
  page.add_style_tag(content='#satriaCloudModal{display:none!important}')
  assert page.locator('[data-jkk-rup-choose] option').count()==3
  page.evaluate('''()=>{S.ui.opd='o1';render()}''')
  assert page.locator('[data-jkk-rup-choose] option').count()==2
  page.locator('[data-jkk-rup-choose]').select_option('r-jkk')
  page.locator('[data-jkk-field="alokasi"]').fill('8000000')
  page.locator('[data-jkk-field="subjenis"]').select_option('Konstruksi')
  before=page.evaluate("JSON.stringify(S.rupBank)")
  page.locator('[data-jkk-create]').click()
  assert page.evaluate('S.paket.length')==1
  assert page.evaluate('JSON.stringify(S.rupBank)')==before
  assert page.evaluate('S.paket[0].rupBankId')=='r-jkk'
  assert page.locator('.jkk-step-nav button').count()==8
  assert page.locator('[data-jkk-step-panel="rup"]').is_visible()
  assert not page.locator('[data-jkk-step-panel="meta"]').is_visible()
  def step(n):
   page.locator('.jkk-step-nav [data-jkk-step]').nth(n-1).click()
   key=['rup','meta','reviu','kualifikasi','penawaran','survei','biaya','dokumen'][n-1]
   assert page.locator('[data-jkk-step-panel="'+key+'"]').is_visible(),key
  step(2)
  page.locator('[data-jkk-section="meta"] [data-jkk-field="bentuk"]').select_option('Perorangan')
  page.locator('[data-jkk-section="meta"] [data-jkk-field="layanan"]').select_option('Perencanaan/perancangan')
  page.locator('[data-jkk-section="meta"] [data-jkk-field="nomorPermintaan"]').fill('001/PPK/2026')
  page.locator('[data-jkk-section="meta"] [data-jkk-field="jamReviu"]').fill('09.00 WIB')
  page.locator('[data-jkk-section="meta"] details').first.evaluate('(el)=>el.open=true')
  page.locator('[data-jkk-section="meta"] [data-jkk-jadwal="uploadMulai"]').fill('2026-11-15 09:00')
  page.locator('[data-jkk-section="meta"] [data-jkk-save]').click()
  assert page.evaluate('S.paket[0].kkJkk.jadwal.uploadMulai')=='2026-11-15 09:00'
  assert page.evaluate('S.paket[0].kkJkk.nomorPermintaan')=='001/PPK/2026'
  step(3)
  assert page.locator('[data-jkk-section="reviu"] [data-jkk-criterion-row]').count()==42
  page.locator('[data-jkk-section="reviu"] details').first.evaluate('(el)=>el.open=true')
  first=page.locator('[data-jkk-section="reviu"] [data-jkk-criterion-row]').first
  first.locator('[data-jkk-col="status"]').select_option('Sesuai')
  first.locator('[data-jkk-col="bukti"]').fill('Dokumen KAK 2026')
  first.locator('[data-jkk-col="pic"]').fill('PPK')
  first.locator('[data-jkk-col="target"]').fill('20-11-2026')
  page.locator('[data-jkk-section="reviu"] [data-jkk-save]').click()
  assert page.evaluate('S.paket[0].kkJkk.reviu["rev-01"].pic')=='PPK'
  step(4)
  assert page.locator('[data-jkk-section="kualifikasi"] [data-jkk-criterion-row]').count()==8
  page.locator('[data-jkk-section="kualifikasi"] [data-jkk-field="namaPenyedia"]').fill('CV Konsultan')
  page.locator('[data-jkk-section="kualifikasi"] [data-jkk-field="kuaEvaluator"]').fill('Tim PP')
  page.locator('[data-jkk-section="kualifikasi"] [data-jkk-criterion-row]').first.locator('[data-jkk-col="status"]').select_option('Ada')
  page.locator('[data-jkk-section="kualifikasi"] [data-jkk-save]').click()
  assert page.evaluate('S.paket[0].kkJkk.kualifikasi["kua-01"].status')=='Ada'
  step(5)
  assert page.locator('[data-jkk-section="penawaran"] [data-jkk-criterion-row]').count()==12
  page.locator('[data-jkk-section="penawaran"] [data-jkk-criterion-row]').first.locator('[data-jkk-col="status"]').select_option('Ada')
  page.locator('[data-jkk-section="penawaran"] [data-jkk-field="penEvaluator"]').fill('PP')
  page.locator('[data-jkk-section="penawaran"] [data-jkk-save]').click()
  assert page.evaluate('S.paket[0].kkJkk.penawaran["pen-01"].status')=='Ada'
  step(6)
  page.locator('[data-jkk-section="survei"] [data-jkk-add]').click()
  step(6)
  assert page.locator('[data-jkk-survey-row]').count()==1
  row=page.locator('[data-jkk-survey-row]').first
  row.locator('[data-jkk-survey-col="item"]').fill('Tenaga ahli')
  row.locator('[data-jkk-survey-col="standar"]').fill('1500000')
  row.locator('[data-jkk-survey-col="kontrak"]').fill('1450000')
  row.locator('[data-jkk-survey-col="calon"]').fill('1600000')
  page.locator('[data-jkk-section="survei"] [data-jkk-save]').click()
  assert page.evaluate('SATRIA_JKK_CORE.surveyPrice(Object.values(S.paket[0].kkJkk.survei)[0])')==1450000
  page.locator('[data-jkk-apply-survey]').click()
  assert page.evaluate('S.paket[0].kkJkk.biaya[0].harga')=='1450000'
  step(7)
  row=page.locator('[data-jkk-price-row]').first
  row.locator('[data-jkk-field="uraian"]').fill('Tenaga ahli')
  row.locator('[data-jkk-field="volume"]').fill('2')
  row.locator('[data-jkk-field="penawaran"]').fill('1400000')
  row.locator('[data-jkk-field="negosiasi"]').fill('1300000')
  page.locator('[data-jkk-section="biaya"] [data-jkk-field="hpsPPK"]').fill('3219000')
  page.locator('[data-jkk-section="biaya"] [data-jkk-field="tarifPajak"]').fill('11')
  assert '3.219.000' in page.locator('[data-jkk-total="hps"]').inner_text()
  page.locator('[data-jkk-section="biaya"] [data-jkk-save]').click()
  summary=page.evaluate('SATRIA_JKK_CORE.totals(S.paket[0].kkJkk)')
  assert summary['hps']==3219000,summary
  assert summary['offer']==2800000 and summary['nego']==2600000,summary
  assert page.evaluate('S.paket[0].kkJkk.jadwal.uploadMulai')=='2026-11-15 09:00'
  assert page.evaluate('S.paket[0].kkJkk.reviu["rev-01"].pic')=='PPK'
  assert page.evaluate('S.paket[0].kkJkk.kualifikasi["kua-01"].status')=='Ada'
  assert page.evaluate('S.paket[0].kkJkk.penawaran["pen-01"].status')=='Ada'
  step(8)
  assert page.locator('[data-jkk-print]').count()==9
  assert page.locator('[data-jkk-preview]').count()==9
  page.locator('[data-jkk-clean-print]').check()
  ctx="{p:S.paket[0],r:S.rupBank[0],opd:'PUPR',instansi:'PEMDA',pp:'PP',nipPP:'',ppk:'PPK',kota:'Pontianak',printDate:'13 Nov 2026',supplier:'CV Konsultan'}"
  clean=page.evaluate("()=>SATRIA_JKK_DOCS.build('survei',"+ctx+",{cleanPrint:true})")
  assert 'DRAF KERJA SATRIA' not in clean
  assert '1.450.000' in clean
  assert 'Standar referensi' in clean
  reviewdoc=page.evaluate("()=>SATRIA_JKK_DOCS.build('kk-reviu',"+ctx+")")
  assert 'PIC' in reviewdoc and '20-11-2026' in reviewdoc
  invite=page.evaluate("()=>SATRIA_JKK_DOCS.build('und-pl',"+ctx+")")
  assert '2026-11-15 09:00' in invite
  # Reopen a selected package; ensure no duplicate and no overwriting Bank RUP.
  page.evaluate('''()=>{location.hash='#jkk'}''')
  page.locator('[data-jkk-rup-choose]').select_option('r-jkk')
  assert page.locator('[data-jkk-create]').count()==0
  page.evaluate('''()=>{S.ui.user='qa-viewer';location.hash='#jkk/'+S.paket[0].id;render()}''')
  step(2)
  assert page.locator('[data-jkk-section="meta"] [data-jkk-field="bentuk"]').is_disabled()
  assert page.locator('[data-jkk-section="meta"] [data-jkk-save]').is_disabled()
  step(8)
  assert page.locator('[data-jkk-print]').count()==9
  assert page.evaluate('S.paket.length')==1
  assert not errors,(width,errors)
  assert not missing,(width,missing)
  print(f'PASS JKK {width}px: 8 langkah, Bank RUP utuh, metadata, 42/8/12, survei→HPS, semua data bertahan, 9 dokumen, Viewer read-only')
  page.close()
 browser.close()
