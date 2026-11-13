/* SATRIA JKK • layar terpisah, transaksi melalui paket existing; tidak mengubah Bank RUP. */
(function(root,factory){'use strict';const api=Object.freeze(factory(root));if(root)root.SATRIA_JKK_WORKSPACE=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:null,function(root){'use strict';
 const core=root?.SATRIA_JKK_CORE||(typeof module==='object'&&module.exports?require('./satria-jkk-core.js'):null);
 const schema=root?.SATRIA_JKK_SCHEMA||(typeof module==='object'&&module.exports?require('./satria-jkk-schema.js'):null);
 const integration=root?.SATRIA_PL_INTEGRATION||(typeof module==='object'&&module.exports?require('./satria-pl-integration.js'):null);
 const docs=root?.SATRIA_JKK_DOCS||(typeof module==='object'&&module.exports?require('./satria-jkk-docs.js'):null);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const str=(v,m=1500)=>String(v??'').trim().slice(0,m);
 const money=v=>v==null||v===''?'—':'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID');
 const opts=(values,current)=>values.map(x=>`<option value="${safe(x)}" ${String(current||'')===x?'selected':''}>${safe(x||'— Belum diisi —')}</option>`).join('');
 const input=(label,key,value,{type='text',help='',options=null,placeholder='',max=300}={})=>`<label class="jkk-field"><span>${safe(label)}</span>${options?`<select data-jkk-field="${safe(key)}">${opts(['',...options],value)}</select>`:type==='textarea'?`<textarea data-jkk-field="${safe(key)}" maxlength="${max}" rows="3" placeholder="${safe(placeholder)}">${safe(value)}</textarea>`:`<input type="${safe(type)}" data-jkk-field="${safe(key)}" value="${safe(value)}" maxlength="${max}" placeholder="${safe(placeholder)}" ${type==='number'?'min="0" step="any" inputmode="decimal"':''}>`}${help?`<small>${safe(help)}</small>`:''}</label>`;
 const section=(key,title,subtitle,html,readonly)=>`<section class="jkk-section" data-jkk-section="${safe(key)}"><div class="jkk-section-head"><div><h3>${safe(title)}</h3><p>${safe(subtitle)}</p></div><button type="button" data-jkk-save="${safe(key)}" ${readonly?'disabled':''}>Simpan ${safe(title)}</button></div><fieldset class="jkk-section-body jkk-fieldset" ${readonly?'disabled':''}>${html}</fieldset><p class="jkk-status" data-jkk-status aria-live="polite">${readonly?'Akses baca-saja':'Perubahan tersimpan saat berpindah isian; tombol Simpan tersedia untuk memastikan.'}</p></section>`;
 function accessRow(row){const scope=typeof activeCloudScope==='function'?activeCloudScope():null;if(scope&&(!Array.isArray(scope.opdIds)||!scope.opdIds.includes(String(row.opd))||!Array.isArray(scope.years)||!scope.years.includes(Number(row.tahun))))return false;return typeof S!=='undefined'&&Number(row.tahun)===Number(S.ui.tahun)&&(S.ui.opd==='all'||String(row.opd)===String(S.ui.opd));}
 function writable(p){return !!p&&!p.arsip&&typeof canWrite==='function'&&canWrite()&&accessRow(p);}
 function linked(r,packages){return packages.filter(p=>core.rupForPackage(p,[r]).rup===r);}
 function eligibleRupRows(){if(typeof S==='undefined')return [];return (S.rupBank||[]).filter(r=>accessRow(r)&&core.rupEligible(r));}
 function candidatePackages(){if(typeof S==='undefined')return [];const bank=eligibleRupRows();return (S.paket||[]).filter(p=>accessRow(p)&&core.eligiblePackage(p,bank).eligible);}
 function chooser(){const rows=eligibleRupRows(),pkgs=candidatePackages(),can=typeof canWrite==='function'&&canWrite();const index=pkgs.map(p=>{const r=core.rupForPackage(p,rows).rup;return {p,r}});
  return `<div class="jkk-list"><div class="jkk-lead"><h3>Paket dari Bank RUP yang cocok</h3><p>Hanya Bank RUP berjenis <b>Jasa Konsultansi</b> dan bermetode <b>Pengadaan Langsung</b>. Subjenis konstruksi harus dipastikan dari KAK. Paket metode lain tidak ditampilkan.</p></div>${index.length?`<div class="jkk-cards">${index.map(({p,r})=>`<a class="jkk-rup-card" href="#jkk/${encodeURIComponent(p.id)}"><span class="jkk-label">${safe(r.rup)} · TA ${safe(p.tahun)} · ${safe(p.jalurPengadaan==='SPSE_MONITOR'?'SPSE':'Paket')}</span><strong>${safe(p.nama)}</strong><span>${money(p.pagu)} · ${core.subtypeConfirmed(p,r)?'Konstruksi tercatat':'Perlu isi subjenis konstruksi'}</span></a>`).join('')}</div>`:'<p class="jkk-muted">Belum ada paket terkait yang cocok. Anda dapat memulai dari Bank RUP di bawah tanpa mengubah data lama.</p>'}
  <div class="jkk-start"><h3>Mulai kertas kerja dari Bank RUP</h3><p>Jika RUP belum dipakai paket, buat satu paket monitoring SPSE dengan alokasi yang dipilih. Jika sudah ada paket, gunakan paket terkait di atas; tidak perlu menggandakan.</p>${rows.length?`<select data-jkk-rup-choose><option value="">— Pilih RUP Jasa Konsultansi / Pengadaan Langsung —</option>${rows.map(r=>`<option value="${safe(r.id)}">${safe(r.rup)} — ${safe(r.nama)}</option>`).join('')}</select><div data-jkk-rup-info><p class="jkk-muted">Pilih RUP untuk melihat status paket dan alokasi yang tersedia.</p></div>`:'<p>Belum ada Bank RUP dengan klasifikasi yang cocok. Periksa jenis dan metode pada menu Input RUP → Bank RUP.</p>'}${!can?'<p class="jkk-muted">Akun baca-saja tidak dapat membuat paket baru.</p>':''}</div></div>`;
 }
 function rupInfo(r){const candidates=(S.paket||[]).filter(p=>String(p.rupBankId)===String(r.id)||Array.isArray(p.rupBankIds)&&p.rupBankIds.map(String).includes(String(r.id)));
   const existing=candidates.filter(p=>accessRow(p));const status=typeof satriaRupStatusAnggaran==='function'?satriaRupStatusAnggaran(r):null;
   const eligible=existing.filter(p=>core.eligiblePackage(p,[r]).eligible);
   if(existing.length)return `<p>RUP sudah dipakai ${existing.length} paket. Untuk menghindari duplikasi, gunakan paket terkait:</p><div class="jkk-cards">${existing.map(p=>`<div class="jkk-rup-card"><strong>${safe(p.nama)}</strong><small>${safe(core.eligiblePackage(p,[r]).issue||'Jenis dan metode paket cocok')}</small>${eligible.includes(p)?`<a href="#jkk/${encodeURIComponent(p.id)}">Buka kertas kerja →</a>`:`<a href="#${p.jalurPengadaan==='SPSE_MONITOR'?'spse':'paket'}/${encodeURIComponent(p.id)}">Periksa klasifikasi paket →</a>`}</div>`).join('')}</div>`;
   if(!status?.valid||status.sisa<=0)return '<p class="jkk-warning">Alokasi RUP tidak tersedia atau perlu diperiksa pada Bank RUP. Pembuatan paket dibatasi untuk menjaga saldo historis.</p>';
   const can=typeof canWrite==='function'&&canWrite();return `<div class="jkk-grid"><div class="jkk-mini"><small>Pagu RUP</small><strong>${money(r.pagu)}</strong></div><div class="jkk-mini"><small>Sisa alokasi dihitung SATRIA</small><strong>${money(status.sisa)}</strong></div></div><div class="jkk-grid">${input('Alokasi paket kertas kerja (Rp)','alokasi','',{type:'number',placeholder:'Tidak ditentukan otomatis',help:'Harus positif dan tidak melebihi sisa alokasi RUP.'})}${input('Subjenis dari KAK','subjenis','',{options:['Konstruksi'],help:'Pilih Konstruksi hanya bila jenis layanan sesuai dokumen sumber.'})}</div><button type="button" data-jkk-create ${can?'':'disabled'}>Buat paket & buka kertas kerja</button>`;
 }
 // Delapan layar mengikuti tahapan workbook. Panel tersembunyi tidak dihapus dari model data.
 const STEPS=Object.freeze([
  ['rup','Pilih Paket Bank RUP'],['meta','Identitas & Administrasi'],['reviu','Reviu Persiapan Pengadaan'],
  ['kualifikasi','Evaluasi Kualifikasi'],['penawaran','Evaluasi Dokumen Penawaran'],
  ['survei','Survei Harga'],['biaya','HPS & Negosiasi'],['dokumen','Hasil Kertas Kerja']
 ]);
 const stepMemory=new Map();
 const identityCell=(label,value)=>`<div class="jkk-mini"><small>${safe(label)}</small><strong>${safe(value==null||value===''?'—':value)}</strong></div>`;
 const fieldset=(rows)=>`<div class="jkk-grid">${rows.join('')}</div>`;
 function viewP(p){
  const match=core.eligiblePackage(p,S.rupBank||[]);
  if(!match.eligible)return `<section class="jkk-block"><h3>Paket tidak cocok</h3><p class="jkk-warning">${safe(match.issue)}</p><a href="#jkk">Kembali ke Bank RUP</a></section>`;
  const r=match.rup,d=core.model(p.kkJkk),readonly=!writable(p),t=core.totals(d),warnings=core.warnings(p,r,d),moneyState=integration.financial(p,S.rupBank||[]);
  const progress=core.progress(d,schema),confirmed=core.subtypeConfirmed(p,r);
  const selectedStep=stepMemory.get(String(p.id))||'rup';
  const supplierOptions=(S.penyedia||[]).filter(x=>!x.opd||String(x.opd)===String(p.opd));
  const wrap=(key,inner)=>`<div class="jkk-step-content" data-jkk-step-panel="${key}" ${selectedStep===key?'':'hidden'}>${inner}</div>`;
  const nav=`<nav class="jkk-step-nav" aria-label="Tahapan kertas kerja">${STEPS.map(([key,title],i)=>`<button type="button" data-jkk-step="${key}" class="${selectedStep===key?'is-active':''}" aria-current="${selectedStep===key?'step':'false'}"><span>${i+1}</span>${safe(title)}</button>`).join('')}</nav>`;
  const info=wrap('rup',`<section class="jkk-section"><div class="jkk-section-head"><div><h3>1. Pilih Paket Bank RUP</h3><p>Paket terhubung melalui ID Bank RUP, bukan berdasarkan kemiripan nama. Data berikut hanya dibaca, tidak diedit pada kertas kerja.</p></div></div><div class="jkk-section-body"><div class="jkk-grid">${identityCell('Kode RUP',r.rup)}${identityCell('Nama paket',p.nama)}${identityCell('Pagu RUP',money(r.pagu))}${identityCell('Alokasi paket',money(p.pagu))}${identityCell('OPD',((S.opd||[]).find(x=>String(x.id)===String(p.opd))||{}).nama||p.opd)}${identityCell('Tahun anggaran',p.tahun)}${identityCell('Metode pemilihan',r.metodePemilihan)}${identityCell('Jenis pengadaan',r.jenisPengadaan)}${identityCell('Sumber dana',p.sumber||r.sumber)}</div><p class="jkk-muted">Bila klasifikasi salah, perbaiki dari Bank RUP/paket sumber. Modul ini tidak mengubah data master.</p><button type="button" data-jkk-step="meta" class="jkk-next">Lanjut: Identitas & Administrasi →</button></div></section>`);
  const metaBase=fieldset([
   input('Subjenis konsultansi (dari KAK)','subjenis',d.subjenis||(confirmed?'Konstruksi':''),{options:['Konstruksi'],help:'Harus sesuai KAK; bukan diprediksi dari nama paket.'}),
   input('Jenis layanan konsultansi','layanan',d.layanan,{options:['Perencanaan/perancangan','Pengawasan','Manajemen konstruksi','Layanan konsultansi konstruksi lainnya']}),
   input('Bentuk penyedia','bentuk',d.bentuk,{options:['Perorangan','Badan Usaha']}),
   input('Lokasi pekerjaan','lokasi',d.lokasi||p.lokasiPengiriman||''),
   input('Alamat lengkap lokasi / unit','alamatPekerjaan',d.alamatPekerjaan),
   input('Durasi pelaksanaan','durasi',d.durasi),input('Waktu pemanfaatan','waktuPemanfaatan',d.waktuPemanfaatan),
   input('Nomor surat permintaan dari PPK','nomorPermintaan',d.nomorPermintaan),
   input('Tanggal surat permintaan','tanggalPermintaan',d.tanggalPermintaan,{type:'date'}),
   input('Referensi KAK','refKak',d.refKak),input('Referensi HPS yang ditetapkan PPK','refHps',d.refHps),
   input('Nomor undangan reviu','nomorUndReviu',d.nomorUndReviu),
   input('Tanggal reviu','tanggalReviu',d.tanggalReviu,{type:'date'}),
   input('Jam reviu (INPUT_META)','jamReviu',d.jamReviu,{placeholder:'Contoh: 09.00 WIB – selesai'}),
   input('Tempat / media reviu','tempatReviu',d.tempatReviu),
   input('Nomor BA reviu','nomorBaReviu',d.nomorBaReviu),
   input('Nomor undangan pengadaan langsung','nomorUndangan',d.nomorUndangan),
   input('Tanggal undangan pengadaan langsung','tanggalUndangan',d.tanggalUndangan,{type:'date'})
  ]);
  const jadwalCols=[['uploadMulai','Upload mulai'],['uploadSelesai','Upload selesai'],['pembukaanMulai','Pembukaan mulai'],['pembukaanSelesai','Pembukaan selesai'],['evaluasiMulai','Evaluasi mulai'],['evaluasiSelesai','Evaluasi selesai'],['klarifikasiMulai','Klarifikasi mulai'],['klarifikasiSelesai','Klarifikasi selesai'],['kontrakMulai','Kontrak mulai'],['kontrakSelesai','Kontrak selesai']];
  const sched=`<details class="jkk-criteria"><summary><b>Jadwal Pengadaan Langsung dari INPUT_META</b><span>10 kolom · isi bila tersedia</span></summary><div class="jkk-grid jkk-in-details">${jadwalCols.map(([key,label])=>input(label,key,d.jadwal?.[key]||'',{placeholder:'Tanggal/jam sesuai jadwal SPSE'}).replaceAll('data-jkk-field=', 'data-jkk-jadwal=')).join('')}</div></details>`;
  const monRows=(p.spseMonitoring?.stages||[]).filter(x=>x.planStart||x.planEnd||x.actual).map(x=>`<li>${safe(x.title||x.key)}: rencana ${safe(x.planStart||'—')} sampai ${safe(x.planEnd||'—')} · aktual ${safe(x.actual||'—')}</li>`).join('');
  const monReference=`<details class="jkk-criteria"><summary><b>Referensi monitoring SPSE (baca saja)</b></summary><p>Jadwal SPSE resmi/aktual adalah catatan terpisah, tidak menimpa jadwal dari INPUT_META.</p><ul>${monRows||'<li>Belum ada tahapan SPSE yang dicatat.</li>'}</ul><a href="#spse/${encodeURIComponent(p.id)}">Buka Monitoring SPSE →</a></details>`;
  const meta=wrap('meta',section('meta','2. Identitas & Administrasi','Isian MASTER_PAKET dan INPUT_META; kode RUP, pagu dan OPD berasal dari SATRIA.',metaBase+sched+monReference,readonly));
  const critRow=(item,value,kind)=>`<div class="jkk-criterion" data-jkk-criterion-row="${safe(item.id)}"><div class="jkk-criterion-title"><b>${safe(item.text)}</b><small>${safe(item.ref?'Acuan: '+item.ref:item.group)}</small></div><div class="jkk-grid">${input('Bukti / dasar / halaman','bukti',value.bukti||'').replaceAll('data-jkk-field=','data-jkk-col=')}<label class="jkk-field"><span>${kind==='reviu'?'Status reviu':'Hasil pemeriksaan'}</span><select data-jkk-col="status">${opts(core.statuses[kind==='reviu'?'reviu':'eval'],value.status||'')}</select></label>${input(kind==='reviu'?'Temuan / alasan':'Catatan / klarifikasi','catatan',value.catatan||'',{type:'textarea',max:1000}).replaceAll('data-jkk-field=','data-jkk-col=')}${kind==='reviu'?`${input('Tindakan / perbaikan','tindakan',value.tindakan||'',{type:'textarea',max:1000}).replaceAll('data-jkk-field=','data-jkk-col=')}${input('PIC','pic',value.pic||'').replaceAll('data-jkk-field=','data-jkk-col=')}${input('Target selesai','target',value.target||'',{placeholder:'Tanggal/target sesuai catatan'}).replaceAll('data-jkk-field=','data-jkk-col=')}`:''}</div></div>`;
  const grouped=schema.rev.reduce((out,x)=>{(out[x.group]||(out[x.group]=[])).push(x);return out;},{});
  const review=Object.entries(grouped).map(([group,items])=>`<details class="jkk-criteria"><summary><b>${safe(group)}</b><span>${items.filter(x=>!!d.reviu?.[x.id]?.status).length}/${items.length} terisi</span></summary>${items.map(x=>critRow(x,d.reviu?.[x.id]||{},'reviu')).join('')}</details>`).join('');
  const reviewFields=fieldset([input('Keputusan reviu oleh Pejabat Pengadaan','keputusanReviu',d.keputusanReviu,{options:['Dapat dilanjutkan','Perlu perbaikan','Belum dapat disimpulkan']}),input('Target perbaikan keseluruhan','targetPerbaikan',d.targetPerbaikan),input('Catatan / tindak lanjut reviu','catatanReviu',d.catatanReviu,{type:'textarea',max:1200})]);
  const reviu=wrap('reviu',section('reviu','3. Reviu Persiapan Pengadaan','42 butir; setiap butir memiliki bukti, status, temuan, tindakan, PIC, dan target. Tidak ada status otomatis.',review+reviewFields,readonly));
  const type=d.bentuk==='Badan Usaha'?'badanUsaha':'perorangan',criteria=schema[type];
  const note= d.bentuk==='Badan Usaha'?'<p class="jkk-warning">Kriteria Badan Usaha masih kerangka awal SATRIA. Cocokkan dengan Dokumen Pemilihan sebelum digunakan.</p>':!d.bentuk?'<p class="jkk-warning">Pilih bentuk penyedia di langkah 2 agar kriteria yang ditampilkan sesuai.</p>':'';
  const supplierSelect=`<label class="jkk-field"><span>Ambil dari Data Master Penyedia</span><select data-jkk-supplier><option value="">— Pilih jika ada —</option>${supplierOptions.map(x=>`<option value="${safe(x.id)}" ${String(x.id)===String(d.penyediaId)?'selected':''}>${safe(x.nama)}</option>`).join('')}</select></label>`;
  const kualifikasiBody=note+fieldset([input('Nama calon penyedia','namaPenyedia',d.namaPenyedia),supplierSelect,input('KUA — Nomor / tanggal penawaran','kuaNoTglPenawaran',d.kuaNoTglPenawaran),input('KUA — Tempat / tanggal evaluasi','kuaTempatTglEvaluasi',d.kuaTempatTglEvaluasi),input('Nama evaluator (opsional)','kuaEvaluator',d.kuaEvaluator),input('KUA — Catatan / kesimpulan INPUT_META','kuaCatatan',d.kuaCatatan,{type:'textarea'}),input('Kesimpulan evaluasi kualifikasi oleh PP','kesimpulanKualifikasi',d.kesimpulanKualifikasi,{type:'textarea'})])+`<div class="jkk-criteria-list">${criteria.kua.map(x=>critRow(x,d.kualifikasi?.[x.id]||{},'eval')).join('')}</div>`;
  const kualifikasi=wrap('kualifikasi',section('kualifikasi','4. Evaluasi Kualifikasi',`Kriteria ${criteria.kua.length} butir sesuai bentuk penyedia; kolom hasil, bukti, dan catatan mengikuti INPUT_KUALIFIKASI.`,kualifikasiBody,readonly));
  const penBody=note+fieldset([input('Nomor dokumen penawaran','nomorPenawaran',d.nomorPenawaran),input('Tanggal dokumen penawaran','tanggalPenawaran',d.tanggalPenawaran,{type:'date'}),input('Tanggal evaluasi','tanggalEvaluasi',d.tanggalEvaluasi,{type:'date'}),input('PEN — Nomor / tanggal penawaran','penNoTglPenawaran',d.penNoTglPenawaran),input('PEN — Tempat / tanggal evaluasi','penTempatTglEvaluasi',d.penTempatTglEvaluasi),input('Nama evaluator (opsional)','penEvaluator',d.penEvaluator),input('PEN — Catatan / kesimpulan INPUT_META','penCatatan',d.penCatatan,{type:'textarea'}),input('Kesimpulan evaluasi penawaran oleh PP','kesimpulanPenawaran',d.kesimpulanPenawaran,{type:'textarea'}),input('Catatan evaluasi tambahan','catatanEvaluasi',d.catatanEvaluasi,{type:'textarea'})])+`<div class="jkk-criteria-list">${criteria.pen.map(x=>critRow(x,d.penawaran?.[x.id]||{},'eval')).join('')}</div>`;
  const penawaran=wrap('penawaran',section('penawaran','5. Evaluasi Dokumen Penawaran',`Kriteria ${criteria.pen.length} butir sesuai bentuk penyedia; hasil, bukti, catatan mengikuti INPUT_PENAWARAN.`,penBody,readonly));
  const surveyRows=d.biaya.map((x,i)=>{const v=d.survei?.[x.id]||{};const price=core.surveyPrice(v);const source=v.manual!==''&&v.manual!=null?'Pilihan manual':price!==null?'Minimum dari sumber tersedia':'Belum ada harga sumber';return `<div class="jkk-price-row" data-jkk-survey-row="${safe(x.id)}"><div class="jkk-price-title"><b>${i+1}. ${safe(x.uraian||'Item survei belum dinamai')}</b><span>${safe(x.kategori)} · ${safe(x.satuan||'satuan belum diisi')}</span></div><div class="jkk-grid jkk-prices">${input('Item survei','item',v.item||x.uraian).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Kualifikasi / persyaratan','kualifikasi',v.kualifikasi).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Standar referensi (Rp)','standar',v.standar,{type:'number'}).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Kontrak sejenis (Rp)','kontrak',v.kontrak,{type:'number'}).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Penawaran calon (Rp)','calon',v.calon,{type:'number'}).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Harga dipilih manual (Rp)','manual',v.manual,{type:'number',help:'Kosong = ambil nilai paling rendah dari referensi tersedia.'}).replaceAll('data-jkk-field=','data-jkk-survey-col=')}${input('Keterangan / sumber bukti','keterangan',v.keterangan).replaceAll('data-jkk-field=','data-jkk-survey-col=')}</div><div class="jkk-survey-result"><span>Harga hasil survei: <b>${money(price)}</b><small>${safe(source)}</small></span><button type="button" data-jkk-apply-survey="${safe(x.id)}" ${readonly||price===null?'disabled':''}>Pakai sebagai tarif HPS</button></div></div>`;}).join('');
  const survei=wrap('survei',section('survei','6. Survei Harga','INPUT_SURVEI: sumber harga per item, harga terpilih manual atau nilai minimum referensi. Tidak menimpa HPS PPK tanpa pilihan pengguna.',`<p class="jkk-muted">Buat rincian satu kali; rincian sama dipakai di survei dan perhitungan HPS.</p><button type="button" data-jkk-add="survei" ${readonly?'disabled':''}>+ Tambah item survei</button>${surveyRows||'<p class="jkk-muted">Belum ada item. Klik Tambah item survei.</p>'}`,readonly));
  const priceRows=d.biaya.map((x,i)=>`<div class="jkk-price-row" data-jkk-price-row="${safe(x.id)}"><div class="jkk-price-title"><b>${i+1}. ${safe(x.uraian||'Rincian baru')}</b><button type="button" data-jkk-remove="${safe(x.id)}" ${readonly?'disabled':''}>Hapus item</button></div><div class="jkk-grid jkk-prices">${input('Kelompok biaya','kategori',x.kategori,{options:['Personel','Nonpersonel','Belum ditentukan']})}${input('Uraian biaya','uraian',x.uraian)}${input('Volume','volume',x.volume,{type:'number'})}${input('Satuan','satuan',x.satuan)}${input('Harga HPS satuan (Rp)','harga',x.harga,{type:'number',help:core.surveyPrice(d.survei?.[x.id])!==null?'Survei tersedia: '+money(core.surveyPrice(d.survei[x.id])):'Berdasarkan dokumen/perhitungan HPS PPK'})}${input('Referensi survei / sumber','survei',x.survei)}${input('Keterangan biaya','keterangan',x.keterangan||'')}${input('Harga penawaran satuan (Rp)','penawaran',x.penawaran,{type:'number'})}${input('Harga hasil negosiasi satuan (Rp)','negosiasi',x.negosiasi,{type:'number'})}</div></div>`).join('');
  const hargaFields=fieldset([input('Nilai HPS ditetapkan PPK (Rp)','hpsPPK',d.hpsPPK,{type:'number',help:'Bukan pagu RUP; isi dari dokumen HPS PPK.'}),input('Tarif pajak (%)','tarifPajak',d.tarifPajak,{type:'number',help:'Isi jika pajak relevan, sesuai dasar pajak; tidak ada tarif paksa.'}),input('Dasar/perlakuan pajak','keteranganPajak',d.keteranganPajak),input('Harga penawaran/nego','basisPenawaran',d.basisPenawaran,{options:['Termasuk pajak','Belum termasuk pajak'],help:'Wajib untuk membandingkan HPS, penawaran, dan negosiasi dengan dasar pajak sama.'}),input('Nomor BA klarifikasi / negosiasi','nomorBaNego',d.nomorBaNego),input('Tanggal klarifikasi/negosiasi','tanggalNego',d.tanggalNego,{type:'date'}),input('Hasil klarifikasi/negosiasi oleh PP','hasilNego',d.hasilNego,{type:'textarea'}),input('Catatan negosiasi','catatanNego',d.catatanNego,{type:'textarea'})]);
  const sums=`<div class="jkk-grid jkk-sum"><div><small>HPS rincian termasuk pajak</small><strong data-jkk-total="hps">${money(t.hps)}</strong></div><div><small>HPS PPK</small><strong data-jkk-total="hpsPPK">${money(d.hpsPPK)}</strong></div><div><small>Penawaran setara pajak HPS</small><strong data-jkk-total="offer">${money(t.offerComparable)}</strong></div><div><small>Negosiasi setara pajak HPS</small><strong data-jkk-total="nego">${money(t.negoComparable)}</strong></div></div>${t.selisih!==null&&t.selisih!==0?`<p class="jkk-warning">Selisih rincian HPS dengan HPS PPK: ${money(Math.abs(t.selisih))}. Periksa sebelum mencetak.</p>`:''}<p class="jkk-muted">Harga, penawaran, dan hasil negosiasi dihitung terpisah; keputusan akhir tetap diisi PP.</p>`;
  const biaya=wrap('biaya',section('biaya','7. HPS & Negosiasi','INPUT_HARGA: biaya personel/nonpersonel, penawaran, hasil negosiasi, perhitungan otomatis.',hargaFields+`<div class="jkk-price-header"><h4>Rincian biaya (dinamis)</h4>${!d.biaya.length&&moneyState.legacyRows?`<button type="button" data-jkk-import-legacy ${readonly?'disabled':''}>Salin ${moneyState.legacyRows} rincian lama (sekali, konfirmasi)</button>`:''}<button type="button" data-jkk-add="biaya" ${readonly?'disabled':''}>+ Tambah rincian</button></div>${priceRows||'<p>Belum ada rincian.</p>'}`+sums,readonly));
  const person=(id)=>(S.pejabat||[]).find(x=>String(x.id)===String(id))||{};
  const docCtx={p,r,pp:person(p.pp).nama||'',supplier:d.namaPenyedia||((S.penyedia||[]).find(x=>String(x.id)===String(d.penyediaId))||{}).nama||''};
  const docBox=`<section class="jkk-section"><div class="jkk-section-head"><div><h3>8. Hasil Kertas Kerja</h3><p>Pratinjau tiap dokumen, kemudian cetak/simpan PDF untuk kebutuhan administrasi LPSE/SPSE.</p></div></div><div class="jkk-section-body"><label class="jkk-print-mode"><input type="checkbox" data-jkk-clean-print><span><b>Cetak bersih untuk berkas LPSE</b><small>Label DRAF hanya hilang jika persyaratan minimum dokumen terpenuhi. Ini bukan pengesahan atau persetujuan.</small></span></label><div class="jkk-doc-grid">${docs.DOCS.map(([key,title])=>`<div class="jkk-doc-tile"><b>${safe(title)}</b><small>${docs.readiness(key,docCtx).ready?'Komponen minimum terisi — periksa substansi':docs.readiness(key,docCtx).missing.length+' komponen masih perlu dilengkapi'}${key==='pemilihan-jkk'?' · hanya kerangka kerja':''}</small><div><button type="button" data-jkk-preview="${safe(key)}" ${confirmed?'':'disabled'}>Pratinjau</button><button type="button" data-jkk-print="${safe(key)}" ${confirmed?'':'disabled'}>Cetak / PDF</button></div></div>`).join('')}</div>${!confirmed?'<p class="jkk-warning">Konfirmasi subjenis Konstruksi pada langkah 2 dahulu.</p>':''}<p class="jkk-muted">Tidak semua dokumen wajib diunggah; pilih sesuai tahap LPSE. Tidak tersedia unggah otomatis atau persetujuan berjenjang.</p></div></section>`;
  const doc=wrap('dokumen',docBox);
  const moneyNote=moneyState.conflict?`<div class="jkk-issues"><b>Rincian lama dan JKK berbeda.</b> Rincian paket lama ${money(moneyState.legacy)}, rincian JKK ${money(moneyState.total)}, selisih ${money(Math.abs(moneyState.delta))}. Sumber aktif dokumen JKK adalah <b>rincian pada langkah 7</b>. Tidak ada penimpaan otomatis.</div>`:!d.biaya.length&&moneyState.legacyRows?`<div class="jkk-issues"><b>${moneyState.legacyRows} rincian lama ditemukan.</b> Buka langkah 7 untuk menyalin secara eksplisit; klasifikasi personel/nonpersonel dan harga tetap harus diperiksa.</div>`:'';
  const referenceNote=Object.keys(p.spseMonitoring?.stages||{}).length?'<p class="jkk-muted">Jadwal yang dicatat di Monitoring SPSE adalah referensi kejadian SPSE, bukan jadwal INPUT_META. Keduanya tidak saling menimpa.</p>':'';
  const issueHtml=warnings.length?`<div class="jkk-issues"><b>${warnings.length} hal perlu diperiksa:</b><ul>${warnings.map(x=>`<li>${safe(x)}</li>`).join('')}</ul></div>`:'<p class="jkk-ready">Tidak ditemukan peringatan nilai pada data terisi. Status ini bukan pengesahan.</p>';
  return `<div class="jkk-detail" data-jkk-panel="${safe(p.id)}"><div class="jkk-breadcrumb"><a href="#jkk">← Pilih RUP lain</a> · <a href="#kerja/${encodeURIComponent(p.id)}">Ruang Kerja PP</a></div><div class="jkk-identity"><div><small>RUP ${safe(r.rup)} · TA ${safe(p.tahun)} · ${safe(r.jenisPengadaan)} / ${safe(r.metodePemilihan)}</small><h2>${safe(p.nama)}</h2><p>8 langkah sesuai workbook · tanpa input berulang · perubahan disimpan hanya pada paket.kkJkk.</p></div><div class="jkk-budget"><small>Pagu paket</small><b>${money(p.pagu)}</b><span>${safe(p.opd)}</span></div></div><div class="jkk-kpis"><div><small>Reviu</small><b>${progress.reviu}/${progress.semuaReviu}</b></div><div><small>Kualifikasi</small><b>${progress.kua}/${progress.semuaKua}</b></div><div><small>Penawaran</small><b>${progress.pen}/${progress.semuaPen}</b></div><div><small>Rincian biaya</small><b>${d.biaya.length}</b></div></div>${moneyNote}${issueHtml}${readonly?'<p class="jkk-warning">Akses baca-saja: dokumen dapat dilihat dan dicetak, data tidak bisa diubah.</p>':''}${nav}${info}${meta}${reviu}${kualifikasi}${penawaran}${survei}${biaya}${doc}</div>`;
 }
 function page(){if(typeof S==='undefined')return '<section class="card">Data SATRIA belum tersedia.</section>';const pkgs=candidatePackages(),chosen=pkgs.find(p=>String(p.id)===String(S.ui.pid||''));return `<section class="jkk-page"><div class="jkk-hero"><div><small>✦ SATRIA · EKOSISTEM PEJABAT PENGADAAN</small><h2>Kertas Kerja Konsultansi Konstruksi</h2><p>Pengadaan Langsung · Terhubung dengan Bank RUP · Dokumen pendamping untuk proses LPSE/SPSE.</p></div><span>Tanpa approval berjenjang</span></div>${chosen?viewP(chosen):chooser()}<p class="jkk-footnote">SATRIA hanya membantu menyiapkan dokumen pendukung. Transaksi dan unggahan resmi dilakukan secara manual di LPSE/SPSE sesuai kewenangan.</p></section>`;}
 function findCurrent(host){const p=typeof P==='function'?P(host?.dataset.jkkPanel):null;return p&&accessRow(p)&&core.eligiblePackage(p,S.rupBank||[]).eligible?p:null;}
 function notify(host,message,error=false){const el=host?.querySelector('[data-jkk-status]')||host?.querySelector('[data-jkk-rup-info]');if(el){el.textContent=message;el.classList.toggle('jkk-error',error);}else if(root?.alert&&error)root.alert(message);}
 function dataForSection(section,d){
  const key=section.dataset.jkkSection;
  if(['meta','reviu','kualifikasi','penawaran','biaya'].includes(key)){
   for(const e of section.querySelectorAll('[data-jkk-field]')){
    if(e.closest('[data-jkk-price-row]'))continue;
    d[e.dataset.jkkField]=str(e.value,1500);
   }
  }
  if(key==='meta'){
   d.jadwal={...d.jadwal};
   for(const e of section.querySelectorAll('[data-jkk-jadwal]'))d.jadwal[e.dataset.jkkJadwal]=str(e.value,250);
  }
  if(['reviu','kualifikasi','penawaran'].includes(key)){
   const out={...(d[key]||{})};
   for(const el of section.querySelectorAll('[data-jkk-criterion-row]')){
    const fields={};for(const x of el.querySelectorAll('[data-jkk-col]'))fields[x.dataset.jkkCol]=str(x.value,1000);
    if(Object.values(fields).some(Boolean))out[el.dataset.jkkCriterionRow]=fields;
    else delete out[el.dataset.jkkCriterionRow];
   }
   d[key]=out;
  }
  if(key==='kualifikasi')d.penyediaId=section.querySelector('[data-jkk-supplier]')?.value||'';
  if(key==='survei'){
   const out={...d.survei};
   for(const el of section.querySelectorAll('[data-jkk-survey-row]')){
    const fields={};for(const x of el.querySelectorAll('[data-jkk-survey-col]'))fields[x.dataset.jkkSurveyCol]=str(x.value,1200);
    if(Object.values(fields).some(Boolean)){out[el.dataset.jkkSurveyRow]=fields;const row=d.biaya.find(x=>String(x.id)===String(el.dataset.jkkSurveyRow));if(row&&!row.uraian&&fields.item)row.uraian=fields.item;}
    else delete out[el.dataset.jkkSurveyRow];
   }
   d.survei=out;
  }
  if(key==='biaya'){
   d.biaya=[...section.querySelectorAll('[data-jkk-price-row]')].map(el=>{
    const old=d.biaya.find(x=>String(x.id)===String(el.dataset.jkkPriceRow))||{};
    const row={...old,id:el.dataset.jkkPriceRow};
    for(const x of el.querySelectorAll('[data-jkk-field]'))row[x.dataset.jkkField]=str(x.value,250);
    return row;
   });
  }
  return d;
 }
 function saveSection(host,section,quiet=false){const p=findCurrent(host);if(!p||!writable(p)){if(!quiet)notify(section,'Tidak dapat menulis data paket ini.',true);return false;}
   try{const d=dataForSection(section,core.model(p.kkJkk));if(!core.subtypeConfirmed({...p,kkJkk:d},core.rupForPackage(p,S.rupBank).rup)&&section.dataset.jkkSection!=='meta'&&!p.kkJkk?.subjenis)throw Error('Pilih subjenis Konstruksi di langkah Identitas & Administrasi sebelum mengisi tahap lainnya.');
     core.clean(d);d.updatedAt=new Date().toISOString();const ok=SATRIA.tx('paket','Draf Kertas Kerja JKK RUP '+p.rup,()=>{p.kkJkk=d;return true;});if(ok===null){notify(section,'Penyimpanan ditolak oleh kontrol integritas SATRIA.',true);return false;}notify(section,'✔ Tersimpan pada paket SATRIA (sinkronisasi mengikuti pengaturan aplikasi).');return true;
   }catch(err){notify(section,'⚠ '+err.message,true);return false;}
 }
 function create(r,section){if(!r||!core.rupEligible(r)||!accessRow(r)||typeof canWrite!=='function'||!canWrite())throw Error('RUP tidak cocok atau hak akses tidak mencukupi.');const others=(S.paket||[]).filter(p=>core.rupForPackage(p,[r]).rup===r||[p.rupBankId,...(p.rupBankIds||[])].some(id=>String(id)===String(r.id)));if(others.length)throw Error('RUP sudah dipakai paket. Buka paket terkait, bukan membuat duplikat.');const budget=Number(section.querySelector('[data-jkk-field="alokasi"]')?.value||'');const subtype=section.querySelector('[data-jkk-field="subjenis"]')?.value||'';if(subtype!=='Konstruksi')throw Error('Pilih subjenis Konstruksi sesuai sumber KAK.');const status=typeof satriaRupStatusAnggaran==='function'?satriaRupStatusAnggaran(r):null;if(!Number.isSafeInteger(budget)||budget<1||!status?.valid||budget>status.sisa)throw Error('Alokasi harus positif, bilangan rupiah, dan tidak melebihi sisa Bank RUP.');
   const mon=typeof satriaSpseNewModel==='function'?satriaSpseNewModel('Pengadaan Langsung'):{method:'Pengadaan Langsung',stages:[],auditTrail:[]};mon.method='Pengadaan Langsung';const record={id:typeof uid==='function'?uid('k'):'jkk-'+Date.now().toString(36),tahun:Number(r.tahun),opd:r.opd,seq:typeof nextSeq==='function'?nextSeq(r.tahun,r.opd):1,nama:r.nama,rup:r.rup,pagu:budget,sumber:r.sumber||'',sub:r.sub||'',unit:((S.unit||[]).find(x=>String(x.opd)===String(r.opd))||{}).id||'',metodePemilihan:'Pengadaan Langsung',jenisPengadaan:'Jasa Konsultansi',ppk:typeof pjId==='function'?pjId(r.opd,'PPK')||'':'',pp:typeof pjId==='function'?pjId(r.opd,'PP')||'':'',kabid:typeof pjId==='function'?pjId(r.opd,'Kabid')||'':'',items:[],penawaran:[],pemenangId:null,rupBankId:r.id,rupBankIds:[String(r.id)],jalurPengadaan:'SPSE_MONITOR',spseMonitoring:mon,kkJkk:{...core.blank(),subjenis:'Konstruksi'}};
   const result=SATRIA.tx('paket','Buat paket JKK dari Bank RUP '+r.rup,()=>{S.paket.push(record);return true;});if(result===null)throw Error('Pembuatan paket ditolak oleh kontrol integritas SATRIA.');S.ui.tahun=record.tahun;S.ui.opd=record.opd;location.hash='#jkk/'+encodeURIComponent(record.id);if(typeof render==='function')render();return record;
 }
 function printDoc(kind,p,doPrint=true){const check=core.eligiblePackage(p,S.rupBank||[]);if(!check.eligible||!core.subtypeConfirmed(p,check.rup))throw Error('Paket bukan Pengadaan Langsung Jasa Konsultansi Konstruksi.');const person=id=>S.pejabat?.find(x=>String(x.id)===String(id))||{};const opd=S.opd?.find(x=>String(x.id)===String(p.opd))||{};const pemda=S.pemda||{};const today=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});const ctx={p,r:check.rup,opd:opd.nama||opd.singkat||p.opd,instansi:pemda.nama||'',pp:person(p.pp).nama||'',nipPP:person(p.pp).nip||'',ppk:person(p.ppk).nama||'',kota:pemda.kota||opd.tempat||'',printDate:today,supplier:p.kkJkk?.namaPenyedia||(S.penyedia||[]).find(x=>String(x.id)===String(p.kkJkk?.penyediaId))?.nama||''};const cleanPrint=!!document.querySelector('.jkk-page [data-jkk-clean-print]')?.checked;const readiness=docs.readiness(kind,ctx);if(cleanPrint&&doPrint&&!readiness.ready)throw Error('Cetak bersih belum tersedia. Lengkapi: '+readiness.missing.slice(0,4).join('; ')+(readiness.missing.length>4?' (dan lainnya)':''));const html=docs.build(kind,ctx,{cleanPrint});const w=root.open('','_blank');if(!w)throw Error('Izinkan jendela pop-up agar dokumen dapat dicetak.');w.document.open();w.document.write(html);w.document.close();w.focus();if(doPrint)w.print();}
 function initEvents(){if(!root||typeof document==='undefined')return;
   document.addEventListener('input',ev=>{
     const section=ev.target?.closest?.('[data-jkk-section="biaya"]');
     if(section){
       const panel=section.closest('[data-jkk-panel]'),p=findCurrent(panel);
       if(p){
         const draft=dataForSection(section,core.model(p.kkJkk)),t=core.totals(draft);
         for(const [key,value] of [['hps',t.hps],['hpsPPK',draft.hpsPPK],['offer',t.offerComparable],['nego',t.negoComparable]]){
           const el=section.querySelector('[data-jkk-total="'+key+'"]');if(el)el.textContent=money(value);
         }
       }
     }
     if(ev.target.closest?.('.jkk-page'))ev.stopImmediatePropagation();
   },true);
   document.addEventListener('change',ev=>{const target=ev.target,host=target?.closest?.('.jkk-page');if(!host)return;ev.stopImmediatePropagation();if(target.matches('[data-jkk-rup-choose]')){const r=(S.rupBank||[]).find(x=>String(x.id)===target.value&&accessRow(x)&&core.rupEligible(x));const el=host.querySelector('[data-jkk-rup-info]');if(el)el.innerHTML=r?rupInfo(r):'<p>Pilih RUP untuk mulai.</p>';return;}
     if(target.matches('[data-jkk-supplier]')){const section=target.closest('[data-jkk-section]'),supplier=(S.penyedia||[]).find(x=>String(x.id)===target.value&&(!x.opd||String(x.opd)===String(findCurrent(host.querySelector('[data-jkk-panel]'))?.opd)));if(supplier){const e=section?.querySelector('[data-jkk-field="namaPenyedia"]');if(e)e.value=supplier.nama||'';}}
     const section=target.closest('[data-jkk-section]'),panel=target.closest('[data-jkk-panel]');
     if(section&&panel&&(target.matches('[data-jkk-field],[data-jkk-col],[data-jkk-supplier],[data-jkk-jadwal],[data-jkk-survey-col]'))){
       const saved=saveSection(panel,section,true);
       if(saved&&target.matches('[data-jkk-field="bentuk"]')&&typeof render==='function')render();
     }
   },true);
   document.addEventListener('click',ev=>{const b=ev.target?.closest?.('[data-jkk-create],[data-jkk-save],[data-jkk-add],[data-jkk-remove],[data-jkk-print],[data-jkk-preview],[data-jkk-step],[data-jkk-apply-survey],[data-jkk-import-legacy]');if(!b||!b.closest('.jkk-page'))return;ev.preventDefault();ev.stopImmediatePropagation();try{
      const host=b.closest('[data-jkk-panel]');
      if(b.hasAttribute('data-jkk-step')){
        const step=b.dataset.jkkStep,details=b.closest('[data-jkk-panel]');
        if(!details||!STEPS.some(x=>x[0]===step))return;
        stepMemory.set(String(details.dataset.jkkPanel),step);
        for(const el of details.querySelectorAll('[data-jkk-step-panel]'))el.hidden=el.dataset.jkkStepPanel!==step;
        for(const el of details.querySelectorAll('[data-jkk-step]')){
          const active=el.dataset.jkkStep===step;
          el.classList.toggle('is-active',active);
          if(el.closest('nav'))el.setAttribute('aria-current',active?'step':'false');
        }
        details.querySelector('[data-jkk-step-panel="'+step+'"]')?.scrollIntoView?.({behavior:'instant',block:'nearest'});
        return;
      }
      if(b.hasAttribute('data-jkk-create')){const rootEl=b.closest('.jkk-page'),r=(S.rupBank||[]).find(x=>String(x.id)===rootEl.querySelector('[data-jkk-rup-choose]')?.value);if(!r)throw Error('Pilih Bank RUP terlebih dahulu.');create(r,rootEl.querySelector('[data-jkk-rup-info]'));return;}
      const p=findCurrent(host);if(!p)throw Error('Paket tidak ada dalam OPD/tahun atau tidak cocok dengan klasifikasi RUP.');if(b.hasAttribute('data-jkk-print')||b.hasAttribute('data-jkk-preview')){printDoc(b.dataset.jkkPrint||b.dataset.jkkPreview,p,b.hasAttribute('data-jkk-print'));return;}if(!writable(p))throw Error('Mode baca-saja atau paket diarsipkan.');const section=b.closest('[data-jkk-section]');if(!section)throw Error('Formulir tidak ditemukan.');if(b.hasAttribute('data-jkk-save')){if(saveSection(host,section)&&['survei','biaya'].includes(section.dataset.jkkSection)&&typeof render==='function')render();return;}
      if(b.hasAttribute('data-jkk-import-legacy')){
        if(!root.confirm('Salin rincian paket lama ke JKK? Tidak mengubah rincian lama atau HPS PPK. Periksa kategori biaya, pajak, satuan, dan harga sebelum cetak.'))return;
        const imported=integration.importLegacy(p);imported.updatedAt=new Date().toISOString();
        const ok=SATRIA.tx('paket','Salin rincian lama sebagai draf JKK '+p.rup,()=>{if(core.model(p.kkJkk).biaya.length)throw Error('Rincian JKK sudah terisi.');p.kkJkk=imported;return true;});
        if(ok===null)throw Error('Penyalinan ditolak oleh SATRIA.');if(typeof render==='function')render();return;
      }
      if(!saveSection(host,section))return;const d=core.model(p.kkJkk);
      if(b.hasAttribute('data-jkk-apply-survey')){
        const id=b.dataset.jkkApplySurvey,price=core.surveyPrice(d.survei[id]);
        if(price===null)throw Error('Harga survei belum tersedia. Isi referensi harga terlebih dahulu.');
        const row=d.biaya.find(x=>String(x.id)===String(id));if(!row)throw Error('Item survei tidak terhubung dengan rincian biaya.');
        row.harga=String(price);row.survei=d.survei[id]?.keterangan||row.survei||'INPUT_SURVEI';
      }
      if(b.hasAttribute('data-jkk-add')){if(d.biaya.length>=100)throw Error('Batas maksimal 100 rincian.');d.biaya.push({id:'jkk-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),kategori:'Personel',uraian:'',volume:'1',satuan:'',harga:'',survei:'',penawaran:'',negosiasi:''});}
      if(b.hasAttribute('data-jkk-remove')){const id=b.dataset.jkkRemove;d.biaya=d.biaya.filter(x=>x.id!==id);delete d.survei[id];}
      core.clean(d);const ok=SATRIA.tx('paket','Ubah rincian biaya JKK '+p.rup,()=>{p.kkJkk=d;return true;});if(ok===null)throw Error('Gagal menyimpan perubahan rincian.');if(typeof render==='function')render();
    }catch(err){const status=b.closest('[data-jkk-section]');notify(status||b.closest('.jkk-page'),err.message,true);if(!status&&root.alert)root.alert(err.message);}
   },true);
 }
 initEvents();return {page,rupInfo,candidatePackages,eligibleRupRows,dataForSection,create,printDoc};
});
