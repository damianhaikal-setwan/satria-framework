from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
src=(root/'frontend/refactor/js/01-app-core.js').read_text()
helper=src[src.index('const satriaHpsEditDrafts=new Map();'):src.index('/* SATRIA 3.0.49 — Tabel Harga Nego')]
inputcode=src[src.index('/* Form rincian: capture langsung'):src.index('let paketSearchTimer=null;')]
clickcode=src[src.index(" if(a==='hpsdraftadd'||a==='additem')"):src.index(" if(a==='correctOfferProvider')")]
setup='''
const S={ui:{user:'local-test'},paket:[{id:'a',pagu:2000000,rup:'a',items:Array.from({length:15},(_,i)=>({id:'i'+i,nama:'Barang '+(i+1),vol:i+1,hs:1000,satuan:'Buah',spesifikasi:'Spek tetap',merek:'X'})),penawaran:[]},{id:'b',pagu:2000000,rup:'b',items:[{id:'ib',nama:'Paket lain',vol:20,hs:1100,satuan:'Unit'}],penawaran:[]}]};
function P(id){return S.paket.find(p=>p.id===id)}
function canWrite(){return true}
function activeCloudScope(){return null}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function nf(n){return Math.round(Number(n)||0).toLocaleString('id-ID')}
function rp(n){return 'Rp '+nf(n)}
function hps(p){return p.items.reduce((s,it)=>s+Number(it.vol)*Number(it.hs),0)}
function toast(msg){window.lastToast=msg}
function satriaRupUjiPerubahanRincian(p,items){return {ok:items.reduce((s,i)=>s+i.vol*i.hs,0)<=p.pagu,msg:'Melebihi pagu'}}
function render(){document.getElementById('root').innerHTML=fItems(P(window.activePid||'a'))}
let seedId=20;function uid(prefix){return prefix+ ++seedId}
const SATRIA={tx:(kind,label,fn)=>fn()};
'''
click='''document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,id=t.dataset.id,pid=t.dataset.pid;'''+clickcode+'''},false);'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1300,'height':750})
 page.set_content('<!doctype html><html><body><div id="root"></div></body></html>')
 page.add_style_tag(content=(root/'frontend/refactor/css/23-hps-draft-batch.css').read_text())
 page.add_script_tag(content=setup+helper+inputcode+click+'render();')
 assert page.locator('[data-hps-row]').count()==15
 assert page.locator('input[type="number"]').count()==0
 original=page.evaluate('JSON.stringify(S.paket)')
 qty=page.locator('[data-hps-edit][data-id="i0"][data-f="vol"]')
 qty.fill('432')
 page.locator('.satria-hps-scroller').evaluate('(el)=>el.scrollTop=el.scrollHeight')
 page.locator('[data-hps-edit][data-id="i14"][data-f="vol"]').fill('17')
 page.locator('.satria-hps-scroller').evaluate('(el)=>el.scrollTop=0')
 assert qty.input_value()=='432','scroll must not reset first item'
 # Mouse wheel must not increment a focused volume (text input, not number input).
 qty.focus();old=qty.input_value();page.mouse.wheel(0,420)
 assert qty.input_value()==old,'mouse wheel must not change volume'
 assert page.evaluate('JSON.stringify(S.paket)')==original,'draft must not mutate saved packet'
 assert page.locator('[data-hps-status]').inner_text().startswith('●')
 page.locator('[data-act="hpsdraftsave"]').click()
 assert page.evaluate('P("a").items[0].vol')==432
 assert page.evaluate('P("a").items[14].vol')==17
 assert page.evaluate('P("a").items[0].spesifikasi')=='Spek tetap'
 assert page.evaluate('P("b").items[0].vol')==20
 assert page.evaluate('satriaHpsDraftVolume("4.849")')==4849
 assert page.evaluate('satriaHpsDraftVolume("1,5")')==1.5
 assert page.locator('[data-hps-status]').inner_text().startswith('✓')
 # no mutation until save, invalid data rejected
 page.locator('[data-hps-edit][data-id="i0"][data-f="vol"]').fill('0')
 page.locator('[data-act="hpsdraftsave"]').click()
 assert page.evaluate('P("a").items[0].vol')==432
 assert 'volume positif' in page.evaluate('window.lastToast')
 dialog_action={'accept':True}
 page.on('dialog',lambda d:d.accept() if dialog_action['accept'] else d.dismiss())
 page.locator('[data-act="hpsdraftdiscard"]').click()
 assert page.locator('[data-hps-edit][data-id="i0"][data-f="vol"]').input_value()=='432'
 # Add 16th item without commit; remains draft; cancel preserves all saved
 page.locator('[data-act="hpsdraftadd"]').click()
 assert page.locator('[data-hps-row]').count()==16
 assert page.evaluate('P("a").items.length')==15
 page.locator('[data-act="hpsdraftdiscard"]').click()
 assert page.evaluate('P("a").items.length')==15
 # Financial history requires explicit confirmation; reject and then accept.
 page.evaluate("P('a').penawaran=[{id:'w1',harga:{i0:1000},nego:{i0:950}}]")
 page.locator('[data-hps-edit][data-id="i0"][data-f="hs"]').fill('2.000')
 dialog_action['accept']=False
 page.locator('[data-act="hpsdraftsave"]').click()
 assert page.evaluate('P("a").items[0].hs')==1000
 dialog_action['accept']=True
 page.locator('[data-act="hpsdraftsave"]').click()
 assert page.evaluate('P("a").items[0].hs')==2000
 assert page.evaluate('P("a").penawaran[0].harga.i0')==1000
 # switch active package, no cross-packet changes
 page.evaluate("window.activePid='b'; render()")
 assert page.locator('[data-hps-row]').count()==1
 assert page.locator('[data-hps-edit][data-f="vol"]').input_value()=='20'
 print('PASS browser: 15 items retained through scroll; explicit save; batch validation; cancellation; other packet untouched; add remains draft')
 # mobile form
 page.set_viewport_size({'width':390,'height':800})
 assert page.locator('.satria-hps-field>span').first.is_visible()
 print('PASS mobile: labels visible and fields accessible')
 b.close()
