// SATRIA Tahap gabungan P0–P3 · controller modular; loaded after 01-app-core.js.
/* ===== PANDUAN ===== */
function vPanduan(){const sec=(t,items)=>`<div class=card><h3>${t}</h3><ol style="margin:0;padding-left:20px;line-height:1.7">${items.map(x=>`<li>${x}</li>`).join('')}</ol></div>`;
 return sec('1. Alur kerja pengadaan',['Pilih tahun dan OPD di header.','Buat paket di menu Paket Pengadaan dengan Kode RUP sesuai Bank RUP (boleh dipakai oleh beberapa paket).','Isi rincian barang dan volume. HPS dihitung otomatis.','Isi penawaran penyedia di tab Penawaran dan Negosiasi. Kandidat dihitung otomatis dari penawaran lengkap; pemenang baru sah di dalam aplikasi setelah tanggal dan harga negosiasi setiap item lengkap serta total tidak melebihi HPS.','Isi tanggal Nota Dinas, DPP, dan BA Hasil di tab Data Paket.','Cetak dokumen dari menu Dokumen Pengadaan. Semua dokumen mengambil data yang sama, sehingga cukup diisi sekali.'])
 + sec('2. Menyiapkan aplikasi',['Pengaturan Sistem: identitas pemda, logo, tahun anggaran, OPD, kop surat per OPD (gambar), dan format penomoran.','Master Data: pejabat PPK/KPA, Pejabat Pengadaan, Kepala Bidang (lengkap dengan TTD dan cap), penyedia, dan akun anggaran.',])
 + sec('3. Nomor dokumen',['Format: {kode}/{Kode RUP}/{singkatan OPD}/{kode unit}.','Jika Kode RUP belum diisi, nomor akan menampilkan [KODE RUP] sebagai pengingat.'])
 + sec('4. Hak akses',['Admin: akses penuh, termasuk Pengaturan Instansi dan Manajemen User.','Operator: mengelola paket dan master PPK/KPA, Pejabat Pengadaan, Kepala Bidang, serta Unit/Bagian pada OPD assignment; katalog Penyedia dan Akun Anggaran dikelola bersama seluruh Operator/Admin. Operator tidak mengubah pengaturan organisasi atau user.','Viewer: hanya melihat, mencetak, dan memakai chatbot.','Tidak bisa menonaktifkan atau menghapus user yang sedang dipakai, atau Admin aktif terakhir.'])
 + sec('5. Backup dan penyimpanan',['Dengan penyimpanan IndexedDB (Dexie), data tersimpan otomatis di browser ini. Tetap klik Backup di header secara berkala.','Muat lagi backup lewat Pengaturan Sistem → Backup & Pemulihan.','Pilih engine penyimpanan di header: IndexedDB (Dexie) atau memori sesi.']);}

/* Sampah Tahap 1 & 2: IndexedDB lokal tetap mandiri; cloud memakai RPC arsip/pulih atomik.
   Aksi tanpa kontrak arsip server tetap diblokir (fail closed). */
