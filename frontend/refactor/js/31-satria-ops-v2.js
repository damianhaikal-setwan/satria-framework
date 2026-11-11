
/* SATRIA OPS 2.0 — monitoring terpadu baca-saja. Tidak menambah kolom database.
 * Sumber: paket e-Purchasing, spseMonitoring, Bank RUP, dan S.events yang sudah ada.
 * Peringatan dihitung saat halaman dibuka/dirender, BUKAN push/background scheduler.
 */
function satriaOpsVisiblePaket(){
 const year=Number(S.ui.tahun),opd=String(S.ui.opd||'all'),scope=activeCloudScope();
 return (S.paket||[]).filter(p=>Number(p.tahun)===year&&(opd==='all'||String(p.opd)===opd)&&(!scope||(scope.years.includes(year)&&scope.opdIds.includes(String(p.opd))))&&!p.arsip);
}
function satriaOpsVisibleRup(){
 const year=Number(S.ui.tahun),opd=String(S.ui.opd||'all'),scope=activeCloudScope();
 return (S.rupBank||[]).filter(r=>Number(r.tahun)===year&&(opd==='all'||String(r.opd)===opd)&&(!scope||(scope.years.includes(year)&&scope.opdIds.includes(String(r.opd)))));
}
function satriaOpsDays(date,today=satriaSpseToday()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
 const a=new Date(date+'T12:00:00'),b=new Date(today+'T12:00:00');
 if(!Number.isFinite(a.getTime()))return null;
 return Math.round((a-b)/86400000);
}
function satriaOpsAlerts(today=satriaSpseToday()){
 const result=[];const push=(p,level,kind,when,message,action)=>result.push({id:p.id,opd:p.opd,tahun:p.tahun,code:p.rup||'',name:p.nama||'',level,kind,when,message,action});
 for(const p of satriaOpsVisiblePaket()){
  if(!satriaSpseIs(p))continue;
  const m=p.spseMonitoring||{};
  for(const st of m.stages||[]){if(st.actual||!st.planEnd)continue;const days=satriaOpsDays(st.planEnd,today);if(days===null)continue;
   if(days<0)push(p,'Tinggi','Tahap SPSE',st.planEnd,(st.title||st.key||'Tahap')+' terlambat '+(-days)+' hari','Perbarui tanggal aktual atau jadwal sesuai SPSE');
   else if(days<=7)push(p,'Sedang','Tahap SPSE',st.planEnd,(st.title||st.key||'Tahap')+' jatuh tempo '+(days===0?'hari ini':'dalam '+days+' hari'),'Periksa progres pada SPSE');
  }
  const end=satriaOpsDays(m.contractEnd,today);
  if(end!==null&&m.contractNo&&m.phase!=='Selesai'&&m.phase!=='Dibatalkan'){
   if(end<0)push(p,'Tinggi','Kontrak',m.contractEnd,'Masa kontrak telah berakhir','Periksa status penyelesaian dan dokumen kontrak');
   else if(end<=14)push(p,'Sedang','Kontrak',m.contractEnd,'Kontrak berakhir '+(end===0?'hari ini':'dalam '+end+' hari'),'Konfirmasi progres fisik dan administrasi');
  }
  for(const issue of m.issues||[]){if(issue.status==='Selesai')continue;const days=satriaOpsDays(issue.due,today);
   if(days!==null&&days<0)push(p,'Tinggi','Tindak lanjut',issue.due,'Kendala belum selesai: '+String(issue.note||'').slice(0,95),issue.action||'Tindak lanjuti kendala');
   else if(days!==null&&days<=7)push(p,'Sedang','Tindak lanjut',issue.due,'Tenggat tindak lanjut mendekat: '+String(issue.note||'').slice(0,95),issue.action||'Periksa pemilik kendala');
   else if(issue.priority==='Tinggi')push(p,'Sedang','Kendala prioritas','',String(issue.note||'Kendala penting').slice(0,110),issue.action||'Periksa kendala');
  }
 }
 const rank={'Tinggi':0,'Sedang':1};return result.sort((a,b)=>(rank[a.level]-rank[b.level])||String(a.when||'9999').localeCompare(String(b.when||'9999'))||String(a.name).localeCompare(String(b.name),'id'));
}
function satriaOpsFinances(){
 const packages=satriaOpsVisiblePaket(),rup=satriaDashboardRupMetrics(Number(S.ui.tahun));const rupIds=new Set(satriaOpsVisibleRup().map(r=>String(r.id)));
 const rows=[];let epAward=0,epHps=0,spContract=0,spPaid=0,spDraftContract=0,spRecorded=0,spUnverified=0,spGaps=0;
 for(const p of packages){
  if(satriaSpseIs(p)){
   const m=p.spseMonitoring||{},val=satriaSpseContractValue(m),verified=satriaSpsePayments(m,true),recorded=satriaSpsePayments(m,false),confirmed=Boolean(String(m.contractNo||'').trim())&&val>0;
   if(confirmed)spContract+=val;else if(val>0)spDraftContract+=val;
   spPaid+=verified;spRecorded+=recorded;spUnverified+=recorded-verified;
   if(verified>val||(val>0&&!confirmed))spGaps++;
   rows.push({p,kind:'SPSE',hps:null,award:null,contract:confirmed?val:null,paid:verified,unverified:recorded-verified,flag:verified>val?'Bayar > kontrak':(!confirmed&&val>0?'Nomor kontrak belum lengkap':'')});
  }else{
   const hp=hps(p),win=pemenang(p),award=win?Number(win.t)||0:null;epHps+=hp;if(award!==null)epAward+=award;
   rows.push({p,kind:'E-Purchasing',hps:hp,award,contract:null,paid:null,unverified:null,flag:win?'':'Belum ada penetapan tervalidasi'});
  }
 }
 // Filter RUP only by visible scope; do not sum every linked package as another RUP.
 const bank=(rup.rows||[]).filter(x=>x.rup&&rupIds.has(String(x.rup.id)));
 const rupPagu=bank.filter(x=>x.valid).reduce((a,x)=>a+Number(x.pagu||0),0);
 const used=bank.filter(x=>x.valid).reduce((a,x)=>a+Number(x.used||0),0);
 const free=bank.filter(x=>x.valid).reduce((a,x)=>a+Math.max(0,Number(x.free||0)),0);
 return {packages,rows,bank,rupPagu,used,free,epAward,epHps,spContract,spPaid,spDraftContract,spRecorded,spUnverified,spGaps};
}
function satriaOpsHealth(){
 const records=satriaOpsVisiblePaket(),bank=satriaOpsVisibleRup(),rupSet=new Set(bank.map(r=>String(r.id))),rupKey=new Set(bank.map(r=>rupBankKey(r)));
 const issues=[],seen=new Set();let checked=0;
 function add(level,scope,p,message,action){issues.push({level,scope,p:p||null,message,action});}
 for(const r of bank){const key=rupBankKey(r);if(seen.has(key))add('Tinggi','Bank RUP',null,'RUP sumber ganda: '+String(r.rup),'Periksa OPD/tahun/kode RUP');seen.add(key);
  if(!Number.isFinite(Number(r.pagu))||Number(r.pagu)<=0)add('Tinggi','Bank RUP',null,'Pagu RUP belum valid: '+String(r.rup),'Periksa data SiRUP');
  checked++;
 }
 // Satu agregasi O(RUP + paket), bukan memindai seluruh paket per RUP.
 for(const entry of satriaDashboardRupMetrics(Number(S.ui.tahun)).rows||[]){if(entry.valid&&Number(entry.free)<0)add('Tinggi','Bank RUP',null,'Penggunaan RUP '+String(entry.rup.rup)+' melebihi pagu '+rp(-entry.free),'Periksa alokasi paket dan rincian');}
 for(const p of records){const links=satriaRupLinks(p);if(links.length?!links.every(id=>rupSet.has(String(id))):!rupKey.has(rupBankKey(p)))add('Tinggi','Relasi RUP',p,'Referensi Bank RUP tidak ditemukan','Periksa tautan RUP dan OPD/tahun');
  if(Number(p.pagu)<0||!Number.isFinite(Number(p.pagu)))add('Tinggi','Pagu paket',p,'Pagu paket tidak valid','Perbaiki alokasi paket');
  if(satriaSpseIs(p)){
   const m=p.spseMonitoring||{},value=satriaSpseContractValue(m),paid=satriaSpsePayments(m,true),source=String(m.sourceAsOf||'');
   if(value>0&&!String(m.contractNo||'').trim())add('Sedang','Kontrak SPSE',p,'Nilai kontrak ada tetapi nomor kontrak kosong','Lengkapi nomor kontrak');
   if(paid>value)add('Tinggi','Pembayaran SPSE',p,'Pembayaran terverifikasi melebihi nilai kontrak','Periksa pembayaran dan addendum');
   if(m.source&&(!source||satriaOpsDays(source)<-30))add('Sedang','Keterkinian SPSE',p,'Sumber SPSE belum diverifikasi dalam 30 hari','Periksa SPSE lalu perbarui tanggal sumber');
   if(!String(m.tenderCode||'').trim())add('Rendah','Identitas SPSE',p,'Nomor tender/paket SPSE belum diisi','Lengkapi identitas dari SPSE');
  }else if((p.items||[]).length===0)add('Sedang','Rincian e-Purchasing',p,'Rincian barang belum diisi','Lengkapi rincian sebelum dokumen diterbitkan');
 }
 // Tambahan pemeriksaan murni atas Paket/HPS/Penawaran yang SUDAH tersaring scope.
 // Jangan memperluas himpunan dari state global maupun mengubah angka sumber.
 const extra=window.SATRIA_OPERATIONAL_INTEGRITY?.inspect?.({packages:records,rupBank:bank,suppliers:S.penyedia||[],links:satriaRupLinks});
 if(extra)for(const issue of extra.issues){
  // 'LINKED_RUP_NOT_VISIBLE' sudah ditangani oleh pemeriksaan dasar di atas.
  if(issue.code==='LINKED_RUP_NOT_VISIBLE')continue;
  issues.push(issue);
 }
 const rank={'Tinggi':0,'Sedang':1,'Rendah':2};issues.sort((a,b)=>rank[a.level]-rank[b.level]);return {records,bank,checked,issues};
}
function satriaOpsLink(p){return '#'+(satriaSpseIs(p)?'spse':'paket')+'/'+encodeURIComponent(p.id)}
function satriaOpsKpi(label,value,note){return `<div class="ops-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`}
function satriaOpsTable(headers,rows,empty='Belum ada data.'){
 return `<div class="ops-tablewrap"><table><thead><tr>${headers.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}
function satriaOpsRiskSummary(){
 const h=satriaOpsHealth(),critical=h.issues.filter(i=>i.level==='Tinggi').length;
 return `<aside class="ops-risk-summary card" role="note"><div><strong>Integritas lintas modul</strong><p class="mut">${critical} temuan prioritas tinggi dari ${h.issues.length} catatan. Pemeriksaan baca-saja atas data yang dapat diakses; bukan audit legal.</p></div><a href="#quality">Lihat temuan dan langkah perbaikan</a></aside>`;
}
function satriaOpsMonitor(){const al=satriaOpsAlerts(),critical=al.filter(x=>x.level==='Tinggi').length;
 return `<section class="ops-page">${satriaOpsRiskSummary()}<div class="ops-hero"><h2>Monitoring Jadwal & Peringatan</h2><p>Peringatan dihitung dari catatan jadwal SPSE, masa kontrak, dan tindak lanjut. Data diperbarui ketika SATRIA dibuka atau disegarkan—bukan notifikasi latar belakang.</p><p>TA ${esc(S.ui.tahun)} • ${esc(S.ui.opd==='all'?'Semua OPD yang dapat diakses':O(S.ui.opd).singkat)} • Diperiksa ${esc(satriaSpseDateIdNow())}</p></div><div class="ops-grid">${satriaOpsKpi('Perhatian tinggi',critical,'Tanggal lewat atau kontrak berakhir')}${satriaOpsKpi('Mendekati tenggat',al.length-critical,'≤7 hari tahapan/kendala • ≤14 hari kontrak')}${satriaOpsKpi('Paket yang diperiksa',satriaOpsVisiblePaket().filter(satriaSpseIs).length,'Paket monitoring SPSE')}${satriaOpsKpi('Total pengingat',al.length,'Dapat berupa beberapa isu pada satu paket')}</div><div class="card"><div class="row" style="justify-content:space-between"><h3>Daftar peringatan</h3><button type="button" class="g" data-ops-action="alerts-csv">Ekspor daftar CSV</button></div>${satriaOpsTable(['Prioritas','Paket/RUP','Jenis','Tenggat','Kondisi & tindak lanjut'],al.slice(0,250).map(x=>`<tr><td><span class="ops-priority ${x.level==='Tinggi'?'ops-high':'ops-medium'}">${esc(x.level)}</span></td><td><a href="${satriaOpsLink({id:x.id,jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{}})}">${esc(x.name)}</a><small>RUP ${esc(x.code)} • ${esc(O(x.opd).singkat)}</small></td><td>${esc(x.kind)}</td><td>${esc(x.when||'Tanpa tanggal')}</td><td>${esc(x.message)}<small>${esc(x.action)}</small></td></tr>`),'Tidak ada jadwal lewat atau tenggat dekat pada data yang sudah dicatat.')}<p class="mut">Ditampilkan maksimal 250 pengingat. Tanggal resmi tetap harus dicocokkan dengan SPSE dan kontrak; pengingat tidak mengubah status data.</p></div></section>`;
}
function satriaOpsFinance(){const d=satriaOpsFinances(),pct=d.spContract?(d.spPaid/d.spContract*100).toFixed(1)+'%':'Belum dapat dihitung';
 return `<section class="ops-page">${satriaOpsRiskSummary()}<div class="ops-hero"><h2>Keuangan & Kontrak Terpadu</h2><p>Pagu RUP unik, estimasi penggunaan, penetapan e-Purchasing, kontrak SPSE, dan pembayaran terverifikasi tidak boleh diperlakukan sebagai satu jenis uang atau dijumlahkan menjadi satu total belanja.</p></div><div class="ops-grid">${satriaOpsKpi('Pagu Bank RUP unik',rp(d.rupPagu),'Sumber pagu, bukan anggaran kas')}${satriaOpsKpi('Penggunaan RUP terhitung',rp(d.used),'HPS/cadangan/alokasi sesuai mesin RUP')}${satriaOpsKpi('Sisa kapasitas RUP',rp(d.free),'Bukan saldo kas')}${satriaOpsKpi('Penetapan e-Purchasing',rp(d.epAward),'Penetapan terverifikasi, bukan pembayaran')}${satriaOpsKpi('Kontrak SPSE bernomor',rp(d.spContract),'Nilai termasuk addendum')}${satriaOpsKpi('Pembayaran SPSE terverifikasi',rp(d.spPaid),'Rasio dari kontrak SPSE: '+pct)}</div><div class="card"><h3>Catatan rekonsiliasi</h3><p>Kontrak belum bernomor yang belum masuk KPI: <b>${rp(d.spDraftContract)}</b>. Pembayaran yang masih tercatat tetapi belum diverifikasi: <b>${rp(d.spUnverified)}</b>. ${d.spGaps?`<b class="warn">${d.spGaps} paket SPSE membutuhkan pemeriksaan keuangan.</b>`:'Tidak ditemukan anomali kontrak dasar pada data SPSE yang terisi.'}</p><p class="mut">Pembayaran e-Purchasing tidak tersedia sebagai ledger terverifikasi di modul ini; kolom pembayaran e-Purchasing sengaja tidak diisi otomatis. Progres fisik juga tidak disimpulkan dari pembayaran.</p></div><div class="card"><div class="row" style="justify-content:space-between"><h3>Rincian paket</h3><button class="g" data-ops-action="finance-csv">Ekspor rincian CSV</button></div>${satriaOpsTable(['Paket','Metode','Pagu paket','HPS / Penetapan','Kontrak SPSE','Pembayaran SPSE'],d.rows.slice(0,250).map(x=>`<tr><td><a href="${satriaOpsLink(x.p)}">${esc(x.p.nama)}</a><small>RUP ${esc(x.p.rup)}</small></td><td>${x.kind}</td><td class="n">${rp(x.p.pagu)}</td><td>${x.kind==='E-Purchasing'?'HPS '+rp(x.hps)+'<small>Penetapan: '+(x.award===null?'Belum ada':rp(x.award))+'</small>':'—'}</td><td class="n">${x.contract===null?'—':rp(x.contract)}</td><td class="n">${x.paid===null?'Tidak dicatat':rp(x.paid)}${x.flag?`<small class="warn">${esc(x.flag)}</small>`:''}</td></tr>`),'Belum ada paket pada filter ini.')}<p class="mut">Maksimal 250 paket ditampilkan; CSV mencakup seluruh paket yang terlihat dalam hak akses.</p></div></section>`;
}
function satriaOpsQuality(){const h=satriaOpsHealth(),scope=activeCloudScope(),admin=!!window.SATRIA_CLOUD_CONFIGURED&&window.SATRIA_CLOUD_ROLE==='admin';
 const audit=(S.events||[]).slice(-100).reverse();const showAudit=!window.SATRIA_CLOUD_CONFIGURED||admin;return `<section class="ops-page"><div class="ops-hero"><h2>Kualitas Data & Audit Trail</h2><p>Pemeriksaan hanya membaca kondisi terkini. Tidak mengubah catatan yang sudah tersimpan dan tidak menyatakan kepatuhan hukum atau kebenaran data resmi.</p></div><div class="ops-grid">${satriaOpsKpi('Paket diperiksa',h.records.length,'Sesuai hak akses dan filter')}${satriaOpsKpi('RUP diperiksa',h.checked,'Bank RUP tahun/OPD aktif')}${satriaOpsKpi('Perhatian tinggi',h.issues.filter(x=>x.level==='Tinggi').length,'Perlu ditindaklanjuti')}${satriaOpsKpi('Seluruh catatan',h.issues.length,'Tidak otomatis diperbaiki')}</div><div class="card"><div class="row" style="justify-content:space-between"><h3>Temuan dan tindak lanjut</h3><button type="button" class="g" data-ops-action="quality-csv">Ekspor temuan CSV</button></div>${satriaOpsTable(['Tingkat','Area','Paket','Temuan','Saran tindakan'],h.issues.slice(0,250).map(i=>`<tr><td><span class="ops-priority ${i.level==='Tinggi'?'ops-high':i.level==='Sedang'?'ops-medium':''}">${esc(i.level)}</span></td><td>${esc(i.scope)}</td><td>${i.p?`<a href="${satriaOpsLink(i.p)}">${esc(i.p.nama)}</a>`:'—'}</td><td>${esc(i.message)}</td><td>${esc(i.action)}</td></tr>`),'Tidak ada temuan menurut aturan pemeriksaan ini.')}<p class="mut">Pemeriksaan bukan bukti bahwa seluruh data sah/terverifikasi. Ditampilkan maksimal 250 temuan; CSV mencakup seluruh temuan.</p></div><div class="card"><h3>Riwayat perubahan yang sudah dicatat SATRIA</h3>${showAudit?satriaOpsTable(['Waktu','Pengguna','Jenis','Perubahan'],audit.slice(0,60).map(e=>`<tr><td>${esc(e.t||'')}</td><td>${esc(e.actor||'-')}</td><td>${esc(e.kind||'')}</td><td>${esc(e.label||'')}</td></tr>`),'Belum ada event dalam riwayat tersimpan.'):`<p class="mut">Audit global tidak ditampilkan pada akun operator terbatas karena event lama tidak selalu memuat ID OPD. Riwayat monitoring per paket tetap tersedia di detail SPSE.</p>`}<p class="mut">Riwayat yang ada mengikuti batas retensi SATRIA. Ini bukan log server yang anti-manipulasi; untuk audit formal diperlukan log backend immutable dan identitas Auth terverifikasi.</p></div></section>`;
}
function satriaOpsBriefExtra(){const d=satriaOpsFinances(),alerts=satriaOpsAlerts(),health=satriaOpsHealth(),s=satriaSpseMetrics(satriaSpseRows());return `<section class="ops-page ops-brief-extra"><div class="card"><h3>Executive Briefing SPSE • Keputusan yang dibutuhkan</h3><div class="ops-grid">${satriaOpsKpi('Peringatan tinggi',alerts.filter(a=>a.level==='Tinggi').length,'Jadwal/kontrak/kendala melewati tenggat')}${satriaOpsKpi('SPSE data >30 hari',s.stale,'Perlu verifikasi sumber informasi')}${satriaOpsKpi('Temuan kualitas',health.issues.length,'Menurut pemeriksaan lokal')}${satriaOpsKpi('Realisasi kontrak SPSE',d.spContract?(d.spPaid/d.spContract*100).toFixed(1)+'%':'—','Pembayaran terverifikasi / kontrak bernomor')}</div><h4>Usulan agenda rapat (berdasarkan data yang tersedia)</h4>${satriaOpsTable(['Prioritas','Paket','Isu','Tindak lanjut'],alerts.slice(0,12).map(x=>`<tr><td>${esc(x.level)}</td><td>${esc(x.name)}<small>RUP ${esc(x.code)}</small></td><td>${esc(x.message)}</td><td>${esc(x.action)}</td></tr>`),'Belum ada peringatan jadwal atau kendala prioritas dari data yang dicatat.')}<p class="mut">Sumber: pencatatan operator di SATRIA. Data SPSE bukan sinkronisasi resmi real-time. Tanggal penyusunan: ${esc(satriaSpseDateIdNow())}. HPS, penetapan, kontrak, dan pembayaran tidak disamakan.</p><div class="row ops-brief-links"><a href="#monitor">Buka peringatan →</a><a href="#finance">Rincian keuangan →</a><a href="#quality">Pemeriksaan data →</a></div></div></section>`;}
function satriaOpsDashWidget(){const al=satriaOpsAlerts(),health=satriaOpsHealth();return `<section class="card ops-dash-widget"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">Pusat Monitoring Pengadaan</h3><a href="#monitor">Lihat seluruh peringatan →</a></div><p class="mut">${al.filter(x=>x.level==='Tinggi').length} perhatian tinggi, ${al.filter(x=>x.level==='Sedang').length} mendekati tenggat. Dihitung dari jadwal SPSE dan kontrak yang dicatat. <a href="#quality">${health.issues.length} temuan kualitas data</a>.</p></section>`}
function satriaOpsAssistant(raw){
 const q=String(raw||'').toLowerCase();
 const scope=`TA ${S.ui.tahun} • ${S.ui.opd==='all'?'OPD dalam hak akses':'OPD '+O(S.ui.opd).singkat}`;
 const rupMatch=q.match(/\brup\s*[:#-]?\s*(\d{7,12})\b/);
 if(rupMatch){const rup=satriaOpsVisibleRup().find(x=>String(x.rup)===rupMatch[1]);if(!rup)return 'RUP '+rupMatch[1]+' tidak ditemukan dalam tahun/OPD yang dapat Anda akses.';
  const b=satriaRupStatusAnggaran(rup);const visible=new Set(satriaOpsVisiblePaket().map(p=>String(p.id)));
  return `RUP ${rup.rup} (${scope}):\nPagu sumber: ${rp(b.batas)}\nTerhitung digunakan: ${rp(b.allocated)}\nSisa kapasitas: ${rp(b.sisa)}\nPaket terkait: ${b.linked.filter(p=>visible.has(String(p.id))).length} paket dalam cakupan yang dapat diakses.\nData penggunaan adalah rincian/alokasi, bukan pembayaran.`;
 }
 if(/\b(sisa.*rup|rup.*sisa|kapasitas rup|pagu rup)\b/.test(q)){const d=satriaOpsFinances();return `Dari Bank RUP (${scope}):\nPagu unik: ${rp(d.rupPagu)}\nPenggunaan terhitung: ${rp(d.used)}\nSisa kapasitas: ${rp(d.free)}\nCatatan: nilai ini adalah estimasi alokasi/rincian, bukan kas atau realisasi pembayaran.`;}
 if(/\b(jadwal|tenggat|terlambat|deadline|kontrak.*akhir|berakhir)\b/.test(q)){const al=satriaOpsAlerts();return `Peringatan (${scope}): ${al.filter(a=>a.level==='Tinggi').length} tinggi dan ${al.filter(a=>a.level==='Sedang').length} mendekati tenggat.\n`+(al.length?al.slice(0,8).map(a=>`• ${a.name} (RUP ${a.code}): ${a.message}${a.when?' — '+a.when:''}`).join('\n'):'Belum ada peringatan dari jadwal yang terisi.')+'\nPeriksa menu Monitoring Jadwal untuk tindak lanjut. Status resmi tetap di SPSE.';}
 if(/\b(kontrak|pembayaran|dibayar|realisasi|keuangan|termin|addendum)\b/.test(q)){const d=satriaOpsFinances();return `Keuangan (${scope}):\nKontrak SPSE bernomor: ${rp(d.spContract)}\nPembayaran SPSE terverifikasi: ${rp(d.spPaid)}\nBelum diverifikasi: ${rp(d.spUnverified)}\nPenetapan e-Purchasing: ${rp(d.epAward)} (bukan pembayaran)\nPembayaran e-Purchasing tidak tercatat sebagai ledger terverifikasi. Periksa menu Keuangan & Kontrak.`;}
 if(/\b(temuan|kualitas|integritas|audit|periksa data|data bermasalah)\b/.test(q)){const h=satriaOpsHealth();return `Kualitas data (${scope}): ${h.issues.length} temuan; ${h.issues.filter(i=>i.level==='Tinggi').length} prioritas tinggi.\n`+(h.issues.length?h.issues.slice(0,7).map(i=>'• '+i.scope+': '+i.message).join('\n'):'Belum ada temuan menurut aturan lokal.')+'\nBuka Kualitas Data & Audit Trail untuk daftar lengkap; ini bukan audit server.';}
 if(/\b(spse|tender)\b/.test(q)&&/\b(paket|jumlah|berapa|status)\b/.test(q)){const v=satriaOpsVisiblePaket().filter(satriaSpseIs),m=satriaSpseMetrics(v);return `Monitoring SPSE (${scope}): ${m.count} paket; ${m.late} tahapan terlambat; ${m.soon} mendekati tenggat; ${m.openIssues} kendala terbuka. Kontrak tercatat ${rp(m.contract)} (periksa nomor kontrak); pembayaran terverifikasi ${rp(m.paid)}. Buka Monitoring SPSE untuk data sumber.`;}
 if(/\b(briefing|pimpinan|agenda rapat|prioritas rapat|eksekutif)\b/.test(q)){const d=satriaOpsFinances(),al=satriaOpsAlerts(),h=satriaOpsHealth();return `Agenda Executive Briefing (${scope}):\n• ${al.filter(x=>x.level==='Tinggi').length} peringatan tinggi\n• ${h.issues.length} temuan kualitas data\n• Kontrak SPSE ${rp(d.spContract)}, pembayaran terverifikasi ${rp(d.spPaid)}\n`+(al.length?'Top prioritas:\n'+al.slice(0,5).map(x=>'• '+x.name+': '+x.action).join('\n'):'Belum ada peringatan jadwal yang tercatat.')+'\nBuka Executive Briefing untuk pemeriksaan pimpinan.';}
 return null;
}
function satriaOpsCsv(type){
 if(type==='alerts-csv'){const items=satriaOpsAlerts();satriaLaporanDownloadCsv('SATRIA-peringatan-jadwal.csv',['TA','OPD','RUP','Paket','Prioritas','Jenis','Tanggal','Kondisi','Tindakan'],items.map(x=>[x.tahun,O(x.opd).singkat,x.code,x.name,x.level,x.kind,x.when,x.message,x.action]));}
 if(type==='finance-csv'){const d=satriaOpsFinances();satriaLaporanDownloadCsv('SATRIA-monitoring-keuangan.csv',['TA','OPD','RUP','ID Paket','Nama Paket','Metode','Pagu Paket','HPS EP','Penetapan EP','Kontrak SPSE','Pembayaran Terverifikasi SPSE','Pembayaran Belum Verifikasi','Catatan'],d.rows.map(x=>[x.p.tahun,O(x.p.opd).singkat,x.p.rup,x.p.id,x.p.nama,x.kind,x.p.pagu,x.hps??'',x.award??'',x.contract??'',x.paid??'',x.unverified??'',x.flag]));}
 if(type==='quality-csv'){const q=satriaOpsHealth().issues;satriaLaporanDownloadCsv('SATRIA-kualitas-data.csv',['Prioritas','Area','RUP','Paket','Temuan','Tindak Lanjut'],q.map(x=>[x.level,x.scope,x.p?.rup||'',x.p?.nama||'',x.message,x.action]));}
}
(function(){document.addEventListener('click',e=>{const b=e.target.closest?.('[data-ops-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();satriaOpsCsv(b.dataset.opsAction);},true)})();
window.SATRIA_OPS_V2=Object.freeze({visiblePaket:satriaOpsVisiblePaket,alerts:satriaOpsAlerts,finances:satriaOpsFinances,health:satriaOpsHealth});

