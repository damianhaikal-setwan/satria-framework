"""End-to-end simulation of actual SATRIA main router, E-P and Pengadaan Langsung.
No production Supabase interaction. Uses synthetic package fixtures only.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from legacy_index_source import read_index
import json,re
ROOT=Path(__file__).resolve().parents[1]
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for filename in ['pbj2026-policy.js','pbj2026-workspace.js','pbj2026-ppkerja-adapter.js','satria-hps-generator.js','satria-pp-ecosystem.js','satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{filename}"></script>', '<script>\n'+(ROOT/'frontend'/filename).read_text()+'\n</script>')
for filename in ['pbj2026-workspace.css','satria-hps-generator.css','satria-pp-ecosystem.css','satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{filename}">','<style>\n'+(ROOT/'frontend'/filename).read_text()+'\n</style>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as play:
 browser=play.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950},accept_downloads=True)
 page.set_default_timeout(6000)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/*',lambda r:r.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(1000)
 assert page.evaluate("typeof SATRIA_PP_ECOSYSTEM")=='object'
 page.evaluate('''() => {
    const first=JSON.parse(JSON.stringify(SEED.paket[0]));
    first.id='pp-ep'; first.rup='RUP-EP-UJI';first.nama='Pengadaan Barang melalui Katalog';first.tahun=2026;
    first.pagu=100000000;first.metodePemilihan='E-Purchasing dengan Negosiasi Harga';first.jenisPengadaan='Barang';
    first.items=[{id:'i',nama:'Printer',vol:2,hs:7000000,satuan:'Unit'}];first.penawaran=[];
    const second=JSON.parse(JSON.stringify(first));
    second.id='pp-pl'; second.rup='RUP-PL-UJI';second.nama='Pengadaan Langsung Kertas';second.pagu=18000000;
    second.jalurPengadaan='SPSE_MONITOR';second.metodePemilihan='SPSE (monitoring)';
    second.spseMonitoring=satriaSpseNewModel();second.spseMonitoring.method='Pengadaan Langsung';
    second.items=[];second.penawaran=[];
    const third=JSON.parse(JSON.stringify(second));third.id='pp-tender';third.rup='RUP-TENDER-UJI';third.spseMonitoring=satriaSpseNewModel();third.spseMonitoring.method='Tender';
    S.paket=[first,second,third];window.SATRIA_CLOUD_CONFIGURED=false;S.users=[{id:'qa-admin',nama:'Admin Uji',role:'Admin',aktif:true,opd:'all'}];S.ui.user='qa-admin';S.ui.tahun=2026;S.ui.opd='all';
    location.hash='#kerja/pp-ep';route();
 }''')
 page.wait_for_timeout(200)
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(e=>{e.hidden=true;e.style.display='none'})")
 page.on('dialog',lambda d:d.dismiss())
 assert page.locator('#nav a[href="#kerja"]').count()==1,'Workspace not in navigation'
 assert page.locator('.pp-ecosystem').count()==1
 assert page.locator('.pp-hero-badge').inner_text()=='E-Purchasing'
 assert page.locator('[data-pp-draft]').count()==0,'E-P cannot show SPSE draft printing'
 assert 'DPP' in page.locator('.pp-document-list').inner_text()
 assert page.locator('[data-pp-go="docs"]').count()==1
 # Persist one working note without touching HPS and budget.
 
 old=page.evaluate("({pagu:P('pp-ep').pagu,hs:P('pp-ep').items[0].hs,award:P('pp-ep').pemenangId})")
 page.locator('[data-pp-field="note"]').fill('Bukti survei belum lengkap; perlu dilengkapi sebelum cetak.')
 page.locator('[data-pp-action="note"]').click()
 page.wait_for_timeout(100)
 assert page.evaluate("P('pp-ep').ppEkosistem.notes.length")==1
 assert page.evaluate("({pagu:P('pp-ep').pagu,hs:P('pp-ep').items[0].hs,award:P('pp-ep').pemenangId})")==old
 assert 'Bukti survei belum lengkap' in page.locator('.pp-records').first.inner_text()
 # Block unsafe proof URL; add valid proof with date and number.
 page.locator('[data-pp-field="title"]').fill('Dokumen sumber')
 page.locator('[data-pp-field="reference"]').fill('Dokumen-001')
 page.locator('[data-pp-field="url"]').fill('http://invalid.example')
 page.locator('[data-pp-action="evidence"]').click()
 assert page.evaluate("P('pp-ep').ppEkosistem.evidence.length")==0
 page.locator('[data-pp-field="url"]').fill('https://jdih.lkpp.go.id')
 page.locator('[data-pp-field="date"]').fill('2026-11-11')
 page.locator('[data-pp-action="evidence"]').click()
 page.wait_for_timeout(100)
 assert page.evaluate("P('pp-ep').ppEkosistem.evidence.length")==1
 with page.expect_download() as info:
  page.locator('[data-pp-action="export"]').click()
 downloaded=json.loads(Path(info.value.path()).read_text())
 assert downloaded['notes'][0]['text'].startswith('Bukti survei')
 assert downloaded['package']['hpsRincian']==14000000
 assert downloaded['evidence'][0]['url']=='https://jdih.lkpp.go.id'
 # Real package selection switches to SPSE without adding a second login or source.
 page.locator('#ppWorkspaceSelect').select_option('pp-pl')
 page.wait_for_timeout(200)
 assert page.locator('.pp-hero-badge').inner_text()=='Pengadaan Langsung'
 assert page.locator('[data-pp-draft]').count()==2, 'BA reviu dan analisa pasar draf remain'
 assert page.locator('[data-pp-go="spse-docs"]').count()==1, 'selection doc is opened through its own generator'
 assert page.locator('.pp-alert').count()==1
 page.evaluate('''() => {window.__printed='';window.open=()=>({document:{open(){},write(s){window.__printed=s},close(){}},focus(){},print(){}})}''')
 page.locator('[data-pp-draft="analisa-pasar"]').click()
 assert 'DRAF BELUM LENGKAP' in page.evaluate('window.__printed')
 assert 'Pengadaan Langsung Kertas' in page.evaluate('window.__printed')
 # Tender cannot print PP draft; a manual method override is not treated as authorization.
 page.locator('#ppWorkspaceSelect').select_option('pp-tender')
 page.wait_for_timeout(200)
 assert page.locator('[data-pp-draft]').count()==0
 assert 'Metode perlu diperiksa' in page.locator('.pp-hero-badge').inner_text()
 # Viewer can inspect but cannot change snapshot (security app-level).
 page.evaluate('''() => {S.users.push({id:'viewer-qa',nama:'Viewer Uji',role:'Viewer',aktif:true});S.ui.user='viewer-qa';render()}''')
 assert page.locator('[data-pp-action="note"]').count()==0
 assert page.locator('[data-pp-action="evidence"]').count()==0
 # A change of scope invalidates a previously selected package in the workspace.
 page.evaluate("S.ui.opd='o2';render()")
 assert page.locator('[data-pp-action="note"]').count()==0
 page.evaluate("S.ui.opd='all';render()")
 page.evaluate("S.ui.user='qa-admin';location.hash='#kerja/pp-ep';route()")
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(e=>{e.hidden=true;e.style.display='none'})")
 page.wait_for_timeout(150)
 page.screenshot(path='/mnt/data/SATRIA_NEXT_3.0.59.56_RUANG_KERJA_PP_UJI.png',full_page=True)
 assert not errors, errors
 browser.close()
print('PASS browser full SATRIA: navigation, E-P/PL/Tender routing, scoped notes/evidence, no HPS/pagu mutation, JSON export, draft print, Viewer restriction, no JS errors')
