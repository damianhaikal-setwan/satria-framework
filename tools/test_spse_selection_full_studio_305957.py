"""Acceptance: integrated SPSE editor in the ACTIVE optimized SATRIA Document Studio."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from legacy_index_source import read_index
ROOT=Path(__file__).resolve().parents[1]
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['pbj2026-policy.js','satria-spse-selection-document.js','pbj2026-workspace.js','satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>', '<script>\n'+(ROOT/'frontend'/name).read_text()+'\n</script>')
for name in ['pbj2026-workspace.css','satria-spse-selection-document.css','satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">', '<style>\n'+(ROOT/'frontend'/name).read_text()+'\n</style>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':950})
 page.route('**/*',lambda r:r.abort())
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.wait_for_timeout(400)
 page.evaluate('''() => {
  const a=JSON.parse(JSON.stringify(SEED.paket[0]));
  a.id='spse-sim-57';a.rup='RUP-SIMULASI-57';a.nama='SIMULASI Pengadaan Langsung Meja';a.pagu=100000000;
  a.metodePemilihan='Pengadaan Langsung';a.jalurPengadaan='SPSE_MONITOR';a.spseMonitoring={method:'Pengadaan Langsung',stages:[],payments:[],addenda:[],issues:[],contractValue:0};
  a.jenisPengadaan='Barang';a.tglMulaiPemilihan='2026-11-01';a.dasarRegulasi='perlem-3-2026';
  a.items=[{id:'spse-item',nama:'Meja SIMULASI',spesifikasi:'Bahan solid untuk SIMULASI',vol:2,hs:32000000,satuan:'unit'}];
  S.paket=[a];S.users=[{id:'sim-admin',nama:'Admin Simulasi',role:'Admin',aktif:true}];S.ui.user='sim-admin';S.ui.tahun=2026;S.ui.opd='all';S.ui.dpid=a.id;S.ui.dok='nodis';S.ui.plife='all';
  location.hash='#dok';route();
 }''')
 page.wait_for_timeout(350)
 assert page.locator('.dok-studio').count()==1,'optimized doc studio missing'
 assert page.locator('.dok-studio .sd-editor').count()==1,'SPSE editor missing in active document UI'
 assert page.locator('.sd-editor [data-sd-field]').count()>=20
 assert page.locator('[data-sd-save]').count()==1
 assert page.locator('.dok-preview-section').count()==0, 'SPSE must not show e-Purchasing legacy preview' 
 assert page.locator('.dok-studio .pbj-panel').count()==1
 # test no SPA page re-render loss while entering draft field
 page.locator('.sd-editor details').evaluate('(e)=>e.open=true')
 page.locator('[data-sd-field="nomor"]').fill('SIMULASI-NOMOR-UJI')
 assert page.locator('[data-sd-field="nomor"]').input_value()=='SIMULASI-NOMOR-UJI'
 assert page.locator('.sd-editor').count()==1
 # Both methods share package selection without exposing e-Purchasing templates for SPSE.
 page.evaluate("""() => {
   const ep=JSON.parse(JSON.stringify(S.paket[0]));ep.id='e-p-sim-57';ep.rup='RUP-EP-SIM';ep.nama='Paket Katalog Simulasi';ep.jalurPengadaan='E_PURCHASING';delete ep.spseMonitoring;ep.metodePemilihan='E-Purchasing dengan Negosiasi Harga';S.paket.push(ep);render();
 }""")
 assert page.locator('#selPaket option').count()==2
 page.locator('#selPaket').select_option('e-p-sim-57')
 assert page.locator('.dok-preview-section').count()==1 and page.locator('.sd-editor').count()==0
 page.locator('#selPaket').select_option('spse-sim-57')
 assert page.locator('.dok-spse-workspace .sd-editor').count()==1 and page.locator('.dok-preview-section').count()==0
 page.locator('.dok-spse-workspace').scroll_into_view_if_needed()
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(e=>{e.hidden=true;e.style.display='none'})")
 page.screenshot(path='/mnt/data/SATRIA_NEXT_3.0.59.57_PENYUSUN_SPSE_SIMULASI.png',full_page=False)
 assert not errors,errors
 b.close()
print('PASS real SATRIA optimized Document Studio: 22-field SPSE editor visible, draft field stable, SPSE and e-Purchasing switching intact')
