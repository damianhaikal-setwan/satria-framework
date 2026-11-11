/* SATRIA PBJ policy 2026 — advisory and document routing, not a legal authorization.
 * Perlem LKPP 3/2026: penyedia/pengadaan langsung; Perlem 2/2026: katalog.
 * Never manufacture dates, document contents, approvals, or regulatory status.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SATRIA_PBJ_POLICY=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SOURCES=Object.freeze({penyedia:'https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026',transisi:'https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026',katalog:'https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026'});
 const upper=v=>String(v??'').trim().toLocaleLowerCase('id-ID');
 const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 function route(p){const mode=upper(p?.spseMonitoring?.method||p?.metodePemilihan),isSpse=p?.jalurPengadaan==='SPSE_MONITOR'||!!p?.spseMonitoring;
  if(!isSpse&&(mode.includes('e-purchasing')||mode.includes('e purchasing')||mode.includes('katalog')))return 'katalog';
  if(mode.includes('pengadaan langsung'))return 'pengadaan-langsung';
  return isSpse?'spse-lain':'perlu-konfirmasi';}
 function regulatoryContext(p){const jalur=route(p),date=iso(p?.tglMulaiPemilihan)?p.tglMulaiPemilihan:'',selected=String(p?.dasarRegulasi||'');
  if(jalur==='katalog')return {jalur,source:SOURCES.katalog,label:'Perlem LKPP 2/2026 — E-Purchasing/Katalog',note:'Aturan katalog tidak disamakan dengan ambang fitur Pengadaan Langsung SPSE. Periksa tanggal proses katalog dan petunjuk sistem resmi.',needsReview:!date,date};
  if(!date)return {jalur,source:SOURCES.penyedia,label:'Dasar regulasi belum dipastikan',note:'Tanggal mulai pemilihan resmi belum dicatat. Periksa Perlem LKPP 3/2026 dan ketentuan transisi sebelum dokumen digunakan.',needsReview:true,date};
  if(date<'2026-09-22')return {jalur,source:SOURCES.transisi,label:'Paket dimulai sebelum 22 September 2026',note:'Periksa ketentuan transisi dan dasar regulasi yang digunakan saat pemilihan dimulai; jangan menerapkan peraturan baru secara retrospektif.',needsReview:true,date};
  if(date<='2026-10-29')return {jalur,source:SOURCES.transisi,label:'Paket pada masa penyesuaian regulasi 2026',note:selected==='perlem-12-2021'?'Dasar lama dicatat oleh pengguna. Periksa waktu/tahapan pemilihan dan bukti sesuai SE Kepala LKPP 3/2026; bukan izin otomatis.':selected==='perlem-3-2026'?'Dasar baru dicatat. Cocokkan tahapan dan kondisi khusus SE Kepala LKPP 3/2026.':'Periksa apakah paket berjalan dengan dasar lama atau baru dan apakah ketentuan transisi SE Kepala LKPP 3/2026 berlaku. SATRIA tidak menentukan otomatis.',needsReview:true,date};
  if(selected==='perlem-12-2021')return {jalur,source:SOURCES.transisi,label:'Penerapan dasar lama perlu verifikasi',note:'Dasar lama telah dipilih meskipun tanggal paket setelah SE 29 Oktober 2026. Periksa kelanjutan paket serta dokumen dan keputusan resmi; jangan menganggap pilihan ini sudah sah.',needsReview:true,date};
  return {jalur,source:SOURCES.penyedia,label:'Perlem LKPP 3/2026 — melalui penyedia',note:'Dasar pelaksanaan perlu dicocokkan dengan jenis pengadaan, metode dan keputusan resmi. SATRIA hanya menyiapkan bahan administrasi.',needsReview:!selected,date};
 }
 function spseFeature(p){if(route(p)!=='pengadaan-langsung')return {type:'perlu-konfirmasi',message:'Bukan Pengadaan Langsung yang teridentifikasi. Tentukan metode dan kewenangan pada SPSE resmi.'};
  const value=Number(p?.pagu),type=upper(p?.jenisPengadaan),consult=type.includes('konsultan');
  if(!Number.isFinite(value)||value<=0)return {type:'perlu-konfirmasi',message:'Nilai dan jenis pengadaan belum cukup untuk menentukan fitur SPSE.'};
  if(consult)return {type:'transaksional',message:'Pengadaan Langsung Jasa Konsultansi: fitur transaksional; cek nilai dan ruang kewenangan menurut ketentuan khusus.'};
  if(!type||!(type.includes('barang')||type.includes('jasa lainnya')||type.includes('konstruksi')))return {type:'perlu-konfirmasi',message:'Jenis pengadaan belum dikenali untuk klasifikasi fitur SPSE.'};
  return value<=50000000?{type:'pencatatan',message:'Pengadaan Langsung sampai dengan Rp50 juta: fitur pencatatan, periksa pengecualian dan ketentuan sistem.'}:{type:'transaksional',message:'Pengadaan Langsung di atas Rp50 juta: fitur transaksional, periksa batas kewenangan dan pengecualian.'};
 }
 function documentPlan(p){const jalur=route(p),value=Number(p?.pagu);
  if(jalur==='katalog'){
   const docs=[{code:'dpp',label:'DPP',available:true}];
   if(value>50000000)docs.push({code:'hrs',label:'HRS (nama/format perlu dikonfirmasi)',available:false});
   return {jalur,docs,note:value===50000000?'Nilai tepat Rp50 juta belum diklasifikasikan oleh instruksi internal yang tersedia; pastikan persyaratan unggahan.':value>50000000?'Susunan DPP + HRS mengikuti kebutuhan operasional, bukan ketentuan Perlem 3/2026. HRS tidak digenerasikan sebelum nama/formatnya terverifikasi.':value>0?'DPP sesuai kebutuhan operasional yang disampaikan; tetap cocokkan kewajiban unggahan pada sistem resmi.':'Nilai paket belum tersedia untuk memilih kebutuhan unggahan.',needsReview:!(value>0)||value===50000000||value>50000000};
  }
  if(jalur!=='pengadaan-langsung')return {jalur,docs:[],note:'Metode pemilihan ini belum terbukti sebagai Pengadaan Langsung dalam kewenangan Pejabat Pengadaan. SATRIA tidak menerbitkan draf dokumen pemilihan untuk Tender/Seleksi atau metode tidak teridentifikasi.',needsReview:true};
  const jenis=upper(p?.jenisPengadaan);
  if(!jenis||!(jenis.includes('barang')||jenis.includes('jasa lainnya')||jenis.includes('konstruksi')||jenis.includes('konsultan')))return {jalur,docs:[],note:'Jenis pengadaan pada paket belum dikenali. Konfirmasi data SiRUP dan jenis pekerjaan sebelum memilih model dokumen.',needsReview:true};
  const hasBuilder=jenis.includes('barang')||jenis.includes('jasa lainnya');
  const docs=[{code:'pemilihan',label:hasBuilder?'Dokumen Pemilihan (draf Barang/Jasa Lainnya)':'Dokumen Pemilihan khusus jenis ini (model belum tersedia)',available:hasBuilder},{code:'reviu-dpp',label:'BA Reviu DPP (draf)',available:true},{code:'analisa-pasar',label:'Analisa Pasar PP (draf)',available:true}];
  return {jalur,docs,note:hasBuilder?'Model draf Barang/Jasa Lainnya tersedia, tetapi tetap harus ditinjau menurut persyaratan SPSE dan Perlem 3/2026.':'Model untuk kategori ini belum tersedia; jangan memakai model Barang/Jasa Lainnya. Gunakan MDP resmi jenis yang sesuai.',needsReview:!hasBuilder};
 }
 function totalCheck({hps=0,pagu=0,penetapan=0}={}){const val=Number(penetapan),h=Number(hps),b=Number(pagu);const errors=[];
  if(!Number.isFinite(val)||val<=0)errors.push('Total penetapan tidak valid');
  if(!Number.isFinite(h)||h<=0)errors.push('Total HPS belum valid');
  if(!Number.isFinite(b)||b<=0)errors.push('Pagu paket belum valid');
  if(Number.isFinite(val)&&h>0&&val>h)errors.push('Total penetapan melebihi HPS paket');
  if(Number.isFinite(val)&&b>0&&val>b)errors.push('Total penetapan melebihi pagu paket');
  return {ready:errors.length===0,errors};
 }
 return Object.freeze({SOURCES,route,regulatoryContext,spseFeature,documentPlan,totalCheck});
});
