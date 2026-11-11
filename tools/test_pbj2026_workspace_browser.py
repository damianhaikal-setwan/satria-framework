"""Offline browser acceptance for one-click PBJ document assistance and scoped notes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<main id="host"></main>')
 page.add_script_tag(content=(root/'frontend/pbj2026-policy.js').read_text())
 page.evaluate('''() => {
   window.__pkg={id:'pbj2026',opd:'o1',tahun:2026,rup:'RUP-TEST',nama:'Paket Contoh',pagu:45000000,jenisPengadaan:'Barang',jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{method:'Pengadaan Langsung'},items:[{id:'i1',nama:'Kertas',vol:3,hs:100000,satuan:'Rim'}],penawaran:[]};
   window.__writes=0;window.__prints=0;window.__draft='';window.__renders=0;
   window.P=id=>id==='pbj2026'?window.__pkg:null;
   window.O=id=>({nama:'OPD Uji'});window.PY=id=>({nama:'Penyedia Uji'});
   window.canWrite=()=>true;
   window.activeCloudScope=()=>({opdIds:['o1'],years:[2026]});
   window.SATRIA={tx:(type,note,mutate)=>{mutate();window.__writes++;return undefined}};
   window.render=()=>window.__renders++;window.toast=()=>{};window.alert=(m)=>{window.__lastAlert=m};
   window.open=()=>({document:{open(){},write(content){window.__draft=content},close(){}},focus(){},print(){window.__prints++}});
 }''')
 page.add_script_tag(content=(root/'frontend/pbj2026-workspace.js').read_text())
 assert page.evaluate('typeof window.SATRIA_PBJ_WORKSPACE')=='object'
 page.evaluate("document.querySelector('#host').innerHTML=window.SATRIA_PBJ_WORKSPACE.panel(window.__pkg)")
 assert page.locator('[data-pbj-print]').count()==2
 assert page.locator('[data-pbj-save]').count()==1
 page.locator('details').evaluate('(el)=>el.open=true')
 page.locator('[data-pbj-start]').fill('2026-09-23')
 page.locator('[data-pbj-basis]').select_option('perlem-3-2026')
 page.locator('[data-pbj-save]').click()
 result=page.evaluate('({p:window.__pkg,date:window.__pkg.tglMulaiPemilihan,basis:window.__pkg.dasarRegulasi,writes:window.__writes,renders:window.__renders})')
 assert result['writes']==1 and result['date']=='2026-09-23' and result['basis']=='perlem-3-2026',result
 assert result['renders']==1
 page.locator('[data-pbj-print="analisa-pasar"]').click()
 doc=page.evaluate('window.__draft')
 assert 'DRAF BELUM LENGKAP' in doc and '45.000.000' in doc and 'Kertas' in doc and page.evaluate('window.__prints')==1
 assert page.evaluate('window.__writes')==1,'Printing must not mutate package data'
 page.evaluate("window.__pkg.spseMonitoring.method='Tender';document.querySelector('#host').innerHTML=window.SATRIA_PBJ_WORKSPACE.panel(window.__pkg)")
 assert page.locator('[data-pbj-print]').count()==0,'Tender must not produce PP documents'
 page.evaluate("window.canWrite=()=>false;window.__pkg.spseMonitoring.method='Pengadaan Langsung';document.querySelector('#host').innerHTML=window.SATRIA_PBJ_WORKSPACE.panel(window.__pkg)")
 assert page.locator('[data-pbj-save]').count()==0,'Readonly user must not edit context'
 assert not errors,errors
 b.close()
print('PASS PBJ 2026 browser: scoped date save via SATRIA.tx, 2 legacy draft helpers (pemilihan uses detailed authoring form), Tender blocked, read-only, no fabricated approval or data changes on print')
