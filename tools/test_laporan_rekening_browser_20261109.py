"""Uji visual/filter modul rekening dalam browser Chromium tanpa jaringan produksi."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'frontend/refactor/js/01-app-core.js').read_text()
helper=source[source.index('function satriaLaporanRekeningScope(){'):source.index('function vLap(){')]
css=(root/'frontend/refactor/css/24-laporan-rekening.css').read_text()
base='''
const S={ui:{opd:'all',lapRekeningTahun:'all',lapRekeningAkun:'all',lapRekeningCari:''},
 opd:[{id:'bap',nama:'Bapperida',singkat:'Bapperida'},{id:'disp',nama:'Disporapar',singkat:'Disporapar'}],
 akun:[{id:'acc1',kode:'5.1.02.01',nama:'Belanja Bahan'},{id:'acc2',kode:'5.1.02.02',nama:'Belanja Perjalanan'}],paket:[]};
const pack=(id,opd,akunId,tahun=2026)=>({id,opd,akunId,tahun,nama:'Paket '+id,rup:'RUP-'+id,pagu:100000,
 items:[{id:'item-'+id,nama:'Produk',vol:2,hs:20000}],penawaran:[],pemenangId:null});
S.paket=[pack('A','bap','acc1'),pack('B','bap','acc2'),pack('C','disp','acc1'),pack('L','bap','acc1',2025),pack('X','bap',''),pack('Z','bap','deleted')];
function activeCloudScope(){return window.testScope||null}
function O(id){return S.opd.find(o=>o.id===id)||{nama:id,singkat:id}}
function hps(p){return p.items.reduce((s,i)=>s+i.vol*i.hs,0)}
function pemenang(p){return null}
function satriaSpseIs(p){return p.jalurPengadaan==='SPSE_MONITOR'}
function satriaSpseContractValue(m){return m.contractValue||0}
function satriaSpsePayments(m){return (m.payments||[]).filter(p=>p.status==='Terverifikasi').reduce((s,p)=>s+p.amount,0)}
function stt(p){return 'Draf'}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function rp(n){return 'Rp '+Math.round(n||0).toLocaleString('id-ID')}
function satriaLaporanDownloadCsv(filename,headers,rows){window.lastCsv={filename,headers,rows}}
'''
handlers='''
function render(){document.getElementById('main').innerHTML=vLaporanRekening()}
document.addEventListener('input',e=>{if(e.target?.id==='lapRekeningCari')S.ui.lapRekeningCari=String(e.target.value||'')});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='lapRekeningTahun'){S.ui.lapRekeningTahun=String(t.value||'all');return render()}
 if(t.id==='lapRekeningAkun'){S.ui.lapRekeningAkun=String(t.value||'all');return render()}
});
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;
 if(t.dataset.act==='lapRekeningReset'){S.ui.lapRekeningTahun='all';S.ui.lapRekeningAkun='all';S.ui.lapRekeningCari='';return render()}
 if(t.dataset.act==='lapRekeningCari'){S.ui.lapRekeningCari=document.getElementById('lapRekeningCari').value;return render()}
 if(t.dataset.act==='lapRekeningCsv')return satriaLaporanRekeningCsv(false);
 if(t.dataset.act==='lapRekeningDetailCsv')return satriaLaporanRekeningCsv(true);
});
render();
'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1320,'height':900})
 page.set_content('<!doctype html><html><head><style>:root{--ink:#15152d;--mut:#555;--acc:#4338ca;--bd:#ddd;--card-2:#f8f8ff;--card-solid:white}.card{padding:20px;border-radius:15px;background:white}button,select,input{padding:9px;cursor:pointer}button{background:#eee;border:1px solid #ddd;border-radius:7px}body{font-family:Arial,sans-serif;background:#eee}small{display:block}</style></head><body><main id="main"></main></body></html>')
 page.add_style_tag(content=css)
 page.add_script_tag(content=base+helper+handlers)
 panel=page.locator('#satriaLaporanRekening')
 assert panel.get_by_text('Pengadaan Berdasarkan Kode Rekening').is_visible()
 assert panel.locator('table').count()==2
 assert panel.get_by_text('Paket A',exact=True).count()>=1
 assert panel.locator('.satria-rek-attention').is_visible()
 panel.locator('#lapRekeningTahun').select_option('2025')
 assert panel.get_by_text('Paket L',exact=True).count()>0
 assert panel.get_by_text('Paket A',exact=True).count()==0
 panel.locator('#lapRekeningTahun').select_option('all')
 panel.locator('#lapRekeningAkun').select_option('akun:acc2')
 assert panel.get_by_text('Paket B',exact=True).count()>0
 assert panel.get_by_text('Paket C',exact=True).count()==0
 panel.locator('[data-act="lapRekeningReset"]').click()
 panel.locator('#lapRekeningCari').fill('RUP-X')
 panel.locator('[data-act="lapRekeningCari"]').click()
 assert panel.get_by_text('Paket X',exact=True).count()>0
 assert panel.get_by_text('Paket A',exact=True).count()==0
 panel.locator('[data-act="lapRekeningReset"]').click()
 panel.locator('[data-act="lapRekeningDetailCsv"]').click()
 csv=page.evaluate('window.lastCsv')
 assert csv['filename']=='satria-paket-per-rekening.csv'
 assert len(csv['rows'])==6
 assert any(row[7]=='Paket A' and row[2]=='5.1.02.01' for row in csv['rows'])
 page.evaluate("window.testScope={opdIds:['bap'],years:[2026]};render()")
 assert panel.get_by_text('Paket C',exact=True).count()==0
 assert panel.get_by_text('Paket L',exact=True).count()==0
 panel.locator('[data-act="lapRekeningDetailCsv"]').click()
 assert all(row[0]==2026 and row[1]=='Bapperida' for row in page.evaluate('window.lastCsv.rows'))
 print('PASS Chromium: tabel rekap/detail, filter TA, rekening, pencarian, reset, CSV, scope PPKom')
 page.set_viewport_size({'width':390,'height':800})
 assert panel.locator('select').first.is_visible()
 assert panel.locator('.satria-rek-scroll').first.evaluate('(el)=>el.scrollWidth>el.clientWidth')
 print('PASS Chromium mobile: kontrol filter terlihat, tabel dapat digeser horizontal')
 browser.close()