function satriaRecycleBlocked(){
 if(window.SATRIA_CLOUD_CONFIGURED){toast('Tindakan ini belum memiliki mekanisme Sampah cloud dan tetap diblokir. Tidak ada data yang dihapus.');return true}
 if(ENGINE!=='dexie'){toast('Penyimpanan permanen tidak aktif. Aktifkan IndexedDB sebelum memindahkan data ke Sampah.');return true}
 return false;
}
function satriaRecycleMove(collection,id){
 if(window.SATRIA_CLOUD_CONFIGURED){
   const api=window.SATRIA_CLOUD_TRASH;
   if(!api?.ready){toast('Cloud belum siap atau akun belum masuk. Data tidak dihapus.');return false}
   api.archive(collection,id).catch(err=>toast('Arsip cloud dibatalkan: '+err.message));
   return false; // cloud mutation & refreshed state are asynchronous and server-owned
 }
 if(satriaRecycleBlocked())return false;
 try{window.SATRIA_CORE_GUARDS.archive(S,collection,id,cur().nama);sync(collection==='paket'||collection==='rupBank'?'paket':'master','Dipindahkan ke Sampah: '+collection+' '+id);return true}
 catch(err){toast('Tidak dapat memindahkan ke Sampah: '+err.message);return false}
}
function satriaRecycleDependencies(entry){
 const r=entry.record;if(!r)return 'Snapshot tidak lengkap';
 if(entry.collection==='paket'){
   if(!S.opd.some(o=>String(o.id)===String(r.opd))||!S.tahun.includes(Number(r.tahun)))return 'OPD atau tahun sumber tidak tersedia';
   if(r.rupBankId&&!S.rupBank.some(x=>String(x.id)===String(r.rupBankId)))return 'Bank RUP utama perlu dipulihkan terlebih dahulu';
   if((r.rupBankIds||[]).some(id=>!S.rupBank.some(x=>String(x.id)===String(id))))return 'Bank RUP terkait perlu dipulihkan terlebih dahulu';
   if(r.ppk&&!S.pejabat.some(x=>String(x.id)===String(r.ppk)))return 'PPK terkait perlu dipulihkan terlebih dahulu';
   if(r.pp&&!S.pejabat.some(x=>String(x.id)===String(r.pp)))return 'Pejabat Pengadaan terkait perlu dipulihkan terlebih dahulu';
   if((r.penawaran||[]).some(w=>!S.penyedia.some(y=>String(y.id)===String(w.pen))))return 'Penyedia terkait perlu dipulihkan terlebih dahulu';
 }
 if(entry.collection==='penawaran'&&(!S.paket.some(p=>String(p.id)===String(r.paketId))||!S.penyedia.some(y=>String(y.id)===String(r.offer?.pen))))return 'Paket/penyedia perlu dipulihkan terlebih dahulu';
 if(entry.collection==='item'&&!S.paket.some(p=>String(p.id)===String(r.paketId)))return 'Paket induk perlu dipulihkan dahulu';
 if(entry.collection==='media'&&r.owner==='opd'&&!S.opd.some(o=>String(o.id)===String(r.opdId)))return 'OPD perlu dipulihkan terlebih dahulu';
 if(entry.collection==='rupBank'&&(!S.opd.some(o=>String(o.id)===String(r.opd))||!S.tahun.includes(Number(r.tahun))))return 'OPD atau tahun Bank RUP perlu dipulihkan';
 if(['pejabat','unit'].includes(entry.collection)&&r.opd&&!S.opd.some(o=>String(o.id)===String(r.opd)))return 'OPD terkait perlu dipulihkan';
 return '';
}
function vSampah(){
 const cloud=!!window.SATRIA_CLOUD_CONFIGURED;
 const api=window.SATRIA_CLOUD_TRASH;
 if(cloud&&api?.ready&&!api.loaded&&!api.loading)api.ensureLoaded();
 const scope=activeCloudScope();
 const records=(cloud?(api?.items||[]):(S.sampah||[])).filter(e=>{
  if(cloud||!scope)return true;const r=e.record||{};
  return e.collection!=='snapshot'&&scope.opdIds.includes(String(r.opd))&&scope.years.includes(Number(r.tahun));
 });
 const note=cloud?(api?.error?'⚠ '+esc(api.error):!api?.ready?'Masuk Supabase dan tarik data cloud untuk melihat Sampah.':api.loading?'Mengambil Sampah cloud…':'Sampah tersimpan di Supabase. Hapus/pulihkan bersifat atomik dan dapat dilihat lintas perangkat. Tidak ada hapus permanen otomatis.'):'Pemulihan tersimpan hanya di browser ini (IndexedDB) dan backup JSON, bukan di server.';
 return `<section class="card satria-trash-page"><div class="row" style="justify-content:space-between;align-items:center;gap:12px"><div><h2>🗑️ Sampah & Pemulihan</h2><p class="mut">Data yang diarsipkan dapat dipulihkan tanpa persetujuan berjenjang.</p></div><b class="pill">${records.length} item</b></div>
 <p class="mut" role="status">${note}</p>
 ${cloud?'<div class="row"><button type="button" class="g" data-act="trashrefresh">↻ Segarkan Sampah cloud</button><span class="mut">Maksimal 250 arsip terbaru ditampilkan. Arsip lama tetap tersimpan di server.</span></div>':''}
 ${records.length?`<div style="overflow-x:auto"><table><thead><tr><th>Jenis</th><th>Nama / ID</th><th>Dihapus</th><th>Oleh</th><th>Aksi</th></tr></thead><tbody>${records.map(e=>{const r=e.record||{},issue=cloud?'':e.collection==='snapshot'?'':satriaRecycleDependencies(e);const name=r.nama||r.rup||r.username||(e.collection==='media'?(r.owner==='pemda'?'Logo Pemerintah Daerah':'Kop OPD '+String(r.opdId||'')):e.collection==='penawaran'?'Penawaran '+String(r.offer?.id||''):e.collection==='tahun'?'Tahun '+String(r.year||''):e.collection==='item'?'Rincian '+String(r.item?.nama||r.item?.id||''):e.originalId)||'Snapshot data';return `<tr><td>${esc(e.collection==='snapshot'?'Snapshot reset':e.collection)}</td><td>${esc(name)}</td><td>${esc(e.deletedAt||'-')}</td><td>${esc(e.deletedBy||'-')}</td><td>${canWrite()&&(!cloud||api?.ready)?`<button type="button" class="g" data-act="trashrestore" data-id="${esc(e.id)}">Pulihkan</button>${issue?`<small class="mut"> ${esc(issue)}</small>`:''}`:'<span class="mut">Lihat saja</span>'}</td></tr>`}).join('')}</tbody></table></div>`:'<p>Belum ada data yang ditampilkan di Sampah.</p>'}
 <div class="row"><a class="btn g" href="#paket">Kembali ke Paket</a>${!cloud?'<button data-act="export" type="button">Unduh backup JSON</button>':''}</div></section>`;
}
