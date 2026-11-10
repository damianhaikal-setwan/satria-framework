/* SATRIA — one-package document assistance. No approval workflow, no SPSE API calls.
 * All generated pages are DRAFTS until verified, signed, and uploaded by an authorized officer.
 */
(function(root){'use strict';if(!root||!root.SATRIA_PBJ_POLICY)return;
 const policy=root.SATRIA_PBJ_POLICY;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>Number.isFinite(Number(v))?'Rp '+Math.round(Number(v)).toLocaleString('id-ID'):'—';
 const value=v=>String(v??'').trim()?esc(v):'<em>Belum tersedia — lengkapi dari sumber resmi</em>';
 function userCanWrite(p){
  if(typeof canWrite!=='function'||!canWrite())return false;
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  return !scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun)));
 }
 function panel(p){if(!p)return '';
  const plan=policy.documentPlan(p),context=policy.regulatoryContext(p),feature=policy.spseFeature(p);
  const isSpse=p.jalurPengadaan==='SPSE_MONITOR'||!!p.spseMonitoring;
  const can=userCanWrite(p),date=String(p.tglMulaiPemilihan||''),basis=String(p.dasarRegulasi||'');
  const choices=plan.docs.map(d=>`<li><b>${esc(d.label)}</b> — ${d.available?(isSpse?'Rancangan bantuan tersedia untuk cetak/PDF':'Tersedia di menu dokumen SATRIA'):'Belum tersedia; jangan gunakan template pengganti tanpa konfirmasi'}</li>`).join('');
  const actions=isSpse?`<div class="pbj-actions">${plan.docs.filter(d=>d.available).map(d=>`<button type="button" class="g" data-pbj-print="${esc(d.code)}" data-pbj-pid="${esc(p.id)}">Cetak draf ${esc(d.label)}</button>`).join('')}</div>`:'<p class="pbj-note">Gunakan tombol <b>Cetak / PDF</b> dan pilihan template DPP yang telah tersedia di menu ini. Dokumen HRS belum dibuat sampai nama/formatnya terverifikasi.</p>';
  return `<section class="card no-print pbj-panel" data-pbj-panel="${esc(p.id)}" aria-label="Paket dokumen pendukung PBJ 2026">
   <h3>📁 Paket Dokumen Pendukung Sistem Resmi</h3>
   <p><b>${esc(context.label)}</b> · ${esc(context.note)}</p>
   <p class="pbj-note">SATRIA hanya alat bantu penyusunan dokumen; bukan pengganti SPSE, Katalog Elektronik, INAPROC, SiRUP atau persetujuan resmi. Tidak ada verifikasi/persetujuan berjenjang tambahan.</p>
   <details><summary>Identitas dasar regulasi paket (opsional, dicatat satu kali)</summary>
    <div class="pbj-fields"><label>Tanggal mulai pemilihan menurut catatan resmi<input type="date" data-pbj-start value="${esc(date)}" ${can?'':'disabled'}></label>
    <label>Dasar regulasi transisi (jika berlaku)<select data-pbj-basis ${can?'':'disabled'}>
      <option value="" ${!basis?'selected':''}>Belum dipastikan</option>
      <option value="perlem-12-2021" ${basis==='perlem-12-2021'?'selected':''}>Perlem 12/2021 (hanya bila berlaku dalam transisi)</option>
      <option value="perlem-3-2026" ${basis==='perlem-3-2026'?'selected':''}>Perlem 3/2026</option>
    </select></label></div>
    ${can?`<button type="button" class="g" data-pbj-save="${esc(p.id)}">Simpan keterangan regulasi</button>`:'<p class="pbj-note">Akun ini tidak memiliki hak ubah pada paket.</p>'}
    <p class="pbj-note">Simpan hanya tanggal dan dasar yang benar-benar diketahui dari proses resmi. Tidak ada tanggal yang dibuat otomatis.</p>
   </details>
   ${isSpse?`<p><b>Rute SPSE:</b> ${esc(feature.message)}</p>`:''}
   <strong>Dokumen yang dibantu SATRIA</strong><ul>${choices}</ul><p class="pbj-note">${esc(plan.note)}</p>${actions}
   <p class="pbj-source">Rujukan: <a href="${policy.SOURCES.penyedia}" target="_blank" rel="noopener noreferrer">Perlem 3/2026</a> · <a href="${policy.SOURCES.transisi}" target="_blank" rel="noopener noreferrer">SE transisi 3/2026</a> · <a href="${policy.SOURCES.katalog}" target="_blank" rel="noopener noreferrer">Perlem 2/2026 katalog</a></p>
   </section>`;
 }
 function verificationRows(p){return [
  ['Nomor/kode RUP',p.rup],['Nama paket',p.nama],['OPD',typeof O==='function'?O(p.opd)?.nama:''],['Tahun anggaran',p.tahun],
  ['Jenis pengadaan',p.jenisPengadaan],['Metode pemilihan',p.spseMonitoring?.method||p.metodePemilihan],
  ['Pagu paket',money(p.pagu)],['HPS paket',Array.isArray(p.items)&&p.items.length?money(p.items.reduce((s,i)=>s+Number(i.vol||0)*Number(i.hs||0),0)):'Belum ada rincian HPS'],
  ['Tanggal mulai pemilihan (bila diketahui)',p.tglMulaiPemilihan]
 ];}
 function table(rows){return `<table><tbody>${rows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${value(v)}</td></tr>`).join('')}</tbody></table>`;}
 function itemsTable(p){const items=Array.isArray(p.items)?p.items:[];
  return `<table><thead><tr><th>No.</th><th>Uraian/spesifikasi</th><th>Volume</th><th>HPS/unit</th><th>HPS item</th></tr></thead><tbody>${items.map((i,n)=>`<tr><td>${n+1}</td><td>${value(i.nama)}<small>${value(i.spesifikasi)}</small></td><td>${value(i.vol)} ${value(i.satuan)}</td><td>${money(i.hs)}</td><td>${money(Number(i.vol||0)*Number(i.hs||0))}</td></tr>`).join('')||'<tr><td colspan="5">Rincian paket belum tersedia; jangan tandatangani sebelum dilengkapi.</td></tr>'}</tbody></table>`;
 }
 function sourcesTable(p){const offers=Array.isArray(p.penawaran)?p.penawaran:[];
  let rows=[];for(const w of offers){const supplier=typeof PY==='function'?PY(w.pen)?.nama:String(w.pen||'');for(const it of p.items||[]){rows.push([supplier,it.nama,w.harga?.[it.id],w.nego?.[it.id],w.sumberHarga,w.tanggalHarga]);}}
  return `<table><thead><tr><th>Penyedia / sumber</th><th>Barang</th><th>Harga tayang</th><th>Negosiasi</th><th>Sumber/bukti</th><th>Tanggal</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${value(x[0])}</td><td>${value(x[1])}</td><td>${Number(x[2])>0?money(x[2]):'—'}</td><td>${Number(x[3])>0?money(x[3]):'—'}</td><td>${value(x[4])}</td><td>${value(x[5])}</td></tr>`).join('')||'<tr><td colspan="6">Belum tersedia bukti pembanding dari paket. Sumber tidak dibuat otomatis.</td></tr>'}</tbody></table>`;
 }
 function draft(p,kind){const context=policy.regulatoryContext(p),common=table(verificationRows(p));
  if(kind==='pemilihan')return `<h2>DRAF DOKUMEN PEMILIHAN</h2><p>Ruang lingkup: ${value(p.nama)}. Dokumen ini bukan standar dokumen resmi dan wajib diselaraskan dengan metode serta format SPSE yang berlaku.</p>${common}<h3>Rincian Kebutuhan dan HPS</h3>${itemsTable(p)}<h3>Ketentuan dan persyaratan</h3><p>Persyaratan kualifikasi, evaluasi, ketentuan kontrak, jadwal pemilihan, ketentuan penawaran, dan klausul khusus: <b>BELUM DITETAPKAN — isi berdasarkan dokumen resmi yang disiapkan pejabat berwenang.</b></p>`;
  if(kind==='reviu-dpp')return `<h2>DRAF BERITA ACARA REVIU DPP</h2><p>Nomor BA: <b>belum tersedia</b> · Tanggal: <b>belum tersedia</b></p>${common}<h3>Objek Reviu</h3><ol><li>Kesesuaian kebutuhan dan spesifikasi — perlu dicocokkan dengan DPP asli.</li><li>Kelengkapan rincian kuantitas, HPS dan sumber data — perlu dikonfirmasi.</li><li>Metode, jadwal dan persyaratan pemilihan — perlu dikonfirmasi.</li></ol>${itemsTable(p)}<h3>Hasil dan tindak lanjut</h3><p><b>Belum diisi.</b> Masukkan temuan, klarifikasi, keputusan dan data pendukung yang sebenarnya; SATRIA tidak menyatakan suatu reviu telah dilaksanakan.</p>`;
  if(kind==='analisa-pasar')return `<h2>DRAF ANALISA PASAR PEJABAT PENGADAAN</h2>${common}<h3>Rincian Kebutuhan dan HPS</h3>${itemsTable(p)}<h3>Informasi Harga dan Kualitas</h3><p>Bandingkan paling sedikit dua sumber yang berbeda apabila tersedia untuk Pengadaan Langsung, sesuai jenis pekerjaan dan ketentuan yang berlaku. Ketersediaan sumber, kesetaraan spesifikasi, pajak dan ongkos kirim harus diperiksa oleh pejabat.</p>${sourcesTable(p)}<h3>Kesimpulan Analisis</h3><p><b>Belum diisi.</b> Tentukan kelayakan setelah membandingkan sumber, spesifikasi dan harga yang benar-benar tersedia. SATRIA tidak menyimpulkan hasil pasar tanpa bukti.</p>`;
  return '';
 }
 function printDraft(p,kind){const allowed=new Set(['pemilihan','reviu-dpp','analisa-pasar']);if(!allowed.has(kind))return;
  const win=root.open('','_blank');if(!win){root.alert('Jendela cetak diblokir browser. Izinkan pop-up untuk SATRIA lalu ulangi.');return;}
  const context=policy.regulatoryContext(p);
  const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>DRAF ${esc(kind)} — ${esc(p.rup)}</title><style>@page{size:A4 portrait;margin:17mm}body{font:12px/1.45 Arial,sans-serif;color:#151515}h1{text-align:center;font-size:17px}h2{font-size:15px;text-align:center;margin-top:22px}h3{margin:18px 0 7px;font-size:12px}p{line-height:1.6}table{width:100%;border-collapse:collapse;margin:12px 0;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #888;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f4f4f4}td small{display:block}header{border-bottom:2px solid #333;padding-bottom:8px}footer{border-top:1px solid #ccc;margin-top:20px;color:#555}.draft{padding:8px;border:2px solid #ad792d;background:#fff9e9;font-weight:bold}@media print{.draft{color:#000;background:none}}</style></head><body><header><h1>SATRIA • DOKUMEN BANTU PENGADAAN</h1><p class="draft">DRAF BELUM LENGKAP — BUKAN DOKUMEN RESMI / BELUM SIAP UNGGAH</p></header><p><b>Rujukan:</b> ${esc(context.label)}. ${esc(context.note)}</p>${draft(p,kind)}<footer><p>Dokumen ini hanya bahan kerja. Lengkapi nomor, tanggal, hasil pemeriksaan, persyaratan resmi, dan tanda tangan sesuai kewenangan sebelum dipakai dalam sistem pemerintah.</p></footer></body></html>`;
  win.document.open();win.document.write(html);win.document.close();win.focus();win.print();
 }
 document.addEventListener('click',function(ev){const btn=ev.target?.closest?.('[data-pbj-save],[data-pbj-print]');if(!btn)return;
  const pid=btn.getAttribute('data-pbj-save')||btn.getAttribute('data-pbj-pid'),p=typeof P==='function'?P(pid):null;
  if(!p)return;ev.preventDefault();ev.stopImmediatePropagation();
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  if(scope&&(!scope.opdIds.includes(String(p.opd))||!scope.years.includes(Number(p.tahun)))){root.alert('Tidak ada akses ke paket tersebut.');return;}
  if(btn.hasAttribute('data-pbj-print')){if(p.jalurPengadaan!=='SPSE_MONITOR'||!policy.documentPlan(p).docs.some(d=>d.code===btn.dataset.pbjPrint&&d.available)){root.alert('Draf Pejabat Pengadaan hanya tersedia untuk metode Pengadaan Langsung SPSE sesuai kewenangan.');return;}printDraft(p,btn.dataset.pbjPrint);return;}
  if(!userCanWrite(p)){root.alert('Tidak memiliki izin mengubah paket.');return;}
  const host=btn.closest('[data-pbj-panel]');const date=host?.querySelector('[data-pbj-start]')?.value||'';
  const basis=host?.querySelector('[data-pbj-basis]')?.value||'';
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)){root.alert('Tanggal tidak valid.');return;}
  if(!['','perlem-12-2021','perlem-3-2026'].includes(basis)){root.alert('Pilihan dasar regulasi tidak valid.');return;}
  if(basis==='perlem-12-2021'&&(!date||date<'2026-09-22'||date>'2026-10-09')){root.alert('Pilihan Perlem 12/2021 pada fitur transisi hanya tersedia jika tanggal mulai pemilihan tercatat 22 September–9 Oktober 2026. Untuk paket lebih lama, cocokkan dasar yang berlaku secara manual.');return;}
  if(typeof SATRIA==='undefined'||typeof SATRIA.tx!=='function'){root.alert('Penyimpanan SATRIA belum siap.');return;}
  const saved=SATRIA.tx('paket','Catatan dasar regulasi paket '+String(p.rup||p.id),()=>{p.tglMulaiPemilihan=date;p.dasarRegulasi=basis;});
  if(saved!==null){if(typeof toast==='function')toast('Catatan dasar regulasi tersimpan; cocokkan dengan proses resmi.');if(typeof render==='function')render();}
 },true);
 root.SATRIA_PBJ_WORKSPACE=Object.freeze({panel,draft});
})(typeof window!=='undefined'?window:null);
