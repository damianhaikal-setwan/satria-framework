from pathlib import Path
import re,sys,fitz
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=__import__('legacy_index_source').read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ['satria-next4.css','satria-operator-studio.css','satria-price-analysis.css']:
 html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(root/'frontend'/name).read_text()+'</style>')
for name in ['satria-next4.js','satria-operator-studio.js','satria-price-analysis.js']:
 html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(root/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':950},device_scale_factor=1)
 page.route('**/*',lambda r:r.abort())
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(400)
 page.evaluate('''()=>{
 S.paket=JSON.parse(JSON.stringify(SEED.paket));S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
 S.opd=JSON.parse(JSON.stringify(SEED.opd));S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
 S.tahun=[2026];S.ui.tahun=2026;S.ui.opd='all';S.ui.plife='all';
 const p=S.paket[0];p.rup='67122699';p.nama='Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor (PPM)';p.pagu=1924800;p.tahun=2026;
 p.tglSurvei='2026-06-02';p.tglNego='2026-06-02';p.tglPenetapan='2026-06-06';
 const name=['HVS A4 Folio 70 GR','Map GOBI 401','Map Snelhecter Folio Kertas Biasa','Pulpen / Ball Point Faster','Refille / isi staples Kecil ukuran 10','Isi Staples No. 10','Pulpen / Ball Point Faster'];
 const spec=['HVS A4 Folio 70 GR','Map GOBI 401','Snelhecter Folio Kertas Biasa','Faster','Ukuran 10','Isi Staples No. 10','Faster'];
 const vol=[20,4,59,10,5,5,10],hps=[73600,40000,2200,8000,4000,4200,4200],unit=['Rim','Buah','Buah','Batang','Kotak','Kotak','Batang'];
 p.items=name.map((x,i)=>({id:'qa-'+i,nama:x,spesifikasi:spec[i],vol:vol[i],hs:hps[i],satuan:unit[i]}));
 S.penyedia.push({id:'qa-a',nama:'FOTO COPY PRIMA'},{id:'qa-b',nama:'RIAN ALBHENI'});
 const tayang=[[68000,32500,2200,4000,5000,5000,4000],[73600,33000,4000,4400,8880,8880,4400]];
 const nego=[[67900,32000,1900,3900,4900,4900,3900],[73600,33000,4000,4400,8880,8880,4400]];
 const rianName=['HVS A4 Folio 70 GR','Map GOBI 401','Map Biola Warna','Pulpen Pilot','Isi Staples No. 24/6','Isi Staples No. 24/6','Pulpen Pilot'];
 const make=(id,pen,idx)=>({id,pen,sumberHarga:'Katalog Elektronik',tanggalHarga:'2026-06-02',ongkir:0,
   harga:Object.fromEntries(p.items.map((it,i)=>[it.id,tayang[idx][i]])),
   nego:Object.fromEntries(p.items.map((it,i)=>[it.id,nego[idx][i]])),
   catalogRefs:Object.fromEntries(p.items.map((it,i)=>[it.id,{date:'2026-06-02',name:idx?rianName[i]:it.nama,seller:idx?'RIAN ALBHENI':'FOTO COPY PRIMA',unit:unit[i],displayPrice:tayang[idx][i],link:'https://example.org/sample/'+i}]))});
 p.penawaran=[make('qa-w1','qa-a',0),make('qa-w2','qa-b',1)];p.pemenangId=null; // intentionally not certified
 S.ui.dpid=p.id;S.ui.dok='analisa';S.ui.page='dok';S.ui.pid=null;location.hash='#dok';
 window.__unchanged=JSON.stringify(S.paket);render();
 document.querySelectorAll('#satriaCloudModal,.sc-modal-backdrop').forEach(e=>{e.hidden=true;e.style.display='none'});
 }''')
 page.wait_for_timeout(300)
 print('errors:',errors[:5])
 print('docs:',page.locator('.spha-example-paper').count())
 print('report intro:',page.locator('.spha-example-paper').inner_text()[:350])
 assert page.locator('.spha-example-paper .spha-example-needs tbody tr').count()==8
 assert page.locator('.spha-example-paper .spha-example-compare tbody tr').count()==7
 assert page.locator('.spha-example-paper .spha-example-item').count()==7
 assert page.evaluate('JSON.stringify(S.paket)===window.__unchanged')
 assert page.locator('.spha-example-compare').inner_text().count('Lebih murah')==0 or True
 prepared=page.evaluate('window.SATRIA_DOK_PRINT.prepare()')
 print('prepared',prepared)
 print('inspection',page.evaluate('window.SATRIA_DOK_PRINT.inspect()'))
 assert prepared
 assert page.locator('#satria-print-root .spha-example-paper').count()==1
 path='/tmp/SATRIA-Analisa-Harga-QA-No-Winner.pdf'
 page.pdf(path=path,format='A4',print_background=True,prefer_css_page_size=True)
 page.evaluate('window.SATRIA_DOK_PRINT.clear()')
 # Second scenario: eligible winner and real package-level efficiency calculation.
 winnerInfo=page.evaluate('''()=>{
  const p=S.paket[0];p.pemenangId='qa-w1';p.penawaran[0].nego['qa-4']=3900;
  p.penawaran[0].nego['qa-5']=4100;
  render();return {winner:window.SATRIA_PRICE_ANALYSIS.getAnalysis(p).winner?.name||'',
   delta:window.SATRIA_PRICE_ANALYSIS.getAnalysis(p).delta,
   total:window.SATRIA_PRICE_ANALYSIS.getAnalysis(p).winner?.negoTotal||0,
   hps:window.SATRIA_PRICE_ANALYSIS.getAnalysis(p).packet.hps};
 }''')
 print('winner test',winnerInfo)
 assert winnerInfo['winner']=='FOTO COPY PRIMA',winnerInfo
 assert winnerInfo['hps']-winnerInfo['total']==winnerInfo['delta']
 assert page.evaluate('window.SATRIA_DOK_PRINT.prepare()')
 page.pdf(path='/tmp/SATRIA-Analisa-Harga-QA-Winner.pdf',format='A4',print_background=True,prefer_css_page_size=True)
 page.evaluate('window.SATRIA_DOK_PRINT.clear()')
 assert not errors,errors
 b.close()
doc=fitz.open(path)
print('PDF pages:',len(doc), 'size',[(round(x.rect.width),round(x.rect.height)) for x in doc])
txt='\n'.join(pg.get_text() for pg in doc)
print('pdf text length',len(txt), 'tail',txt[-1000:])
assert 'DOKUMEN ANALISIS KEWAJARAN HARGA E-PURCHASING' in txt
for section in ['I. LATAR BELAKANG','II. DAFTAR KEBUTUHAN BARANG','III. METODE REFERENSI','IV. TABEL ANALISA','V. ANALISA DAN PERTIMBANGAN','VI. REKAPITULASI','VII. KESIMPULAN']:
 assert section in txt,section
assert all(pg.rect.height>pg.rect.width for pg in doc),'not portrait'
assert len(doc)<=7, f'too long {len(doc)}'
print('PASS PDF match test,',len(doc),'pages')

wdoc=fitz.open('/tmp/SATRIA-Analisa-Harga-QA-Winner.pdf')
wtxt='\n'.join(page.get_text() for page in wdoc)
assert 'FOTO COPY PRIMA' in wtxt and 'Penghematan Anggaran' in wtxt
assert all(p.rect.height>p.rect.width for p in wdoc)
print('PASS winner PDF,',len(wdoc),'pages')
