/* SATRIA Tahap 4 — template dokumen dipisah dari controller aplikasi.
   Global classic-script; panggil setelah app-core, sebelum modul cloud dan vDok.
   Mesin data, cetak, dan aturan pajak tidak diubah. */
function nodis(p){
const k=PJ(p.kabid),o=OP(p),u=unitOf(p);
const dari=esc(u.bidang||o.nama);
const B='border:1px solid #000;padding:3px 6px;vertical-align:top';
const N='border:0;padding:2px 0;vertical-align:top';
const tglID=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'-';
const en=n=>nf(n); // Rupiah bulat dengan pemisah ribuan Indonesia
const akun=S.akun.find(a=>a.id===p.akunId);
const rekening=akun?`${esc(akun.kode)} ${esc(akun.nama)}`:'-';
const baris=p.items.map((i,n)=>`<tr><td style="${B};text-align:center">${n+1}</td><td style="${B}">${itemLabel(i)}</td><td style="${B};text-align:center">${vf(i.vol)}</td><td style="${B};text-align:center">${esc(i.satuan)}</td><td style="${B};text-align:right">${en(i.hs)}</td><td style="${B};text-align:right">${en(i.vol*i.hs)}</td></tr>`).join('');
const rincian=`<table style="border-collapse:collapse;width:100%"><thead><tr><th style="${B};text-align:center">No</th><th style="${B}">Nama Barang</th><th style="${B}">Vol</th><th style="${B}">Satuan</th><th style="${B}">Harga Satuan (Rp)</th><th style="${B}">Jumlah (Rp)</th></tr></thead><tbody>${baris}</tbody></table>`;
const meta=[['Yth.','Pejabat Pembuat Komitmen (PPK)'],['Dari',dari],['Tanggal',tglID(p.tglNodis)],['Nomor',nomor('NODIS',p)],['Sifat','Biasa'],['Lampiran','1 (satu) rangkap'],['Perihal',`Penyampaian Pengajuan ${esc(p.nama)}`]]
 .map(([a,b])=>`<tr><td style="${N};width:100px">${a}</td><td style="${N};width:12px">:</td><td style="${N}">${b}</td></tr>`).join('');
const rows=[['1.','Nama Program',esc(progOf(p)).replace(/\n/g,'<br>')],['2.','Nama Kegiatan',esc(kegOf(p)).replace(/\n/g,'<br>')],['3.','Nama Sub Kegiatan',esc(subOf(p)).replace(/\n/g,'<br>')],['4.','Nama Paket',esc(p.nama)],['5.','Kode Rekening Belanja',rekening],['6.','Pagu Anggaran','Rp '+en(p.pagu)]]
 .map(([a,b,c])=>`<tr><td style="${B};text-align:center;width:36px">${a}</td><td style="${B};width:190px">${b}</td><td style="${B}">${c}</td></tr>`).join('');
return `${kop(p)}
<table style="border:0;margin-top:16px">${meta}</table>
<p style="margin:14px 0 8px">Terlampir disampaikan pengajuan dengan rincian sebagai berikut:</p>
<table style="border-collapse:collapse;width:100%">${rows}${p.items.length>8?`<tr><td style="${B};text-align:center">7.</td><td colspan="2" style="${B}">Rincian Belanja — daftar per item pada tabel berikut</td></tr></table>${rincian}`:`<tr><td style="${B};text-align:center">7.</td><td style="${B}">Rincian Belanja</td><td style="${B};padding:0">${rincian}</td></tr></table>`}
<p style="margin-top:14px">Demikian disampaikan untuk dapat dipergunakan sebagaimana mestinya.</p>
<div style="margin-top:28px;margin-left:auto;width:320px;text-align:left;line-height:1.4">${dari}<br>${sigImg(k)}<b>${esc(k.nama)}</b><br>NIP. ${esc(k.nip)}</div>`;
}
const sigImg=x=>(x.ttd||x.cap)?`<div style="height:70px">${x.ttd?`<img src="${x.ttd}" style="height:60px;vertical-align:middle">`:''}${x.cap?`<img src="${x.cap}" style="height:65px;vertical-align:middle;margin-left:-16px">`:''}</div>`:'<br><br><br>';
/* SATRIA NEXT 3.0.53 — referensi resmi DPP: tempat, PPK penandatangan, TTD & cap. */
function satriaDppOfficialPlace(p){
  const opd=O(p.opd);
  const bad=v=>!v||/^(?:kota|lokasi|tempat|alamat|kabupaten|provinsi)\s+contoh\b|\b(?:demo|simulasi)\b/i.test(v.trim());
  const tempat=String(opd.tempat||'').trim();
  const pemda=satriaPemdaOfficial('kota');
  if(!bad(tempat))return tempat;
  if(!bad(pemda))return pemda;
  return '[Tempat belum diatur]';
}
function satriaDppSigner(p){
  const id=String(p.dppPpkId||p.ppk||'');
  return S.pejabat.find(x=>String(x.id)===id && String(x.opd)===String(p.opd) && x.peran==='PPK')||null;
}
function satriaDppPicture(src,kind){
  const v=String(src||'').trim();
  if(!/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(v) && !/^satria-media:\/\/[a-f0-9-]+\/(?:opd|shared)\//i.test(v))return '';
  const isCap=kind==='cap';
  return `<img class="${isCap?'satria-dpp-cap':'satria-dpp-ttd'}" src="${esc(v)}" alt="${isCap?'Cap atau stempel PPK':'Tanda tangan PPK'}" decoding="async">`;
}
function satriaDppSignerVisual(x,p){
 const stamp=x?satriaDppPicture(x.cap,'cap'):'';
 const signature=x?satriaDppPicture(x.ttd,'ttd'):'';
 // Cap kiri, TTD kanan dengan sedikit tumpang tindih, tetap dalam satu bidang tetap.
 // Cap lebih dulu agar garis TTD berada di atas cap bila gambarnya transparan.
 return `<div class="satria-dpp-ppk-images" style="${globalThis.SATRIA_DPP_SIGN_LAYOUT?.inlineStyle?.(p)||''}" aria-label="Tanda tangan dan cap PPK terpilih">${stamp}${signature}</div>`;
}
function satriaDppPpkControl(p){
 const current=String(p.dppPpkId||p.ppk||'');
 const eligible=(S.pejabat||[]).filter(x=>x.peran==='PPK'&&String(x.opd)===String(p.opd)&&(x.aktif!==false||String(x.id)===current));
 const selected=eligible.find(x=>String(x.id)===current);
 const sign=selected||null;
 const place=satriaDppOfficialPlace(p);
 return `<section class="satria352-ppk-panel no-print" aria-label="Pejabat penandatangan DPP">
   <div class="satria352-ppk-title"><span>✍</span><div><b>Penandatangan Dokumen Persiapan Pengadaan</b><p>Pilih PPK dari Data Master pada OPD paket. Pilihan hanya berlaku pada DPP paket ini.</p></div></div>
   <div class="satria352-ppk-grid"><div class="fg"><label for="satriaDppSignerSelect">Pejabat Pembuat Komitmen (PPK)</label>
   <select id="satriaDppSignerSelect" data-pid="${esc(p.id)}" ${!canWrite()?'disabled':''}>
     <option value="" ${!selected?'selected':''}>— pilih PPK penandatangan DPP —</option>
     ${eligible.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===current?'selected':''}>${esc(x.nama)} · NIP ${esc(x.nip||'-')}${x.aktif===false?' (nonaktif)':''}</option>`).join('')}
   </select></div><div class="satria352-ppk-meta"><small>Tempat penandatanganan dari Pengaturan Sistem</small><b>${esc(place)}</b><small>${sign?(sign.ttd?'✓ TTD':'⚠ TTD belum diunggah')+' · '+(sign.cap?'✓ Cap':'⚠ Cap belum diunggah'):'Pilih PPK terlebih dahulu'}</small></div></div>
   ${!eligible.length?'<p class="satria352-ppk-warning">Belum ada PPK untuk OPD ini. Tambahkan di Data Master → PPK/KPA, lalu unggah tanda tangan dan cap.</p>':''}
   <p class="satria352-ppk-help">Gambar TTD dan cap berasal dari Data Master → PPK/KPA. Jika gambar belum tersedia, area tanda tangan dibiarkan kosong untuk penandatanganan manual; aplikasi tidak membuat tanda tangan palsu.</p>
 </section>`;
}

/* SATRIA DPP 2026-11-02: format contoh per paket; tidak mengubah data HPS, RUP, atau dokumen lainnya. */
function satriaDppOptions(p){
 const f=p?.dppFormat&&typeof p.dppFormat==='object'&&!Array.isArray(p.dppFormat)?p.dppFormat:{};
 const tableMode=f.tableMode==='lengkap'?'lengkap':'contoh';
 const brandPolicy=['unreviewed','no_specific','reference','specific'].includes(f.brandPolicy)?f.brandPolicy:'unreviewed';
 return {tableMode,brandPolicy,brandReason:String(f.brandReason||'').trim(),brandEvidence:String(f.brandEvidence||'').trim(),docNumber:String(f.docNumber||'').trim(),includePhotos:f.includePhotos!==false};
}
function satriaDppNumber(p){return satriaDppOptions(p).docNumber||nomor('DPP',p);}
function satriaDppMetaLines(p,key){
 const base={program:progOf(p),kegiatan:kegOf(p),subKeg:subOf(p)}[key]||'';
 const values=[base];
 const linked=[p?.rupBankId,...(Array.isArray(p?.rupBankIds)?p.rupBankIds:[])].filter(Boolean).map(String);
 // Hanya referensi RUP tersambung dengan OPD & tahun paket yang sama; bukan data OPD lainnya.
 const seenIds=new Set();
 for(const id of linked){
  if(seenIds.has(id))continue;seenIds.add(id);
  const r=(S.rupBank||[]).find(x=>String(x.id)===id&&String(x.opd)===String(p.opd)&&Number(x.tahun)===Number(p.tahun));
  if(!r)continue;
  const subCode=String(r.subKegKode||r.sub||'').trim();
  const bankKode=(S.kode||[]).find(x=>String(x.kode)===subCode);
  const subName=String(r.subKegNama||bankKode?.nama||'').trim();
  const extra=key==='subKeg'?(r.subKeg||(subCode&&subName?subCode+' - '+subName:subName||subCode)):(r[key]||bankKode?.[key]||'');
  if(extra)values.push(String(extra));
 }
 const lines=[];const seen=new Set();
 for(const value of values){
  for(const part of String(value||'').split(/\r?\n/)){
   const t=part.trim();if(!t||/^(?:-|KODE-DEMO-001|Program Demo|Kegiatan Simulasi)$/i.test(t)||/\b(?:instansi pemerintah demo|dana simulasi)\b/i.test(t))continue;
   const k=t.toLocaleLowerCase('id-ID').replace(/\s+/g,' ');if(!seen.has(k)){seen.add(k);lines.push(t);}
  }
 }
 return lines.length?lines.map(x=>esc(x)).join('<br>'):'<em>[Belum diisi]</em>';
}
function satriaDppBrandText(p){
 const f=satriaDppOptions(p),reason=esc(f.brandReason),evidence=esc(f.brandEvidence);
 const refs=(p.items||[]).filter(i=>String(i.merek||'').trim()).map(i=>esc(i.nama||'Barang')+': '+esc(i.merek));
 const refText=refs.length?`<br><span class="satria-dpp-brand-refs">Merek/tipe yang tercatat dalam data barang: ${refs.join('; ')}.</span>`:'';
 if(f.brandPolicy==='no_specific')return 'Tidak mensyaratkan merek tertentu. Penyebutan merek/model pada rincian, bila ada, bukan syarat merek tunggal; kesesuaian dinilai terhadap spesifikasi teknis yang ditetapkan.'+(reason?'<br>Catatan PPK: '+reason:'')+refText;
 if(f.brandPolicy==='reference')return 'Merek/model yang disebut digunakan sebagai referensi karakteristik dan kompatibilitas; produk yang memenuhi spesifikasi teknis tetap dapat dievaluasi.'+(reason?'<br>Pertimbangan teknis PPK: '+reason:'')+refText;
 if(f.brandPolicy==='specific')return 'Persyaratan merek/tipe tertentu memerlukan justifikasi teknis dan bukti pendukung yang disetujui PPK.'+(reason?'<br>Justifikasi PPK: '+reason:'<br><b>[Alasan teknis belum diisi]</b>')+(evidence?'<br>Dokumen pendukung: '+evidence:'<br><b>[Bukti pendukung belum diisi]</b>')+refText;
 return '<b>[Status penggunaan merek belum ditetapkan PPK]</b> Tentukan status dan alasan melalui pengaturan DPP sebelum penerbitan resmi.'+refText;
}
function dpp(p){const o=OP(p),H=hps(p),dppSigner=satriaDppSigner(p);
const TS=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';
// Sumber dana hanya dari paket; jangan gabungkan nama default instansi yang bisa berisi Demo.
const cleanSumber=String(p.sumber||'').trim();
const dppFunding=(/\b(?:demo|contoh|dummy|simulasi|test)\b/i.test(cleanSumber)||!cleanSumber)?'':(cleanSumber+(String(p.tahun||'').trim()&&!/\bTA\s*\d{4}\b/i.test(cleanSumber)?' TA '+p.tahun:''));
const fDpp=satriaDppOptions(p);
const subs=satriaDppMetaLines(p,'subKeg');
const five=fDpp.tableMode==='contoh';
const P_=(n,t)=>`<p style="margin:4px 0;text-align:justify">${n}${t}</p>`;
const L=(a,t)=>`<tr><td style="border:0;width:150px;vertical-align:top">${a}</td><td style="border:0;width:10px;vertical-align:top">:</td><td style="border:0">${t}</td></tr>`;
const items=p.items.map((i,n)=>`<tr><td>${n+1}.</td><td>${itemLabel(i)}</td><td style="text-align:right">${vf(i.vol)}</td><td>${esc(i.satuan)}</td><td style="text-align:right">${nf(i.hs)}</td>${five?'':`<td style="text-align:right">${nf((+i.vol||0)*(+i.hs||0))}</td>`}</tr>`).join('');
return `${kop(p)}
<p class="doc-title" style="text-align:center;margin:6px 0 12px"><u><b>DOKUMEN PERSIAPAN PENGADAAN (DPP) E-PURCHASING</b></u></p>
<table class="tbl-letter-meta" style="border:0;margin-bottom:10px">
${L('Nomor',esc(satriaDppNumber(p)))}${L('Tanggal',TS(p.tglDpp))}${L('Program',satriaDppMetaLines(p,'program'))}${L('Kegiatan',satriaDppMetaLines(p,'kegiatan'))}${L('Sub Kegiatan',subs)}${L('Lokasi',esc(p.lokasiPengiriman||o.tempat||o.alamat||o.nama))}${L('Nama Paket Pengadaan',esc(p.nama))}${L('Sumber Dana',esc(dppFunding))}${L('Pagu Dana',rp(p.pagu))}${L('RUP',esc(p.rup))}</table>

