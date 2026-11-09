#!/usr/bin/env python3
"""Regression: vLap integrated tabs with actual full SATRIA stylesheet order, simulated data."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
source=(root/'frontend/refactor/js/01-app-core.js').read_text()
js=source[source.index('function satriaLaporanRekeningScope(){'):source.index('function csvExport(){')]
html=(root/'index.html').read_text()
styles=[]
for link in re.findall(r'<link\s+[^>]*rel="stylesheet"[^>]*>',html):
    match=re.search(r'href="([^"]+)"',link)
    if match and match.group(1).startswith('./'):
        path=root/match.group(1)[2:]
        if path.exists():styles.append(path.read_text())
css='\n'.join(styles)
# Reuse a deterministic fixture from the previous regression, not any live/user data.
prev=(root/'tools/test_laporan_visual_genz_20261109.py').read_text()
base=prev.split("base=r'''",1)[1].split("'''",1)[0]
base+='\nfunction satriaLaporanData(){return []}\n'
handlers=r'''
function render(){document.getElementById('main').innerHTML=vLap()}
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,d=t.dataset;
 if(a==='lapView') { if(!['overview','rekening','audit','rup'].includes(d.view))return; S.ui.lapView=d.view; render();return }
 if(a==='lapVizAccount'){const key=String(d.key||'');if(!satriaLaporanRekeningRows().options.has(key))return;S.ui.lapView='rekening';S.ui.lapRekeningAkun=key;render();return}
 if(a==='lapVizAudit'){const kind=String(d.kind||'');if(!Object.hasOwn(SATRIA_LAP_AUDIT_LABELS,kind))return;S.ui.lapView='audit';S.ui.lapAuditJenis=kind;render();return}
 if(a==='lapRekeningReset'){S.ui.lapRekeningTahun='all';S.ui.lapRekeningAkun='all';S.ui.lapRekeningCari='';render();return}
});
document.addEventListener('change',e=>{const t=e.target;
 if(t.id==='lapVizYear'||t.id==='lapRekeningTahun'){S.ui.lapRekeningTahun=String(t.value||'all');render();return}
 if(t.id==='lapVizMetric'){S.ui.lapVizMetric=String(t.value||'hps');render();return}
 if(t.id==='lapRekeningAkun'){S.ui.lapRekeningAkun=String(t.value||'all');render();return}
 if(t.id==='lapAuditJenis'){S.ui.lapAuditJenis=String(t.value||'all');render();return}
});
render();
'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1450,'height':970},device_scale_factor=1)
    page.set_content('<!doctype html><html lang="id" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="main"></main></body></html>')
    page.add_style_tag(content=css)
    page.add_script_tag(content=base+js+handlers)
    tabs=page.locator('#satriaLaporanShell [role="tab"]')
    assert tabs.count()==4
    assert tabs.nth(0).get_attribute('aria-selected')=='true'
    assert page.locator('#satriaLaporanVisual').is_visible()
    assert not page.locator('#satriaLaporanRekening').is_visible()
    assert not page.locator('#satriaLaporanAudit').is_visible()
    assert page.locator('#satriaLaporanVisual .satria-lv-panel').count()==5
    assert page.locator('#satriaLaporanVisual .satria-lv-kpi').count()==4
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+3'), 'desktop has document overflow'
    assert page.locator('.satria-lv-hero').evaluate('(e)=>getComputedStyle(e).backgroundImage').startswith('linear-gradient')
    assert page.locator('.satria-lv-hero h2').evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)', 'hero heading must stay white with all actual CSS'
    page.screenshot(path=str(root/'tools/pratinjau-laporan-integrated-desktop-v3.0.59.51.png'),full_page=True)
    # navigation from visual account interaction opens real account report tab
    page.locator('#satriaLaporanVisual [data-act="lapVizAccount"]').first.click()
    assert page.locator('#satriaLaporanRekening').is_visible()
    assert page.locator('#satriaLaporanVisual').is_hidden()
    assert page.locator('#lapTab-rekening').get_attribute('aria-selected')=='true'
    page.screenshot(path=str(root/'tools/pratinjau-laporan-rekening-v3.0.59.51.png'),full_page=True)
    assert page.evaluate("S.ui.lapRekeningAkun!='all'")
    page.locator('#lapTab-audit').click()
    assert page.locator('#satriaLaporanAudit').is_visible()
    page.screenshot(path=str(root/'tools/pratinjau-laporan-audit-v3.0.59.51.png'),full_page=True)
    assert page.locator('#satriaLaporanRekening').is_hidden()
    page.locator('#lapTab-rup').click()
    assert page.locator('[data-satria-laporan="integrated"]').is_visible()
    assert page.locator('#satriaLaporanVisual').is_hidden()
    page.locator('#lapTab-overview').click()
    assert page.locator('#satriaLaporanVisual').is_visible()
    # PPKom scope still server-filtered
    page.evaluate("S.ui.lapRekeningAkun='all';window.testScope={opdIds:['bap'],years:[2026]};render()")
    assert page.evaluate('satriaLaporanVisualData().totals.paket')==5
    assert page.evaluate('satriaLaporanVisualData().rekening.details.every(p=>p.opd==="bap" && p.tahun===2026)')
    # responsive mobile dark and no body overflow
    page.evaluate("document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--ink','#eff1ff');document.documentElement.style.setProperty('--mut','#b2bed6');document.documentElement.style.setProperty('--bd','#39425c');document.documentElement.style.setProperty('--card-solid','#1d2440')")
    page.set_viewport_size({'width':390,'height':844})
    assert page.locator('#satriaLaporanVisual').is_visible()
    assert page.locator('#lapTab-rekening').is_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+3'), 'mobile has document overflow'
    page.screenshot(path=str(root/'tools/pratinjau-laporan-integrated-mobile-v3.0.59.51.png'),full_page=True)
    browser.close()
print('PASS full SATRIA CSS with integrated overview, account and audit drilldowns, RUP tab, mobile dark, PPKom scope')
