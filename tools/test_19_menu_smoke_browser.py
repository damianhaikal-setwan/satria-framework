#!/usr/bin/env python3
"""Local browser smoke of 19 original menu routes + Sampah.
External scripts stubbed; NOT full E2E validation or live Supabase audit.
"""
from pathlib import Path
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
EXPECTED=['dash','paket','kerja','kalk','input','spse','monitor','finance','quality','brief','satria360','dok','lap','master','set','care','user','panduan','chat','sampah']
with sync_playwright() as api:
 browser=api.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None,args=['--no-sandbox'])
 for width in (390,1280):
  page=browser.new_page(viewport={'width':width,'height':800},accept_downloads=True)
  errors=[];missing=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  def serve(route):
   url=urlparse(route.request.url)
   if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
    route.fulfill(status=200,body='',content_type='text/javascript');return
   if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com'):
    route.fulfill(status=200,body='',content_type='text/css');return
   file=(ROOT/url.path.lstrip('/')).resolve()
   if file.is_file() and ROOT.resolve() in file.parents:
    content_type='text/javascript' if file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'text/html'
    route.fulfill(status=200,body=file.read_bytes(),content_type=content_type);return
   missing.append(url.path);route.fulfill(status=404,body='missing')
  page.route('**/*',serve)
  html=(ROOT/'index.html').read_text(encoding='utf8').replace('<head>','<head><base href="https://satria.local/">',1)
  page.set_content(html,wait_until='domcontentloaded',timeout=30000)
  page.wait_for_timeout(200)
  page.evaluate('''()=>{S.users=[{id:'qa-admin',nama:'QA Admin',role:'Admin',aktif:true}];S.ui.user='qa-admin';render()}''')
  items=page.evaluate('NAV.map(([id])=>id)')
  assert items==EXPECTED,(items,EXPECTED)
  for name in EXPECTED:
   before=len(errors)
   page.evaluate('(name)=>{location.hash="#"+name}',name)
   
   try:page.wait_for_function('(name)=>S.ui.page===name',arg=name,timeout=1500)
   except Exception as exc:
    print('ROUTE FAIL',width,name,page.evaluate('({hash:location.hash,page:S.ui.page})'), 'errors',errors[-2:]);raise
   out=page.evaluate('''()=>{const main=document.querySelector('#main');return {actual:S.ui.page,text:(main?.textContent||'').trim().slice(0,300),htmlLen:(main?.innerHTML||'').length}}''')
   assert out['actual']==name,(width,name,out)
   assert out['htmlLen']>100,(width,name,out)
   assert len(errors)==before,(width,name,errors[before:])
  # Verify client-side guard for a local Viewer; not a substitute for server RLS.
  page.evaluate('''()=>{S.users=[{id:'qa-viewer',nama:'QA Viewer',role:'Viewer',aktif:true}];S.ui.user='qa-viewer';location.hash='#dash';render()}''')
  access=page.evaluate('''()=>({menu:[...document.querySelectorAll('#nav a')].map(a=>a.getAttribute('href')),write:canWrite()})''')
  assert not access['write'],(width,access)
  for restricted in ('#input','#master','#set','#user'):
   assert restricted not in access['menu'],(width,restricted)
  # Audit mode uses only in-memory synthetic users, never database or cloud.
  assert not missing,(width,missing)
  print(f'PASS browser {width}px: {len(EXPECTED)} menu admin + Viewer guard, tanpa runtime/pageerror/asset hilang')
  page.close()
 browser.close()