<p style="margin:10px 0 4px"><b>I. Spesifikasi Teknis</b></p>
<p style="margin:4px 0">Penyusunan spesifikasi teknis telah menguraikan hal-hal sebagai berikut antara lain:</p>
<ol style="margin:4px 0 8px 22px;padding:0">
${['Kesesuaian spesifikasi teknis dengan kebutuhan;','Karakteristik: ukuran, dimensi, bentuk, bahan, warna, komposisi, dan lain-lain;','Kinerja: ketahanan, efisiensi, batas pemakaian, dan lain-lain;','Standar yang digunakan: SNI, JIS, ASTM, ISO, dan lain-lain;','Validitas standar yang digunakan;','Pengepakan dan cara pengiriman;','Macam, jenis, kapasitas dan jumlah peralatan;','Aspek layanan meliputi waktu penyelesaian, ketepatan pengiriman, dan responsivitas penyedia;','Output atau hasil pekerjaan sesuai volume dan kualitas yang dipersyaratkan;','Higienitas dan keamanan (khusus pengadaan makan minum);','Kompatibilitas teknis (khusus bahan komputer);','Ketentuan garansi atau penggantian atas ketidaksesuaian barang/jasa.'].map(x=>`<li>${x}</li>`).join('')}
</ol>
<p style="margin:4px 0">Spesifikasi teknis paket pengadaan/pekerjaan adalah sebagai berikut:</p>
<p class="doc-section-heading" style="margin:4px 0"><b>a. Spesifikasi Jenis, Mutu Barang/Bahan/Material, Jumlah, Satuan dan Harga</b></p>
<table class="tbl-dpp-items ${five?'satria-dpp-example-five':'satria-dpp-six'}"><thead><tr><th>No</th><th>Nama/Jenis Barang, Spesifikasi Mutu/Bahan/Material</th><th>Jumlah</th><th>Satuan</th><th>Harga Satuan (Rp)</th>${five?'':'<th>Jumlah (Rp)</th>'}</tr></thead><tbody>
${items}
${five?'':`<tr><th colspan="5" style="text-align:right">Total HPS</th><th style="text-align:right">${nf(H)}</th></tr>`}
</tbody></table>
<p style="margin:6px 0 4px"><b>b. Justifikasi Teknis Dalam Penggunaan Merek (Jika ada)</b><br>${satriaDppBrandText(p)}</p>
<p style="margin:4px 0"><b>c. Spesifikasi Waktu</b><br>Pelaksanaan pekerjaan mulai dari diterbitkannya surat pesanan sampai dengan tanggal ${TS(p.batas)}.</p>
<p class="satria594-spec-block" style="margin:4px 0"><b>d. Spesifikasi Tempat</b><br>Pengiriman sampai ke lokasi yaitu ${esc(p.lokasiPengiriman||o.tempat||o.alamat||o.nama||'-')}<br>Lokasi pengantaran: langsung ke tempat/lokasi tujuan.<br>Jarak dan akses lokasi diperhitungkan oleh penyedia tanpa biaya tambahan di luar harga satuan e-Katalog.</p>
<p class="satria-dpp-service-block" style="margin:4px 0"><b>e. Spesifikasi Layanan</b><br>Penyedia wajib memenuhi tingkat layanan meliputi ketepatan waktu, kesesuaian spesifikasi, kualitas hasil, ketepatan jumlah, responsivitas, pengemasan dan pengiriman, jaminan/garansi, fleksibilitas layanan, kepatuhan administratif, serta standar keamanan dan kepatuhan. Penyedia juga wajib menindaklanjuti setiap ketidaksesuaian melalui perbaikan atau penggantian tanpa biaya tambahan sesuai ketentuan yang disepakati serta bertanggung jawab penuh atas pengadaan.</p>

<p style="margin:8px 0 4px"><b>II. Prioritas Penggunaan Produk Dalam Negeri</b></p>
${P_('', 'Berdasarkan Pasal 66 ayat (1) dan (2) Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua Atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah, maka PPK/PP yang akan melakukan e-Purchasing memilih barang/jasa pada Katalog Elektronik dengan urutan/prioritas sebagai berikut:')}
<ol style="margin:4px 0 8px 22px;padding:0">
${['Apabila barang/jasa yang dibutuhkan pada Katalog Elektronik terdapat produk dalam negeri yang memiliki jumlah nilai TKDN dan nilai BMP minimal 40% (empat puluh persen) maka PPK/PP memilih produk dalam negeri dengan nilai TKDN paling sedikit 25% (dua puluh lima persen);','Dalam hal kondisi pada angka 1 di atas tidak dapat dipenuhi, maka PPK/PP dapat memilih produk dalam negeri dengan nilai TKDN kurang dari 25% (dua puluh lima persen);','Dalam hal kondisi pada angka 1 dan 2 di atas tidak dapat dipenuhi, maka PPK/PP dapat memilih produk dengan label PDN namun belum mempunyai nilai TKDN;','Dalam hal kondisi pada angka 1, 2, dan 3 di atas tidak dapat dipenuhi, maka PPK/PP dapat memilih produk impor; dan','Dalam hal kondisi pada angka 1, 2, 3, dan 4 di atas tidak dapat dipenuhi, maka PPK/PP dapat menggunakan metode lain selain e-Purchasing Katalog sesuai ketentuan peraturan perundang-undangan.'].map(x=>`<li>${x}</li>`).join('')}
</ol>

<p style="margin:8px 0 4px"><b>III. Prioritas Penggunaan Produk dari Penyedia dengan Kualifikasi Usaha Kecil serta Koperasi</b></p>
${P_('', 'Berdasarkan Pasal 65 ayat (3) dan (4) Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua Atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah, maka PPK/PP yang akan melakukan e-Purchasing Katalog memilih barang/jasa pada Katalog Elektronik dengan urutan/prioritas sebagai berikut:')}
<ol style="margin:4px 0 8px 22px;padding:0">
${['Apabila nilai paket pengadaan barang/jasa dengan nilai pagu anggaran sampai dengan Rp15.000.000.000,00 (lima belas miliar rupiah) maka PPK/PP memilih Penyedia dengan Kualifikasi Usaha Kecil atau Koperasi untuk barang/jasa yang dibutuhkan yang tersedia pada Katalog Elektronik;','Dalam hal kondisi pada angka 1 di atas tidak dapat dipenuhi maka PPK/PP dapat memilih Penyedia Katalog Elektronik dengan Kualifikasi Usaha Non Kecil.'].map(x=>`<li>${x}</li>`).join('')}
</ol>

<p style="margin:8px 0 4px"><b>IV. Pengumpulan Referensi Harga</b></p>
${P_('', 'PPK/PP mempersiapkan referensi harga yang berfungsi sebagai referensi untuk melakukan Negosiasi Harga. Pengumpulan referensi harga dilakukan dengan memperhatikan hal-hal sebagai berikut:')}
<p style="margin:4px 0">1. Referensi harga disusun dengan sumber data sebagai berikut:</p>
<ol type="a" style="margin:4px 0 8px 42px;padding:0">
${['Mencari produk dengan harga terbaik yang tercantum pada Katalog Elektronik sesuai dengan spesifikasi teknis yang dibutuhkan dengan memperhatikan ketentuan terkait Prioritas Penggunaan Produk Dalam Negeri dan Prioritas Penggunaan Produk dari Penyedia dengan Kualifikasi Usaha Kecil serta Koperasi;','Mencari harga pembanding produk sejenis di luar aplikasi Katalog Elektronik (apabila ada);','Informasi biaya/harga satuan yang dipublikasikan secara resmi oleh Kementerian/Lembaga/Pemerintah Daerah (apabila ada); dan','Dokumen lainnya yang dapat dipertanggungjawabkan (apabila ada).'].map(x=>`<li>${x}</li>`).join('')}
</ol>
${P_('2. ', 'Selain referensi harga, PPK/PP juga dapat mempersiapkan kebutuhan terkait layanan teknis pendukung dari barang/jasa untuk dijadikan referensi dalam melakukan negosiasi dengan Penyedia apabila diperlukan. Layanan teknis pendukung adalah layanan yang dapat diberikan Penyedia untuk mendukung penggunaan dari barang/jasa yang akan dibeli. Negosiasi layanan teknis pendukung tidak digunakan untuk menegosiasi teknis barang seperti mengubah/menambah spesifikasi barang/jasa yang telah tayang pada Katalog Elektronik.')}
${P_('3. ', 'Pengumpulan referensi harga tidak diperlukan jika harga produk yang tayang pada aplikasi Katalog Elektronik berupa fixed price atau harga tidak bisa dinegosiasi.')}

<p style="margin:8px 0 4px"><b>V. Rancangan Kontrak</b></p>
${P_('', 'Rancangan Kontrak menggunakan Surat Pesanan sesuai yang tertuang di aplikasi e-Purchasing.')}

<p style="margin:8px 0 4px"><b>VI. Rencana Metode Pemilihan Penyedia</b></p>
${P_('', 'Rencana metode pemilihan penyedia Katalog Elektronik menggunakan: <b>Negosiasi Harga</b>.')}

