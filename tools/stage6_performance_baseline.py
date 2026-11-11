#!/usr/bin/env python3
"""Local browser baseline, synthetic data only. Not a production performance claim."""
import os,json,shutil
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=os.environ.get('SATRIA_PERFORMANCE_REPORT',str(Path('/tmp')/'satria_stage6_performance.json'))
results=[]
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (390,1280):
  page=browser.new_page(viewport={'width':width,'height':844})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def serve(route):
   u=urlparse(route.request.url)
   if u.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
    route.fulfill(status=200,body='',content_type='text/javascript');return
   if u.hostname in ('fonts.googleapis.com','fonts.gstatic.com'):
    route.fulfill(status=200,body='',content_type='text/css');return
   f=(ROOT/u.path.lstrip('/')).resolve()
   if f.is_file() and ROOT in f.parents:
    route.fulfill(status=200,body=f.read_bytes(),content_type='text/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'text/html' if f.suffix=='.html' else 'text/plain')
   else:route.fulfill(status=404,body='missing')
  page.route('**/*',serve)
  html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/">',1)
  page.set_content(html,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_timeout(400)
  for n in (500,5000):
   metric=page.evaluate('''n=>{
    const base=JSON.parse(JSON.stringify(SEED.paket[0]));
    S.paket=Array.from({length:n},(_,i)=>({...base,id:'synthetic-p-'+i,seq:i+1,
      nama:'Paket uji sintetis '+i,penawaran:[],pemenangId:null}));
    S.rupBank=[];S.ui.pid=null;S.ui.opd='all';S.ui.tahun=base.tahun;
    location.hash='#paket';const at=performance.now();route();
    return {count:n,renderMs:Math.round((performance.now()-at)*100)/100,
      mainText:document.querySelector('#main')?.textContent?.trim().slice(0,80)||'',
      scriptCount:document.scripts.length,viewportWidth:innerWidth};
   }''',n)
   metric['width']=width
   results.append(metric)
   print('BASELINE',metric,flush=True)
  assert not errors,errors
  page.close()
 browser.close()
Path(OUT).write_text(json.dumps({'basis':'localhost static files + headless Chromium, CDN mocked; synthetic 500/5000 packages, not real devices or cloud',
 'metrics':results},indent=2))
print('PASS UI & performance baseline. RESULT',OUT)
