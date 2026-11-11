// SATRIA Tahap gabungan P0–P3 · controller modular; loaded after 01-app-core.js.
/* SATRIA 3.0.39 — Data Master quality and referential safeguards */
const SATRIA_MASTER_COLLECTIONS=['pejabat','unit','penyedia','akun'];
const satMasterNorm=v=>String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
function satMasterIssues(){
 const issues=[]; const add=(type,msg)=>issues.push({type,msg});
 for(const [field,label] of [['nama','Nama pemerintah daerah'],['kota','Kota/tempat tanda tangan'],['provinsi','Provinsi'],['sumber','Sumber dana default']]){
  if(!satriaPemdaOfficial(field))add('identitas',label+' kosong atau masih berupa data Demo/Contoh. Lengkapi melalui Pengaturan Sistem.');
 }
 for(const o of S.opd||[]){
  if(satriaIdentityPlaceholder(o.nama)||satriaIdentityPlaceholder(o.singkat))add('identitas','Identitas OPD '+(o.id||'-')+' masih kosong atau contoh.');
 }

 for(const type of SATRIA_MASTER_COLLECTIONS){
   const rows=S[type]||[], ids=new Set();
   for(const r of rows){
     if(ids.has(String(r.id)))add(type,'ID internal ganda: '+r.id);ids.add(String(r.id));
     if(type==='pejabat'){
       if(!satMasterNorm(r.nama))add(type,'Nama pejabat kosong');
       if(!S.opd.some(o=>String(o.id)===String(r.opd)))add(type,'Pejabat '+(r.nama||r.id)+' memiliki OPD tidak ditemukan');
     }
     if(type==='unit'){
       if(!satMasterNorm(r.kode)||!satMasterNorm(r.bidang))add(type,'Kode atau nama unit belum lengkap');
       if(!S.opd.some(o=>String(o.id)===String(r.opd)))add(type,'Unit '+(r.kode||r.id)+' memiliki OPD tidak ditemukan');
     }
     if(type==='penyedia'&&!satMasterNorm(r.nama))add(type,'Nama penyedia kosong');
     if(type==='akun'&&(!satMasterNorm(r.kode)||!satMasterNorm(r.nama)))add(type,'Kode atau nama akun kosong');
   }
 }
 for(const [type,fn] of [
  ['unit',r=>satMasterNorm(r.opd)+'|'+satMasterNorm(r.kode)],
  ['akun',r=>satMasterNorm(r.kode)],
  ['penyedia',r=>satMasterNorm(r.npwp)?'npwp:'+satMasterNorm(r.npwp):'nama:'+satMasterNorm(r.nama)]
 ]){
  const seen=new Set();for(const r of (S[type]||[])){const k=fn(r);if(!k||k.endsWith(':'))continue;if(seen.has(k))add(type,'Duplikat '+(r.kode||r.nama||r.id));seen.add(k)}
 }
 for(const p of S.paket||[]){
   for(const [f,col] of [['ppk','pejabat'],['pp','pejabat'],['kabid','pejabat'],['unit','unit'],['akunId','akun']]){
     if(p[f]&&!S[col].some(r=>String(r.id)===String(p[f])))add(col,'Paket '+(p.rup||p.nama||p.id)+' merujuk '+f+' yang tidak ditemukan');
   }
   for(const w of p.penawaran||[]){if(w.pen&&!S.penyedia.some(r=>String(r.id)===String(w.pen)))add('penyedia','Penawaran pada paket '+(p.rup||p.nama||p.id)+' kehilangan referensi penyedia')}
 }
 return issues;
}
function satMasterCheckNew(m,r,editingId=null){
 const coll=PERAN[m]?'pejabat':m;const list=S[coll]||[];const other=list.filter(x=>String(x.id)!==String(editingId));
 if(['ppk','pp','kabid'].includes(m)){
   if(!satMasterNorm(r.nama))return 'Nama lengkap wajib diisi.';
   if(!S.opd.some(o=>String(o.id)===String(r.opd)))return 'Pilih OPD yang tersedia.';
   if(r.nip&&(!/^\d{8,20}$/.test(String(r.nip).replace(/\s/g,''))))return 'NIP harus berupa 8–20 digit atau dikosongkan bila tidak berlaku.';
   if(r.nip&&other.some(x=>satMasterNorm(x.nip)===satMasterNorm(r.nip)&&satMasterNorm(x.peran)===satMasterNorm(PERAN[m])))return 'NIP dan peran tersebut sudah tercatat.';
 }
 if(m==='unit'){
   if(!satMasterNorm(r.kode)||!satMasterNorm(r.bidang))return 'Kode dan nama unit wajib diisi.';
   if(!S.opd.some(o=>String(o.id)===String(r.opd)))return 'OPD unit tidak tersedia.';
   if(other.some(x=>String(x.opd)===String(r.opd)&&satMasterNorm(x.kode)===satMasterNorm(r.kode)))return 'Kode unit sudah dipakai pada OPD ini.';
 }
 if(m==='akun'){
  if(!satMasterNorm(r.kode)||!satMasterNorm(r.nama))return 'Kode dan nama akun wajib diisi.';
  if(other.some(x=>satMasterNorm(x.kode)===satMasterNorm(r.kode)))return 'Kode rekening sudah ada.';
 }
 if(m==='penyedia'){
  if(!satMasterNorm(r.nama))return 'Nama penyedia wajib diisi.';
  if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email).trim()))return 'Format email penyedia tidak valid.';
  if(r.link){try{const u=new URL(r.link);if(!['https:','http:'].includes(u.protocol))throw Error('protocol')}catch{return 'Link katalog harus berupa alamat http:// atau https://.'}}
  if(r.npwp&&other.some(x=>satMasterNorm(x.npwp)&&satMasterNorm(x.npwp)===satMasterNorm(r.npwp)))return 'NPWP penyedia sudah tercatat.';
  if(other.some(x=>satMasterNorm(x.nama)===satMasterNorm(r.nama)&&satMasterNorm(x.kabupaten)===satMasterNorm(r.kabupaten)))return 'Nama penyedia dan kabupaten/kota sama dengan data yang sudah ada.';
 }
 return '';
}
function satMasterDashboard(){
 const issues=satMasterIssues();const items=issues.slice(0,18);
 return `<section class="satria-master-audit"><div class="satria-master-audit-head"><div><strong>Kontrol Kualitas Data Master</strong><p>Memeriksa duplikasi, relasi ke OPD dan paket, serta referensi yang hilang. Pemeriksaan tidak mengubah data.</p></div><span class="pill">${issues.length} temuan</span></div><div class="satria-master-audit-actions"><button type="button" class="g" data-act="satMasterAudit">Periksa kembali</button><button type="button" class="g" data-act="satMasterExport">Ekspor tab ini (CSV)</button></div>${issues.length?`<details><summary>Periksa ${issues.length} temuan integritas data</summary><ul>${items.map(x=>`<li><b>${esc(x.type)}</b>: ${esc(x.msg)}</li>`).join('')}${issues.length>items.length?`<li>Dan ${issues.length-items.length} temuan lainnya</li>`:''}</ul></details>`:'<p class="satria-master-noissue">Tidak ditemukan masalah berdasarkan aturan pemeriksaan lokal ini.</p>'}</section>`;
}
function satMasterExport(){
 const m=MTAB.some(t=>t[0]===S.ui.mtab)?S.ui.mtab:'ppk', arr=PERAN[m]?S.pejabat.filter(x=>x.peran===PERAN[m]):(S[m]||[]);
 const fields=PERAN[m]?['nama','nip','jabatan','peran','opd','aktif']:(COLS[m]||[]).map(x=>x[0]).concat(['aktif']);
 const csv=x=>window.SATRIA_CORE_GUARDS.csvCell(x);
 const content='\uFEFF'+[fields.map(csv).join(','),...arr.map(r=>fields.map(f=>csv(r[f])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='SATRIA-DataMaster-'+m+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function vMaster(){
 const m=MTAB.some(t=>t[0]===S.ui.mtab)?S.ui.mtab:'ppk';
 const kpi=[
   ['PPK / KPA aktif',S.pejabat.filter(x=>x.peran==='PPK'&&x.aktif!==false).length,'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z M4.5 20.25a6.75 6.75 0 0113.5 0v.75a.75.75 0 01-.75.75h-12a.75.75 0 01-.75-.75v-.75z M19.5 6a3.75 3.75 0 10-7.5 0 3.75 3.75 0 007.5 0z','ppk'],
   ['Pejabat Pengadaan aktif',S.pejabat.filter(x=>x.peran==='PP'&&x.aktif!==false).length,'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12 12 12 12 12s-1.536 0-2.121.879a2.25 2.25 0 000 3.182l.879-.659','pp'],
   ['Kepala Bidang aktif',S.pejabat.filter(x=>x.peran==='Kabid'&&x.aktif!==false).length,'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z','kabid'],
   ['Unit/Bagian aktif',S.unit.filter(x=>x.aktif!==false).length,'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z','unit'],
   ['Penyedia aktif',S.penyedia.filter(x=>x.aktif!==false).length,'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z M18.25 12l1.5 2.25L22 15.75l-2.25 1.5L18.25 19.5l-1.5-2.25L14.5 15.75l2.25-1.5L18.25 12z','penyedia'],
   ['Akun anggaran aktif',S.akun.filter(x=>x.aktif!==false).length,'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v3.75','akun']
 ];
 const body=PERAN[m]?tPejabat(PERAN[m]):tGen(m,COLS[m]);
 const masterScope=activeCloudScope();
 const isAdmin = window.SATRIA_CLOUD_CONFIGURED && window.SATRIA_CLOUD_ROLE==='admin';
 const scopeNote = isAdmin
   ? `<div class="satria-scope-card scope-admin"><div class="scope-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><b>Hak admin penuh.</b> Anda dapat mengelola master semua OPD. Setiap perubahan Operator pada master OPD akan muncul di sini setelah sinkronisasi cloud.</div></div>`
   : (masterScope?`<div class="satria-scope-card"><div class="scope-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><b>Scope Operator:</b> master PPK/KPA, Pejabat Pengadaan, Kepala Bidang, dan Unit/Bagian hanya untuk OPD yang ditugaskan. Penyedia dan Akun Anggaran adalah katalog bersama organisasi. Setiap perubahan disimpan otomatis sebagai delta per-record ke Supabase setelah jeda singkat; pengguna lain diberi notifikasi melalui Supabase Realtime.</div></div>`:'');
 return `
 ${scopeNote}
 ${!satriaPemdaOfficial('nama')?`<div class="card no-print" role="alert" style="border:1px solid #e0a800;background:#fff9ed;color:#854d0e"><b>Identitas Pemerintah Daerah belum resmi.</b> Data Master dan dokumen tidak boleh memakai teks demo sebagai identitas instansi. Admin perlu membuka <a href="#set">Pengaturan Sistem</a> → Identitas Pemerintah Daerah, mengisi nama, kota, provinsi, dan sumber dana yang benar. Data yang tersimpan tidak diubah otomatis.</div>`:''}
 ${satMasterDashboard()}
 <div class="satria-kpi-grid">
   ${kpi.map(([label,count,path,key])=>`
     <div class="satria-kpi-card" data-kpi="${key}">
       <div class="kpi-top">
         <div class="kpi-icon">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${path}"/></svg>
         </div>
         <div class="kpi-badge"><span class="dot"></span> realtime</div>
       </div>
       <div class="kpi-label">${label}</div>
       <div class="kpi-value">${count}</div>
       <div class="kpi-foot"><span class="live-dot"></span> Data Master • ${esc(satriaMasterScopeName())}</div>
     </div>
   `).join('')}
 </div>

 <div class="satria-master-nav-card">
   <div class="master-tabs">
     ${MTAB.map(([k,t])=>`<button class="master-tab ${k===m?'active':''}" data-act="mtab" data-tab="${k}"><span>${t}</span></button>`).join('')}
   </div>
   <div class="master-search-wrap">
     <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="M21 21l-3.5-3.5"/></svg>
     <input id="mSearch" class="master-search" placeholder="Cari nama, NIP, atau kode..." value="${esc(S.ui.ms||'')}">
   </div>
 </div>

 ${fAdd(m)}

 <div class="satria-table-card">
   <div class="table-card-head">
     <div class="table-title">
       <div class="title-accent"></div>
       <span>Daftar ${MTAB.find(x=>x[0]===m)?.[1]||''}</span>
       <span class="count-badge">${(() => { const L = (PERAN[m]?S.pejabat.filter(x=>x.peran===PERAN[m]):S[m]||[]).filter(x=>{ const q=(S.ui.ms||'').toLocaleLowerCase('id-ID').trim(); if(!q) return true; return Object.values(x).join(' ').toLocaleLowerCase('id-ID').includes(q); }); return L.length; })()} data</span>
     </div>
   </div>
   ${body}
 </div>
 <p class="satria-master-note">Pejabat yang dinonaktifkan tetap tampil di dokumen yang sudah dibuat, tetapi tidak dipilih untuk paket baru. Perubahan otomatis tersimpan sebagai delta dan disinkronkan realtime.</p>
 `;
}
function kopEditor(o){
 return `<div class="satria-settings-opd-kop" style="margin-top:12px"><label>Kop surat OPD (gambar)</label>
 <div class="satria-settings-opd-kop-preview">${o.kop?`<img src="${satriaSafeMediaSrc(o.kop)}" alt="Kop ${esc(o.singkat)}">`:'<span class=mut>Belum ada kop gambar. Dokumen memakai kop teks dari data OPD.</span>'}</div>
 <div class="satria-settings-opd-kop-actions"><input type=file accept="image/png,image/jpeg,image/webp,image/gif" data-kopup="${o.id}"> ${o.kop?`<button class=d data-act="rmkop" data-id="${o.id}">Hapus kop</button>`:''}</div>
 <div class=mut>PNG/JPG, maks. 1 MB. Jika tersedia, kop gambar menjadi kop utama dan menggantikan kop teks otomatis (logo pemda tidak ditambahkan lagi). Gunakan gambar yang sudah memuat identitas resmi dan pastikan keterbacaan saat dicetak.</div></div>`}
function satriaSettingsCheck(){const groups={identitas:[],referensi:[],dokumen:[],data:[]};const add=(g,msg)=>groups[g].push(msg);
  if(!satriaPemdaOfficial('nama'))add('identitas','Nama pemerintah daerah kosong atau data contoh');
  if(!satriaPemdaOfficial('kota'))add('identitas','Kota tempat tanda tangan kosong atau data contoh');
  if(!satriaPemdaOfficial('provinsi'))add('identitas','Provinsi kosong atau data contoh');
  if(!satriaPemdaOfficial('sumber'))add('identitas','Sumber dana default kosong atau data contoh');
  const rupKeys=new Set();(S.rupBank||[]).forEach(r=>{const tag=String(r.tahun)+'|'+String(r.opd)+'|'+String(r.rup||'').trim();if(rupKeys.has(tag))add('referensi','Kode RUP duplikat: '+(r.rup||'-'));rupKeys.add(tag);if(!S.opd.some(o=>o.id===r.opd))add('referensi','Bank RUP '+(r.rup||'-')+' merujuk OPD tidak dikenal');if(!S.tahun.includes(+r.tahun))add('referensi','Bank RUP '+(r.rup||'-')+' merujuk tahun tidak terdaftar');});
  (S.unit||[]).forEach(u=>{if(!S.opd.some(o=>o.id===u.opd))add('referensi','Unit '+(u.kode||u.id)+' merujuk OPD tidak dikenal')});
  (S.pejabat||[]).forEach(x=>{if(x.opd&&!S.opd.some(o=>o.id===x.opd))add('referensi','Pejabat '+(x.nama||x.id)+' merujuk OPD tidak dikenal')});
  (S.paket||[]).forEach(p=>{for(const issue of satriaRupLinkValidation(p))add('referensi','Paket '+(p.id||'-')+': '+issue);if((+p.pagu||0)<hps(p))add('data','HPS melebihi pagu paket '+(p.rup||p.id));});
  if(!(S.users||[]).some(u=>u.role==='Admin'&&u.aktif!==false))add('data','Tidak ada Admin aktif');
  if(!S.tahun.length)add('referensi','Belum ada tahun anggaran');if(!S.opd.length)add('referensi','Belum ada OPD');
  [['NODIS','Nota Dinas'],['DPP','DPP'],['BAHR','Reviu DPP'],['BAHP','BAHP'],['PPBJ','SPPBJ']].forEach(([code,label])=>{if(!String(S.penomoran?.[code]||'').trim())add('dokumen','Kode penomoran '+label+' kosong')});
  return groups;}
function satriaSettingsWarnings(){
 const warns=[];
 if(!satriaPemdaOfficial('nama'))warns.push('Nama pemerintah daerah belum diisi atau masih menggunakan data Demo/Contoh.');
 if(!satriaPemdaOfficial('kota'))warns.push('Kota tempat tanda tangan belum diisi atau masih data contoh.');
 if(!satriaPemdaOfficial('provinsi'))warns.push('Provinsi belum diisi atau masih data contoh.');
 if(!satriaPemdaOfficial('sumber'))warns.push('Sumber dana default belum diisi atau masih data simulasi.');
 if(!S.tahun.length)warns.push('Belum ada tahun anggaran.');
 if(new Set(S.tahun.map(Number)).size!==S.tahun.length)warns.push('Terdapat tahun anggaran duplikat.');
 if(!S.opd.length)warns.push('Belum ada OPD.');
  S.paket.forEach(p=>{if(!S.tahun.includes(+p.tahun))warns.push(`Paket ${p.nama||p.id}: tahun ${p.tahun} belum terdaftar.`);if(!S.opd.some(o=>o.id===p.opd))warns.push(`Paket ${p.nama||p.id}: OPD tidak ditemukan.`);if(p.unit&&!S.unit.some(u=>u.id===p.unit))warns.push(`Paket ${p.nama||p.id}: Unit/Bagian tidak ditemukan di Data Master.`);if(!(+p.pagu>0))warns.push(`Paket ${p.nama||p.id}: pagu belum valid.`);if(!satriaSpseIs(p)&&!p.items?.length)warns.push(`Paket ${p.nama||p.id}: rincian item belum tersedia.`);if(hps(p)>+p.pagu)warns.push(`Paket ${p.nama||p.id}: HPS melebihi pagu.`);if(p.items?.some(i=>!(+i.vol>0)||!(+i.hs>0)))warns.push(`Paket ${p.nama||p.id}: terdapat volume/harga item yang belum valid.`);const datePairs=[['tglNodis','tglDpp'],['tglSurvei','tglNego'],['tglNego','tglBahp'],['tglBahp','tglSppbj']];if(datePairs.some(([a,b])=>p[a]&&p[b]&&p[a]>p[b]))warns.push(`Paket ${p.nama||p.id}: tanggal proses perlu diperiksa kronologinya.`);if(p.pemenangId&&!pemenang(p))warns.push(`Paket ${p.nama||p.id}: penetapan pemenang tidak lagi valid terhadap data saat ini.`)});
 S.opd.forEach(o=>{if(!String(o.nama||'').trim()||!String(o.singkat||'').trim()||!String(o.alamat||'').trim())warns.push(`OPD ${o.singkat||'(tanpa singkatan)'}: nama, singkatan, dan alamat wajib lengkap.`);
  const kur=['PPK','PP','Kabid'].filter(r=>!S.pejabat.some(x=>x.opd===o.id&&x.peran===r&&x.aktif!==false&&String(x.nama||'').trim()&&String(x.nip||'').trim()));if(kur.length)warns.push(`OPD ${o.singkat||''}: pejabat aktif dengan nama dan NIP lengkap belum ditetapkan untuk ${kur.join(', ')}.`)});
 [['NODIS','Nota Dinas'],['PPBJ','SPPBJ'],['DPP','DPP/Lampiran Referensi Harga'],['BAHR','BA Reviu DPP'],['BAHEPE','BA Evaluasi Penyedia'],['BAHP','BA Hasil Pemilihan'],['KKNEGO','Kertas Kerja Negosiasi']].forEach(([c,n])=>{if(!String(S.penomoran?.[c]||'').trim())warns.push(`Kode penomoran ${n} belum diisi.`)});

 return warns;
}
function vSet(){
 const k=S.opd[0],warns=satriaSettingsWarnings();
 const checks=satriaSettingsCheck(),totalIssues=Object.values(checks).reduce((n,a)=>n+a.length,0);
 const stat=(title,value,detail)=>`<div class="satria-settings-stat"><small>${esc(title)}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></div>`;
 const diagnostics=`<section class="card satria-settings-health"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Pusat Kendali & Kesehatan Pengaturan</h3><span class="pill">${totalIssues?'Perlu pemeriksaan: '+totalIssues:'Referensi utama konsisten'}</span></div><p class="mut">Pemeriksaan ini bersifat lokal dan tidak menyatakan kepatuhan hukum, keamanan cloud, atau kesiapan dokumen final.</p><div class="satria-settings-stats">${stat('Bank RUP',String((S.rupBank||[]).length),'RUP sumber SiRUP')}${stat('Paket',String(S.paket.length),'Paket aktif di aplikasi')}${stat('OPD',String(S.opd.length),'Unit organisasi')}${stat('Pengguna aktif',String((S.users||[]).filter(u=>u.aktif!==false).length),'Identitas lokal; bukan login')}${stat('Tahun',String(S.tahun.length),'Tahun anggaran tersedia')}${stat('Peringatan',String(totalIssues),'Temuan pemeriksaan tambahan')}</div><details class="satria-settings-detail" ${totalIssues?'open':''}><summary>Rincian pemeriksaan konfigurasi (${totalIssues})</summary>${Object.entries(checks).map(([group,items])=>`<div><b>${esc(({identitas:'Identitas Instansi',referensi:'Relasi Bank RUP / Data Master',dokumen:'Nomor Dokumen',data:'Kualitas Data'})[group])}</b>${items.length?`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="ok">Tidak ada masalah yang terdeteksi pada pemeriksaan ini.</p>'}</div>`).join('')}</details><div class="satria-settings-actions"><button type="button" class="g" data-act="settingsReport">Unduh laporan konfigurasi</button><button type="button" class="g" data-act="settingsBackup">Backup pengaturan & data (JSON)</button><a class="g satria-settings-care-link" href="#care">Buka Perawatan SATRIA</a></div></section>`;
 const inp=(c,f,v,l)=>`<div class=fg><label>${l}</label><input value="${esc(v)}" data-col="${c}" data-id="" data-f="${f}"></div>`;
 const pjNama=(o,r)=>(S.pejabat.find(x=>x.opd===o.id&&x.peran===r)||{}).nama||'belum diatur';
 const kartu=o=>{const used=S.paket.filter(p=>p.opd===o.id).length+(S.rupBank||[]).filter(r=>r.opd===o.id).length;const f=(c,l)=>`<div class=fg><label>${l}</label><input value="${esc(o[c])}" data-col="opd" data-id="${o.id}" data-f="${c}"></div>`;
  return `<div class="card satria-settings-opd-card"><div class="satria-settings-opd-header"><b class="satria-settings-opd-title">${esc(o.singkat||'(tanpa singkatan)')} — ${esc(o.nama)}</b><button class=d ${used?`disabled title="Dipakai ${used} paket"`:''} data-act="delrow" data-c="opd" data-id="${o.id}">Hapus OPD</button></div>
  <div class="satria-settings-opd-fields">${f('nama','Nama instansi')}${f('singkat','Singkatan')}${f('tempat','Tempat pelaksanaan')}${f('alamat','Alamat (kop baris 4)')}${f('kontak','Kontak (kop baris 5)')}</div>${kopEditor(o)}
  <p class=mut>Pejabat: PPK ${esc(pjNama(o,'PPK'))} · PP ${esc(pjNama(o,'PP'))} · Kabid ${esc(pjNama(o,'Kabid'))}. Kelola di <a href="#master">Data Master</a>.</p>${used?`<p class=mut>Dipakai ${used} paket, sehingga tidak bisa dihapus.</p>`:''}</div>`};
 const logo=S.pemda.logo?`<img src="${satriaSafeMediaSrc(S.pemda.logo)}" alt="logo" style="height:70px;border:1px solid #ddd;padding:4px;background:#fff">`:'<div class=mut style="width:120px">Belum ada logo</div>';
 const years=S.tahun.slice().sort();
 const demo=S.paket.find(p=>p.opd===(k&&k.id))||{seq:1,opd:k&&k.id,tahun:S.ui.tahun};
 const docs=[['NODIS','Nota Dinas'],['PPBJ','SPPBJ'],['DPP','DPP & Lampiran Referensi Harga'],['BAHR','BA Reviu DPP'],['BAHEPE','BA Evaluasi Penyedia'],['BAHP','BA Hasil Pemilihan'],['KKNEGO','Kertas Kerja Negosiasi']];
 return `${diagnostics}${warns.length?`<div class=card style="border-color:#e0a800"><b class=warn>Perlu dilengkapi (${warns.length})</b><ul style="margin:6px 0 0">${warns.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'<div class=card><span class=ok>✔ Pengaturan instansi sudah lengkap</span></div>'}
 <div class="card satria-settings-pemda-card"><h3>Identitas Pemerintah Daerah</h3><div class=row>${logo}<div><input type=file id=logoFile accept="image/png,image/jpeg,image/webp,image/gif"> <button class=g data-act="rmlogo">Hapus logo</button><div class=mut>PNG/JPG, maks. 300 KB. Logo tampil pada kop teks otomatis. Jika OPD memakai kop gambar, gambar kop tersebut menggantikan kop teks termasuk logo ini.</div></div></div><br>
  <div class="satria-settings-pemda-fields">${inp('pemda','nama',S.pemda.nama,'Nama pemda (kop baris 1)')}${inp('pemda','kota',S.pemda.kota,'Kota tanda tangan')}${inp('pemda','provinsi',S.pemda.provinsi,'Provinsi')}${inp('pemda','sumber',S.pemda.sumber,'Sumber dana default')}</div></div>
 <div class=card><h3>Pratinjau Kop Surat per OPD</h3><p class=mut>Pratinjau mengikuti aturan yang dipakai saat cetak: kop gambar menggantikan kop teks; jika tidak ada kop gambar, identitas pemda dan OPD dirender dari data konfigurasi.</p>${S.opd.length?S.opd.map(o=>`<div style="margin:12px 0;background:#fff;border:1px solid var(--bd);padding:12px"><b style="color:#334155">${esc(o.singkat)} — ${esc(o.nama)}</b><div style="margin-top:8px">${kop({opd:o.id})}</div></div>`).join(''):'<span class=mut>Belum ada OPD.</span>'}</div>
 <div class=card><h3>Tahun Anggaran</h3><table><tr><th>Tahun</th><th class=n>Paket</th><th class=n>Total pagu</th><th></th></tr>
  ${years.map(t=>{const x=S.paket.filter(p=>p.tahun==t),bankN=(S.rupBank||[]).filter(r=>+r.tahun===+t).length;return `<tr><td>TA ${t} ${t==S.ui.tahun?'<span class=pill>aktif</span>':''}</td><td class=n>${x.length}</td><td class=n>${rp(sum(x,p=>p.pagu))}</td><td>${x.length||bankN?`<span class=mut>${bankN?'Bank RUP: '+bankN+' · ':''}${x.length?'Paket: '+x.length:''}</span>`:`<button class=d data-act="delyear" data-y="${t}">Hapus</button>`}</td></tr>`}).join('')}</table>
  <div class=row><input id=newYear type=number placeholder="contoh: 2027" style="width:140px"><button data-act="addyear">+ Tambah tahun</button></div></div>
 <h3 style="margin:8px 0">Instansi / OPD</h3>${S.opd.map(kartu).join('')}<button class=g data-act="addopd">+ Tambah OPD</button>
 <div class=card style="margin-top:14px"><h3>Penomoran Dokumen</h3><p class=mut>Format: <b>{kode}/{Kode RUP}/{singkatan OPD}/{kode unit}</b>. Kode RUP diambil dari masing-masing paket. Contoh memakai paket pertama.</p>
  <table><tr><th>Dokumen</th><th>Kode</th><th>Contoh nomor</th></tr>${docs.map(([c,l])=>`<tr><td>${l}</td><td><input value="${esc(S.penomoran[c])}" data-col="penomoran" data-id="" data-f="${c}"></td><td>${k?esc(nomor(c,demo)):'-'}</td></tr>`).join('')}</table></div>
 <div class=card><h3>Catatan Kualitas Data</h3><ul><li>Indikator kelengkapan administratif bukan sertifikasi kepatuhan hukum atau bukti pelaksanaan pekerjaan.</li><li>Nilai pagu, HPS, hasil negosiasi, nilai kontrak, dan realisasi pembayaran merupakan ukuran yang berbeda.</li><li>Data PDN, UMKM, katalog, KBLI, status penyedia, dan sumber harga harus didukung bukti yang dapat diverifikasi.</li><li>Pengguna yang dipilih di halaman ini bukan autentikasi keamanan; jangan membagikan file HTML berisi data nyata sebagai sistem multiuser.</li></ul></div><div class=card><h3>Panduan Cepat</h3><ol><li>Isi identitas pemda, logo, dan tahun anggaran.</li><li>Lengkapi setiap OPD beserta pejabat PPK, PP, dan Kabid di Data Master.</li><li>Buat satu atau lebih Paket Pengadaan dari Bank RUP. Setiap paket mempunyai ID tersendiri; pagu/alokasi tiap paket harus diverifikasi agar tidak dihitung ganda.</li><li>Isi harga tayang, sumber/tanggal bukti harga, serta negosiasi per item. Sistem menghitung kandidat dari penawaran lengkap yang tercatat dan dibandingkan dengan HPS; hasil tetap perlu diverifikasi berdasarkan ketentuan pengadaan yang berlaku.</li><li>Isi tanggal, lalu cetak dokumen di menu Dokumen Pengadaan.</li><li>Klik <b>Backup</b> di header secara berkala. Data lokal tersimpan di browser/perangkat aktif; lakukan backup berkala.</li></ol></div>
 <div class=card><h3>Backup &amp; Pemulihan</h3><p class=mut>IndexedDB menyimpan data di browser ini; mode memori sesi kehilangan data saat halaman ditutup. Buat backup JSON sebelum impor, pengosongan data, atau reset. Backup juga mencakup Bank RUP, data paket, master, pengaturan, dan mungkin data pribadi pejabat/penyedia; simpan di lokasi aman. Impor akan mengganti data aktif setelah validasi dan konfirmasi.</p>
  <div class=row><button data-act="export">Unduh backup JSON</button><input type=file id=imp accept=".json,application/json"><button class=g data-act="clearsample">Kosongkan data contoh</button><button class=d data-act="reset">Kembalikan ke data awal</button></div><p class=mut>File impor harus berupa backup SATRIA JSON yang memuat struktur paket, OPD, pengaturan, dan master yang valid. File yang rusak atau tidak sesuai tidak akan diterapkan.</p></div>`;
}
