"""Generate a clearly marked synthetic PDF to inspect print layout; NEVER a real procurement document."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=Path('/mnt/data/SATRIA_NEXT_3.0.59.57_SIMULASI_DOKUMEN_PEMILIHAN.pdf')
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1000,'height':900})
 page.set_content('<html><body></body></html>')
 page.add_script_tag(content=(root/'frontend/pbj2026-policy.js').read_text())
 page.add_script_tag(content=(root/'frontend/satria-spse-selection-document.js').read_text())
 html=page.evaluate('''() => {
   const p={id:'sim',nama:'SIMULASI — Pengadaan Meja Kerja (DATA FIKTIF)',rup:'RUP-SIMULASI',opd:'OPD-UJI',tahun:2026,pagu:150000000,
   jenisPengadaan:'Barang',jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{method:'Pengadaan Langsung'},tglMulaiPemilihan:'2026-11-01',dasarRegulasi:'perlem-3-2026',
   items:[{id:'1',nama:'Meja kerja contoh',vol:5,satuan:'unit',spesifikasi:'Dimensi dan bahan sesuai kebutuhan instansi simulasi.',hs:12000000},{id:'2',nama:'Kursi kerja contoh',vol:8,satuan:'unit',spesifikasi:'Dukungan ergonomis sesuai daftar kebutuhan simulasi.',hs:4500000}]};
   const d={};for(const [k,label,type] of SATRIA_SPSE_SELECTION.FIELDS){
     d[k]=type==='date'?'2026-11-02':type==='datetime-local'?'2026-11-04T09:00':'SIMULASI — data '+label+' hanya untuk memeriksa tata letak, bukan dokumen resmi.';
   }
   d.syaratKualifikasi='SIMULASI. Pelaku usaha memenuhi persyaratan legalitas dan teknis yang relevan dengan pekerjaan. Bukti kualifikasi diperiksa sesuai dokumen pemilihan resmi.';
   d.instruksiPeserta='SIMULASI. Peserta menyampaikan penawaran administrasi, teknis, harga dan kualifikasi melalui fitur SPSE sesuai jadwal. Pertanyaan diajukan melalui mekanisme resmi.';
   d.kriteriaEvaluasi='SIMULASI. Pemeriksaan kesesuaian persyaratan administrasi dan teknis, kewajaran harga, serta kualifikasi sesuai ketentuan dan spesifikasi paket.';
   d.rancanganSpk=('SIMULASI RANCANGAN SPK dari PPK untuk pengujian tata letak saja. Klausul asli belum dimasukkan dan tidak boleh dipakai untuk kontrak.\\n').repeat(16);
   return SATRIA_SPSE_SELECTION.html(p,d,false);
 }''')
 page.set_content(html)
 page.pdf(path=str(out),format='A4',print_background=True,prefer_css_page_size=True)
 print(out, out.stat().st_size)
 browser.close()
