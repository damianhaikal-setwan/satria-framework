"""Tahap 5B: browser smoke with fake Supabase transport; never touches production."""
from pathlib import Path
from urllib.parse import urlparse
import ast, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=ast.parse((ROOT/'tools/test_cloud_trash_stage2_browser.py').read_text())
INJECT=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='INJECT' for x in n.targets))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':900})
 errors=[];missing=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.on('dialog',lambda dlg:dlg.accept())
 def serve(route):
  url=urlparse(route.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   route.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('d3js.org','fonts.googleapis.com','fonts.gstatic.com'):
   route.fulfill(status=200,body='',content_type='text/css');return
  dest=(ROOT/url.path.lstrip('/')).resolve()
  if dest.is_file() and ROOT in dest.parents:
   route.fulfill(status=200,body=dest.read_bytes(),content_type='text/javascript' if dest.suffix=='.js' else 'text/css' if dest.suffix=='.css' else 'text/plain');return
  missing.append(route.request.url);route.fulfill(status=404,body='missing')
 page.route('**/*',serve)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/"><script>'+INJECT+'</script>',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.evaluate('''() => {
  __mockSatriaServer.payload=JSON.parse(JSON.stringify(SEED));
  __mockSatriaServer.payload.rupBank=[];
  __mockSatriaServer.payload.sampah=[];
  S.ui.user=(S.users.find(x=>x.role==='Admin')||S.users[0]).id;
 }''')
 assert page.evaluate("typeof window.SATRIA_INSTALL_CLOUD_ADMIN === 'undefined'")
 assert page.evaluate("typeof window.SATRIA_ADMIN_USERS?.refresh === 'function'")
 # Admin login opens the user UI. This proves the extracted modal uses LIVE session state.
 page.locator('#scEmail').fill('admin@example.test')
 page.locator('#scPassword').fill('password123')
 page.locator('#scConnect').click()
 page.wait_for_function("window.SATRIA_CLOUD_TRASH.ready && window.SATRIA_CLOUD_ROLE==='admin'",timeout=12000)
 page.evaluate("location.hash='#user';route()")
 page.wait_for_timeout(200)
 page.evaluate("document.getElementById('satriaOpenCreateUser')?.click()")
 page.wait_for_function("document.getElementById('satriaCreateUserModal')?.hidden === false",timeout=4500)
 # Place synthetic confidential text in the admin-only roster DOM, then logout.
 page.evaluate('''() => { const rows=document.querySelector('#satriaAdminUsersRows');if(rows)rows.innerHTML='<tr><td>SECRET-OLD-SESSION</td></tr>'; }''')
 page.locator('#satriaCreateUserModal [data-satria-user-close]').first.click()
 page.locator('#satriaCloudOpen').click()
 page.locator('#scSignOut').click()
 page.wait_for_function("window.SATRIA_CLOUD_ROLE===null",timeout=8000)
 assert page.evaluate("document.getElementById('satriaCreateUserModal').hidden")
 assert not page.evaluate("document.body.textContent.includes('SECRET-OLD-SESSION')")
 # Second user in same org has Viewer role and may not access admin modal.
 page.evaluate("__mockSatriaServer.role='viewer'")
 page.locator('#scEmail').fill('viewer@example.test')
 page.locator('#scPassword').fill('password123')
 page.locator('#scConnect').click()
 page.wait_for_function("window.SATRIA_CLOUD_TRASH.ready && window.SATRIA_CLOUD_ROLE==='viewer'",timeout=12000)
 page.evaluate("location.hash='#user';route()")
 page.evaluate("document.getElementById('satriaOpenCreateUser')?.click()")
 assert page.evaluate("document.getElementById('satriaCreateUserModal').hidden")
 assert not page.evaluate("document.body.textContent.includes('SECRET-OLD-SESSION')")
 assert not errors,errors
 assert not missing,missing
 print('PASS Stage5 browser: admin module loaded, live session, admin create UI, cross-session roster cleared, Viewer blocked (mock cloud)')
 browser.close()
