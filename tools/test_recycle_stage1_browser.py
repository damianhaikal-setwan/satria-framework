"""Offline browser smoke: local recycle, role guard, cloud block and XSS regression.
Tests front-end event flows with a simulated durable engine; does not claim live cloud checks.
"""
from pathlib import Path
from urllib.parse import urlparse
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True, executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':920},accept_downloads=True)
 page.on('dialog',lambda dialog:dialog.accept())
 errors=[]; missing=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def serve(route):
  url=urlparse(route.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   route.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('d3js.org','fonts.googleapis.com','fonts.gstatic.com'):
   route.fulfill(status=200,body='',content_type='text/css');return
  target=(ROOT/url.path.lstrip('/')).resolve()
  if target.is_file() and ROOT.resolve() in target.parents:
   ctype='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'text/plain'
   route.fulfill(status=200,body=target.read_bytes(),content_type=ctype);return
  missing.append(route.request.url);route.fulfill(status=404,body='missing')
 page.route('**/*',serve)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/">',1)
 page.set_content(html,wait_until='domcontentloaded')
 page.wait_for_timeout(450)
 assert page.locator('nav a[href="#sampah"]').count()==1
 page.evaluate("document.querySelectorAll('#satriaCloudModal, .sc-modal-backdrop, .satria-cloud-modal, .satria-cloud-overlay').forEach(el=>{el.hidden=true;el.style.display='none'})")
 page.evaluate("""() => {
  window.SATRIA_CLOUD_CONFIGURED=false;
  ENGINE='dexie'; // simulate storage active; tested separately by persistence suite
  S.paket=JSON.parse(JSON.stringify(SEED.paket));S.opd=JSON.parse(JSON.stringify(SEED.opd));
  S.users=JSON.parse(JSON.stringify(SEED.users));S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
  S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));S.tahun=[2026];
  S.ui.tahun=2026;S.ui.opd='all';S.ui.user='demo-admin';
  S.opd[0].kop='x" onerror="window.__satriaXssRan=true';
  S.pemda.logo='javascript:alert(1)';
  location.hash='#set';route();
 }""")
 assert page.evaluate('window.__satriaXssRan===undefined')
 assert page.locator('.satria-settings-opd-kop-preview img[onerror]').count()==0
 assert page.locator('.satria-settings-pemda-card img[onerror]').count()==0
 page.evaluate("location.hash='#paket/k1';route()")
 assert page.locator('[data-act="delpaket"]').count()==1
 page.locator('[data-act="delpaket"]').click()
 assert page.evaluate("S.paket.some(p=>p.id==='k1')") is False
 assert page.evaluate("S.sampah.length") == 1
 assert page.evaluate("persistable().sampah[0].record.id") == 'k1'
 page.evaluate("location.hash='#sampah';route()")
 assert page.locator('.satria-trash-page [data-act="trashrestore"]').count()==1
 page.screenshot(path='/mnt/data/SATRIA_NEXT_STAGE1_SAMPAH_QA.png',full_page=False)
 page.locator('.satria-trash-page [data-act="trashrestore"]').click()
 assert page.evaluate("S.paket.some(p=>p.id==='k1')") is True
 assert page.evaluate("S.sampah.length")==0
 # Cloud configured: deleting must not create a real RPC delete or false restore promise.
 page.evaluate("window.SATRIA_CLOUD_CONFIGURED=true;location.hash='#paket/k1';route()")
 page.locator('[data-act="delpaket"]').click()
 assert page.evaluate("S.paket.length") == 1
 assert page.evaluate("S.sampah.length") == 0
 page.evaluate("window.SATRIA_CLOUD_CONFIGURED=false;S.users.push({id:'viewer-test',nama:'Penguji lihat',role:'Viewer',aktif:true});S.ui.user='viewer-test';location.hash='#paket/k1';route()")
 assert page.locator('[data-act="delpaket"]').is_disabled()
 assert page.evaluate("S.paket.length") == 1
 assert page.evaluate("S.sampah.length") == 0
 # Existing deep links with #settings should land on the real Settings page.
 page.evaluate("S.ui.user='demo-admin';location.hash='#settings';route()")
 assert page.evaluate("S.ui.page") == 'set'
 assert not errors, errors
 assert not missing, missing
 print('PASS browser: XSS blocked; delete / restore local; browser backup includes trash; cloud and Viewer guarded; settings alias')
 browser.close()
