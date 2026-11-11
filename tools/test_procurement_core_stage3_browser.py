#!/usr/bin/env python3
"""Integration UI nyata SATRIA Tahap 3 dengan data sintetis, CDN/cloud disimulasikan offline."""
from pathlib import Path
from urllib.parse import urlparse
import json, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':900},accept_downloads=True)
 errors=[]; missing=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def route(request):
  url=urlparse(request.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   request.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com','d3js.org'):
   request.fulfill(status=200,body='',content_type='text/css');return
  target=(ROOT/url.path.lstrip('/')).resolve()
  if target.is_file() and ROOT.resolve() in target.parents:
   typ='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'image/png' if target.suffix=='.png' else 'application/json' if target.suffix=='.json' else 'text/plain'
   request.fulfill(status=200,body=target.read_bytes(),content_type=typ);return
  missing.append(url.path);request.fulfill(status=404,body='not found')
 page.route('**/*',route)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/">',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(400)
 result=page.evaluate('''() => {
  const p={id:'stage3-test-p',nama:'Paket Tahap 3 — pengujian offline',rup:'RUP-101',tahun:2026,opd:'stage3-opd',pagu:2000000,
   metodePemilihan:'E-Purchasing dengan Negosiasi Harga',jenisPengadaan:'Barang',rupBankId:'rup1',rupBankIds:['rup1','rup2'],
   items:[{id:'one',nama:'Barang A',spesifikasi:'Simulasi',satuan:'Set',vol:3,hs:427920},{id:'two',nama:'Barang B',satuan:'Unit',vol:2,hs:80000}],
   penawaran:[{id:'w1',pen:'penyedia-test',harga:{one:420000,two:79000},nego:{one:410000,two:78000},ongkir:15000,sumberHarga:'Katalog',tanggalHarga:'2026-11-11'}]};
  const bank=[{id:'rup1',rup:'RUP-101',opd:'stage3-opd',tahun:2026},{id:'rup2',rup:'RUP-102',opd:'stage3-opd',tahun:2026}];
  S.rupBank=bank;S.paket=[p];
  const unchanged=JSON.stringify(p);
  const model=window.SATRIA_PROCUREMENT_CORE.packageSnapshot(p,bank);
  const generator=window.SATRIA_HPS_GENERATOR.evaluate(p,{mode:'excluded',tarif:'11',tanggal:'2026-11-11',tempat:'Sintang',ppkNama:'PPK Simulasi',pptkNama:'PPTK Simulasi'});
  const eco=window.SATRIA_PP_ECOSYSTEM.assess(p);
  const preview=window.SATRIA_PP_ECOSYSTEM.page([p],p.id);
  const analysis=window.SATRIA_PRICE_CORE.analyze(p,{suppliers:{'penyedia-test':'Penyedia Simulasi'}});
  const draft=window.SATRIA_PBJ_WORKSPACE.draft(p,'analisa-pasar');
  const warnings=window.SATRIA_PROCUREMENT_CORE.rupLinkStatus({...p,rupBankIds:['rup1','hilang']},bank).issues;
  return {hps:model.hps,price:model.offers[0].tayang,nego:model.offers[0].negosiasi,
   docTotal:generator.total,docTax:generator.tax,docErrors:generator.errors,docWarnings:generator.warnings,
   workspaceHps:eco.total,priceHps:analysis.packet.hps,linked:eco.rupStatus.references.length,
   uiHasReference:preview.includes('2/2 tautan ditemukan'),draftHasHps:draft.includes('Rincian Kebutuhan dan HPS'),
   warning: warnings.length>0,noMutation:JSON.stringify(p)===unchanged,uiPreview:preview};
 }''')
 assert result['hps']==1443760,result
 assert result['price']==1418000,result
 assert result['nego']==1386000,result
 assert result['docTax']==158814,result
 assert result['docTotal']==1602574,result
 assert result['docErrors']==[],result
 assert result['workspaceHps']==result['priceHps']==result['hps'],result
 assert result['linked']==2 and result['uiHasReference'] and result['draftHasHps'],result
 assert result['warning'] and result['noMutation'],result
 assert not errors,errors
 assert not missing,missing
 # Render a test-only independent workspace preview; screenshot is not used as source of truth.
 page.evaluate('''(html) => {let wrap=document.getElementById('satria-stage3-qa');if(!wrap){wrap=document.createElement('div');wrap.id='satria-stage3-qa';document.body.append(wrap)}wrap.innerHTML=html;wrap.style.cssText='position:relative;z-index:2147483600;margin:20px auto;width:1050px;max-width:90vw;background:#fff;color:#17223c;padding:24px;border-radius:18px;filter:none!important;backdrop-filter:none!important';document.querySelectorAll('#satriaCloudModal,[role=dialog],.sc-backdrop,.satria-cloud-overlay').forEach(el=>{el.hidden=true;el.style.display='none'});document.querySelector('#satria-stage3-qa').scrollIntoView()}''',result['uiPreview'])
 page.locator('#satria-stage3-qa').screenshot(path='/mnt/data/SATRIA_NEXT_TAHAP3_ALUR_INTI_QA.png')
 result.pop('uiPreview')
 print('PASS Stage3 browser:',json.dumps(result,ensure_ascii=False))
 browser.close()
