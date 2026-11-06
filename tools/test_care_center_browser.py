#!/usr/bin/env python3
"""Optional smoke test in Chromium: care-center navigation, downloads, roles, mobile.
External CDN and cloud are stubbed, never a production Supabase test.
"""
from pathlib import Path
from urllib.parse import urlparse
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'tools'/'care-center-preview.png'
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1365,'height':900}, accept_downloads=True)
    errors=[]; missing=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    def fulfill(route):
        url=urlparse(route.request.url)
        if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
            route.fulfill(status=200,body='',content_type='text/javascript');return
        if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com','d3js.org'):
            route.fulfill(status=200,body='',content_type='text/css');return
        if url.hostname=='satria.local' and url.path in ('/','/index.html'):
            route.fulfill(status=200,body=(ROOT/'index.html').read_bytes(),content_type='text/html');return
        target=(Path(url.path) if url.scheme=='file' else ROOT/url.path.lstrip('/')).resolve()
        if target.is_file() and ROOT.resolve() in target.parents:
            typ='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'text/plain'
            route.fulfill(status=200,body=target.read_bytes(),content_type=typ);return
        missing.append(url.path)
        route.fulfill(status=404,body='not found')
    page.route('**/*',fulfill)
    page.set_content((ROOT/'index.html').read_text(encoding='utf-8').replace('<head>','<head><base href="https://satria.local/">',1),wait_until='domcontentloaded',timeout=30000)
    page.wait_for_timeout(550)
    # CDN is stubbed in this harness; do not test the Supabase modal here.
    page.evaluate("document.getElementById('satriaCloudModal').style.display='none'")
    assert page.locator('#nav a[href="#care"]').count()==1, 'Menu belum ada'
    # Fragment links navigate out of about:blank when base is injected; invoke same router for the fixture.
    page.evaluate("window.SATRIA_CLOUD_CONFIGURED=false;window.SATRIA_CLOUD_ROLE='';S.users.push({id:'fixture-admin',role:'Admin',nama:'Admin Uji',aktif:true,opd:'all'});S.ui.user='fixture-admin';location.hash='#care';route()")
    page.wait_for_timeout(180)
    assert page.locator('.satria-care-page').count()==1, 'Halaman Perawatan tidak muncul'
    assert page.get_by_role('heading',name='Perawatan SATRIA').count()==1
    before=page.evaluate('JSON.stringify(S.paket)')
    page.get_by_role('button',name='Periksa Ulang').click()
    assert page.evaluate('JSON.stringify(S.paket)')==before, 'Pemeriksaan mengubah data paket'
    assert page.locator('.satria-care-kpi').count()==4
    with page.expect_download() as download:
        page.get_by_role('button',name='Unduh Ringkasan').click()
    assert download.value.suggested_filename=='SATRIA-Ringkasan-Perawatan.json'
    with page.expect_download() as download:
        page.get_by_role('button',name='Unduh Laporan Error').click()
    assert download.value.suggested_filename=='SATRIA-Laporan-Diagnostik.json'
    page.get_by_role('button',name='Buka SATRIA Debug').click()
    assert page.locator('#satriaDebug').is_visible(), 'Debug tidak terbuka'
    page.locator('#sdClose').click()
    # Existing Settings view remains valid after reusing the original warning rules.
    page.evaluate("S.ui.page='set';render()")
    assert page.locator('.satria-settings-health').count()==1
    assert page.locator('.satria-settings-care-link').count()==1
    page.evaluate("S.ui.page='care';render()")
    page.screenshot(path=str(OUTPUT),full_page=True)
    # Verify non-admin cannot see global admin actions even if local user label is admin.
    page.evaluate("window.SATRIA_CLOUD_CONFIGURED=true;window.SATRIA_CLOUD_ROLE='operator';render()")
    assert page.locator('.satria-care-page').count()==1
    assert page.get_by_role('button',name='Backup Data JSON').count()==0
    assert page.get_by_role('button',name='Buka SATRIA Debug').count()==0
    assert 'Khusus Admin' in page.locator('.satria-care-page').inner_text()
    # Mobile navigation uses the existing menu toggle.
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate("window.SATRIA_CLOUD_CONFIGURED=false;window.SATRIA_CLOUD_ROLE='';render()")
    page.wait_for_timeout(140)
    width=page.evaluate('document.querySelector(\'.satria-care-page\').getBoundingClientRect().width')
    assert width <= 400, f'Mobile page too wide: {width}'
    assert page.locator('#nav a[href="#care"]').count()==1
    assert not errors, errors
    assert not missing, missing
    print('PASS care-center browser: menu, scan nonmutating, download, debug, role guard, mobile, no pageerror')
    browser.close()
