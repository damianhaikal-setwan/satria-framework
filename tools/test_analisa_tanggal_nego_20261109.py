"""Regression: tanggal cetak Analisis Harga berasal dari tglNego paket, bukan jam cetak.
Data sintetis/offline; tidak menyentuh Supabase/produksi.
"""
from pathlib import Path
import re
import fitz
from playwright.sync_api import sync_playwright
import legacy_index_source

ROOT=Path(__file__).resolve().parents[1]
html=legacy_index_source.read_index()
html=re.sub(r'<script\s+src="https?://[^"]+"\s*>\s*</script>','',html)
for name in ('satria-next4.css','satria-operator-studio.css','satria-price-analysis.css'):
    html=html.replace(f'<link rel="stylesheet" href="./frontend/{name}">','<style>'+(ROOT/'frontend'/name).read_text()+'</style>')
for name in ('satria-next4.js','satria-operator-studio.js','satria-price-analysis.js'):
    html=html.replace(f'<script src="./frontend/{name}"></script>','<script>\n'+(ROOT/'frontend'/name).read_text()+'\n</script>')
html=re.sub(r'@import\s+url\([^;]+;','',html)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1365,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.abort())
    page.set_content(html,wait_until='domcontentloaded',timeout=45000)
    page.evaluate('''() => {
      S.paket=JSON.parse(JSON.stringify(SEED.paket));
      S.opd=JSON.parse(JSON.stringify(SEED.opd));
      S.pejabat=JSON.parse(JSON.stringify(SEED.pejabat));
      S.penyedia=JSON.parse(JSON.stringify(SEED.penyedia));
      S.tahun=[2026];S.ui.tahun=2026;S.ui.opd='all'; S.ui.plife='all';
      const p=S.paket[0];p.tahun=2026;p.nama='Paket uji tanggal cetak';p.rup='RUP-UJI-TANGGAL';p.pagu=100000;
      p.tglNego='2026-09-14';p.tglPenetapan='2026-10-01';p.tglSurvei='2026-06-01';
      p.items=[{id:'uji',nama:'Barang simulasi',spesifikasi:'Contoh',vol:2,satuan:'Buah',hs:5000}];
      p.penawaran=[];p.pemenangId=null;
      S.ui.dpid=p.id;S.ui.dok='analisa';S.ui.page='dok';S.ui.pid=null;
      window.__snapshot=JSON.stringify(S.paket);
      location.hash='#dok';render();
    }''')
    date=page.locator('.spha-sign p').first.text_content()
    info=page.locator('[data-satria-analisa-date-help]').inner_text()
    assert '14 September 2026' in date,(date,info)
    assert '14 September 2026' in info,(date,info)
    assert '1 Oktober 2026' not in date,(date,info)
    assert page.evaluate('JSON.stringify(S.paket)===window.__snapshot')
    assert page.evaluate('SATRIA_PRICE_ANALYSIS.docChecks(S.paket[0]).find(x=>x.id==="nego-date").ok')
    assert page.evaluate('window.SATRIA_DOK_PRINT.prepare()')
    pdf_bytes=page.pdf(format='A4',print_background=True,prefer_css_page_size=True)
    sample=Path('/mnt/data/SATRIA-Contoh-Tanggal-Analisis-Harga-Otomatis.pdf')
    sample.write_bytes(pdf_bytes)
    pdf=fitz.open(stream=pdf_bytes,filetype='pdf')
    print_text='\n'.join(pg.get_text() for pg in pdf)
    assert re.search(r'14\s+September\s+2026',print_text),'tanggal negosiasi harus muncul di hasil PDF'
    pdf.close()

    page.evaluate('''() => {S.paket[0].tglNego='2026-03-08'; render();}''')
    date=page.locator('.spha-sign p').first.text_content()
    assert '08 Maret 2026' in date,date
    assert '14 September 2026' not in date,date

    page.evaluate('''() => {S.paket[0].tglNego='';render();}''')
    date=page.locator('.spha-sign p').first.text_content()
    info=page.locator('[data-satria-analisa-date-help]').inner_text()
    assert 'Tanggal negosiasi belum diisi' in date,date
    assert 'Belum diisi' in info,info
    assert not page.evaluate('SATRIA_PRICE_ANALYSIS.docChecks(S.paket[0]).find(x=>x.id==="nego-date").ok')
    assert 'November 2026' not in date,date

    page.evaluate('''() => {S.paket[0].tglNego='2026-02-30';render();}''')
    assert 'Tanggal negosiasi belum diisi' in page.locator('.spha-sign p').first.text_content()
    assert not page.evaluate('SATRIA_PRICE_ANALYSIS.docChecks(S.paket[0]).find(x=>x.id==="nego-date").ok')
    assert not errors,errors[:4]
    print('PASS tanggal analisis: nego valid, perubahan, kosong, invalid, pratinjau, checklist, tanpa mutasi data')
    browser.close()
