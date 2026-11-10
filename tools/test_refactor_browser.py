#!/usr/bin/env python3
"""Optional Chromium smoke test for the real split-file loader.

Uses set_content + intercepted resources so it can also run in restricted CI
containers that block localhost navigation. External cloud/font/CDN scripts are
stubbed; this is not a live Supabase integration test.
"""
from pathlib import Path
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None, args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':800},accept_downloads=True)
    errors=[]; missing=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    def fulfill(route):
        url=urlparse(route.request.url)
        if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
            route.fulfill(status=200,body='',content_type='text/javascript');return
        if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com','d3js.org'):
            route.fulfill(status=200,body='',content_type='text/css');return
        target=(ROOT/url.path.lstrip('/')).resolve()
        if target.is_file() and ROOT.resolve() in target.parents:
            typ='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'text/plain'
            route.fulfill(status=200,body=target.read_bytes(),content_type=typ);return
        missing.append(url.path);route.fulfill(status=404,body='not found')
    page.route('**/*',fulfill)
    html=(ROOT/'index.html').read_text(encoding='utf-8').replace('<head>','<head><base href="https://satria.local/">',1)
    page.set_content(html,wait_until='domcontentloaded',timeout=30000)
    page.wait_for_timeout(400)
    assert page.locator('nav a').count()>=10, 'Navigasi utama tidak muncul'
    assert page.locator('a[href="#care"]').count()>=1, 'Menu Perawatan SATRIA belum tersedia'
    assert page.evaluate("typeof render === 'function'"), 'Render core tidak dimuat'
    assert page.evaluate("typeof window.SATRIA_PRICE_CORE?.analyze === 'function'"), 'Analisa harga tidak dimuat'
    health=page.evaluate('window.SATRIA_MAINTENANCE.inspect()')
    assert health['scriptsExpected']==34 and health['stylesExpected']==24, health
    assert health['stylesLoaded']==24,health
    assert health['coreReady'] and health['priceAnalysisReady'],health
    assert health['errorCount']==0,health
    assert not errors,errors
    assert not missing,missing
    assert page.locator('#satriaDebug #sdDiagnostics').count()==1, 'Tombol diagnostik tidak tersedia'
    with page.expect_download() as download:
        page.evaluate("document.querySelector('#sdDiagnostics').click()")
    assert download.value.suggested_filename=='SATRIA-Laporan-Diagnostik.json'
    print('PASS browser: 34 JS, 24 CSS, modul & navigasi, diagnostik unduh, tanpa pageerror (CDN/cloud di-stub)')
    browser.close()
