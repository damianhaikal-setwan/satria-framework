
(function(){'use strict';
 const esc594=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bad594=v=>/\b(?:demo|contoh|dummy|simulasi|test|testing)\b/i.test(String(v||''));
 function checks(p){
   const blockers=[],warnings=[];
   if(!p)return {blockers:['Paket DPP belum dipilih.'],warnings};
   if(!String(p.sumber||'').trim()||bad594(p.sumber))blockers.push('Sumber dana paket kosong atau masih menggunakan data contoh/demo. Perbaiki di Data Paket.');
   if(!p.tglDpp)blockers.push('Tanggal DPP belum diisi.');
   if(!p.rup||bad594(p.rup))blockers.push('Nomor RUP belum valid.');
   const place=satriaDppOfficialPlace(p);
   if(!place||place.startsWith('[')||bad594(place))blockers.push('Tempat penandatanganan belum valid di Pengaturan OPD/Pemda.');
   const signer=satriaDppSigner(p);
   if(!signer||!String(signer.nama||'').trim()||!String(signer.nip||'').trim()||bad594(signer.nama))blockers.push('PPK DPP belum dipilih atau nama/NIP Data Master belum lengkap.');
   if(!Array.isArray(p.items)||!p.items.length)blockers.push('Rincian HPS belum tersedia.');
   else if(p.items.some(i=>!(+i.vol>0)||!(+i.hs>0)))blockers.push('Ada volume atau harga satuan HPS yang tidak valid.');
   if(!p.nama||bad594(p.nama))blockers.push('Nama paket belum valid atau mengandung data contoh.');
   if(!satriaPemdaOfficial('nama'))warnings.push('Nama Pemda belum resmi: periksa Pengaturan Sistem, terutama jika DPP tidak memakai kop gambar OPD.');
   if(!p.items?.some(i=>String(i.merek||'').trim())&&p.items?.some(i=>/\b(?:epson|canon|hp|brother|samsung|lenovo|asus|acer)\b/i.test(String(i.nama||''))))warnings.push('Nama barang memuat merek, tetapi justifikasi merek belum dicatat secara khusus. Periksa relevansinya sesuai ketentuan.');
   const refs=(p.penawaran||[]).flatMap(w=>Object.values(w.catalogRefs||{}));
   if(refs.some(r=>r.imageUrl&&!String(r.spec||'').trim()))warnings.push('Sebagian foto referensi belum memiliki spesifikasi katalog; baris kosong disembunyikan dari lampiran.');
   if(!refs.length)warnings.push('Belum ada referensi produk katalog untuk paket ini.');
   else if(refs.some(r=>r.imageUrl&&!r.date))warnings.push('Tanggal survei pada sebagian referensi foto belum diisi.');
   if(p.docPpkSettings?.dpp?.showImages!==false&&signer&&(!signer.ttd||!signer.cap))warnings.push('Gambar TTD atau cap PPK belum lengkap; pastikan penandatanganan resmi dilakukan sesuai prosedur.');
   const df=satriaDppOptions(p);
   if(df.brandPolicy==='unreviewed')warnings.push('Status penggunaan merek belum ditetapkan oleh PPK pada pengaturan DPP.');
   if(df.brandPolicy==='specific'&&!df.brandReason)blockers.push('Justifikasi teknis merek tertentu belum diisi.');
   if(df.brandPolicy==='specific'&&!df.brandEvidence)blockers.push('Dokumen/bukti pendukung merek tertentu belum dicatat.');
   const same=(S.paket||[]).filter(x=>x!==p&&String(x.opd)===String(p.opd)&&Number(x.tahun)===Number(p.tahun)&&satriaDppNumber(x)===satriaDppNumber(p));
   if(same.length)warnings.push('Nomor DPP sama dengan '+same.length+' paket lain pada OPD/tahun ini. Periksa dan tentukan nomor unik sebelum diterbitkan.');
   if(['program','kegiatan','subKeg'].some(k=>satriaDppMetaLines(p,k).includes('[Belum diisi]')))warnings.push('Ada klasifikasi program/kegiatan/subkegiatan yang belum tersedia dari paket atau RUP terkait.');
   return {blockers,warnings};
 }
 function panel(p){const a=checks(p);return `<div class="satria594-check-panel no-print" role="status" aria-label="Pemeriksaan cetak DPP"><strong>✦ Pemeriksaan DPP sebelum cetak</strong><p style="margin:5px 0">${a.blockers.length?`<span class="satria594-critical">${a.blockers.length} masalah wajib diperbaiki sebelum cetak resmi</span>`:'<span style="color:#13784e">Data wajib dasar terisi</span>'}${a.warnings.length?` · ${a.warnings.length} catatan untuk diverifikasi`:''}</p>${a.blockers.length?`<ul>${a.blockers.map(x=>`<li class="satria594-critical">${esc594(x)}</li>`).join('')}</ul>`:''}${a.warnings.length?`<ul>${a.warnings.map(x=>`<li class="satria594-warning">${esc594(x)}</li>`).join('')}</ul>`:''}<small>Periksa data pada menu Paket Pengadaan, Data Master, dan Pengaturan Sistem. SATRIA tidak mengisi atau mengarang data yang tidak tersedia.</small></div>`}
 window.SATRIA_DPP_PREFLIGHT=Object.freeze({checks,panel});
 // Application click is captured before the delegated print handler; enforce warnings only on DPP.
 document.addEventListener('click',function(ev){
  const btn=ev.target.closest?.('[data-act="print"]');
  if(!btn||!btn.closest('.dok-studio')||S.ui.dok!=='dpp')return;
  const pid=document.getElementById('selPaket')?.value||S.ui.pid;
  const p=(S.paket||[]).find(x=>String(x.id)===String(pid));
  const {blockers,warnings}=checks(p);
  if(!blockers.length&&!warnings.length)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  window.SATRIA_DOK_PRINT?.clear?.();
  if(blockers.length){alert('Cetak DPP ditunda karena data wajib belum valid:\n\n• '+blockers.join('\n• ')+'\n\nPerbaiki data lalu buka kembali pratinjau DPP.');return;}
  if(confirm('Catatan pemeriksaan DPP:\n\n• '+warnings.join('\n• ')+'\n\nAnda sudah memverifikasi catatan tersebut dan ingin melanjutkan cetak?')){
    window.SATRIA_DOK_PRINT?.prepare?.();window.print();
  }
 },true);
})();
