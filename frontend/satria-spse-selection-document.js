/* SATRIA — SPSE Pengadaan Langsung selection-document authoring.
 * Focus: Barang/Jasa Lainnya SPK, Perlem LKPP 3/2026 Lampiran I 5.3.2.
 * Support material only. No official issuance, approval, signature, or SPSE upload API.
 */
(function(root,factory){'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SATRIA_SPSE_SELECTION=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:null,function(root){'use strict';
 const FIELDS=Object.freeze([
  ['nomor','Nomor dokumen pemilihan','text',160],
  ['tanggal','Tanggal dokumen','date',10],
  ['namaPP','Nama Pejabat Pengadaan','text',180],
  ['nipPP','NIP/identitas pejabat (jika ada)','text',80],
  ['alamatPemilihan','Alamat/tempat pelaksanaan pemilihan','textarea',500],
  ['sumberDana','Sumber pendanaan (sesuai DPA/DIPA)','text',220],
  ['penyedia','Calon Penyedia yang diundang','text',180],
  ['alamatPenyedia','Alamat penyedia yang diundang','textarea',450],
  ['tanggalUndangan','Tanggal undangan','date',10],
  ['batasPenawaran','Batas pemasukan penawaran (tanggal dan jam)','datetime-local',16],
  ['metodePenyampaian','Cara dan alamat/fitur penyampaian penawaran di SPSE','textarea',600],
  ['lokasi','Lokasi pelaksanaan pekerjaan','text',240],
  ['jangkaWaktu','Jangka waktu pelaksanaan pekerjaan','text',200],
  ['syaratKualifikasi','Persyaratan kualifikasi administrasi/teknis yang sesuai paket','textarea',3500],
  ['instruksiPeserta','Instruksi kepada peserta (cara mengikuti, klarifikasi, dan pembukaan)','textarea',5000],
  ['metodeEvaluasi','Metode evaluasi penawaran','textarea',1600],
  ['kriteriaEvaluasi','Kriteria evaluasi administrasi, teknis, harga, dan kualifikasi','textarea',4000],
  ['dokumenPenawaran','Daftar dokumen yang harus disampaikan peserta','textarea',2500],
  ['ketentuanKhusus','Klausul/ketentuan tambahan yang relevan (opsional)','textarea',3500],
  ['refHpsPPK','Nomor/tanggal penetapan HPS oleh PPK (sesuai bukti)','text',200],
  ['refSpesifikasi','Nomor/referensi spesifikasi atau KAK yang telah ditetapkan','text',200],
  ['rancanganSpk','Isi rancangan SPK dari PPK (salin sesuai dokumen yang ditetapkan)','textarea',45000]
 ]);
 const REQUIRED=['nomor','tanggal','namaPP','alamatPemilihan','sumberDana','penyedia','alamatPenyedia','tanggalUndangan','batasPenawaran','metodePenyampaian','lokasi','jangkaWaktu','syaratKualifikasi','instruksiPeserta','metodeEvaluasi','kriteriaEvaluasi','dokumenPenawaran','refHpsPPK','refSpesifikasi','rancanganSpk'];
 const MAX_BYTES=100000;
 const pending=new Map();
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=x=>Number.isFinite(Number(x))?'Rp '+Math.round(Number(x)).toLocaleString('id-ID'):'—';
 const str=(v,n=10000)=>String(v??'').trim().slice(0,n);
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const method=p=>{if(root?.SATRIA_PBJ_POLICY?.route)return root.SATRIA_PBJ_POLICY.route(p);
  const mode=String(p?.spseMonitoring?.method||p?.metodePemilihan||'').toLowerCase();return mode.includes('pengadaan langsung')?'pengadaan-langsung':'perlu-konfirmasi';};
 const kind=p=>{const v=String(p?.jenisPengadaan||'').toLowerCase();return v.includes('konsultan')?'konsultansi':v.includes('konstruksi')?'konstruksi':v.includes('barang')||v.includes('jasa lainnya')?'barang-jasa':'tak-dikenali';};
 const isEligible=p=>!!p&&(p.jalurPengadaan==='SPSE_MONITOR'||!!p.spseMonitoring)&&method(p)==='pengadaan-langsung';
 const hpsTotal=p=>(Array.isArray(p?.items)?p.items:[]).reduce((n,i)=>n+Number(i?.vol||0)*Number(i?.hs||0),0);
 function sourceFingerprint(p){return JSON.stringify({rup:p?.rup,opd:p?.opd,tahun:p?.tahun,metode:p?.spseMonitoring?.method||p?.metodePemilihan,jenis:p?.jenisPengadaan,pagu:p?.pagu,nama:p?.nama,items:(p?.items||[]).map(i=>[i.id,i.nama,i.spesifikasi,i.vol,i.hs,i.satuan])});}
 function record(p){const x=p?.ppDokumenPemilihan;return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
 function editable(p){if(typeof canWrite!=='function'||!canWrite())return false;
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  if(scope&&(!scope.opdIds?.includes(String(p?.opd))||!scope.years?.includes(Number(p?.tahun))))return false;
  return true;
 }
 function normalize(input){const out={};for(const [name,,type,length] of FIELDS){const v=str(input?.[name],length);out[name]=v;}return out;}
 function assessment(p,data,attested=false){const details=normalize(data),reasons=[];
  if(!isEligible(p))reasons.push('Paket bukan Pengadaan Langsung pada jalur SPSE yang dapat diidentifikasi.');
  if(kind(p)!=='barang-jasa')reasons.push('Template final saat ini khusus Barang/Jasa Lainnya (Lampiran I); kategori konstruksi/konsultansi memerlukan template khusus.');
  const total=hpsTotal(p),pagu=Number(p?.pagu||0);
  if(!Number.isFinite(pagu)||pagu<=0||pagu>200000000)reasons.push('Pagu tidak berada dalam batas umum Pengadaan Langsung Barang/Jasa Lainnya sampai Rp200 juta; pengecualian khusus perlu diperiksa pada sistem resmi.');
  if(pagu<=50000000)reasons.push('Pengadaan Langsung sampai Rp50 juta menggunakan fitur pencatatan; dokumen pemilihan SPK transaksional ini tidak otomatis diperlukan.');
  if(!Array.isArray(p?.items)||!p.items.length||!Number.isFinite(total)||total<=0||total>pagu)reasons.push('Rincian HPS harus ada, bernilai positif dan tidak melebihi pagu paket.');
  if((p?.items||[]).some(i=>!str(i.nama)||!str(i.spesifikasi)||!str(i.satuan)||!Number.isFinite(Number(i.vol))||Number(i.vol)<=0||!Number.isFinite(Number(i.hs))||Number(i.hs)<=0))reasons.push('Lengkapi nama, spesifikasi, satuan, volume, dan harga tiap rincian HPS.');
  if(!str(p?.rup)||!str(p?.nama)||!str(p?.opd)||!Number(p?.tahun))reasons.push('Identitas paket, RUP, OPD dan tahun harus lengkap.');
  if(!validDate(str(p?.tglMulaiPemilihan))||p?.dasarRegulasi!=='perlem-3-2026')reasons.push('Tanggal mulai pemilihan dan dasar Perlem 3/2026 belum tercatat/ditinjau pada panel regulasi paket.');
  for(const key of REQUIRED){if(!details[key])reasons.push('Isi '+FIELDS.find(f=>f[0]===key)[1]+'.');}
  for(const key of ['tanggal','tanggalUndangan']){if(details[key]&&!validDate(details[key]))reasons.push('Tanggal '+key+' tidak valid.');}
  if(details.batasPenawaran){const [d,t]=details.batasPenawaran.split('T');if(!validDate(d)||!/^\d{2}:\d{2}$/.test(t||'')||Number(t.slice(0,2))>23||Number(t.slice(3,5))>59)reasons.push('Batas pemasukan penawaran tidak valid.');}
  if(details.tanggalUndangan&&details.batasPenawaran&&details.batasPenawaran.slice(0,10)<details.tanggalUndangan)reasons.push('Batas penawaran tidak boleh mendahului tanggal undangan.');
  if(details.rancanganSpk&&details.rancanganSpk.length<120)reasons.push('Rancangan SPK terlalu singkat; masukkan isi rancangan SPK yang benar-benar diberikan/ditetapkan PPK, bukan ringkasan atau nomor referensi saja.');
  if(details.syaratKualifikasi&&details.syaratKualifikasi.length<40)reasons.push('Persyaratan kualifikasi perlu diuraikan secara jelas, tidak cukup judul.');
  if(details.instruksiPeserta&&details.instruksiPeserta.length<60)reasons.push('Instruksi peserta harus mencantumkan ketentuan pelaksanaan, bukan sekadar judul.');
  if(details.kriteriaEvaluasi&&details.kriteriaEvaluasi.length<40)reasons.push('Kriteria evaluasi harus cukup terperinci untuk dipahami calon peserta.');
  if(details.nomor&&details.nomor.length<3)reasons.push('Nomor dokumen tidak valid.');
  if(details.tanggal&&details.tanggalUndangan&&details.tanggalUndangan<details.tanggal)reasons.push('Tanggal undangan mendahului tanggal dokumen pemilihan.');
  if(!attested)reasons.push('Pejabat harus meninjau isi, kesesuaian regulasi, rancangan SPK/HPS dari PPK, dan persyaratan SPSE sebelum cetak final.');
  return {ready:reasons.length===0,reasons,total,details,category:kind(p)};
 }
 function rowLabel(p){return String(p?.rup||p?.id||'paket');}
 function panel(p){if(!isEligible(p))return '';
  const id=String(p.id),state=pending.get(id)||record(p),res=assessment(p,state,false),can=editable(p),stored=record(p);
  const options=FIELDS.map(([key,label,type,max])=>`<label>${safe(label)}${REQUIRED.includes(key)?' <span aria-label="wajib">*</span>':''}${type==='textarea'?`<textarea data-sd-field="${key}" maxlength="${max}" rows="${key==='rancanganSpk'?7:3}" ${can?'':'disabled'}>${safe(state[key])}</textarea>`:`<input data-sd-field="${key}" type="${type}" maxlength="${max}" value="${safe(state[key])}" ${can?'':'disabled'}>`}</label>`).join('');
  const age=stored?.savedAt?`Terakhir disimpan: ${safe(stored.savedAt)}`:'Belum pernah disimpan';
  const methodNote=kind(p)==='barang-jasa'?'Dibuka untuk Barang/Jasa Lainnya dengan SPK. Paket ≤Rp50 juta menggunakan pencatatan, bukan otomatis dokumen transaksional.':'Kategori lain dapat melihat formulir, tetapi finalisasi diblokir sampai model dokumen yang sesuai Lampiran II/jenis jasa disiapkan.';
  return `<section class="sd-editor" data-sd-panel="${safe(id)}"><h3>📝 Penyusun Dokumen Pemilihan SPSE — Pengadaan Langsung</h3>
   <p class="pbj-note">${safe(methodNote)} Berdasarkan Perlem 3/2026 Lampiran I angka 5.3.2. Formulir tidak menggantikan penetapan dokumen, HPS maupun rancangan kontrak oleh pejabat yang berwenang.</p>
   <details><summary><b>Isi Dokumen Pemilihan (${safe(rowLabel(p))})</b> — ${safe(age)}</summary><div class="sd-grid">${options}</div>
   <p class="pbj-note">* Wajib untuk penyiapan berkas. Rancangan SPK berasal dari PPK; jangan menyalin klausul karangan atau data sensitif yang tidak diperlukan.</p>
   <div class="sd-actions">${can?`<button type="button" class="g" data-sd-save>Simpan isian dokumen</button>`:''}<button type="button" class="g" data-sd-check>Periksa kelengkapan</button><button type="button" class="g" data-sd-draft>Pratinjau draf PDF</button></div>
   <label class="sd-verify"><input type="checkbox" data-sd-confirm> Saya telah mencocokkan seluruh isian dengan dokumen persiapan yang ditetapkan PPK, kesesuaian Perlem 3/2026, dan kebutuhan/format SPSE pada paket ini; saya memahami cetak ini bukan tanda tangan elektronik.</label>
   <button type="button" class="g" data-sd-final ${can?'':'disabled'}>Cetak berkas lengkap untuk pemeriksaan akhir & unggah SPSE</button>
   <p class="sd-status" data-sd-status role="status">Isian lengkap: ${REQUIRED.filter(k=>str(state[k])).length}/${REQUIRED.length}. Perlu pemeriksaan sebelum dapat dicetak tanpa label DRAF.</p></details>
   <p class="pbj-note">Bagian yang disusun: undangan, instruksi peserta, lembar data pemilihan, spesifikasi/KAK, daftar kuantitas/harga, formulir penawaran, formulir kualifikasi, dan rancangan SPK dari PPK. Tidak ada unggah otomatis atau persetujuan berjenjang tambahan.</p></section>`;
 }
 function tableRows(rows){return `<table><tbody>${rows.map(([k,v])=>`<tr><th>${safe(k)}</th><td>${safe(v)||'—'}</td></tr>`).join('')}</tbody></table>`;}
 function multi(s){return safe(s).replace(/\n/g,'<br>');}
 function itemsTable(p){return `<table><thead><tr><th>No.</th><th>Uraian dan spesifikasi</th><th>Vol.</th><th>Satuan</th><th>Harga satuan</th><th>Total HPS</th></tr></thead><tbody>${(p.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td><b>${safe(i.nama)}</b><p>${multi(i.spesifikasi)}</p></td><td>${safe(i.vol)}</td><td>${safe(i.satuan)}</td><td>${money(i.hs)}</td><td>${money(Number(i.vol)*Number(i.hs))}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="5">TOTAL HPS</th><th>${money(hpsTotal(p))}</th></tr></tfoot></table>`;}
 function html(p,data,final=false){const d=normalize(data),ver=assessment(p,d,true),valid=ver.ready,finalAllowed=final&&valid;
  const badge=finalAllowed?'DOKUMEN KERJA LENGKAP — PERIKSA DAN TETAPKAN SESUAI KEWENANGAN':'DRAF — BELUM SIAP UNGGAH';
  const sections=[
   ['I. UNDANGAN PENGADAAN LANGSUNG',`<h3>Kepada: ${safe(d.penyedia)||'—'}</h3><p>${multi(d.alamatPenyedia)}</p>${tableRows([['Nomor dokumen',d.nomor],['Tanggal undangan',d.tanggalUndangan],['Nama paket',p.nama],['Kode RUP',p.rup],['HPS paket',money(hpsTotal(p))],['Sumber pendanaan',d.sumberDana],['Alamat pemilihan',d.alamatPemilihan],['Batas pemasukan penawaran',d.batasPenawaran?.replace('T',' ')],['Penyampaian penawaran',d.metodePenyampaian]])}<p>Undangan ini ditujukan untuk menyampaikan penawaran pada Pengadaan Langsung. Persyaratan dan rincian tercantum pada bagian berikut.</p>`],
   ['II. INSTRUKSI KEPADA PESERTA',`<p>${multi(d.instruksiPeserta)}</p><h4>Dokumen penawaran yang diminta</h4><p>${multi(d.dokumenPenawaran)}</p>`],
   ['III. LEMBAR DATA PEMILIHAN',`${tableRows([['Nama paket',p.nama],['OPD',p.opd],['Tahun anggaran',p.tahun],['Metode','Pengadaan Langsung (SPSE)'],['Jenis pengadaan',p.jenisPengadaan],['Nilai pagu',money(p.pagu)],['HPS',money(hpsTotal(p))],['Penetapan HPS oleh PPK',d.refHpsPPK],['Tempat pelaksanaan',d.lokasi],['Waktu pelaksanaan',d.jangkaWaktu],['Metode evaluasi',d.metodeEvaluasi],['Tanggal dokumen',d.tanggal]])}<h4>Persyaratan kualifikasi</h4><p>${multi(d.syaratKualifikasi)}</p><h4>Kriteria evaluasi</h4><p>${multi(d.kriteriaEvaluasi)}</p>${d.ketentuanKhusus?`<h4>Ketentuan paket</h4><p>${multi(d.ketentuanKhusus)}</p>`:''}`],
   ['IV. SPESIFIKASI TEKNIS / KERANGKA ACUAN KERJA',`<p>Referensi spesifikasi/KAK yang telah ditetapkan: <b>${safe(d.refSpesifikasi)}</b></p><p>Rincian barang/jasa berikut bersumber dari paket SATRIA. Periksa kembali terhadap dokumen teknis PPK dan lampiran resmi.</p>${itemsTable(p)}`],
   ['V. DAFTAR KUANTITAS DAN HARGA',`<p>Daftar berikut memakai HPS sebagai informasi pengadaan; peserta mengisi harga penawaran pada formulirnya sendiri.</p>${itemsTable(p)}`],
   ['VI. FORMULIR PENAWARAN PESERTA',`<p>Kepada Pejabat Pengadaan; sehubungan dengan undangan nomor ${safe(d.nomor)}, kami menyampaikan penawaran untuk paket ${safe(p.nama)}.</p>${tableRows([['Nama badan usaha/peserta','................................................'],['Alamat peserta','................................................'],['Harga penawaran total','Rp ................................................'],['Jangka waktu penyelesaian','................................................'],['Masa berlaku penawaran','................................................'],['Tanggal penawaran','................................................']])}<p>Rincian harga satuan penawaran per item diisi oleh peserta, bukan oleh SATRIA:</p><table><thead><tr><th>No.</th><th>Uraian barang/jasa</th><th>Vol.</th><th>Harga satuan penawaran</th><th>Jumlah penawaran</th></tr></thead><tbody>${(p.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td>${safe(i.nama)}</td><td>${safe(i.vol)} ${safe(i.satuan)}</td><td>........................</td><td>........................</td></tr>`).join('')}</tbody></table><p>Rincian spesifikasi penawaran dilampirkan oleh peserta. Tanda tangan/otorisasi peserta: _____________________</p>`],
   ['VII. FORMULIR ISIAN KUALIFIKASI',`<p>Peserta menyampaikan data kualifikasi yang diperlukan dan benar sesuai persyaratan di LDP, melalui SPSE sebagaimana berlaku.</p>${tableRows([['Nama pelaku usaha','................................................'],['NIB/izin sesuai persyaratan','................................................'],['Alamat dan kontak','................................................'],['Nama penanggung jawab','................................................'],['Dokumen pembuktian kualifikasi','................................................']])}<p>Dokumen isian dan bukti peserta disampaikan sesuai syarat kualifikasi dalam dokumen ini; informasi tersebut tidak diisi SATRIA atas nama peserta.</p>`],
   ['VIII. RANCANGAN SURAT PERINTAH KERJA (SPK) DARI PPK',`<p><b>Rancangan kontrak dari PPK — isi sebagaimana ditetapkan:</b></p><div class="contract">${multi(d.rancanganSpk)}</div><p>Bagian ini merupakan salinan rancangan kontrak yang dimasukkan pejabat. SATRIA tidak menetapkan atau mengubah klausul kontrak.</p>`]
  ];
  const contents=sections.map(([title,body])=>`<section class="doc-section"><h2>${title}</h2>${body}</section>`).join('');
  const warning=!valid?`<section class="errors"><b>Kekurangan pemeriksaan:</b><ol>${ver.reasons.map(x=>`<li>${safe(x)}</li>`).join('')}</ol></section>`:'';
  const note='Dokumen pendukung penyusunan Pejabat Pengadaan, bukan tanda tangan elektronik maupun bukti unggah SPSE. Penetapan, tanda tangan, serta penggunaan di sistem resmi tetap merupakan tanggung jawab pejabat berwenang.';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${finalAllowed?'Dokumen Pemilihan':'DRAF Dokumen Pemilihan'} — ${safe(p.rup)}</title><style>@page{size:A4 portrait;margin:17mm}*{box-sizing:border-box}body{font:11px/1.52 Arial,sans-serif;color:#121923}header{text-align:center;border-bottom:2px solid #111;padding-bottom:10px}header h1{font-size:17px;margin:0}header p{font-size:11px}.status{margin:12px 0;padding:9px;border:1px solid #444;font-weight:bold;text-align:center}.doc-section{break-inside:auto;margin-top:19px}.doc-section h2{font-size:12.5px;border-bottom:1px solid #555;padding-bottom:5px;break-after:avoid}h3,h4{font-size:11.5px;break-after:avoid}table{width:100%;border-collapse:collapse;margin:9px 0}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #88929d;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf0f4}td p{margin:4px 0}p{overflow-wrap:anywhere;white-space:normal}.contract{white-space:normal;border:1px solid #aaa;padding:12px;line-height:1.7}.errors{padding:12px;border:2px solid #9a2d25;background:#fff1eb}.errors li{margin:5px 0}footer{margin-top:24px;border-top:1px solid #777;font-size:10px;color:#333}.sign{margin-top:45px;text-align:right;break-inside:avoid}.sign b{display:block;margin-top:65px}@media print{.errors{background:#fff}.doc-section{page-break-inside:auto}}</style></head><body><header><h1>DOKUMEN PEMILIHAN PENGADAAN LANGSUNG</h1><p>${safe(p.nama)} · RUP ${safe(p.rup)} · TA ${safe(p.tahun)}</p></header><p class="status">${badge}</p><p>Acuan: Peraturan LKPP Nomor 3 Tahun 2026, Lampiran I angka 5.3.2; periksa ketentuan transisi dan dokumen standar paket sesuai SPSE.</p>${warning}${contents}<div class="sign"><p>${safe(d.alamatPemilihan)}, ${safe(d.tanggal)}</p><b>Pejabat Pengadaan</b><b>${safe(d.namaPP)}</b><p>${safe(d.nipPP)}</p><p>Tanda tangan/paraf wajib dilakukan melalui proses resmi jika dipersyaratkan.</p></div><footer>${note}</footer></body></html>`;
 }
 function formState(host,p){const saved=pending.get(String(p.id))||record(p),out={...normalize(saved)};
  for(const [key] of FIELDS){const el=host?.querySelector('[data-sd-field="'+key+'"]');if(el)out[key]=el.value;}
  return normalize(out);
 }
 function findPackage(host){if(!host||typeof P!=='function')return null;
  const p=P(host.dataset.sdPanel);
  if(!p||!isEligible(p))return null;
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  if(scope&&(!scope.opdIds?.includes(String(p.opd))||!scope.years?.includes(Number(p.tahun))))return null;
  if(typeof S!=='undefined'&&S?.ui&&(Number(S.ui.tahun)!==Number(p.tahun)||(S.ui.opd!=='all'&&String(S.ui.opd)!==String(p.opd))))return null;
  return p;
 }
 function openPrint(contents){const win=root?.open?.('','_blank');if(!win){root?.alert?.('Izinkan pop-up untuk mencetak dokumen.');return false;}
  win.document.open();win.document.write(contents);win.document.close();win.focus();win.print();return true;
 }
 if(typeof document!=='undefined'&&document.addEventListener){
  for(const type of ['input','change'])document.addEventListener(type,ev=>{
   const el=ev.target;if(!el?.matches?.('[data-sd-field]'))return;
   const host=el.closest('[data-sd-panel]');if(!host)return;ev.stopImmediatePropagation();
   const p=findPackage(host);if(!p)return;
   pending.set(String(p.id),formState(host,p));
   const status=host.querySelector('[data-sd-status]');if(status)status.textContent='Perubahan belum disimpan. Simpan isian lalu periksa kelengkapan sebelum cetak final.';
  },true);
  document.addEventListener('click',ev=>{
   const btn=ev.target?.closest?.('[data-sd-save],[data-sd-check],[data-sd-draft],[data-sd-final]');if(!btn)return;
   const host=btn.closest('[data-sd-panel]');if(!host)return;ev.preventDefault();ev.stopImmediatePropagation();
   const p=findPackage(host);if(!p){root?.alert?.('Paket tidak ditemukan atau hak akses OPD/tahun tidak sesuai.');return;}
   const d=formState(host,p),state=host.querySelector('[data-sd-status]'),confirmed=!!host.querySelector('[data-sd-confirm]')?.checked,check=assessment(p,d,confirmed);
   if(btn.hasAttribute('data-sd-draft')){openPrint(html(p,d,false));return;}
   if(btn.hasAttribute('data-sd-check')){if(state)state.textContent=check.ready?'Seluruh pemeriksaan isian lulus. Simpan isian sebelum mencetak.':'Masih ada '+check.reasons.length+' pemeriksaan: '+check.reasons.join(' • ');return;}
   if(btn.hasAttribute('data-sd-save')){
    if(!editable(p)||typeof SATRIA==='undefined'||typeof SATRIA.tx!=='function'){root?.alert?.('Tidak memiliki hak ubah atau penyimpanan SATRIA belum tersedia.');return;}
    if(JSON.stringify(d).length>MAX_BYTES){root?.alert?.('Isian dokumen terlalu besar. Periksa ukuran rancangan SPK.');return;}
    const done=SATRIA.tx('paket','Simpan isian Dokumen Pemilihan '+rowLabel(p),()=>{p.ppDokumenPemilihan={...d,schema:1,sourceSnapshot:sourceFingerprint(p),savedAt:new Date().toISOString()};});
    if(done!==null){pending.delete(String(p.id));if(typeof toast==='function')toast('Isian Dokumen Pemilihan tersimpan.');if(typeof render==='function')render();}
    return;
   }
   if(!editable(p)){root?.alert?.('Akses baca saja.');return;}
   if(!check.ready){if(state)state.textContent='Tidak dapat mencetak berkas lengkap: '+check.reasons.join(' • ');return;}
   const saved=record(p),fieldsEqual=FIELDS.every(([key])=>str(saved[key])===str(d[key]));
   if(!saved.savedAt||saved.sourceSnapshot!==sourceFingerprint(p)||!fieldsEqual){if(state)state.textContent='Simpan dahulu isian terkini. Paket atau HPS berubah sejak penyimpanan terakhir; periksa dan simpan ulang.';return;}
   openPrint(html(p,d,true));
  },true);
 }
 return Object.freeze({FIELDS,REQUIRED,normalize,kind,isEligible,hpsTotal,sourceFingerprint,assessment,html,panel,record,formState});
});
