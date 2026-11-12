/* SATRIA JKK • domain murni, tanpa mutasi pada paket/RUP lama. */
(function(root,factory){'use strict';const api=Object.freeze(factory());if(root)root.SATRIA_JKK_CORE=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const str=(x,max=900)=>String(x??'').trim().slice(0,max);
 const normalized=x=>str(x,160).toLowerCase().replace(/\s+/g,' ');
 const unique=a=>[...new Set(a)];
 const list=x=>Array.isArray(x)?x:[];
 const rupEligible=r=>!!r&&['jasa konsultansi','jasa konsultansi konstruksi'].includes(normalized(r.jenisPengadaan))&&normalized(r.metodePemilihan)==='pengadaan langsung';
 const isPL=p=>normalized(p?.spseMonitoring?.method||(p?.jalurPengadaan==='SPSE_MONITOR'?'':p?.metodePemilihan))==='pengadaan langsung';
 const isConsult=p=>!str(p?.jenisPengadaan)||['jasa konsultansi','jasa konsultansi konstruksi'].includes(normalized(p.jenisPengadaan));
 const rupIds=p=>unique([p?.rupBankId,...list(p?.rupBankIds)].filter(x=>x!=null&&str(x)).map(String));
 const sameScope=(p,r)=>String(p?.opd)===String(r?.opd)&&Number(p?.tahun)===Number(r?.tahun);
 function rupForPackage(p,bank){
   if(!p)return {rup:null,issue:'Paket tidak ditemukan'};
   const ids=rupIds(p);
   if(ids.length!==1)return {rup:null,issue:ids.length?'Paket mempunyai beberapa RUP; modul JKK memerlukan satu RUP utama yang jelas.':'Paket belum memiliki tautan ID Bank RUP.'};
   const r=list(bank).find(x=>String(x.id)===ids[0]);
   if(!r)return {rup:null,issue:'Relasi ID Bank RUP tidak ditemukan.'};
   if(!sameScope(p,r))return {rup:null,issue:'OPD/tahun paket berbeda dari Bank RUP.'};
   if(str(p.rup)&&normalized(p.rup)!==normalized(r.rup))return {rup:null,issue:'Kode RUP pada paket tidak sama dengan Bank RUP.'};
   return {rup:r,issue:''};
 }
 function eligiblePackage(p,bank){const match=rupForPackage(p,bank);if(match.issue)return {...match,eligible:false,issue:match.issue};if(!rupEligible(match.rup))return {...match,eligible:false,issue:'Jenis/metode di Bank RUP bukan Pengadaan Langsung — Jasa Konsultansi.'};if(!isPL(p)||!isConsult(p))return {...match,eligible:false,issue:'Jenis/metode paket berbeda; periksa pada paket/monitoring SPSE terlebih dahulu.'};return {...match,eligible:true,issue:''};}
 function subtypeConfirmed(p,r){return normalized(p?.kkJkk?.subjenis||p?.subjenisKonsultansi||r?.subjenisKonsultansi)==='konstruksi'||normalized(p?.jenisPengadaan)==='jasa konsultansi konstruksi'||normalized(r?.jenisPengadaan)==='jasa konsultansi konstruksi';}
 const blank=()=>({schema:1,subjenis:'',layanan:'',bentuk:'',nomorPermintaan:'',tanggalPermintaan:'',refKak:'',refHps:'',lokasi:'',durasi:'',tempatReviu:'',tanggalReviu:'',nomorUndReviu:'',nomorBaReviu:'',keputusanReviu:'',catatanReviu:'',tanggalUndangan:'',nomorUndangan:'',penyediaId:'',namaPenyedia:'',nomorPenawaran:'',tanggalPenawaran:'',tanggalEvaluasi:'',catatanEvaluasi:'',kesimpulanKualifikasi:'',kesimpulanPenawaran:'',tanggalNego:'',nomorBaNego:'',catatanNego:'',hasilNego:'',hpsPPK:'',tarifPajak:'',keteranganPajak:'',reviu:{},kualifikasi:{},penawaran:{},biaya:[],survei:{},jadwal:{},jamReviu:'',alamatPekerjaan:'',waktuPemanfaatan:'',targetPerbaikan:'',kuaNoTglPenawaran:'',kuaTempatTglEvaluasi:'',kuaCatatan:'',kuaEvaluator:'',penNoTglPenawaran:'',penTempatTglEvaluasi:'',penCatatan:'',penEvaluator:'',updatedAt:''});
 const statuses=Object.freeze({reviu:['','Sesuai','Perlu perbaikan','Tidak berlaku'],eval:['','Ada','Tidak ada','Tidak dipersyaratkan']});
 function model(source){return {...blank(),...(source&&typeof source==='object'&&!Array.isArray(source)?source:{}),reviu:{...(source?.reviu||{})},kualifikasi:{...(source?.kualifikasi||{})},penawaran:{...(source?.penawaran||{})},biaya:list(source?.biaya).map(x=>({...x})),survei:{...(source?.survei||{})},jadwal:{...(source?.jadwal||{})}};}
 // Harga survei hanya usulan pembanding; tidak menimpa HPS PPK tanpa tindakan pengguna.
 const SURVEY_KEYS=Object.freeze(['standar','kontrak','calon','manual']);
 function surveyPrice(row){
  const item=row&&typeof row==='object'?row:{};
  if(item.manual!==''&&item.manual!=null){return validMoney(item.manual)?Number(item.manual):null;}
  const refs=['standar','kontrak','calon'].map(k=>item[k]).filter(x=>x!==''&&x!=null&&validMoney(x)).map(Number);
  return refs.length?Math.min(...refs):null;
 }
 const number=x=>x===''||x==null?null:Number(x);
 const validMoney=x=>x===''||x==null||Number.isSafeInteger(Number(x))&&Number(x)>=0&&Number(x)<=1e13;
 const validQty=x=>x!==''&&x!=null&&Number.isFinite(Number(x))&&Number(x)>0&&Number(x)<=1e7;
 function totals(d){
   const rows=list(d?.biaya);let base=0,offer=0,nego=0,hpsComplete=rows.length>0,offerComplete=rows.length>0,negoComplete=rows.length>0,invalid=false;
   for(const r of rows){const qty=number(r.volume),h=number(r.harga),o=number(r.penawaran),n=number(r.negosiasi);if(!validQty(r.volume)||!validMoney(r.harga)||!validMoney(r.penawaran)||!validMoney(r.negosiasi))invalid=true;
    if(h===null)hpsComplete=false;else base+=Number(r.volume||0)*h;
    if(o===null)offerComplete=false;else offer+=Number(r.volume||0)*o;
    if(n===null)negoComplete=false;else nego+=Number(r.volume||0)*n;
   }
   const rate=d?.tarifPajak===''||d?.tarifPajak==null?null:Number(d.tarifPajak);
   if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))invalid=true;
   const tax=hpsComplete&&rate!==null?Math.round(base*rate/100):null;
   const hps=hpsComplete&&tax!==null?Math.round(base)+tax:null;
   return {base:hpsComplete?Math.round(base):null,tax,hps,offer:offerComplete?Math.round(offer):null,nego:negoComplete?Math.round(nego):null,invalid,rate,selisih:hps!=null&&d.hpsPPK!==''&&validMoney(d.hpsPPK)?hps-Number(d.hpsPPK):null};
 }
 function warnings(p,r,d){const t=totals(d),w=[];
   if(!subtypeConfirmed(p,r))w.push('Subjenis Konstruksi belum ditetapkan dari KAK/dokumen paket.');
   if(Number(p.pagu)>100000000)w.push('Pagu paket di atas Rp100.000.000; periksa batas metode berdasarkan aturan yang berlaku.');
   if(!d.bentuk)w.push('Bentuk penyedia belum dipilih.');
   if(d.hpsPPK==='')w.push('Nilai HPS yang ditetapkan PPK belum direferensikan.');
   if(t.invalid)w.push('Ada rincian volume/harga atau tarif pajak yang tidak valid.');
   if(t.selisih!==null&&t.selisih!==0)w.push('Total rincian HPS berbeda dari HPS PPK: '+Math.abs(t.selisih).toLocaleString('id-ID')+' rupiah.');
   if(t.hps!==null&&Number(p.pagu)>0&&t.hps>Number(p.pagu))w.push('Total rincian biaya melampaui alokasi pagu paket.');
   if(d.hpsPPK!==''&&Number(d.hpsPPK)>Number(p.pagu))w.push('HPS PPK melampaui pagu paket.');
   if(t.offer!==null&&d.hpsPPK!==''&&t.offer>Number(d.hpsPPK))w.push('Nilai penawaran rincian melebihi HPS PPK; perlu evaluasi manusia.');
   if(t.nego!==null&&t.offer!==null&&t.nego>t.offer)w.push('Total negosiasi lebih tinggi daripada total penawaran; periksa kembali.');
   return w;
 }
 function progress(d,schema){const count=keys=>keys.reduce((n,x)=>n+(d[x]?1:0),0);const rv=Object.keys(d.reviu||{}).filter(id=>!!d.reviu[id]?.status).length;const criteria=schema?.[d.bentuk==='Badan Usaha'?'badanUsaha':'perorangan']||{kua:[],pen:[]};return {reviu:rv,semuaReviu:schema?.rev?.length||0,kua:list(criteria.kua).filter(x=>!!d.kualifikasi[x.id]?.status).length,semuaKua:list(criteria.kua).length,pen:list(criteria.pen).filter(x=>!!d.penawaran[x.id]?.status).length,semuaPen:list(criteria.pen).length};}
 function clean(d){if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Format kertas kerja tidak valid.');const obj=model(d);
   if(obj.schema!==1)throw Error('Versi data kertas kerja belum didukung.');
   for(const [key,value] of Object.entries(obj))if(typeof value==='string'&&value.length>3000)throw Error('Isian terlalu panjang: '+key);
   if(!['','Konstruksi'].includes(obj.subjenis)||!['','Perorangan','Badan Usaha'].includes(obj.bentuk))throw Error('Pilihan jenis layanan/penyedia tidak valid.');
   for(const k of ['reviu','kualifikasi','penawaran']){const src=obj[k];if(typeof src!=='object'||Array.isArray(src))throw Error('Struktur evaluasi tidak valid.');for(const [id,entry] of Object.entries(src)){if(!/^(rev-\d{2}|kua-\d{2}|pen-\d{2}|b-kua-\d{2}|b-pen-\d{2})$/.test(id))throw Error('ID kriteria tidak valid.');if(!statuses[k==='reviu'?'reviu':'eval'].includes(entry?.status||''))throw Error('Status kriteria tidak valid.');for(const name of ['bukti','catatan','tindakan','pic','target'])if(String(entry?.[name]??'').length>1500)throw Error('Catatan kriteria terlalu panjang.')}}
   if(!obj.survei||typeof obj.survei!=='object'||Array.isArray(obj.survei))throw Error('Struktur survei tidak valid.');
   if(!obj.jadwal||typeof obj.jadwal!=='object'||Array.isArray(obj.jadwal))throw Error('Struktur jadwal tidak valid.');
   const JADWAL_KEYS=['uploadMulai','uploadSelesai','pembukaanMulai','pembukaanSelesai','evaluasiMulai','evaluasiSelesai','klarifikasiMulai','klarifikasiSelesai','kontrakMulai','kontrakSelesai'];
   for(const [k,v] of Object.entries(obj.jadwal))if(!JADWAL_KEYS.includes(k)||String(v??'').length>250)throw Error('Kolom jadwal tidak valid.');
   if(Object.keys(obj.survei).length>100)throw Error('Terlalu banyak baris survei.');
   for(const [id,item] of Object.entries(obj.survei)){
     if(!/^jkk-[a-z\d_-]{1,64}$/i.test(id)||!item||typeof item!=='object'||Array.isArray(item))throw Error('ID rincian survei tidak valid.');
     for(const k of SURVEY_KEYS)if(!validMoney(item[k]))throw Error('Angka survei tidak valid: '+k);
     for(const k of ['kualifikasi','keterangan','item'])if(String(item[k]??'').length>1200)throw Error('Catatan survei terlalu panjang.');
   }
   if(obj.biaya.length>100)throw Error('Maksimal 100 rincian per paket untuk menjaga kinerja.');
   const ids=new Set();for(const row of obj.biaya){if(!/^jkk-[a-z\d_-]{1,64}$/i.test(str(row.id,100))||ids.has(row.id))throw Error('ID rincian biaya tidak valid/duplikat.');ids.add(row.id);if(!['Personel','Nonpersonel'].includes(row.kategori)||!validQty(row.volume)||!validMoney(row.harga)||!validMoney(row.penawaran)||!validMoney(row.negosiasi)||str(row.uraian).length>250)throw Error('Rincian biaya tidak valid.');}
   const sums=totals(obj);if(sums.invalid||[sums.base,sums.tax,sums.hps,sums.offer,sums.nego].some(x=>x!==null&&!Number.isSafeInteger(x)))throw Error('Jumlah rincian biaya tidak valid atau melampaui ketelitian rupiah.');
   for(const key of ['tanggalPermintaan','tanggalReviu','tanggalUndangan','tanggalPenawaran','tanggalEvaluasi','tanggalNego']){const v=obj[key];if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Tanggal tidak valid: '+key);}
   if(!validMoney(obj.hpsPPK)||obj.tarifPajak!==''&&(!Number.isFinite(Number(obj.tarifPajak))||Number(obj.tarifPajak)<0||Number(obj.tarifPajak)>100))throw Error('HPS PPK/tarif pajak tidak valid.');
   return obj;
 }
 return {rupEligible,isPL,isConsult,rupForPackage,eligiblePackage,subtypeConfirmed,blank,model,clean,totals,warnings,progress,validMoney,validQty,statuses,surveyPrice};
});
