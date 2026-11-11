"""SATRIA 3.0.59.58: test the active Bank RUP screen, real event delegation, without cloud/production data."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from legacy_index_source import read_index
import re
ROOT=Path(__file__).resolve().parents[1]
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>', '', html)
for filename in ['pbj2026-policy.js','pbj2026-workspace.js','pbj2026-ppkerja-adapter.js','satria-hps-generator.js','satria-pp-ecosystem.js','satria-next4.js','satria-operator-studio.js','satria-price-analysis.js','satria-spse-selection-document.js']:
 html=html.replace(f'<script src="./frontend/{filename}"></script>', '<script>\n'+(ROOT/'frontend'/filename).read_text()+'\n</script>')
for filename in ['pbj2026-workspace.css','satria-hps-generator.css','satria-pp-ecosystem.css','satria-next4.css','satria-operator-studio.css','satria-price-analysis.css','satria-spse-selection-document.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{filename}">','<style>\n'+(ROOT/'frontend'/filename).read_text()+'\n</style>')
html=re.sub(r'@import\s+url\([^;]+;', '', html)
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 page.set_default_timeout(12000)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/*',lambda route:route.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(750)
 page.evaluate('''() => {
   S.tahun=[2026]; S.opd=[{id:'o1',nama:'Badan Perencanaan Daerah',singkat:'BAPPEDA'}];
   S.paket=[]; S.rupBank=[
     {id:'r-no-class',rup:'0000071234',nama:'Paket RUP sumber belum lengkap',opd:'o1',tahun:2026,pagu:100000000,jenisPengadaan:'',metodePemilihan:'',asal:'Impor JSON/CSV SiRUP'},
     {id:'r-complete',rup:'0000071235',nama:'Paket Barang',opd:'o1',tahun:2026,pagu:25000000,jenisPengadaan:'Barang',metodePemilihan:'E-Purchasing',asal:'Impor JSON/CSV SiRUP'}
   ];
   S.users=[{id:'qa-admin',nama:'Admin Simulasi',role:'Admin',aktif:true},{id:'qa-viewer',nama:'Viewer Simulasi',role:'Viewer',aktif:true}];
   S.ui.user='qa-admin';S.ui.tahun=2026;S.ui.opd='all';S.ui.rupBankYear='all';S.ui.rupBankOpd='all';S.ui.rupSearch='';
   window.SATRIA_CLOUD_CONFIGURED=false;
   location.hash='#input';route();
 }''')
 page.wait_for_timeout(250)
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(e=>{e.hidden=true;e.style.display='none'})")
 assert page.locator('.satria-rup-class-summary').count()==1
 assert '1 RUP belum lengkap' in page.locator('.satria-rup-class-summary').inner_text()
 assert page.locator('.satria-rup-identity').count()==2
 target=page.locator('article.satria-rup-card').filter(has_text='0000071234')
 assert target.count()==1
 assert 'Perlu verifikasi' in target.locator('.satria-rup-identity').inner_text()
 # Creating a new package from an unclassified RUP must not fabricate type/method.
 target.locator('[data-act="rupcreate"]').click()
 assert page.evaluate("S.paket[0].jenisPengadaan")==''
 assert page.evaluate("S.paket[0].metodePemilihan")==''
 page.evaluate("location.hash='#input';route()")
 target=page.locator('article.satria-rup-card').filter(has_text='0000071234')
 target.locator('.satria-rup-classifier').evaluate('(e)=>e.open=true')
 target.locator('[data-rup-class-kind]').select_option('Pekerjaan Konstruksi')
 target.locator('[data-rup-class-method]').select_option('Pengadaan Langsung')
 target.locator('[data-act="rupclasssave"]').click()
 page.wait_for_timeout(150)
 r=page.evaluate("S.rupBank.find(x=>x.id==='r-no-class')")
 assert r['jenisPengadaan']=='Pekerjaan Konstruksi'
 assert r['metodePemilihan']=='Pengadaan Langsung'
 assert r['klasifikasiDiperiksaPada']
 assert page.evaluate("S.paket[0].jenisPengadaan")=='' and page.evaluate("S.paket[0].metodePemilihan")=='', 'Historical package classifications must remain unchanged'
 assert '0 RUP belum lengkap' in page.locator('.satria-rup-class-summary').inner_text()
 # A second displayed RUP still has its old type; no mass rewrite.
 assert page.evaluate("S.rupBank.find(x=>x.id==='r-complete').jenisPengadaan")=='Barang'
 page.evaluate("S.ui.user='qa-viewer'")
 # Viewer may inspect, but cannot write through the real delegated event.
 viewer=page.locator('article.satria-rup-card').filter(has_text='0000071234')
 viewer.locator('details.satria-rup-classifier').evaluate('(e)=>e.open=true')
 viewer.locator('[data-rup-class-kind]').select_option('Jasa Konsultansi')
 viewer.locator('[data-act="rupclasssave"]').click()
 assert page.evaluate("S.rupBank.find(x=>x.id==='r-no-class').jenisPengadaan")=='Pekerjaan Konstruksi'
 page.evaluate("S.ui.user='qa-admin';render()")
 page.screenshot(path='/mnt/data/SATRIA_NEXT_3.0.59.58_BANK_RUP_UJI.png',full_page=False)
 assert not errors,errors
 browser.close()
print('PASS browser SATRIA Bank RUP: classification visible, manual save persists, unchanged other RUP, Viewer blocked.')
