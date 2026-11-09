#!/usr/bin/env python3
"""Independent Chromium regression for read-only Laporan & Analisis visual dashboard."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'frontend/refactor/js/01-app-core.js').read_text()
js=source[source.index('function satriaLaporanRekeningScope(){'):source.index('function csvExport(){')]
css=(root/'frontend/refactor/css/24-laporan-rekening.css').read_text()
global_css=(root/'frontend/refactor/css/06-genz-design.css').read_text()
base=r'''
const S={ui:{opd:'all',lapRekeningTahun:'all',lapRekeningAkun:'all',lapRekeningCari:'',lapAuditJenis:'all'},
 opd:[{id:'bap',nama:'Bapperida',singkat:'Bapperida'},{id:'disp',nama:'Disporapar',singkat:'Disporapar'}],
 akun:[{id:'acc1',kode:'5.1.02.01',nama:'Belanja Bahan'},{id:'acc2',kode:'5.1.02.02',nama:'Belanja Perjalanan'}],
 rupBank:[], paket:[]};
const p=(id,opd,akunId,tahun=2026)=>({id,opd,akunId,tahun,nama:'Paket '+id,rup:'RUP-'+id,pagu:100000,items:[{id:'i-'+id,nama:'Produk',vol:2,hs:20000}],penawaran:[],pemenangId:null});
S.paket=[p('B1','bap','acc1'),{...p('B2','bap','acc1'),pemenangId:'valid'},p('B3','bap','acc2'),p('O1','disp','acc2'),{...p('S1','bap','acc2'),jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{contractNo:'C-1',contractValue:50000,payments:[{status:'Terverifikasi',amount:10000}]}},p('Y1','bap','acc1',2025),{...p('M1','bap',''),items:[]}];
S.rupBank=S.paket.map(q=>({id:'rup-'+q.id,opd:q.opd,tahun:q.tahun,rup:q.rup}));
S.paket.forEach(q=>{q.rupBankId='rup-'+q.id});
function activeCloudScope(){return window.testScope||null}
function O(id){return S.opd.find(o=>o.id===id)||{nama:id,singkat:id}}
function hps(q){return (q.items||[]).reduce((s,i)=>s+i.vol*i.hs,0)}
function pemenang(q){return q.pemenangId==='valid'?{t:36000}:null}
function satriaSpseIs(q){return q.jalurPengadaan==='SPSE_MONITOR'}
function satriaSpseContractValue(m){return m.contractValue||0}
function satriaSpsePayments(m){return (m.payments||[]).filter(p=>p.status==='Terverifikasi').reduce((s,x)=>s+x.amount,0)}
function stt(q){return 'Draf'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rp(n){return 'Rp '+Math.round(n||0).toLocaleString('id-ID')}
function satriaRupLinks(q){return [q.rupBankId,...(q.rupBankIds||[])].filter(Boolean)}
function rupBankKey(q){return q.opd+'|'+q.tahun+'|'+String(q.rup||'').toLowerCase()}
function satriaLaporanDownloadCsv(filename,head,rows){window.lastCsv={filename,head,rows}}
'''
handlers=r'''
function render(){document.getElementById('main').innerHTML=vLaporanVisual()+vLaporanRekening()+vLaporanAudit()}
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='lapVizYear'){S.ui.lapRekeningTahun=String(t.value||'all');return render()}
 if(t.id==='lapVizMetric'){const key=String(t.value||'hps');S.ui.lapVizMetric=Object.hasOwn(SATRIA_LV_METRICS,key)?key:'hps';return render()}
 if(t.id==='lapAuditJenis'){S.ui.lapAuditJenis=String(t.value||'all');return render()}
 if(t.id==='lapRekeningTahun'){S.ui.lapRekeningTahun=String(t.value||'all');return render()}
 if(t.id==='lapRekeningAkun'){S.ui.lapRekeningAkun=String(t.value||'all');return render()}
});
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;
 const a=t.dataset.act,d=t.dataset;
 if(a==='lapVizAccount'){const key=String(d.key||'');if(!satriaLaporanRekeningRows().options.has(key))return;S.ui.lapRekeningAkun=key;render();document.getElementById('satriaLaporanRekening')?.scrollIntoView({block:'start'});return}
 if(a==='lapVizAudit'){const kind=String(d.kind||'');if(!Object.hasOwn(SATRIA_LAP_AUDIT_LABELS,kind))return;S.ui.lapAuditJenis=kind;render();document.getElementById('satriaLaporanAudit')?.scrollIntoView({block:'start'});return}
 if(a==='lapRekeningReset'){S.ui.lapRekeningTahun='all';S.ui.lapRekeningAkun='all';S.ui.lapRekeningCari='';return render()}
});
render();
'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1365,'height':900},device_scale_factor=1)
 page.set_content('''<!DOCTYPE html><html><head><meta charset="utf-8"><style>
 :root{--ink:#15152d;--mut:#555b70;--acc:#6257f5;--bd:#dde0eb;--card-2:#f8f8ff;--card-solid:white}
 html{scroll-behavior:auto}body{font-family:Inter,Arial,sans-serif;background:#f3f4fc;color:#15152d;margin:0;padding:22px}main{max-width:1250px;margin:auto}
 .card{background:#fff;padding:18px;border-radius:15px;border:1px solid #ddd;margin-bottom:18px}
 button,select,input{font:inherit;padding:8px;border:1px solid #d0d2e0;border-radius:8px;background:white;color:#111}
 .satria-rek{margin-bottom:15px}.mut{color:#5b5c74}.table-wrap{overflow-x:auto}.n{text-align:right}
 </style></head><body><main id="main"></main></body></html>''')
 page.add_style_tag(content=global_css)
 page.add_style_tag(content=css)
 page.add_script_tag(content=base+js+handlers)
 viz=page.locator('#satriaLaporanVisual')
 assert viz.get_by_text('Pengadaan dalam satu pandangan').is_visible()
 assert viz.locator('.satria-lv-kpi').count()==4
 assert viz.locator('.satria-lv-panel').count()==5
 assert viz.locator('.satria-lv-donut').count()==1
 assert viz.locator('.satria-lv-trend-svg').count()==1
 assert viz.locator('.satria-lv-auditline').count()>0
 assert page.locator('#main .satria-lv-barline').first.evaluate('(e)=>getComputedStyle(e).backgroundColor') in ['rgba(0, 0, 0, 0)','transparent'], 'tombol grafik harus transparan meski stylesheet global menggunakan !important'
 assert viz.locator('.satria-lv-table-panel tbody tr').count()>0
 assert page.evaluate('satriaLaporanVisualData().totals.paket')==7
 assert page.evaluate('satriaLaporanVisualData().totals.hps')==200000
 assert page.evaluate('satriaLaporanVisualData().totals.penetapan')==36000
 assert page.evaluate('satriaLaporanVisualData().audit.summary.temuanPaket')>=1
 # Safe geometry in desktop: chart hero should not force horizontal body overflow
 assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+3')
 page.screenshot(path=str(root/'tools/.laporan-genz-desktop.png'),full_page=True)
 viz.locator('#lapVizMetric').select_option('penetapan')
 assert page.evaluate('S.ui.lapVizMetric')=='penetapan'
 assert viz.get_by_text('Penetapan E-Purchasing',exact=False).count()>0
 viz.locator('#lapVizYear').select_option('2025')
 assert page.evaluate('satriaLaporanVisualData().totals.paket')==1
 assert page.evaluate('satriaLaporanVisualData().totals.penetapan')==0
 viz.locator('#lapVizYear').select_option('all')
 viz.locator('[data-act="lapVizAccount"]').first.click()
 assert page.evaluate('S.ui.lapRekeningAkun')!='all'
 assert page.evaluate('satriaLaporanVisualData().totals.paket')<7
 page.evaluate("S.ui.lapRekeningAkun='all';render()")
 viz.locator('[data-act="lapVizAudit"]').first.click()
 assert page.evaluate('S.ui.lapAuditJenis')!='all'
 assert page.locator('#satriaLaporanAudit #lapAuditJenis').input_value()!='all'
 page.evaluate("S.ui.lapAuditJenis='all';render()")
 # Critical PPKom scope: cards, charts, and table must agree on filtered, authorized data
 page.evaluate("window.testScope={opdIds:['bap'],years:[2026]};render()")
 assert page.evaluate('satriaLaporanVisualData().totals.paket')==5
 assert page.evaluate('satriaLaporanVisualData().totals.penetapan')==36000
 assert page.evaluate('satriaLaporanVisualData().rekening.details.every(p=>p.opd===\"bap\"&&p.tahun===2026)')
 assert not page.locator('#satriaLaporanVisual').get_by_text('Paket O1').count()
 # Dark mode then mobile
 page.evaluate("document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--ink','#eff1ff');document.documentElement.style.setProperty('--mut','#b2bed6');document.documentElement.style.setProperty('--bd','#39425c');document.documentElement.style.setProperty('--card-solid','#1d2440')")
 page.set_viewport_size({'width':390,'height':844})
 assert viz.locator('#lapVizYear').is_visible()
 assert viz.locator('.satria-lv-barline').first.is_visible()
 assert viz.locator('.satria-lv-donut').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+3'), 'mobile overflow outside scroll container'
 page.screenshot(path=str(root/'tools/.laporan-genz-mobile-dark.png'),full_page=True)
 print('PASS Chromium: Gen Z dashboard, KPI & 4 charts, responsive, dark mode, year/metric/account/audit interactions, PPKom scope')
 browser.close()
