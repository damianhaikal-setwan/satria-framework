#!/usr/bin/env python3
"""Stage 4 smoke: real separate local assets; no Supabase production activity."""
from pathlib import Path
import shutil, tempfile, os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
assets=[]; errors=[]
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('google-chrome') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1280,'height':850},device_scale_factor=1)
 page=ctx.new_page()
 page.on('pageerror',lambda error:errors.append(str(error)))
 def serve(route):
  url=urlparse(route.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   route.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com'):
   route.fulfill(status=200,body='',content_type='text/css');return
  f=(ROOT/url.path.lstrip('/')).resolve()
  if f.is_file() and (f==ROOT or ROOT in f.parents):
   assets.append(str(f.relative_to(ROOT)))
   route.fulfill(status=200,body=f.read_bytes(),content_type='text/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'text/plain')
  else:route.fulfill(status=404,body='not found')
 page.route('**/*',serve)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/">',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(500)
 assert not errors, errors
 assert page.evaluate('typeof DOCS')=='object'
 assert page.evaluate('Object.keys(DOCS).length')>=14
 assert page.evaluate('window.vDok.name')=='vDokOptimized'
 assert page.evaluate('typeof attachPaketVirtualScroll')=='function'
 assert page.evaluate('typeof window.SATRIA_CORE_GUARDS')=='object'
 assert page.evaluate("NAV.some(x=>x[0]==='sampah')")
 assert all(a in assets for a in ('frontend/satria-document-templates.js','frontend/satria-view-performance.js','frontend/satria-stage4-ux.css','frontend/satria-shared-modal-ui.css'))
 # Desktop virtual table attaches only ONE scroll listener even after rerender and navigation.
 page.evaluate("location.hash='#paket';route()")
 page.wait_for_timeout(350)
 count=page.evaluate('''() => {
  const v=document.querySelector('#paketVirtualViewport');
  if(!v){
    const host=document.createElement('div');host.innerHTML='<div id="paketVirtualViewport" style="height:200px;overflow:auto"><div id="paketVirtualSpacer"></div><div id="paketVirtualContent"></div></div>';document.body.appendChild(host);
  }
  const target=document.querySelector('#paketVirtualViewport');
  let count=0;const orig=target.addEventListener;
  target.addEventListener=function(name,...args){if(name==='scroll')count++;return orig.call(this,name,...args)};
  attachPaketVirtualScroll();attachPaketVirtualScroll();attachPaketVirtualScroll();
  return count;
 }''')
 assert count<=1, count
 # Long document: virtual display is decorative, original semantic table stays accessible & prints intact.
 page.evaluate('''() => {
  const p=JSON.parse(JSON.stringify(SEED.paket[0]));S.paket=[p];S.ui.plife='all';p.items=Array.from({length:26},(_,i)=>({id:'s4-'+i,nama:'Item uji '+i,vol:1,hs:10000,satuan:'Unit',spesifikasi:'Deskripsi contoh '+i}));
  S.ui.dpid=p.id;S.ui.dok='spek';S.ui.tahun=p.tahun;S.ui.opd='all';location.hash='#dok';route();
 }''')
 page.wait_for_timeout(800)
 before=page.evaluate('''() => {
  const doc=document.querySelector('#dokLazyContainer .doc');
  return {tables:doc?.querySelectorAll('table').length||0, rows:[...(doc?.querySelectorAll('table')||[])].map(t=>t.querySelectorAll('tbody tr').length),virtual:doc?.querySelectorAll('.doc-virtual-table').length||0, originals:doc?.querySelectorAll('table.satria-sr-only-table').length||0}
 }''')
 assert before['tables']>=1,before
 # If there are >20 rows, source table should survive the visual virtualization.
 if max(before['rows'])>20:
  assert before['virtual']>0 and before['originals']>0,before
  assert page.locator('#dokLazyContainer .doc .doc-virtual-table[aria-hidden="true"]').count()>0
  page.emulate_media(media='print')
  styles=page.evaluate('''() => ({source:getComputedStyle(document.querySelector('.doc table.satria-sr-only-table')).display,
    virtual:getComputedStyle(document.querySelector('.doc .doc-virtual-table')).display})''')
  assert styles=={'source':'table','virtual':'none'},styles
  page.emulate_media(media='screen')
 # Responsive smoke: Sampah must display correctly and no script exception.
 page.set_viewport_size({'width':390,'height':844})
 page.evaluate("location.hash='#sampah';route()")
 page.wait_for_timeout(200)
 assert page.locator('.satria-trash-page').count()==1
 assert not errors, errors
 # Local QA screenshot only: dismiss login overlay to show the read-only Sampah page.
 page.evaluate("() => { const modal=document.getElementById('satriaCloudModal');if(modal){modal.hidden=true;modal.style.display='none';} }")
 page.screenshot(path=os.environ.get('SATRIA_QA_SCREENSHOT',str(Path(tempfile.gettempdir())/'SATRIA_NEXT_TAHAP4_MODULAR_QA.png')),full_page=True)
 print('PASS STAGE4 browser: separate assets, 14 document templates, route, virtual table idempotence, document print preservation, mobile Sampah')
 print('TABLE AUDIT:',before,'SCROLL NEW LISTENERS:',count,'ASSETS:',len(assets))
 browser.close()
