"""Regression: Analisa cover is not a sticky app-header and photo evidence flows across A4 pages.
Run: python tools/test_analisa_layout_photo_20261109.py
Uses synthetic data only; never modifies cloud records.
"""
from pathlib import Path
from io import BytesIO
import base64
import re
import sys
import fitz
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
import legacy_index_source

ROOT=Path(__file__).resolve().parents[1]
html=legacy_index_source.read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ('satria-next4.css','satria-operator-studio.css','satria-price-analysis.css'):
    html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(ROOT/'frontend'/name).read_text()+'</style>')
for name in ('satria-next4.js','satria-operator-studio.js','satria-price-analysis.js'):
    html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(ROOT/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)

def data_image(size,caption):
    image=Image.new('RGB',size,'white'); d=ImageDraw.Draw(image)
    d.rectangle((18,18,size[0]-19,size[1]-19),outline='#345c84',width=4)
    d.text((40,size[1]//2-10),caption,fill='black')
    b=BytesIO();image.save(b,'PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()

header=data_image((1300,190),'KOP SURAT - DATA UJI / OPD')
photos=[data_image((800,540),'FOTO PRODUK UJI'),data_image((400,900),'FOTO BENTUK TINGGI')]
with sync_playwright() as w:
    browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.abort())
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_timeout(250)
    page.evaluate('''({header,photos})=>{
     S.paket=JSON.parse(JSON.stringify(SEED.paket)); S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
     S.opd=JSON.parse(JSON.stringify(SEED.opd)); S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
     S.tahun=[2026]; S.ui.tahun=2026;S.ui.opd='all';S.ui.plife='all';
     const p=S.paket[0];p.tahun=2026;p.pagu=99000000;p.rup='RUP-UJI-LAYOUT';p.nama='Paket pengujian cetak Analisis Harga';
     p.program='Program Contoh Kebutuhan Kantor';p.kegiatan='Kegiatan panjang untuk pengujian tabel identitas';
     p.subKeg=Array.from({length:8},(_,i)=>`Sub Kegiatan ${i+1} - Koordinasi dan Evaluasi Pelaksanaan Pembangunan Bidang Pemerintahan`).join('\\n');
     S.opd[0].kop=header;
     p.items=Array.from({length:15},(_,i)=>({id:'uji-'+i,nama:`Barang pengujian nomor ${i+1} lengkap dengan varian dan rincian agar caption dapat membungkus`,spesifikasi:'Ukuran dan model uji',satuan:'Buah',vol:2,hs:50000}));
     S.penyedia.push({id:'uji-pen',nama:'PENYEDIA PENGUJIAN'});
     p.penawaran=[{id:'uji-penawaran',pen:'uji-pen',tanggalHarga:'2026-11-01',sumberHarga:'https://example.org/toko',ongkir:0,
       harga:Object.fromEntries(p.items.map(i=>[i.id,43000])),
       nego:Object.fromEntries(p.items.map(i=>[i.id,42000])),
       catalogRefs:Object.fromEntries(p.items.map((i,n)=>[i.id,{date:'2026-11-01',displayPrice:43000,
         name:`Referensi produk ${n+1} dengan nama yang cukup panjang untuk menguji caption`,
         seller:'PENYEDIA PENGUJIAN',unit:'Buah',link:'https://example.org/produk/'+n,imageUrl:photos[n%2]}]))}];
     p.pemenangId=null;
     S.ui.dpid=p.id;S.ui.dok='analisa';S.ui.page='dok';S.ui.pid=null;location.hash='#dok';
     window.__dataBefore=JSON.stringify(S.paket);
     render();document.querySelectorAll('#satriaCloudModal,.sc-modal-backdrop').forEach(x=>{x.hidden=true;x.style.display='none'});
    }''',{'header':header,'photos':photos})
    page.wait_for_timeout(500)
    page.locator('.spha-example-cover').scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    assert page.locator('.spha-example-paper').count()==1
    assert page.locator('.spha-photo-card').count()==15
    props=page.evaluate('''() => {
     const paper=document.querySelector('.spha-example-paper');
     const cover=paper.querySelector('.spha-example-cover');
     const title=paper.querySelector('.spha-doc-title');
     const logo=paper.querySelector('.kop-image img');
     const table=paper.querySelector('.spha-example-identity');
     const wrapper=paper.closest('.doc');
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
     return {coverTag:cover.tagName,coverDisplay:getComputedStyle(cover).display,coverPos:getComputedStyle(cover).position,
      doc:rect(wrapper),cover:rect(cover),logo:rect(logo),title:rect(title),identity:rect(table),
      photoSections:paper.querySelectorAll('.spha-photo-sheet').length,
      photoCount:paper.querySelectorAll('.spha-photo-card').length,
      overflow:paper.scrollWidth>paper.clientWidth+3, tableOverflow:table.scrollWidth>table.clientWidth+3};
     }''')
    print('SCREEN LAYOUT',props)
    assert props['coverTag']=='DIV',props
    assert props['coverDisplay']=='block' and props['coverPos']=='static',props
    assert props['logo']['h']>35,props
    assert props['cover']['h']>props['identity']['h'],props
    assert props['title']['y']>props['logo']['bottom']-2,props
    assert props['identity']['y']>props['title']['bottom']-2,props
    assert props['title']['y']-props['logo']['bottom']<55,props
    assert props['logo']['right']<=props['doc']['right']-20,props
    assert not props['overflow'] and not props['tableOverflow'],props
    assert props['photoSections']==1 and props['photoCount']==15,props
    assert page.evaluate('JSON.stringify(S.paket)===window.__dataBefore')
    assert page.evaluate('window.SATRIA_DOK_PRINT.prepare()')
    pdf='/mnt/data/SATRIA-Analisa-Layout-Foto-Uji.pdf'
    page.pdf(path=pdf,format='A4',print_background=True,prefer_css_page_size=True)
    page.evaluate('window.SATRIA_DOK_PRINT.clear()')
    assert not errors,errors
    browser.close()

p=fitz.open(pdf)
print('PDF total pages:',len(p))
assert len(p)>=3
front=p[0].get_text()
print('FIRST PAGE',front[:650].replace('\n',' | '))
assert 'DOKUMEN ANALISIS KEWAJARAN' in front,front[:600]
assert 'I. LATAR BELAKANG' in front,front[-400:]
alltext='\n'.join(pg.get_text() for pg in p)
assert alltext.count('Harga tayang:')>=15,alltext.count('Harga tayang:')
image_pages=[]
for i,pg in enumerate(p):
   text=pg.get_text()
   if 'Lampiran Foto Barang' in text or 'Harga tayang:' in text:
      image_pages.append((i+1,text.count('Harga tayang:'),len(text)))
   # For every actual text span, reject rightward and leftward clipping beyond printable page bounds.
   for line in pg.get_text('dict')['blocks']:
      for ln in line.get('lines',[]):
         for s in ln['spans']:
            if s['text'].strip() and (s['bbox'][0]<-1 or s['bbox'][2]>pg.rect.width+1):
               raise AssertionError((i+1,s['bbox'],s['text'][:80]))
print('PHOTO PAGE DISTRIBUTION:',image_pages)
assert len(image_pages)>=2,image_pages
assert max(c for _,c,_ in image_pages)>=6,image_pages
assert not any(c==0 for _,c,_ in image_pages[1:]),image_pages
print('PASS: cover, identity, unmodified records, photo flow, print PDF')