<section class="satria594-closing-signature satria-dpp-closing">
<p style="margin:8px 0 4px"><b>VII. Penutup</b></p>
<p style="margin:4px 0;text-align:justify">Demikian Dokumen Persiapan e-Purchasing dibuat untuk dapat diketahui bersama sebagai acuan bagi pelaksanaan proses pengadaan barang/jasa bagi pihak terkait dan dibuat untuk digunakan sebagaimana mestinya.</p>
<div class="satria-dpp-signature" style="width:330px;max-width:100%;margin:22px 0 0 auto;line-height:1.5;text-align:center;break-inside:avoid;page-break-inside:avoid">
${esc(satriaDppOfficialPlace(p))}, ${TS(p.tglDpp)}<br>Ditetapkan oleh:<br>Pejabat Pembuat Komitmen (PPK)<br>${esc(o.nama)}
${satriaDppSignerVisual(dppSigner,p)}<b><u>${esc(dppSigner?.nama||'[PPK belum dipilih]')}</u></b><br>NIP. ${esc(dppSigner?.nip||'-')}
</div></section>`}

function sppbj(p){
 // 3.0.59.20 — Surat Perintah Pengadaan tanpa bingkai/kotak sesuai pedoman pengguna.
 // Nama instansi harus berasal dari OPD paket, bukan seed S.pemda.nama yang bisa berupa demo.
 const o=OP(p),pej=PJ(p.ppk);
 const institution=String(o.nama||'').trim();
 const opdName=institution&&institution!=='-'&&!/\b(?:demo|dummy|contoh|simulasi)\b/i.test(institution)?institution:'[Nama OPD belum diisi]';
 const place=satriaDppOfficialPlace(p);
 const pemdaName=satriaPemdaOfficial('nama');
 const pemdaSafe=pemdaName&&!/\b(?:demo|dummy|contoh|simulasi|instansi pemerintah)\b/i.test(pemdaName)?pemdaName:'';
 const orgKop=o.kop?kop(p):`<div class="kop kop-text" style="text-align:center;margin-bottom:10px">${S.pemda?.logo?`<img src="${satriaSafeMediaSrc(S.pemda.logo)}" alt="Logo pemerintah daerah" style="height:56px;max-width:100%;object-fit:contain;margin-bottom:6px"><br>`:''}${pemdaSafe?`<div style="font-size:15px;font-weight:bold">${esc(pemdaSafe)}</div>`:''}<div style="font-size:14px;font-weight:bold">${esc(opdName.toUpperCase())}</div><div style="font-size:11px;margin-top:4px">${esc(o.alamat||'')}</div><div style="font-size:11px">${esc(o.kontak||'')}</div><hr style="border:0;border-top:2.5px solid #000;margin:10px 0 4px"></div>`;
 const subject='Perintah Pengadaan Barang & Jasa';
 const meta=(label,value)=>`<div class="sppbj-meta-row"><span class="sppbj-meta-label">${label}</span><span class="sppbj-meta-colon">:</span><span class="sppbj-meta-value">${value}</span></div>`;
 const tahun=String(p.tahun||S.tahun||'').trim();
 return `${orgKop}
 <div class="sppbj-pdf-layout satria-sppbj-official">
 <div class="sppbj-letter-heading">
 <div class="sppbj-letter-meta" aria-label="Identitas surat perintah pengadaan">
 ${meta('Nomor',esc(nomor('PPBJ',p)))}${meta('Sifat','Biasa')}${meta('Lampiran','1 (satu) rangkap')}${meta('Perihal',esc(subject))}</div>
 <div class="sppbj-letter-place">${esc(place)}, ${tg(p.tglSppbj)}</div>
 </div>
 <div class="sppbj-destination">Yth. &nbsp; Pejabat Pengadaan pada ${esc(opdName)}<br>di -<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${esc(place)}</div>
 <p class="sppbj-body-text">Sehubungan dengan akan dilaksanakannya kegiatan pengadaan barang/jasa di lingkungan ${esc(opdName)}${tahun?' Tahun Anggaran '+esc(tahun):''} melalui <b><i>E-Purchasing</i></b>, maka dengan ini disampaikan untuk segera melakukan proses kegiatan dimaksud sebagai dasar pelaksanaan dan berikut lampiran:</p>
 <ol class="sppbj-attachments"><li>Spesifikasi Teknis Barang/Jasa;</li><li>Dokumen Persiapan Pengadaan Barang/Jasa.</li></ol>
 <p class="sppbj-body-text">Dalam melakukan proses kegiatan tersebut harus berpedoman pada peraturan perundang-undangan yang berlaku dengan tetap memperhatikan batasan waktu yang tersedia.</p>
 <p class="sppbj-closing">Demikian disampaikan untuk dapat dipergunakan sebagaimana mestinya.</p>
 <div class="sppbj-signature-layout"><div class="sppbj-signature-left" aria-hidden="true"></div><div class="sppbj-signature-cell">Pejabat Pembuat Komitmen (PPKom)<br>${esc(opdName)}<div class="sppbj-signature-space"></div><b><u>${esc(pej.nama&&pej.nama!=='-'?pej.nama:'[PPK belum dipilih]')}</u></b><br>NIP. ${esc(pej.nip&&pej.nip!=='-'?pej.nip:'-')}</div></div>
 </div>`;
}

/* 3.0.59.18 — BAHP mengikuti tata letak TTD/cap DPP tanpa mengubah pejabat BAHP. */
function satriaBahpPicture(src,kind){
  const safe=satriaDppPicture(src,kind); // Utamakan sumber yang sama dengan DPP (Storage privat/Base64).
  if(safe)return safe;
  // Pertahankan kompatibilitas berkas gambar HTTPS lama yang sebelumnya didukung sigImg.
  const v=String(src||'').trim();
  if(/^https:\/\/[^\s"'<>]+$/i.test(v)){
    return `<img class="${kind==='cap'?'satria-dpp-cap':'satria-dpp-ttd'}" src="${esc(v)}" alt="${kind==='cap'?'Cap atau stempel pejabat':'Tanda tangan pejabat'}" decoding="async">`;
  }
  return '';
}
function satriaBahpSignerVisual(pejabat,p){
  const cap=satriaBahpPicture(pejabat?.cap,'cap');
  const ttd=satriaBahpPicture(pejabat?.ttd,'ttd');
  // Foto stempel HARUS lebih dulu (di kiri), TTD di atasnya (kanan) sebagaimana DPP.
  if(!cap&&!ttd)return '<div class="satria-bahp-signature-spacer" aria-hidden="true"></div>';
  const layout=globalThis.SATRIA_DPP_SIGN_LAYOUT?.inlineStyle?.(p)||'';
  return `<div class="satria-bahp-ppk-images" style="${layout}" aria-label="Tanda tangan dan cap pejabat">${cap}${ttd}</div>`;
}
function bahp(p){
 const offers=p.penawaran||[], W=pemenang(p), chosen=W?.w||null;
 const officer=PJ(p.pp),approver=PJ(p.ppk), H=hps(p), chosenName=chosen?PY(chosen.pen).nama:'[Belum ditetapkan]';
 const rows=(p.items||[]), date=p.tglBahp?tg(p.tglBahp):'[Tanggal BAHP belum diisi]';
 const money=n=>nf(n), val=(x,fallback='-')=>String(x??'').trim()||fallback;
 const head=(titles,nums)=>`<thead><tr>${titles.map(t=>`<th>${t}</th>`).join('')}</tr><tr class="bahp-number-row">${nums.map(n=>`<th>${n}</th>`).join('')}</tr></thead>`;
 const metar=(k,v)=>`<div class="bahp-info-line"><span>${k}</span><span>:</span><span>${esc(v??'-')}</span></div>`;
 const refs=offers.map((w,n)=>{
   const y=PY(w.pen);
   const lines=rows.map((it,i)=>{const price=+(w.harga?.[it.id]||0);return `<div class="bahp-ref-row"><span>${i+1})</span><span>${itemLabel(it)}</span><span>${price?rp(price):'-'}</span><span>${price?'Spesifikasi perlu diverifikasi dengan bukti etalase produk':'Harga belum dicatat'}</span></div>`}).join('');
   return `<div class="bahp-ref-block"><div>${n+1}. &nbsp; <b>${esc(y.nama)}</b></div>${lines}</div>`;
 }).join('')||'<p>Referensi harga penyedia belum dicatat.</p>';
 const assessments=offers.map((w,n)=>{
   const y=PY(w.pen);
   const data=rows.map((it,i)=>{
    const supplied=+(w.harga?.[it.id]||0)>0;
    return `<tr><td class="bahp-center">${i+1}</td><td>${itemLabel(it)}</td><td>${supplied?itemLabel(it):'Spesifikasi belum dicatat'}</td><td class="bahp-center">${supplied?'Perlu verifikasi':'-'}</td></tr>`;
   }).join('')||'<tr><td colspan="4">Rincian barang belum tersedia.</td></tr>';
   return `<div class="bahp-assessment"><p class="bahp-inset"><b>${n+1}) &nbsp; ${esc(y.nama)}</b></p><table class="bahp-grid bahp-spec-table">${head(['No.','Kebutuhan Spesifikasi Teknis','Spesifikasi Penyedia','Hasil'],[1,2,3,4])}<tbody>${data}</tbody></table></div>`;
 }).join('')||'<p>Belum ada penyedia untuk dievaluasi.</p>';
 const negotable=rows.map((it,n)=>{
   const unit=chosen?+(chosen.nego?.[it.id]??chosen.harga?.[it.id]??0):0;
   const shipping=0; // ongkir dicatat satu kali pada baris total paket
   return `<tr><td class="bahp-center">${n+1}</td><td>${itemLabel(it)}</td><td class="bahp-center">${vf(it.vol)} ${esc(it.satuan||'')}</td><td class="bahp-money">${unit?'Rp '+Number(unit).toLocaleString('id-ID',{maximumFractionDigits:2}):'-'}</td><td class="bahp-money">${shipping?rp(shipping):'-'}</td><td class="bahp-money">${unit?rp((+it.vol||0)*unit):'-'}</td></tr>`;
 }).join('')||'<tr><td colspan="6">Rincian barang belum tersedia.</td></tr>';
 const base=chosen?sum(rows,it=>(+it.vol||0)*(+(chosen.nego?.[it.id]??chosen.harga?.[it.id]??0)||0)):0;
 const shipping=chosen?+(chosen.ongkir||0):0;
 const final=base+shipping;
 const selected=chosen?PY(chosen.pen):{};
 const pricing=chosen?satriaDocPricing(p,chosen):null;
 const ppnNote=pricing?.verified?'PPN merupakan bagian dari harga satuan hasil negosiasi (bruto), bukan tambahan atas subtotal.':'Komponen sebelum PPN dan PPN pada sebagian rincian belum lengkap/selaras; harga satuan dalam tabel adalah harga akhir termasuk pajak yang tersimpan. Verifikasi sebelum pengesahan.';
 return `${kop(p)}<div class="bahp-reference-layout ${rows.length>12||offers.length>3?'bahp-many':''}">
 <p class="bahp-document-title"><b><u>BERITA ACARA HASIL PEMILIHAN E-PURCHASING</u></b><span>Nomor : ${esc(nomor('BAHP',p))}</span></p>
 <p>Pada Hari ini ${esc(date)} kami yang bertandatangan di bawah ini Pengguna Anggaran selaku Pejabat Pembuat Komitmen (PPKom) bersama Pejabat Pengadaan pada ${esc(OP(p).nama)} telah melaksanakan proses pemilihan melalui E-Purchasing, dengan hasil sebagai berikut :</p>
 <p class="bahp-section"><b>A. &nbsp; DATA UMUM</b></p>
 <div class="bahp-info">${metar('Sub kegiatan',subOf(p))}${metar('Kode RUP',p.rup)}${metar('Pagu',rp(p.pagu))}${metar('Metode',p.metodePemilihan||'Perlu verifikasi')}${metar('Nama Paket',p.nama)}</div>
 <p class="bahp-section"><b>B. &nbsp; PERSIAPAN PENGADAAN</b></p>
 <p>Menyusun identifikasi sesuai kebutuhan terdiri atas :</p><ol class="bahp-list">${rows.map(it=>`<li>${itemLabel(it)}</li>`).join('')}</ol>
 <p>Dengan rincian kebutuhan dan harga satuan :</p><div class="bahp-pricing-list">${rows.map((it,n)=>`<div><span>${n+1}.</span><span>${itemLabel(it)}</span><span>${vf(it.vol)}</span><span>${esc(it.satuan||'')}</span><span>${rp(it.hs)}</span></div>`).join('')}</div>
 <p>Hasil pengumpulan referensi harga dan spesifikasi minimal dari beberapa pelaku usaha :</p>${refs}
 <p class="bahp-section"><b>C. &nbsp; PELAKSANAAN E-PURCHASING</b></p>
 <p class="bahp-inset">1) &nbsp; <b>Pemilihan Produk</b>, dilakukan melalui katalog elektronik sesuai ketentuan yang berlaku dengan memperhatikan kesesuaian spesifikasi, kebutuhan produk, dan dokumen persiapan pengadaan.</p>
 <p class="bahp-inset">2) &nbsp; <b>Referensi Harga</b>, berdasarkan data referensi dari pelaku usaha yang tercatat dalam paket dan bukti Request For Information (RFI) atau sumber resmi lainnya. Bukti dan kesesuaiannya harus diverifikasi.</p>
 <p class="bahp-section"><b>D. &nbsp; HASIL PELAKSANAAN E-PURCHASING</b></p>
 <p class="bahp-section"><b>D.1. Pemenuhan Kriteria Spesifikasi</b></p>${assessments}
 <p>Berdasarkan hasil penilaian terhadap pemenuhan spesifikasi minimal maka pilihan diprioritaskan kepada :</p>
 <div class="bahp-info">${metar('Pelaku Usaha',chosenName)}${metar('Bentuk Usaha',selected.bentuk||selected.bentukUsaha||'-')}${metar('Status',selected.status||'-')}${metar('Tipe Penyedia',selected.tipe||'-')}${metar('Alamat',selected.alamat||'-')}</div>
 <p>Penetapan terhadap pelaku usaha tersebut di atas diambil dengan pertimbangan :</p><ol class="bahp-list"><li>Kesesuaian spesifikasi dan ketersediaan produk harus dibuktikan melalui hasil pemeriksaan dokumen dan etalase.</li><li>Harga dan bukti referensi dibandingkan melalui data penawaran/RFI yang tercatat; keputusan tetap memerlukan verifikasi Pejabat Pengadaan.</li></ol>
 <p class="bahp-section"><b>D.2. Negosiasi Teknis dan Harga</b></p>
 <p class="bahp-inset">a) &nbsp; <b>Negosiasi Teknis</b> dilakukan terhadap layanan yang diberikan agar dapat menyelesaikan sesuai spesifikasi yang disepakati, dengan tetap memperhatikan waktu.</p>
 <p class="bahp-inset">b) &nbsp; <b>Negosiasi harga</b> dilakukan berdasarkan riwayat harga transaksi terakhir/struktur pembentuk harga (bila ada), fitur harga terbaik pada aplikasi katalog elektronik (bila ada), sumber RFI dan/atau hasil pencarian internet yang dapat diverifikasi.</p>
 <p class="bahp-inset">c) &nbsp; Hasil negosiasi harga sebagai berikut :</p>
 <table class="bahp-grid bahp-negotiation">${head(['No.','Jenis Barang/Jasa','Vol.','Harga Satuan Hasil Negosiasi','Ongkos Kirim','Jumlah Total Hasil Negosiasi'],[1,2,3,4,5,6])}<tbody>${negotable}<tr><td colspan="5" class="bahp-right">Sub Total</td><td class="bahp-money">${chosen?rp(base):'-'}</td></tr><tr><td colspan="5" class="bahp-right">PPN (termasuk dalam harga satuan, informasi)</td><td class="bahp-money">${pricing?.verified?rp(pricing.tax):'-'}</td></tr><tr><td colspan="5" class="bahp-right">Ongkos kirim paket (tidak dialokasikan per rincian)</td><td class="bahp-money">${chosen?rp(shipping):'-'}</td></tr><tr><td colspan="5" class="bahp-right"><b>Total${shipping?' (termasuk ongkir)':''}</b></td><td class="bahp-money"><b>${chosen?rp(final):'-'}</b></td></tr></tbody></table>
 <p class="bahp-small">${ppnNote} ${shipping?'Ongkos kirim total yang dicatat: '+rp(shipping)+'; pembebanan per item belum tersedia.':''} ${chosen?'Penyedia dicatat sebagai pemenang manual; seluruh bukti administrasi dan teknis tetap perlu diverifikasi.':'Penetapan akhir penyedia belum tervalidasi.'}</p>
 <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
 <div class="bahp-signatures"><div><span>Disetujui oleh,</span><span>PA / KPA / PPK</span>${satriaBahpSignerVisual(approver,p)}<b><u>${esc(approver.nama)}</u></b><span>NIP. ${esc(approver.nip||'-')}</span></div><div><span>Dipesan oleh,</span><span>Pejabat Pengadaan</span>${satriaBahpSignerVisual(officer,p)}<b><u>${esc(officer.nama)}</u></b><span>NIP. ${esc(officer.nip||'-')}</span></div></div></div>`;
}
const LT=rows=>`<table class="tbl-meta" style="border:0">${rows.map(([a,b])=>`<tr><td style="border:0;width:170px">${a}</td><td style="border:0">: ${esc(b)}</td></tr>`).join('')}</table>`;
const KAB=()=>satriaPemdaOfficial('nama').replace(/^PEMERINTAH (KABUPATEN )?/,'');
function idkb(p){
 // Pedoman Identifikasi Kebutuhan: formulir dua kolom pengesahan pada AKHIR dokumen.
 // Nilai berasal dari paket dan Data Master, tidak menyalin angka/nama pada foto pedoman.
 const k=PJ(p.ppk),o=OP(p);
 const staf=(S.pejabat||[]),penId=String(p.idkbPenyusunId||p.pp||'');
 const penyusun=staf.find(x=>String(x.id)===penId&&String(x.opd)===String(p.opd))||null;
 const text=x=>esc(String(x??'')), nl=x=>text(x||'-').replace(/\r?\n/g,'<br>');
 const titleCase=x=>String(x||'').toLowerCase().replace(/(^|\s)[a-z]/g,m=>m.toUpperCase());
 const dateLong=x=>{
   if(!x)return 'Belum diisi';
   const d=new Date(String(x).slice(0,10)+'T00:00:00');
   return Number.isNaN(d.valueOf())?text(x):d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
 };
 const itemRows=(p.items||[]).map((it,n)=>`<li>${itemLabel(it)}</li>`).join('')||'<li>Rincian barang/jasa belum dicatat.</li>';
 const volRows=(p.items||[]).map((it,n)=>`<tr><td class="idkb-desc">${n+1}. ${itemLabel(it)}</td><td class="idkb-eq">=</td><td class="idkb-vol">${vf(it.vol)} ${text(it.satuan||'')}</td></tr>`).join('')||'<tr><td colspan="3">Belum ada rincian kebutuhan.</td></tr>';
 const suppliers=(p.penawaran||[]).map((w,n)=>{
   const pen=PY(w.pen)||{};
   const source=String(pen.link||'').trim();
   const safeLink=/^https:\/\/[^\s\"'<>]+$/i.test(String(source))?String(source):'';
   return `<li><b>${text(pen.nama||'Penyedia belum dilengkapi')}</b>${safeLink?`<div class="idkb-link"><a href="${text(safeLink)}">${text(safeLink)}</a></div>`:'<div class="idkb-muted">Link katalog belum dicatat</div>'}</li>`;
 }).join('')||'<li>Belum ada referensi penyedia pada paket.</li>';
 const jawaban=(p.idkbJabatanPenyusun||penyusun?.jabatan||penyusun?.namaJabatan||penyusun?.bidang||'').trim();
 const namaPenyusun=penyusun?.nama||'Belum ditentukan';
 const nipPenyusun=penyusun?.nip||'-';
 const province=titleCase(satriaPemdaOfficial('nama')||'[Nama pemerintah daerah belum diatur]');
 const row=(key,val)=>`<tr><td class="idkb-label">${key}</td><td class="idkb-colon">:</td><td class="idkb-value">${val}</td></tr>`;
 const info=[
  row('Pemerintah Daerah',text(province)),
  row('PA/KPA/PPK *)',text(k.nama||'Belum ditentukan')),
  row('Program',nl(progOf(p))),row('Kegiatan',nl(kegOf(p))),row('Sub Kegiatan',nl(subOf(p))),
  row('Output',nl(outOf(p))),row('Jenis Pengadaan',`<b><u>${text(p.jenisPengadaan||'Belum diisi')}</u></b>`)
 ].join('');
 const priorities=String(p.prioritasBarang||p.prioritas||'').trim();
 const prefer=priorities?nl(priorities):'Prioritas PDN, TKDN, UMKM dan produk lokal diperiksa sesuai informasi paket serta ketentuan pengadaan yang berlaku.';
 // Rangka pengesahan khusus dua kolom sesuai foto pedoman. Tidak boleh masuk ke metadata/Output.
 const approvedBy=`Ditetapkan oleh,<br>PA/KPA/PPK<br>${text(o.nama||'')}`;
 const assembledBy=`Disusun oleh,${jawaban?`<br>${nl(jawaban)}`:'<br>Jabatan penyusun belum dicatat'}`;
 return `<div class="satria-idkb-form${(p.items||[]).length>18?' idkb-long':''}" data-satria-idkb-reference="pedoman-2026">
  <p class="satria-idkb-title"><b><u>FORMULIR IDENTIFIKASI KEBUTUHAN</u></b></p>
  <div class="satria-idkb-sheet">
   <table class="satria-idkb-info-table" data-satria-idkb-section="metadata"><tbody>${info}</tbody></table>
   <section class="satria-idkb-section"><h3>A. Identifikasi Jenis/Tipe Barang/Jasa</h3>
    <div class="idkb-subhead">a) Identifikasi barang/jasa yang dibutuhkan :</div><ol class="idkb-list">${itemRows}</ol>
    <div class="idkb-subhead">b) Jumlah kebutuhan barang/jasa :</div>
    <table class="idkb-quantity-table"><tbody>${volRows}</tbody></table>
    <table class="idkb-extra-table"><tbody>
     ${row('c) Waktu pemanfaatan barang/jasa',nl(p.bulanPelaksanaan||'Belum diisi'))}
     ${row('d) Perkiraan waktu (termasuk pengiriman)',`${p.masaHk?text(p.masaHk)+' Hari Kalender':'Belum diisi'}`)}
     ${row('e) Terdapat di Katalog LKPP',nl(p.katalogRef||'Belum dicatat'))}
     ${row('f) Perkiraan Biaya',p.pagu>0?`Rp ${nf(p.pagu)}`:'Belum diisi')}
    </tbody></table>
   </section>
   <section class="satria-idkb-section"><h3>B. Spesifikasi Teknis Minimal Barang/Jasa</h3>
    ${(p.items||[]).length>12?`<p>Spesifikasi minimal untuk ${p.items.length} rincian tercantum pada daftar kebutuhan bagian A dan dokumen spesifikasi teknis per barang; kesesuaian produk wajib diverifikasi.</p>`:`<ol class="idkb-list">${itemRows}</ol>`}
   </section>
   <section class="satria-idkb-section"><h3>C. Ketersediaan Produk dan Pelaku Usaha</h3>
    <p>Referensi ketersediaan produk dan penyedia sesuai informasi yang tercatat untuk paket:</p><ol class="idkb-suppliers">${suppliers}</ol>
   </section>
   <section class="satria-idkb-section"><h3>E. Penentuan Prioritas Barang/Jasa</h3><p>${prefer}</p></section>
  </div>
  <table class="satria-idkb-sign-table" data-satria-idkb-section="signatures"><tbody>
   <tr class="idkb-date-row"><td>Disusun pada tanggal</td><td>${dateLong(p.tglIdkb||p.tglNodis)}</td></tr>
   <tr class="idkb-approval-row"><td class="satria-idkb-approval-cell" data-satria-idkb-section="approval">
     ${approvedBy}<div class="idkb-sig-media">${sigImg(k)}</div>
     <div class="idkb-sign-identity"><b><u>${text(k.nama||'Belum ditentukan')}</u></b><div>NIP. ${text(k.nip||'-')}</div></div>
    </td><td class="idkb-preparer-cell">${assembledBy}
      <div class="idkb-preparer-space" aria-hidden="true"></div>
      <div class="idkb-sign-identity"><b><u>${text(namaPenyusun)}</u></b><div>NIP. ${text(nipPenyusun)}</div></div>
    </td></tr>
  </tbody></table>
 </div>`;
}
function rfi(p){const rows=[];p.penawaran.forEach(w=>p.items.forEach(i=>{if((+w.harga[i.id]||0)>0)rows.push({w,i,h:+w.harga[i.id]})}));
const en2=n=>nf(n); // Harga rupiah dibulatkan, tanpa .00 dan koma ribuan Inggris
const vTot=p.items.reduce((s,x)=>s+(+x.vol||0),0)||1;
const TH='border:1px solid #000;background:#c8c8c8;font-weight:700;text-align:center;vertical-align:middle';
const TD='border:1px solid #000;vertical-align:top';
const W=[3,8,12,6,4,4,6,4,6,7,6,8,4,8,9,5];const cg='<colgroup>'+W.map(w=>`<col style="width:${w}%">`).join('')+'</colgroup>';
const head=`<thead><tr><th rowspan=2 style="${TH}">NO</th><th rowspan=2 style="${TH}">PENYEDIA</th><th rowspan=2 style="${TH}">NAMA PRODUK TAYANG</th><th colspan=12 style="${TH}">UNSUR PENILAIAN</th><th rowspan=2 style="${TH}">KET.</th></tr><tr>${['Spesifikasi','PDN Produk','UMKM','LOKASI','PDN Penyedia','STATUS KATALOG','HARGA SATUAN','ONGKIR','HARGA SATUAN + ONGKIR','QTY','TOTAL HARGA','LINK'].map(t=>`<th style="${TH}">${t}</th>`).join('')}</tr></thead>`;
const body=rows.map(({w,i,h},n)=>{const y=PY(w.pen);const ref=(w.catalogRefs||{})[i.id]||{};const ong=+w.ongkir||0;const ongU=0; // ongkir paket tidak dialokasikan ke setiap barang tanpa dasar

return `<tr class="${rows.length>=7&&rows.length<=12&&n===Math.ceil(rows.length/2)?'satria35912-rfi-half-break':''}"><td style="${TD};text-align:center">${n+1}</td><td style="${TD}"><b>${esc(y.nama)}</b></td><td style="${TD}">${esc(ref.name||i.nama)}</td><td style="${TD};text-align:center">${esc(ref.spec||i.spesifikasi||'Spesifikasi perlu dicocokkan')}</td><td style="${TD};text-align:center">${esc(i.pdn||'Perlu verifikasi')}</td><td style="${TD};text-align:center">${y.tipe==='UMKM'?'Ya':(y.tipe?'Tidak':'Perlu verifikasi')}</td><td style="${TD};text-align:center">${esc(y.kabupaten||y.alamat||'-')}</td><td style="${TD};text-align:center">${esc(y.pdn||i.pdn||'Perlu verifikasi')}</td><td style="${TD};text-align:center">${esc(y.statusKatalog||'Perlu verifikasi')}</td><td style="${TD};text-align:right;white-space:nowrap">Rp ${en2(h)}</td><td style="${TD};text-align:right;white-space:nowrap">${ong?'Ongkir paket': 'Rp -'}</td><td style="${TD};text-align:right;white-space:nowrap">Rp ${en2(h+ongU)}</td><td style="${TD};text-align:center;white-space:nowrap">${vf(i.vol)}</td><td style="${TD};text-align:right;white-space:nowrap">Rp ${en2(i.vol*(h+ongU))}</td><td style="${TD};word-break:break-all">${(ref.link||y.link)?`<a href="${esc(ref.link||y.link)}" style="color:#1d4ed8;text-decoration:underline">${esc(ref.link||y.link)}</a>`:'-'}</td><td style="${TD}"></td></tr>`}).join('');
return `<p style="text-align:center;margin:0 0 10px"><b><u>HASIL REQUEST FOR INFORMATION (RFI) PENYEDIA BARANG/JASA ATAU ANALISIS PASAR PRA E-PURCHASING</u></b></p>
<table class="tbl-rfi" style="border-collapse:collapse;width:100%;table-layout:fixed">${cg}${head}<tbody>${body||`<tr><td colspan=16 style="${TD}">Belum ada data RFI; lengkapi penyedia dan harga tayang pada menu Penawaran dan Negosiasi.</td></tr>`}</tbody></table><p class="doc-note"><b>Catatan ongkos kirim:</b> Ongkir disimpan per penyedia dan tidak dibagi per unit barang tanpa dasar alokasi. ${p.penawaran.map(w=>`${esc(PY(w.pen).nama)}: ${rp(Number(w.ongkir)||0)}`).join(' · ')}. Total pada tabel hanya harga tayang barang; tambah ongkir sekali di ringkasan paket bila relevan.</p>`;}
function survei(p){const W=p.penawaran,H=hps(p);return `${kop(p)}<p class="doc-title" style="text-align:center"><b><u>SURVEI PASAR / REFERENSI HARGA</u></b></p>
${LT([['Nama Paket',p.nama],['Kode RUP',p.rup],['Pagu',rp(p.pagu)],['Nilai HPS',rp(H)],['Sumber referensi','Sumber bukti harga dan tanggal yang dicatat pada masing-masing penawaran penyedia']])}
<p class="doc-section-heading"><b>A. Perbandingan harga per barang</b></p><table class="tbl-price-matrix"><thead><tr><th>No</th><th>Item Barang dan Spesifikasi Minimal</th><th>Volume</th><th>Satuan</th><th class=n>Harga Satuan HPS</th><th class=n>Jumlah HPS</th>${W.map(w=>`<th class=n>${esc(PY(w.pen).nama)}<br>Harga Satuan</th>`).join('')}</tr></thead><tbody>
${p.items.map((i,n)=>`<tr><td>${n+1}</td><td>${itemLabel(i)}</td><td class=n>${vf(i.vol)}</td><td>${esc(i.satuan)}</td><td class=n>${nf(i.hs)}</td><td class=n>${nf(i.vol*i.hs)}</td>${W.map(w=>`<td class=n>${(+w.harga[i.id]||0)?nf(w.harga[i.id]):'-'}</td>`).join('')}</tr>`).join('')}
<tr><th colspan=5 style="text-align:right">Total</th><th class=n>${nf(H)}</th>${W.map(w=>`<th class=n>${nf(totPw(p,w,false))}</th>`).join('')}</tr></tbody></table>
<p class="doc-section-heading"><b>B. Profil penyedia dan sumber referensi</b></p><table class="tbl-supplier-profile"><thead><tr><th>No</th><th>Penyedia</th><th>Alamat</th><th>Status</th><th>Tipe</th><th>Link/Sumber</th><th>Sumber harga</th><th>Tanggal harga</th><th class=n>Ongkir (terpisah)</th><th class=n>Total harga tayang</th><th class=n>Total negosiasi</th></tr></thead><tbody>${W.map((w,n)=>{const y=PY(w.pen);return `<tr><td>${n+1}</td><td>${esc(y.nama)}</td><td>${esc(y.alamat||'-')}</td><td>${esc(y.status||'-')}</td><td>${esc(y.tipe||'-')}</td><td>${y.link?`<a href="${esc(y.link)}">${esc(y.link)}</a>`:'Belum dicatat'}</td><td>${esc(satriaOfferPriceSource(w)||'Belum dicatat')}</td><td>${tg(w.tanggalHarga)}</td><td class=n>${nf(w.ongkir||0)}</td><td class=n>${nf(totPw(p,w,false))}</td><td class=n>${nf(totPw(p,w,true))}</td></tr>`}).join('')||'<tr><td colspan=11>Belum ada referensi penyedia.</td></tr>'}</tbody></table>
<p><b>Catatan analisis:</b> bandingkan kesesuaian spesifikasi, harga satuan, ongkos kirim, status katalog, lokasi, PDN/UMKM, serta kelengkapan bukti. Nilai kosong tidak diperlakukan sebagai harga nol.</p>${sig(PJ(p.pp),'Pejabat Pengadaan,')}`}
function bahepe(p){
const W=Array.isArray(p.penawaran)?p.penawaran:[],o=OP(p);
const en0=n=>nf(n);
const money=n=>(n===null||n===undefined||n==='')?'Rp -':`Rp ${en0(n)}`;
const quoteMoney=n=>(+n>0)?money(n):'Rp -';
const sat=['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan'];
const eja=n=>{n=Math.floor(Math.abs(+n||0));if(n<10)return sat[n];if(n===10)return 'Sepuluh';if(n===11)return 'Sebelas';if(n<20)return sat[n-10]+' Belas';const t=Math.floor(n/10),r=n%10;return (sat[t]||String(t))+' Puluh'+(r?' '+sat[r]:'')};
const ejaTahun=y=>y>=2000?'Dua Ribu'+(y%1000?' '+eja(y%1000):''):eja(y);
const d=p.tglEvaluasi?new Date(p.tglEvaluasi+'T00:00:00'):null;
const cap=s=>s?String(s).charAt(0).toUpperCase()+String(s).slice(1):'';
const hariTanggal=d?`${cap(d.toLocaleDateString('id-ID',{weekday:'long'}))} Tanggal ${eja(d.getDate())} Bulan ${d.toLocaleDateString('id-ID',{month:'long'})} Tahun ${ejaTahun(d.getFullYear())}`:'[hari dan tanggal evaluasi belum diisi]';
const TB='border:1px solid #000;padding:3px 4px;vertical-align:middle';
const NB='border:0;padding:1px 0;vertical-align:top;text-align:left';
const nama=w=>w?String((PY(w.pen)||{}).nama||'Penyedia belum ditentukan'):'Belum ada penyedia';
const PCols=W.length?W:[null];
const asp=[
 ['NIB/OSS; NPWP',(y,w)=>y.nib&&y.npwp?'Ada':null],
 ['KBLI',(y,w)=>y.kbli?'Ada':null],
 ['Tidak sedang dikenakan Sanksi Daftar Hitam',(y,w)=>!y.daftarHitam||y.daftarHitam==='Perlu verifikasi'?null:(y.daftarHitam==='Tidak'?'Ya':'Tidak')],
 ['Status Penyedia Terdaftar aktif di katalog elektronik LKPP',(y,w)=>y.statusKatalog&&y.statusKatalog!=='Perlu verifikasi'?y.statusKatalog:null],
 ['Jenis Penyedia UMKM',(y,w)=>!y.tipe||y.tipe==='Perlu verifikasi'?null:(y.tipe==='UMKM'||y.tipe==='Koperasi'?'Ya':'Tidak')],
 ['Alamat penyedia sesuai wilayah instansi',(y,w)=>{const wilayah=satriaPemdaOfficial('kota');if(!y.kabupaten||!wilayah)return null;return String(y.kabupaten).toLocaleLowerCase('id-ID').includes(wilayah.toLocaleLowerCase('id-ID'))?'Ya':'Tidak'}],
 ['Barang di Etalase minimal menampilkan (Nama produk, harga, no. KBKI, satuan produk, berat produk dan dimensi produk)',(y,w)=>null],
 ['Jenis Produk PDN',(y,w)=>y.pdn==='PDN'?'Ya':y.pdn==='Impor'?'Tidak':null],
 ['Spesifikasi',(y,w)=>p.items.length&&p.items.every(i=>String(i.spesifikasi||'').trim())?'Sesuai Kebutuhan':null],
 ['Jaminan Bebas Cacat Mutu dan Garansi',null],
 ['Menjamin ketersediaan Barang dan/atau Jasa yang sesuai dengan spesifikasi',null],
 ['Memastikan kesesuaian informasi Barang dan/atau Jasa Produk yang diunggah pada Katalog Elektronik sesuai',null],
 ['Penyedia bersedia memberikan layanan tambahan yang diperjanjikan seperti instalasi, testing, asuransi dan pelatihan (apabila ada).',null],
 ['Layanan jasa pengiriman disiapkan oleh Penyedia',null]
];
const evalValue=(fn,w)=>{if(!w)return 'Perlu verifikasi';const y=PY(w.pen)||{};const v=fn?fn(y,w,p):null;return v===null||v===undefined||v===''?'Perlu verifikasi':String(v)};
const admCompact=W.length<=3;
const admColWidths=admCompact?[`<col style="width:6%">`,`<col style="width:32%">`,...PCols.map(()=>`<col style="width:${(51/PCols.length).toFixed(3)}%">`),`<col style="width:11%">`].join(''):[`<col style="width:4%">`,`<col style="width:36%">`,...PCols.map(()=>`<col style="width:${(48/PCols.length).toFixed(3)}%">`),`<col style="width:12%">`].join('');
const aspRows=asp.map(([a,fn],n)=>`<tr><td style="${TB};text-align:center">${n+1}</td><td style="${TB}">${esc(a)}</td>${PCols.map(w=>`<td style="${TB};text-align:center">${esc(evalValue(fn,w))}</td>`).join('')}<td style="${TB}"></td></tr>`).join('');
const low=i=>{const arr=W.map(w=>({w,price:+(((w||{}).harga||{})[i.id])||0})).filter(x=>x.price>0);if(!arr.length)return null;const m=Math.min(...arr.map(x=>x.price));return {m,winners:arr.filter(x=>x.price===m).map(x=>x.w)};};
const itemColWidths=[`<col style="width:4%">`,`<col style="width:27%">`,`<col style="width:12%">`,...PCols.map(()=>`<col style="width:${(30/PCols.length).toFixed(3)}%">`),`<col style="width:10%">`,`<col style="width:17%">`].join('');
const itemRows=p.items.map((i,n)=>{const l=low(i);return `<tr><td style="${TB};text-align:center">${n+1}</td><td style="${TB}">${itemLabel(i)}</td><td style="${TB};text-align:right;white-space:nowrap">${money(i.hs)}</td>${PCols.map(w=>`<td style="${TB};text-align:right;white-space:nowrap">${w?quoteMoney((((w||{}).harga||{})[i.id])):'-'}</td>`).join('')}<td style="${TB};text-align:right;white-space:nowrap">${l?quoteMoney(l.m):'-'}</td><td style="${TB};overflow-wrap:anywhere">${l?esc(l.winners.map(w=>nama(w)).join(', ')):'Belum ada harga'}</td></tr>`}).join('');
const cnt=w=>p.items.filter(i=>{const l=low(i);return l&&l.winners.some(x=>x===w)}).length;
const rank=W.map((w,index)=>({w,cnt:cnt(w),index})).sort((a,b)=>b.cnt-a.cnt||a.index-b.index);
const maxCnt=rank.length?rank[0].cnt:0;
let rankNumber=0,previousCount=null;
const rankRows=rank.map((x,n)=>{if(previousCount===null||x.cnt!==previousCount)rankNumber=n+1;previousCount=x.cnt;const follow=maxCnt>0&&x.cnt===maxCnt?'Pembanding utama':'Pembanding lain';return `<tr><td style="${TB};text-align:center">${rankNumber}</td><td style="${TB}">${esc(nama(x.w))}</td><td style="${TB};text-align:center">${x.cnt}</td><td style="${TB}">${follow}</td></tr>`}).join('');
const top=rank.find(x=>maxCnt>0&&x.cnt===maxCnt);
const subKegiatanLines=value=>{
 const raw=String(value??'').replace(/\r\n?/g,'\n').trim();
 if(!raw)return '-';
 const separated=raw.replace(/([^\n])\s+(?=\d{1,2}\.\d{2}\.\d{2}\.\d{1,2}\.\d{2}\.\d{4}\s*[-–])/g,'$1\n');
 return separated.split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>`<div class="bahepe-sub-line">${esc(line)}</div>`).join('');
};
const dataUmum=[['Sub Kegiatan',subOf(p)||'-'],['Kode RUP',p.rup||'-'],['Pagu',money(p.pagu)],['Metode',p.metodePemilihan||'Perlu verifikasi'],['Nama Paket',p.nama||'-']].map(([a,b])=>{const value=a==='Sub Kegiatan'?subKegiatanLines(b):esc(b);return `<tr><td style="${NB};width:155px">${esc(a)}</td><td style="${NB};width:12px">:</td><td style="${NB}">${value}</td></tr>`}).join('');
const supplierCount=W.filter(w=>p.items.some(i=>(+(((w||{}).harga||{})[i.id])||0)>0)).length;
const kabupaten=satriaPemdaOfficial('nama').replace(/^PEMERINTAH (KABUPATEN |KOTA )?/,'').split(' ').filter(Boolean).map(w=>w[0]+w.slice(1).toLowerCase()).join(' ');
return `${kop(p)}<div class="bahepe-body">
<p class="bahepe-title"><b><u>BERITA ACARA HASIL EVALUASI PENYEDIA E-PURCHASING</u></b></p>
<p class="bahepe-number"><b>Nomor : ${esc(nomor('BAHEPE',p))}</b></p>
<p class="bahepe-intro">Pada hari ini ${esc(hariTanggal)} yang bertanda tangan di bawah ini selaku Pejabat Pengadaan pada ${esc(o.nama||'instansi')} telah melaksanakan verifikasi penyedia jasa melalui E-Purchasing, dengan hasil sebagai berikut:</p>
<p class="bahepe-section"><b>A. DATA UMUM</b></p>
<table class="tbl-letter-meta bahepe-meta" style="border:0;width:100%"><tbody>${dataUmum}</tbody></table>
<p class="bahepe-section"><b>B. EVALUASI ADMINISTRASI DAN TEKNIS</b></p>
<p class="bahepe-subtitle">Verifikasi Penyedia Jasa (berdasarkan persyaratan penyedia yang tercantum pada Dokumen Pengumuman Pendaftaran)</p>
<table class="tbl-bahepe-admin ${W.length<=3?'compact':'wide'}"><colgroup>${admColWidths}</colgroup><thead><tr><th rowspan="2">No</th><th rowspan="2">Aspek penilaian</th><th colspan="${PCols.length}">Penyedia</th><th rowspan="2">Ket</th></tr><tr>${PCols.map(w=>`<th>${esc(nama(w))}</th>`).join('')}</tr></thead><tbody>${aspRows}</tbody></table>
<p class="bahepe-section bahepe-section-c"><b>C. SURVEY HARGA PEMBANDING DENGAN NILAI TERENDAH</b></p>
<table class="tbl-bahepe-price"><colgroup>${itemColWidths}</colgroup><thead><tr><th>No</th><th>Item Barang dan Spek Minimal</th><th>Harga Satuan HPS</th>${PCols.map(w=>`<th>${esc(nama(w))}</th>`).join('')}<th>Terendah</th><th>Penyedia harga terendah (pembanding)</th></tr></thead><tbody>${itemRows||`<tr><td colspan="${PCols.length+5}">Belum ada rincian barang pada paket.</td></tr>`}</tbody></table>
<p class="bahepe-note">Dari beberapa penyedia yang mencantumkan harga masing-masing produk pada E-Katalog lokal ${esc(kabupaten||'-')} yang produknya sesuai dengan kebutuhan dan spesifikasi pada paket pekerjaan tersebut sebanyak ${supplierCount} penyedia. Hasil tangkap layar harga satuan tayang masing-masing penyedia terlampir pada lampiran Dokumen Persiapan Pengadaan (DPP).</p>
<div class="bahepe-rank-block"><p class="bahepe-section bahepe-section-d"><b>D. PERENGKINGAN HARGA TERENDAH</b></p>
<table class="tbl-bahepe-rank"><colgroup><col style="width:10%"><col style="width:40%"><col style="width:20%"><col style="width:30%"></colgroup><thead><tr><th>Rank</th><th>Nama Penyedia</th><th>Item Terendah</th><th>Status harga pembanding</th></tr></thead><tbody>${rankRows||`<tr><td colspan="4">Belum ada data penawaran penyedia.</td></tr>`}</tbody></table></div>
<p class="bahepe-note">Berdasarkan jumlah item dengan harga tayang terendah (informasi pembanding harga, bukan keputusan otomatis mengenai kualifikasi atau penetapan pemenang), penyedia pembanding teratas adalah:</p>
<p class="bahepe-selected"><b>${top?esc(nama(top.w)):'Belum dapat ditentukan'}</b></p>
<p class="bahepe-note"><b>Penyedia yang ditetapkan secara manual:</b> ${pemenang(p)?esc(PY(pemenang(p).w.pen).nama):'Belum ditetapkan'}. Peringkat harga di atas hanya alat bantu perbandingan. Proses selanjutnya memerlukan verifikasi administratif, teknis, persetujuan pejabat berwenang, dan bukti pendukung.</p>
<p class="bahepe-note">Demikian Berita Acara Pemilihan Calon Penyedia ini dibuat untuk dapat digunakan sebagaimana mestinya.</p>
<div class="bahepe-signature">${esc(o.nama||'')}<br>Pejabat Pengadaan<br>${sigImg(PJ(p.pp))}<b><u>${esc(PJ(p.pp).nama)}</u></b><br>NIP. ${esc(PJ(p.pp).nip)}</div>
</div>`;}
function metode(p){
 const o=OP(p), ppk=PJ(p.ppk), pp=PJ(p.pp);
 const tanggal=p.tglPenetapan||p.tglDpp||'';
 const tglRingkas=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';
 const h=s=>esc(s==null||String(s).trim()===''?'-':String(s)).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');
 const kepala=o.kop?`<div class=\"metode-letterhead-image\"><img src=\"${satriaSafeMediaSrc(o.kop)}\" alt=\"Kop surat OPD\"></div>`:`<table class=\"metode-kop-table\"><tbody><tr><td class=\"metode-kop-logo\">${S.pemda.logo?`<img src=\"${satriaSafeMediaSrc(S.pemda.logo)}\" alt=\"Logo pemerintah daerah\">`:''}</td><td class=\"metode-kop-text\"><div class=\"metode-kop-pemda\">${h(satriaPemdaOfficial('nama')||'[Nama pemerintah daerah belum diatur]')}</div><div class=\"metode-kop-opd\">${h(String(o.nama||'').toLocaleUpperCase('id-ID'))}</div><div class=\"metode-kop-address\">${h(o.alamat||'')}</div><div class=\"metode-kop-contact\">${h(o.kontak||'')}</div></td></tr></tbody></table><div class=\"metode-kop-rule\"></div>`;
 const pengadaan=String(p.jenisPengadaan||'jenis pengadaan belum diverifikasi').trim();
 const pengadaanDisplay=/^pengadaan\s+/i.test(pengadaan)?pengadaan:'Pengadaan '+pengadaan;
 const pengadaanRingkas=pengadaan.replace(/^pengadaan\s+/i,'');
 const metodeSumber=String(p.metodePemilihan||'Perlu verifikasi');
 const metodeLabel=/negosiasi/i.test(metodeSumber)?'Negosiasi Harga':metodeSumber;
 const specs=i=>{
   const name=String(i.nama||'').trim(), spec=String(i.spesifikasi||'').trim(), brand=String(i.merek||'').trim();
   const parts=[name||'-'];
   if(spec && !/spesifikasi\s*:/i.test(name)) parts.push('Spesifikasi: '+spec);
   if(brand && !parts.join(' ').toLocaleLowerCase('id-ID').includes(brand.toLocaleLowerCase('id-ID'))) parts.push('Merek/tipe: '+brand);
   return h(parts.join('  '));
 };
 const metaRows=[
  ['Pemerintah Daerah',satriaPemdaOfficial('nama')||'[Nama pemerintah daerah belum diatur]'],
  ['PA/KPA/PPK *)',ppk.nama||'-',true],
  ['Sub Kegiatan',subOf(p)||'-',false],
  ['Masa Pelaksanaan',(p.masaHk||'-')+' Hari Kerja',true],
  ['Output',outOf(p)||'-',false],
  ['Jenis Pengadaan',pengadaanDisplay,true],
  ['Nama Paket',p.nama||'-',true]
 ].map(([a,b,bold=false])=>`<tr><td class="metode-meta-label">${h(a)}</td><td class="metode-meta-colon">:</td><td class="metode-meta-value">${bold?`<b>${h(b)}</b>`:h(b)}</td></tr>`).join('');
 const rowsA=(p.items||[]).map((i,n)=>`<tr><td class="metode-no">${n+1}.</td><td>${h(i.nama||'-')}</td><td class="metode-qty">${vf(i.vol)}</td><td>${h(i.satuan||'-')}</td></tr>`).join('')||'<tr><td colspan="4" class="metode-empty">Belum ada rincian barang/jasa.</td></tr>';
 const rowsB=(p.items||[]).map((i,n)=>`<tr><td class="metode-no">${n+1}.</td><td colspan="3">${specs(i)}</td></tr>`).join('')||'<tr><td class="metode-no">1.</td><td colspan="3">Spesifikasi minimal belum diisi.</td></tr>';
 const criteria=[
  ['Cara pengiriman','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Cara pengangkutan','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Cara pemasangan','-'],
  ['Cara penyimpanan','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Cara pengoperasian/penggunaan','-'],
  ['Kebutuhan pelatihan untuk pengoperasian/pemeliharaan Barang','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Jaminan Bebas Cacat Mutudan Garansi','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Menjamin ketersediaan Barang dan/atau Jasa yang sesuai dengan spesifikasi','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Aspek pengadaan berkelanjutan','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Metode Pemilihan','Perlu konfirmasi berdasarkan ketentuan paket'],
  ['Metode Pembayaran','Perlu konfirmasi berdasarkan ketentuan paket']
 ].map(([a,b],n)=>`<tr><td class="metode-no">${n+1}.</td><td>${h(a)}</td><td colspan="2">${h(b)}</td></tr>`).join('');
 const signImage=x=>`<div class="metode-sign-visual">${(x.ttd||x.cap)?`${x.ttd?`<img class="metode-ttd" src="${esc(x.ttd)}" alt="Tanda tangan">`:''}${x.cap?`<img class="metode-cap" src="${esc(x.cap)}" alt="Cap/stempel">`:''}`:''}</div>`;
 return `${kepala}
 <div class="metode-form-body">
  <p class="metode-form-title"><b><u>FORMULIR PENETAPAN BARANG/JASA E-PURCHASING</u></b></p>
  <table class="metode-change-table"><tbody>
   <tr><td>Perubahan ke :</td><td></td></tr>
   <tr><td>Tanggal :</td><td>${h(tglRingkas(tanggal))}</td></tr>
  </tbody></table>
  <table class="metode-meta-table"><tbody>${metaRows}</tbody></table>
  <table class="metode-main-table">
   <colgroup><col class="metode-col-no"><col class="metode-col-label"><col class="metode-col-qty"><col class="metode-col-unit"></colgroup>
   <thead><tr class="metode-column-head"><th>No</th><th>JENIS BARANG/JASA</th><th>JUMLAH</th><th>SATUAN</th></tr></thead>
   <tbody>
    <tr class="metode-section"><td>A</td><td colspan="3">Meliputi Pengadaan ${h(pengadaanRingkas)} :</td></tr>
    ${rowsA}
    <tr class="metode-section"><td>B</td><td colspan="3">Spesifikasi Minimal</td></tr>
    ${rowsB}
    <tr class="metode-section"><td>C</td><td colspan="3">Persyaratan Lain Yang Diperlukan</td></tr>
    ${criteria}
    <tr class="metode-section satria35912-page-second"><td>D</td><td colspan="3">PENETAPAN METODE E-PURCHASING</td></tr>
    <tr><td class="metode-no">1.</td><td>Penetapan Metode E-Purchasing</td><td colspan="2">${h(metodeLabel)}</td></tr>
    <tr class="metode-basis-row"><td class="metode-no">2.</td><td>Dasar Pemilihan Metode E-Purchasing <i>(termasuk justifikasi memilih penyedia secara berulang)</i></td><td colspan="2">
     Dasar memilih Metode E-Purchasing dengan Negosiasi melalui Katalog Elektronik LKPP dipilih berdasarkan pertimbangan berikut:
     <ol class="metode-reasons" type="a">
      <li><b>Efisiensi Waktu:</b> E-Purchasing memungkinkan proses pengadaan yang lebih cepat dibandingkan metode lain, mengurangi waktu administratif dan prosedural.</li>
      <li><b>Transparansi:</b> Harga dan spesifikasi produk sudah tercantum dalam Katalog Elektronik, meningkatkan transparansi dan mengurangi risiko mark-up harga.</li>
      <li><b>Kemudahan Komparasi:</b> Katalog Elektronik memungkinkan perbandingan langsung antara berbagai produk dan penyedia, memudahkan pemilihan opsi terbaik sesuai kebutuhan dan anggaran.</li>
     </ol>
    </td></tr>
    <tr class="metode-section"><td>E</td><td colspan="3">CATATAN LAINNYA</td></tr>
    <tr><td colspan="4" class="metode-notes">Penyedia wajib memenuhi tingkat layanan meliputi ketepatan waktu, kesesuaian spesifikasi, kualitas hasil, ketepatan jumlah, responsivitas, pengemasan dan pengiriman, jaminan/garansi, fleksibilitas layanan, kepatuhan administratif, serta standar keamanan dan kepatuhan. Penyedia juga wajib menindaklanjuti setiap ketidaksesuaian melalui perbaikan atau penggantian tanpa biaya tambahan sesuai ketentuan yang disepakati serta bertanggung jawab penuh atas pengadaan.</td></tr>
   </tbody>
  </table>
  <table class="metode-signature-table"><tbody>
   <tr class="metode-sign-date"><td>Ditetapkan pada tanggal</td><td>${h(tglRingkas(tanggal))}</td></tr>
   <tr class="metode-sign-head"><td>Ditetapkan oleh<br>PA/KPA/PPK</td><td>Disusun oleh<br>Pejabat Pengadaan</td></tr>
   <tr class="metode-sign-people">
    <td>${signImage(ppk)}<b><u>${h(ppk.nama)}</u></b><br>NIP. ${h(ppk.nip||'-')}</td>
    <td>${signImage(pp)}<b><u>${h(pp.nama)}</u></b><br>NIP. ${h(pp.nip||'-')}</td>
   </tr>
  </tbody></table>
  <div class="metode-footnote"><b>Catatan :</b><br>Terlampir tahap persiapan melalui <i>Request For Information (RFI)</i> Pra E-Purchasing</div>
 </div>`;
}
function spek(p){
const o=OP(p),W=p.penawaran||[];
const TS=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';
const H=hps(p);
const lokasi=p.lokasiPengiriman||o.tempat||o.alamat||o.nama||'-';
const daftarSub=String(subOf(p)||'-').replace(/\s+(?=\d{1,2}(?:\.\d{1,2}){4}\.\d{4}\s*[-–])/g,'\n').split(/\n|(?=\b\d{1,2}(?:\.\d{1,2}){4}\.\d{4}\s*[-–])/g).map(x=>x.trim()).filter(Boolean).map(x=>esc(x)).join('<br>');
const itemRows=(p.items||[]).map((i,n)=>`<tr>
<td style="text-align:center">${n+1}.</td>
<td>${esc(i.nama||'-')}${i.spesifikasi?`<br>Spesifikasi: ${esc(i.spesifikasi)}`:''}</td>
<td style="text-align:center">${vf(i.vol)}</td>
<td style="text-align:center">${esc(i.satuan||'-')}</td>
<td style="text-align:right;white-space:nowrap">${nf(i.hs)}</td>
<td></td>
</tr>`).join('')||'<tr><td colspan="6">Rincian barang belum diisi.</td></tr>';
const catalog=W.map(w=>{const y=PY(w.pen);return y.link?`<a href="${esc(y.link)}">${esc(y.link)}</a>`:esc(y.nama||'')}).filter(Boolean).join('<br>')||'Belum dicatat';
const cell='border:1px solid #222;padding:3px 4px;vertical-align:top;';
const inner=`<table style="width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed">
<thead><tr>
<th style="${cell}width:6%">No</th><th style="${cell}width:48%">Nama Barang dan Spesifikasi</th><th style="${cell}width:10%">Kua</th><th style="${cell}width:11%">Satuan</th><th style="${cell}width:15%">Harga Satuan (Rp)</th><th style="${cell}width:10%">Ket.</th>
</tr></thead><tbody>${itemRows}</tbody></table>`;
return `${kop(p)}
<div class="spek-pdf">
<p class="spek-title">SPESIFIKASI TEKNIS PAKET E-PURCHASING</p>
<table class="spek-meta">
<tr><td class="label">Program</td><td class="colon">:</td><td class="value">${esc(progOf(p)||'-')}</td></tr>
<tr><td class="label">Kegiatan</td><td class="colon">:</td><td class="value">${esc(kegOf(p)||'-')}</td></tr>
<tr><td class="label">Sub Kegiatan</td><td class="colon">:</td><td class="value">${daftarSub}</td></tr>
<tr><td class="label">Lokasi</td><td class="colon">:</td><td class="value">${esc(lokasi)}</td></tr>
<tr><td class="label">Nama Paket Pengadaan</td><td class="colon">:</td><td class="value">${esc(p.nama||'-')}</td></tr>
</table>
<table class="spek-main">
<colgroup><col class="no"><col class="element"><col class="description"><col class="note"></colgroup>
<thead><tr><th>No</th><th>Elemen Spesifikasi</th><th>Uraian Spesifikasi</th><th>Keterangan</th></tr></thead>
<tbody>
${(p.items||[]).length>8 ? (p.items||[]).map((it,index)=>`<tr class="satria35911-long-item"><td class="no">${index===0?'1.':''}</td><td>${index===0?'Jenis, Spesifikasi, Kuantitas, Satuan dan Harga':'Rincian barang '+(index+1)}</td><td>${index+1}. ${esc(it.nama||'-')}${it.spesifikasi?`<div>Spesifikasi: ${esc(it.spesifikasi)}</div>`:''}<div>Volume ${vf(it.vol)} ${esc(it.satuan||'-')} · Harga satuan ${nf(it.hs)}</div></td><td></td></tr>`).join('') : `<tr><td class="no">1.</td><td>Jenis, Spesifikasi, Kuantitas, Satuan dan Harga</td><td style="padding:0">${inner}</td><td></td></tr>`}
<tr><td class="no">2.</td><td>Tempat</td><td colspan="2">${esc(lokasi)}</td></tr>
<tr><td class="no">3.</td><td>Waktu</td><td colspan="2">${esc(p.masaHk||'-')} Hari Kerja</td></tr>
<tr><td class="no">4.</td><td>Tingkat Layanan</td><td colspan="2">Penyedia wajib memenuhi tingkat layanan meliputi ketepatan waktu, kesesuaian spesifikasi, kualitas hasil, ketepatan jumlah, responsivitas, pengemasan dan pengiriman, jaminan/garansi, fleksibilitas layanan, kepatuhan administratif, serta standar keamanan dan kepatuhan. Penyedia juga wajib menindaklanjuti setiap ketidaksesuaian melalui perbaikan atau penggantian tanpa biaya tambahan sesuai ketentuan yang disepakati serta bertanggung jawab penuh atas pengadaan.</td></tr>
<tr><td colspan="4"><b>Link E-Catalog :</b><br>${catalog}<br><br>Di akses tanggal, &nbsp; ${TS(p.tglDpp)}</td></tr>
</tbody></table>
<div class="spek-sign">${esc(satriaDppOfficialPlace(p))}, ${TS(p.tglDpp)}<br>Ditetapkan oleh :<br>Pejabat Pembuat Komitmen (PPKom)<br>${esc(o.nama||'')}<br><br><br><b>${esc(PJ(p.ppk).nama||'-')}</b><br>NIP. ${esc(PJ(p.ppk).nip||'-')}</div>
</div>`;
}
function lamp(p){const H=hps(p);return `${kop(p)}<p class="doc-title" style="text-align:center"><b><u>LAMPIRAN REFERENSI HARGA KATALOG ELEKTRONIK</u></b><br>Nomor Lampiran: ${satriaDppNumber(p)}</p>
${LT([['Nama Paket',p.nama],['Kode RUP',p.rup],['Tanggal dokumen',tg(p.tglDpp)],['Nilai HPS',rp(H)]])}
${p.penawaran.map((w,k)=>{const y=PY(w.pen),rows=p.items.map((i,n)=>({i,n,h:+w.harga[i.id]||0})).filter(x=>x.h>0);return `<p><b>Referensi Harga ${k+1}</b></p>${LT([['Penyedia',y.nama],['Alamat',y.alamat||'-'],['Status/Tipe',(y.status||'-')+' / '+(y.tipe||'-')],['Link toko',y.link||'Belum dicatat'],['Total harga tercatat',rp(totPw(p,w,false))]])}<table class="tbl-reference-items"><thead><tr><th>No</th><th>Nama Produk / Spesifikasi</th><th>Volume</th><th>Satuan</th><th class=n>Harga Satuan (Rp)</th><th class=n>Jumlah (Rp)</th></tr></thead><tbody>${rows.map(({i,n,h})=>`<tr><td>${n+1}</td><td>${itemLabel(i)}${(w.catalogRefs||{})[i.id]?.name?`<div class="satria-doc-subnote">Produk: ${esc(w.catalogRefs[i.id].name)}</div>`:''}${(w.catalogRefs||{})[i.id]?.link?`<div class="satria-doc-subnote">Tautan: ${esc(w.catalogRefs[i.id].link)}</div>`:''}${(w.catalogRefs||{})[i.id]?.date?`<div class="satria-doc-subnote">Tanggal referensi: ${esc(satriaDateId(w.catalogRefs[i.id].date))}</div>`:''}</td><td class=n>${vf(i.vol)}</td><td>${esc(i.satuan)}</td><td class=n>${nf(h)}</td><td class=n>${nf(i.vol*h)}</td></tr>`).join('')||'<tr><td colspan=6>Belum ada harga produk yang dicatat untuk penyedia ini.</td></tr>'}<tr><th colspan=5 style="text-align:right">Jumlah referensi</th><th class=n>${nf(sum(rows,r=>r.i.vol*r.h))}</th></tr></tbody></table>`}).join('')||'<p>Belum ada referensi harga yang dicatat.</p>'}
<p><i>Catatan: tautan, harga tayang, tanggal akses, dan bukti pendukung perlu disimpan/diperiksa sebagai dasar audit.</i></p>`}
function reviu(p){
 // Format diturunkan dari PDF contoh "Riviu DPP.pdf" (2 halaman).
 // Hasil pada referensi adalah contoh; jangan mengesahkan kondisi yang belum diperiksa.
 const o=OP(p), pp=PJ(p.pp), ppk=satriaDppSigner(p)||PJ(p.ppk);
 const e=esc;
 const list=(entries)=>entries.map(([no,act,res])=>`<tr><td class="rv-no">${e(no)}</td><td>${act}</td><td>${res}</td></tr>`).join('');
 const table=(n,title,entries)=>`<section class="rv-section"><div class="rv-section-title"><span>${n}</span><b>${title}</b></div><table class="rv-table"><colgroup><col style="width:6%"><col style="width:49%"><col style="width:45%"></colgroup><thead><tr><th>NO.</th><th>KEGIATAN</th><th>HASIL</th></tr><tr class="rv-numbering"><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${list(entries)}</tbody></table></section>`;
 const sub=(letter,content)=>`<div class="rv-sub"><span>${letter}</span><span>${content}</span></div>`;
 const haveItems=(p.items||[]).length>0;
 const haveOffers=(p.penawaran||[]).length>0;
 const req=haveItems?'Spesifikasi teknis telah dicatat pada rincian paket; kesesuaiannya perlu diperiksa terhadap dokumen persiapan.':'Belum ada rincian spesifikasi teknis paket untuk diverifikasi.';
 const source=haveOffers?`${(p.penawaran||[]).length} data penawaran/referensi tercatat di SATRIA; kesesuaian sumber harga perlu diverifikasi dengan bukti RFI/katalog.`:'Referensi harga/RFI penyedia belum dicatat; pengumpulan sumber perlu diverifikasi.';
 const reviewNote='Perlu pemeriksaan dokumen dan bukti oleh pejabat berwenang.';
 const t1=table(1,'Kertas Kerja Evaluasi Spesifikasi Teknis',[
 ['1','Memastikan spesifikasi teknis telah dituangkan dengan lengkap sehingga peserta memahami dan mampu menyusun penawaran dengan baik.',req],
 ['2',`Memastikan spesifikasi teknis telah dijabarkan dengan :
 ${sub('a','Kesesuaian spesifikasi teknis dengan kebutuhan')}
 ${sub('b','Karakteristik antara lain ukuran, dimensi, bentuk, bahan, warna, komposisi')}
 ${sub('c','Kinerja : ketahanan, efisiensi, batas pemakaian, dst')}
 ${sub('d','Standar yang digunakan : SNI, JIS, ASTM, ISO, dst')}
 ${sub('e','Validitas : standar yang digunakan sudah tepat dan sesuai (SNI berlaku dan valid)')}
 ${sub('f','Pengepakan dan cara pengiriman disesuaikan dengan sifat dan/atau jenis barang')}
 ${sub('g','Mencantumkan macam, jenis, kapasitas dan jumlah peralatan')}`,
 `Spesifikasi teknis ditelaah menurut komponen berikut (isi hasil setelah pemeriksaan):
 ${sub('a',reviewNote)}${sub('b',reviewNote)}${sub('c',reviewNote)}${sub('d','Persyaratan ISO: perlu dikonfirmasi.')}${sub('e','Persyaratan SNI dan validitasnya: perlu dikonfirmasi.')}${sub('f','Pengepakan dan pengiriman: perlu dikonfirmasi berdasarkan DPP.')}${sub('g','Kapasitas/jumlah peralatan: perlu dikonfirmasi.')}`],
 ['3','Hal lain yang relevan dan perlu dilakukan reviu terkait spesifikasi teknis','Belum ada catatan reviu tambahan; isi sesuai hasil pemeriksaan.']
 ]);
 const t2=table(2,'Kertas Kerja Evaluasi terhadap Pengumpulan Referensi Harga',[
 ['1','Memastikan PPK telah mengumpulkan referensi harga yang cukup dan memadai sehingga dapat menjadi dasar penentuan harga.',source],
 ['2','Memastikan harga yang digunakan PPK relevan dengan harga pasar, kontrak sejenis yang pernah dilakukan, atau sumber lainnya.','Sumber dan kesesuaian harga pasar/katalog harus diverifikasi terhadap dokumen pendukung.'],
 ['3','Hal lain yang relevan dan perlu dilakukan reviu terkait referensi harga','Belum ada catatan reviu tambahan; isi sesuai hasil pemeriksaan.']
 ]);
 const t3=table(3,'Kertas Kerja Evaluasi terhadap Rancangan Kontrak (Surat Pesanan dan/atau Surat Perjanjian Kerja)',[
 ['1',`Memastikan Surat Pesanan/SPK telah dituangkan secara lengkap dan benar terkait dengan :${sub('a','Paket pengadaan')}${sub('b','Sumber dana')}${sub('c','Nilai kontrak termasuk pajak')}${sub('d','Jenis kontrak')}${sub('e','Waktu pelaksanaan')}`,
 `Rancangan Surat Pesanan/SPK perlu diperiksa meliputi:${sub('a',`Nama paket: ${e(p.nama||'-')}`)}${sub('b',`Sumber dana: ${e(p.sumber||'-')} (verifikasi)`)}${sub('c','Nilai kontrak termasuk pajak: belum diverifikasi.')}${sub('d','Jenis kontrak: perlu diverifikasi.')}${sub('e',`Waktu pelaksanaan: ${e(p.masaHk||'-')} hari kerja (verifikasi).`)}`],
 ['2','Memastikan Syarat-Syarat Umum Kontrak dan Syarat-Syarat Khusus Kontrak','Kesesuaian syarat kontrak dengan rancangan Surat Pesanan/SPK perlu diperiksa.'],
 ['3','Memastikan jenis kontrak dalam SPK sudah sesuai dengan dokumen persiapan lainnya','Kesesuaian jenis kontrak dengan dokumen persiapan perlu diperiksa.'],
 ['4','Hal lain yang relevan dan perlu dilakukan reviu terkait rancangan kontrak','Belum ada catatan reviu tambahan; isi sesuai hasil pemeriksaan.']
 ]);
 const t4=table(4,'Kertas Kerja Evaluasi terhadap Rencana Metode Pemilihan Penyedia',[
 ['1','Memastikan PPK telah menentukan metode pemilihan penyedia','Metode E-Purchasing tercantum dalam konteks paket; penetapannya perlu dikonfirmasi.'],
 ['2',`Memastikan kesesuaian metode pemilihan penyedia yang dipilih PPK dengan ketentuan :${sub('a','Negosiasi harga dilakukan terhadap harga satuan produk dengan mempertimbangkan kualitas, kuantitas produk, ongkos kirim, biaya instalasi, mobilisasi, SMKK, dan ketersediaan produk')}${sub('b','<i>Mini kompetisi</i> dilakukan terhadap 2 (dua) atau lebih penyedia katalog elektronik yang memiliki produk yang sama atau produk dengan spesifikasi sejenis yang dibutuhkan oleh PPK/PP dengan tujuan mendapatkan harga terbaik; atau')}${sub('c','<i>Competitive Catalogue</i> memuat data dan informasi yang ditawarkan oleh Penyedia Katalog Elektronik dalam lingkup pekerjaan konstruksi berupa komponen dasar konstruksi yang kemudian dikompetisikan melalui sistem.')}`,
 `Memastikan metode yang dipilih:${sub('a','Negosiasi harga: pemeriksaan metode dan dokumentasi negosiasi diperlukan.')}${sub('b','Mini kompetisi: periksa apakah metode ini digunakan.')}${sub('c','Competitive Catalogue: periksa apakah metode ini digunakan.')}`],
 ['3','Hal lain yang relevan dan perlu dilakukan reviu terkait metode pemilihan penyedia','Belum ada catatan reviu tambahan; isi sesuai hasil pemeriksaan.']
 ]);
 const t10=table(10,'Kertas Kerja Evaluasi terhadap Ketersediaan Produk di Katalog Elektronik',[
 ['1','Memastikan ketersediaan produk di katalog elektronik.','Ketersediaan produk pada katalog elektronik harus dicek terhadap RFI/bukti katalog yang berlaku.'],
 ['2','Memastikan berapa banyak penyedia katalog yang menyediakan produk yang akan di-purchase.',source],
 ['3','Hal lain yang relevan dan perlu dilakukan reviu terkait dengan ketersediaan produk di katalog elektronik.','Belum ada catatan reviu tambahan; isi sesuai hasil pemeriksaan.']
 ]);
 const sign=(who,whoRole,label)=>`<div class="rv-sign-col"><div>${label}</div><div>${whoRole}</div><div class="rv-sign-space"></div><b><u>${e(who.nama||'-')}</u></b><div>NIP. ${e(who.nip||'-')}</div></div>`;
 return `<div class="rv-document"><div class="rv-title"><b><u>BERITA ACARA REVIU DOKUMEN PERSIAPAN PENGADAAN <i>E-PURCHASING</i></u></b><div>Nomor : ${e(nomor('BAHR',p))}${p.tahun?'/'+e(p.tahun):''}</div></div>
 <table class="rv-meta"><tbody><tr><td>OPD</td><td>:</td><td>${e(o.nama||'-')}</td></tr><tr><td>PAKET</td><td>:</td><td><b>${e(p.nama||'-')}</b></td></tr></tbody></table>
 ${t1}${t2}${t3}${t4}${t10}
 <div class="rv-signatures">${sign(ppk,'PA / KPA / PPK','Disusun/ditetapkan oleh :')}${sign(pp,'Pejabat Pengadaan','Diperiksa / Direviu')}</div>
 </div>`;
}
function hpsnego(p){const W=p.penawaran,H=hps(p),ev=evalPw(p);return `${kop(p)}<p class="doc-title" style="text-align:center"><b><u>LEMBAR HARGA PERKIRAAN SENDIRI (HPS) DAN NEGOSIASI</u></b></p>
${LT([['Pagu',rp(p.pagu)],['Nilai HPS',rp(H)],['Selisih Pagu - HPS',rp(p.pagu-H)],['Nama Paket',p.nama],['Kode RUP',p.rup],['Sub Kegiatan',subOf(p)]])}
<p class="doc-section-heading"><b>A. Rincian HPS dan referensi harga</b></p><table class="tbl-price-matrix"><thead><tr><th>No</th><th>Nama Barang dan Spesifikasi</th><th class=n>Volume</th><th>Satuan</th><th class=n>Harga Satuan HPS</th><th class=n>Jumlah HPS</th>${W.map(w=>`<th class=n>${esc(PY(w.pen).nama)}<br>Harga Tayang</th>`).join('')}</tr></thead><tbody>
${p.items.map((i,n)=>`<tr><td>${n+1}</td><td>${itemLabel(i)}</td><td class=n>${vf(i.vol)}</td><td>${esc(i.satuan)}</td><td class=n>${nf(i.hs)}</td><td class=n>${nf(i.vol*i.hs)}</td>${W.map(w=>`<td class=n>${(+w.harga[i.id]||0)?nf(w.harga[i.id]):'-'}</td>`).join('')}</tr>`).join('')}
<tr><th colspan=5 style="text-align:right">Total</th><th class=n>${nf(H)}</th>${W.map(w=>`<th class=n>${nf(totPw(p,w,false))}</th>`).join('')}</tr></tbody></table>
<p class="doc-section-heading"><b>B. Perbandingan hasil negosiasi</b></p><table class="tbl-negotiation-summary"><thead><tr><th>No</th><th>Penyedia</th><th class=n>Total Harga Tayang</th><th class=n>Total Harga Nego</th><th class=n>Terhadap HPS</th><th>Hasil sistem</th></tr></thead><tbody>${ev.map(({w,t,st},n)=>`<tr><td>${n+1}</td><td>${esc(PY(w.pen).nama)}</td><td class=n>${nf(totPw(p,w,false))}</td><td class=n>${nf(t)}</td><td class=n>${H?(t/H*100).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'0'}%</td><td>${st}</td></tr>`).join('')||'<tr><td colspan=6>Belum ada data penawaran.</td></tr>'}</tbody></table>
<p class="doc-section-heading"><b>C. Rekonsiliasi harga negosiasi dan pajak (informasi)</b></p><table class="tbl-negotiation-summary"><thead><tr><th>Penyedia</th><th class=n>Harga sebelum PPN</th><th class=n>PPN tercatat</th><th class=n>Subtotal bruto</th><th class=n>Ongkir</th><th class=n>Total akhir</th></tr></thead><tbody>${W.map(w=>{const a=satriaDocPricing(p,w);return `<tr><td>${esc(PY(w.pen).nama)}</td><td class=n>${a.verified?nf(a.net):'Perlu verifikasi'}</td><td class=n>${a.verified?nf(a.tax):'Perlu verifikasi'}</td><td class=n>${nf(a.gross)}</td><td class=n>${nf(a.shipping)}</td><td class=n>${nf(a.total)}</td></tr>`}).join('')}</tbody></table><p><i>PPN sudah termasuk dalam harga satuan bruto; tidak ditambahkan lagi ke total. Perbedaan perhitungan harus diverifikasi terhadap bukti transaksi.</i></p><p><b>Catatan:</b> HPS dan referensi harga harus ditopang sumber yang dapat diperiksa. Nilai ongkos kirim, tanggal akses, dan tautan bukti yang belum tersedia perlu dilengkapi sebelum penetapan.</p>${sig(PJ(p.pp),'Pejabat Pengadaan,')}`}
function kknego(p){const pm=pemenang(p);if(!pm)return `${kop(p)}<p style="text-align:center"><b><u>KERTAS KERJA NEGOSIASI</u></b></p><p>Belum ada pemenang. Kertas kerja negosiasi dapat dibuat setelah data penawaran lengkap dan penyedia ditetapkan oleh pejabat berwenang.</p>`;const w=pm.w,H=hps(p);const rows=p.items.map((i,n)=>{const a=+w.harga[i.id]||0,nn=+(w.nego[i.id]??a)||0;return{n,i,a,nn}});const pricing=satriaDocPricing(p,w);const subTotal=sum(rows,r=>r.i.vol*r.nn);const shipping=Math.max(0,Number(w.ongkir)||0);const fin=subTotal+shipping;const terbilangFinal=terb(Math.round(fin));
return `${kop(p)}<p style="text-align:center"><b><u>KERTAS KERJA NEGOSIASI</u></b><br>Nomor: ${nomor('KKNEGO',p)}</p>
${LT([['Nama Paket',p.nama],['Kode RUP',p.rup],['Sub Kegiatan',subOf(p)],['Penyedia',PY(w.pen).nama],['Pagu',rp(p.pagu)],['HPS',rp(H)],['Tanggal',tg(p.tglNego)]])}
<table class="tbl-knego-items"><thead><tr><th>No</th><th>Nama Barang dan Spesifikasi</th><th class=n>Volume</th><th>Satuan</th><th class=n>HPS Satuan</th><th class=n>Jumlah HPS</th><th class=n>Harga Satuan Awal</th><th class=n>Harga Satuan Nego</th><th class=n>Jumlah Harga Nego</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.n+1}</td><td>${esc(r.i.nama)}</td><td class=n>${vf(r.i.vol)}</td><td>${esc(r.i.satuan)}</td><td class=n>${nf(r.i.hs)}</td><td class=n>${nf(r.i.vol*r.i.hs)}</td><td class=n>${nf(r.a)}</td><td class=n>${Number(r.nn).toLocaleString('id-ID',{maximumFractionDigits:2})}</td><td class=n>${nf(r.i.vol*r.nn)}</td></tr>`).join('')}
<tr><th colspan=5 style="text-align:right">Subtotal harga akhir item (termasuk PPN)</th><th class=n>${nf(H)}</th><th></th><th></th><th class=n>${nf(subTotal)}</th></tr><tr><th colspan=8 style="text-align:right">Ongkos kirim paket (tidak dialokasikan per item)</th><th class=n>${nf(shipping)}</th></tr><tr><th colspan=8 style="text-align:right">Total akhir termasuk ongkos kirim</th><th class=n>${nf(fin)}</th></tr></tbody></table>
<p>Selisih HPS dengan harga akhir: <b>${rp(H-fin)}</b>. Persentase selisih terhadap HPS: <b>${H?((H-fin)/H*100).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'0'}%</b>. Terbilang nilai akhir <b>${esc(terbilangFinal)}</b> (berdasarkan total akhir ${rp(fin)}).</p>
<p><b>Rincian PPN:</b> ${pricing.verified?`Harga sebelum PPN ${rp(pricing.net)} + PPN ${rp(pricing.tax)} = subtotal ${rp(pricing.gross)}; ongkir terpisah ${rp(shipping)}.`:'Komponen harga sebelum PPN/PPN belum lengkap atau belum konsisten pada seluruh rincian; nilai bruto yang tersimpan tidak dipajaki kembali.'}</p><p>Hasil negosiasi perlu dikonfirmasi dan didokumentasikan sesuai mekanisme e-Purchasing yang digunakan.</p>${sig(PJ(p.pp),'Pejabat Pengadaan,')}`}
const DOCS={nodis,idkb,rfi,survei,bahepe,metode,sppbj,spek,dpp,lamp,reviu,hpsnego,kknego,bahp};
