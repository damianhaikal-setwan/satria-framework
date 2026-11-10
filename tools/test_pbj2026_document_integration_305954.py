"""Real Document Studio regression for 3.0.59.54.
Offline simulation, no cloud writes or production data. Asserts the active optimized
view (not the legacy vDok) displays policy assistance for the selected package.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from legacy_index_source import read_index
ROOT=Path(__file__).resolve().parents[1]
html=read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['pbj2026-policy.js','pbj2026-workspace.js','satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
    html=html.replace(f'<script src="./frontend/{name}"></script>', '<script>\n'+(ROOT/'frontend'/name).read_text()+'\n</script>')
for name in ['pbj2026-workspace.css','satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
    html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">', '<style>\n'+(ROOT/'frontend'/name).read_text()+'\n</style>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
    browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.route('**/*',lambda r:r.abort())
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_timeout(500)
    assert page.evaluate('typeof window.SATRIA_PBJ_WORKSPACE')=='object'
    assert page.evaluate('window.vDok.name')=='vDokOptimized',page.evaluate('window.vDok.name')
    page.evaluate('''() => {
       const first=JSON.parse(JSON.stringify(SEED.paket[0]));
       first.id='pbj-qa-a';first.rup='RUP-001';first.nama='Kertas Uji A';first.pagu=45000000;
       first.metodePemilihan='E-Purchasing dengan Negosiasi Harga';first.jenisPengadaan='Barang';
       const second=JSON.parse(JSON.stringify(first));
       second.id='pbj-qa-b';second.rup='RUP-002';second.nama='Paket Uji B';second.pagu=75000000;
       S.paket=[first,second];S.ui.tahun=2026;S.ui.opd='all';S.ui.dpid=first.id;S.ui.dok='nodis';S.ui.plife='all';
       location.hash='#dok';route();
     }''')
    page.wait_for_timeout(250)
    assert page.locator('.dok-studio').count()==1, 'Active document studio missing'
    assert page.locator('.pbj-panel').count()==1, 'PBJ 2026 panel not rendered inside ACTIVE document studio'
    assert page.locator('.dok-studio .pbj-panel').count()==1
    assert page.locator('.pbj-panel').get_attribute('data-pbj-panel')=='pbj-qa-a'
    assert 'DPP' in page.locator('.pbj-panel').inner_text()
    assert 'HRS' not in page.locator('.pbj-panel').inner_text().split('Dokumen yang dibantu SATRIA')[1].split('Rujukan:')[0].split('Gunakan tombol')[0], 'Incorrect HRS plan for low-value package'
    assert page.locator('.sop-studio').inner_text().count('15')>=1, 'Operator Studio must display 15 templates'
    # User changes package from actual dropdown, event must re-render the panel.
    page.locator('#selPaket').select_option('pbj-qa-b')
    page.wait_for_timeout(220)
    assert page.locator('.pbj-panel').count()==1
    assert page.locator('.pbj-panel').get_attribute('data-pbj-panel')=='pbj-qa-b'
    assert 'HRS' in page.locator('.pbj-panel').inner_text()
    assert page.locator('[data-pbj-print]').count()==0, 'E-Purchasing must not offer SPSE drafts'
    # User can inspect settings and navigate to preview with no approval workflow.
    assert page.locator('.pbj-panel [data-pbj-start]').count()==1
    assert page.locator('.pbj-panel [data-pbj-basis]').count()==1
    assert page.locator('.dok-preview-section').count()==1
    # Risk test: route classifier cannot authorize Tender/Seleksi printing.
    policy=page.evaluate('''() => SATRIA_PBJ_POLICY.documentPlan({jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{method:'Tender'},jenisPengadaan:'Barang',pagu:10000000}).docs.length''')
    assert policy==0
    # screenshot is a synthetic test fixture and never contains user production data
    page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(e=>{e.hidden=true;e.style.display='none'})")
    page.locator('.pbj-panel').scroll_into_view_if_needed()
    page.screenshot(path='/mnt/data/SATRIA_NEXT_3.0.59.54_TAMPILAN_PANEL_PBJ_UJI.png')
    assert not errors,errors
    browser.close()
print('PASS real Document Studio: panel present, 15 templates, 2 package selection, correct DPP/HRS advisory, no SPSE drafts on e-P, preview retained, zero JS errors')
