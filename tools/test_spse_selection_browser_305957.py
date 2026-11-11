"""Browser regression: integrated selection-document editor, save, final gate, old panel and read-only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content('<div id="container"></div>')
 page.add_script_tag(content=(root/'frontend/pbj2026-policy.js').read_text())
 page.evaluate('''() => {
   window.__p={id:'pk1',nama:'Pengadaan meja kantor',rup:'SIM-098',opd:'o1',tahun:2026,pagu:160000000,
     jenisPengadaan:'Barang',jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{method:'Pengadaan Langsung'},
     tglMulaiPemilihan:'2026-11-01',dasarRegulasi:'perlem-3-2026',items:[{id:'i1',nama:'Meja kantor',spesifikasi:'Material kayu yang sesuai standar kebutuhan',vol:4,satuan:'unit',hs:20000000}],penawaran:[]};
   window.canWrite=()=>window.__canWrite;
   window.__canWrite=true;window.__writes=0;window.__renders=0;window.__prints=0;window.__html='';window.__alert='';
   window.activeCloudScope=()=>({opdIds:['o1'],years:[2026]});
   window.S={ui:{tahun:2026,opd:'all'}};
   window.P=id=>id==='pk1'?window.__p:null;
   window.O=()=>({nama:'OPD Uji'});
   window.SATRIA={tx:(type,label,cb)=>{cb();window.__writes++;return undefined}};
   window.render=()=>{window.__renders++;document.querySelector('#container').innerHTML=window.SATRIA_PBJ_WORKSPACE.panel(window.__p)};
   window.toast=()=>{};window.alert=t=>window.__alert=t;
   window.open=()=>({document:{open(){},write(s){window.__html=s},close(){}},focus(){},print(){window.__prints++}});
 }''')
 page.add_script_tag(content=(root/'frontend/satria-spse-selection-document.js').read_text())
 page.add_script_tag(content=(root/'frontend/pbj2026-workspace.js').read_text())
 page.evaluate('window.render()')
 assert page.locator('[data-sd-panel]').count()==1,'editor integrated in real PBJ panel'
 assert page.locator('[data-pbj-print]').count()==2,'legacy other drafts remain'
 page.locator('.sd-editor details').evaluate('(x)=>x.open=true')
 # final cannot pass empty
 page.locator('[data-sd-final]').click()
 assert 'Tidak dapat mencetak berkas lengkap' in page.locator('[data-sd-status]').inner_text()
 # populate all required fields using sample (not a real contract)
 page.evaluate('''() => {
   for(const x of document.querySelectorAll('[data-sd-field]')){
     const k=x.dataset.sdField;
     x.value=(x.type==='date')?'2026-11-02':(x.type==='datetime-local')?'2026-11-03T09:00':'Keterangan detail '+k+' yang diperiksa dan ditetapkan sesuai dokumen instansi serta kebutuhan paket pengadaan.';
     if(k==='rancanganSpk')x.value='CONTOH RANCANGAN SPK untuk pengujian perangkat lunak, bukan dokumen resmi. '.repeat(12);
     x.dispatchEvent(new Event('input',{bubbles:true}));
   }
 }''')
 page.locator('[data-sd-draft]').click()
 assert page.evaluate('window.__prints')==1 and 'DRAF' in page.evaluate('window.__html')
 assert page.evaluate('window.__writes')==0,'draft printing must not mutate data'
 page.locator('[data-sd-confirm]').check()
 page.locator('[data-sd-final]').click()
 assert 'Simpan dahulu' in page.locator('[data-sd-status]').inner_text(),'unsaved draft must not finalize'
 page.locator('[data-sd-save]').click()
 assert page.evaluate('window.__writes')==1 and page.evaluate('!!window.__p.ppDokumenPemilihan.savedAt')
 assert page.locator('[data-sd-panel]').count()==1
 page.locator('.sd-editor details').evaluate('(x)=>x.open=true')
 page.locator('[data-sd-confirm]').check()
 page.locator('[data-sd-final]').click()
 assert page.evaluate('window.__prints')==2,'final should print once when saved + reviewed'
 final=page.evaluate('window.__html')
 assert 'DOKUMEN KERJA LENGKAP' in final and 'VIII. RANCANGAN' in final and 'Rp 80.000.000' in final
 # modifying HPS should block previously saved version
 page.evaluate('window.__p.items[0].hs=21000000')
 page.locator('[data-sd-final]').click()
 assert page.evaluate('window.__prints')==2 and 'Simpan dahulu' in page.locator('[data-sd-status]').inner_text()
 # viewer does not get save/final
 page.evaluate('window.__canWrite=false;window.render()')
 assert page.locator('[data-sd-save]').count()==0 and page.locator('[data-sd-final]').is_disabled()
 # tender gets no final editor
 page.evaluate('window.__canWrite=true;window.__p.spseMonitoring.method="Tender";window.render()')
 assert page.locator('[data-sd-panel]').count()==0
 assert not errors,errors
 browser.close()
print('PASS SPSE browser: integrated panel, save transaction, draft vs final, HPS change invalidation, viewer/tender protection')
