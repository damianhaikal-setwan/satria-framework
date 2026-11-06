
/* SATRIA NEXT 3.0.59.39 — Executive Briefing 4.1 e-Purchasing.
 * Read-only; uses already-authorized TA/OPD + current package, supplier and Bank RUP data.
 * Does NOT mutate awards, HPS, suppliers, documents, or finance.
 */
const satriaBriefUI={mode:'ep',status:'all',search:''};
function satriaBriefEpRows(){
 // Build Bank RUP indexes once for large OPD data sets.
 const refMap=new Map((S.rupBank||[]).map(r=>[String(r.id),r]));
 const bankCounts=new Map();
 for(const r of S.rupBank||[]){const key=[String(r.tahun),String(r.opd),String(r.rup)].join('|');bankCounts.set(key,(bankCounts.get(key)||0)+1);}
 return satriaOpsVisiblePaket().filter(p=>!satriaSpseIs(p)).map(p=>{
  const H=hps(p),win=pemenang(p),award=win?Number(win.t):null,docKeys=['tglDpp','tglBahp','tglSppbj'];
  const done=docKeys.filter(key=>!!p[key]).length,issues=[];
  const add=(level,kind,detail,action)=>issues.push({level,kind,detail,action});
  const bankCount=bankCounts.get([String(p.tahun),String(p.opd),String(p.rup)].join('|'))||0;
  const links=satriaRupLinks(p);
  if(links.length){
   if(links.some(id=>!refMap.has(String(id))))add('Tinggi','Referensi Bank RUP','Tautan RUP tidak lagi tersedia','Periksa tautan pada Data Paket');
   else if(links.some(id=>String(refMap.get(String(id)).opd)!==String(p.opd)||Number(refMap.get(String(id)).tahun)!==Number(p.tahun)))add('Tinggi','Referensi Bank RUP','Tautan RUP berbeda OPD atau tahun anggaran','Periksa referensi Bank RUP dan kewenangan akses');
   if(links.length>1&&typeof satriaRupAlokasiDetail==='function'&&!satriaRupAlokasiDetail(p).complete)add('Sedang','Konsolidasi multi-RUP','Pembagian alokasi lintas RUP belum lengkap','Periksa rincian alokasi tiap RUP');
  }
  else if(bankCount!==1)add('Tinggi','Referensi Bank RUP',bankCount?'Referensi RUP ganda':'RUP tidak ditemukan','Periksa Bank RUP dan tautan paket');
  if(!(Number(p.pagu)>0))add('Tinggi','Alokasi paket','Pagu paket tidak valid','Periksa alokasi RUP');
  if(H>Number(p.pagu||0)&&H>0)add('Tinggi','Batas HPS','Total HPS melebihi pagu paket','Periksa rincian HPS dan pagu resmi');
  if(p.pemenangId&&!win)add('Tinggi','Penetapan','Penetapan tersimpan tidak lagi lolos validasi','Buka evaluasi penawaran dan periksa kembali bukti');
  if((p.tglPenetapan||p.tglSppbj)&&!win)add('Tinggi','Administrasi penetapan','Tanggal penetapan/SPPBJ terisi tetapi belum ada pemenang valid','Cocokkan dokumen asli dan evaluasi penawaran');
  if(!(p.items||[]).length)add('Sedang','Rincian barang','Rincian HPS belum diisi','Lengkapi barang dan HPS');
  if(!(p.penawaran||[]).length)add('Sedang','Penawaran','Belum ada penawaran tercatat','Catat bukti penawaran yang benar');
  if(!win){add('Sedang','Penetapan','Belum ada pemenang yang lolos validasi','Periksa negosiasi dan lakukan penetapan sesuai bukti');}
  if(win){
   if(!p.tglDpp)add('Sedang','Dokumen','Tanggal DPP belum terisi','Periksa penerbitan DPP');
   if(!p.tglBahp)add('Sedang','Dokumen','Tanggal BA Hasil belum terisi','Periksa BA Hasil');
   if(!p.tglSppbj)add('Sedang','Dokumen','Tanggal SPPBJ belum terisi','Periksa penerbitan SPPBJ');
   if(satriaNegoAboveUnit(p,win.w).length)add('Sedang','Review historis','Ada harga negosiasi di atas HPS satuan dengan review tercatat','Periksa alasan dan bukti historis sebelum laporan disahkan');
  }
  const chronology=[['tglSurvei','tglNego'],['tglNego','tglBahp'],['tglBahp','tglSppbj']];
  if(chronology.some(([a,b])=>p[a]&&p[b]&&/^\d{4}-\d{2}-\d{2}$/.test(p[a])&&/^\d{4}-\d{2}-\d{2}$/.test(p[b])&&p[a]>p[b]))add('Tinggi','Kronologi','Urutan tanggal proses perlu diperiksa','Cocokkan dengan dokumen bertanggal asli');
  if(p.koreksiPenyediaPerluVerifikasi&&!p.koreksiPenyediaPerluVerifikasi.ditetapkanUlangPada)add('Sedang','Koreksi penyedia','Koreksi identitas penyedia belum ditetapkan ulang','Periksa bukti dan penetapan ulang');
  const high=issues.filter(x=>x.level==='Tinggi').length,medium=issues.length-high;
  return {p,H,win,award,done,totalDoc:docKeys.length,issues,high,medium,level:high?'Tinggi':medium?'Sedang':'Normal',offerCount:(p.penawaran||[]).length};
 });
}
function satriaBriefEpData(){
 const rows=satriaBriefEpRows(),settled=rows.filter(r=>r.award!==null),rup=satriaDashboardRupMetrics(),suppliers=new Map();
 for(const row of settled){const id=String(row.win.w.pen||''),supplier=PY(id).nama||'Tidak diketahui';if(!suppliers.has(id))suppliers.set(id,{id,name:supplier,count:0,amount:0});const a=suppliers.get(id);a.count++;a.amount+=row.award;}
 const supplierRows=[...suppliers.values()].sort((a,b)=>b.amount-a.amount);
 const totalHps=sum(rows,r=>r.H),totalAward=sum(settled,r=>r.award),settledHps=sum(settled,r=>r.H);
 return {rows,settled,rup,totalHps,totalAward,settledHps,delta:settledHps-totalAward,open:rows.length-settled.length,high:rows.filter(x=>x.high).length,medium:rows.filter(x=>!x.high&&x.medium).length,incomplete:rows.filter(x=>x.done<x.totalDoc).length,supplierRows};
}
function satriaBriefScope(){return 'TA '+esc(S.ui.tahun)+' • '+esc(S.ui.opd==='all'?'Semua OPD yang diizinkan':O(S.ui.opd).nama);}
function satriaBriefRisk(row){return `<span class="brief-risk brief-${row.high?'high':row.medium?'medium':'ok'}">${esc(row.level)}${row.issues.length?' ('+row.issues.length+')':''}</span>`;}
function satriaBriefKpi(label,value,sub){return `<div class="brief-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`;}
function satriaBriefTable(headers,rows,empty='Belum ada data.'){return `<div class="brief-scroll"><table class="brief-table"><thead><tr>${headers.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;}
function satriaBriefActionRows(d){const r=[];for(const row of d.rows){for(const x of row.issues)r.push({...x,p:row.p});}
 const rank={Tinggi:0,Sedang:1,Rendah:2};return r.sort((a,b)=>rank[a.level]-rank[b.level]||String(a.p.rup).localeCompare(String(b.p.rup),'id'));}
function satriaBriefControl(){return `<div class="spse-toolbar brief-toolbar no-print" role="group" aria-label="Pilihan Executive Briefing"><button type="button" class="${satriaBriefUI.mode==='ep'?'':'g'}" data-brief-action="mode" data-mode="ep">e-Purchasing</button><button type="button" class="${satriaBriefUI.mode==='spse'?'':'g'}" data-brief-action="mode" data-mode="spse">SPSE</button><button type="button" class="${satriaBriefUI.mode==='all'?'':'g'}" data-brief-action="mode" data-mode="all">Gabungan</button><button type="button" data-brief-action="print">Cetak laporan pimpinan / PDF</button></div>`;}
function satriaBriefEpSummary(d){
 const footer='<p class="mut brief-disclaimer">Sumber: paket e-Purchasing dan Bank RUP yang tersedia pada akun ini. Paket arsip tidak termasuk ringkasan paket aktif; saldo Bank RUP tetap memperhitungkan alokasi paket terkait termasuk arsip. Penetapan bukan pembayaran, selisih HPS bukan penghematan kas, dan kelengkapan tanggal bukan bukti dokumen telah terverifikasi.</p>';
 return `<section class="brief-section" aria-label="Ringkasan e-Purchasing"><div class="card brief-card"><h3>Ringkasan e-Purchasing</h3><div class="brief-kpis">
 ${satriaBriefKpi('Paket aktif',String(d.rows.length),'Belum termasuk paket arsip')}
 ${satriaBriefKpi('Total HPS',rp(d.totalHps),'Seluruh paket aktif dengan rincian')}
 ${satriaBriefKpi('Penetapan valid',rp(d.totalAward),d.settled.length+' paket tervalidasi')}
 ${satriaBriefKpi('Selisih HPS–penetapan',rp(d.delta),'Hanya paket yang telah ditetapkan')}
 ${satriaBriefKpi('Belum ditetapkan',String(d.open),'Perlu evaluasi/negosiasi')}
 ${satriaBriefKpi('Perhatian tinggi',String(d.high),'Jumlah paket, bukan jumlah temuan')}
 ${satriaBriefKpi('Dokumen belum lengkap',String(d.incomplete),'Tanggal DPP / BA Hasil / SPPBJ')}
 ${satriaBriefKpi('Sisa pagu Bank RUP',d.rup.validCount?rp(d.rup.free):'—','Penetapan + cadangan; bukan saldo kas')}
 </div><p class="mut">Pagu Bank RUP unik: <b>${d.rup.validCount?rp(d.rup.pagu):'Belum ada RUP valid'}</b> · Sisa berdasarkan HPS: <b>${d.rup.validCount?rp(d.rup.freeHps):'—'}</b> · Penetapan tidak dihitung dua kali sebagai HPS. Paket konsolidasi multi-RUP yang belum terbagi tetap menjadi cadangan.</p>${footer}</div></section>`;
}
function satriaBriefEpPriorities(d,print=false){const actions=satriaBriefActionRows(d);return `<section class="card brief-card"><h3>Prioritas keputusan &amp; tindak lanjut (${actions.length} temuan)</h3><p class="mut">Otomatis dari data yang tersimpan; urutan perhatian bukan keputusan pengadaan atau penilaian kepatuhan hukum.</p>${satriaBriefTable(['Prioritas','Paket / RUP','Perhatian','Tindak lanjut'],actions.slice(0,print?40:30).map(x=>`<tr><td>${esc(x.level)}</td><td>${esc(x.p.nama)}<small>RUP ${esc(x.p.rup)}</small></td><td>${esc(x.detail)}</td><td>${esc(x.action)}${print?'':`<div><a href="#brief/${encodeURIComponent(x.p.id)}">Buka briefing paket ↗</a></div>`}</td></tr>`),'Tidak ada temuan dari pemeriksaan otomatis.')}${actions.length>(print?40:30)?`<p class="mut">Ditampilkan ${(print?40:30)} dari ${actions.length} temuan. Unduh CSV untuk seluruh tindak lanjut.</p>`:''}</section>`;}
function satriaBriefEpSuppliers(d){
 return `<section class="card brief-card"><h3>Distribusi penetapan per penyedia</h3><p class="mut">Alat transparansi, bukan indikator bahwa konsentrasi penetapan melanggar aturan. Hanya penyedia pemenang valid; jumlah per paket tidak menggandakan nilai saat satu RUP dipakai beberapa paket.</p>${satriaBriefTable(['Penyedia','Paket ditetapkan','Nilai penetapan','Porsi penetapan'],d.supplierRows.slice(0,15).map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${x.count}</td><td class="n">${rp(x.amount)}</td><td class="n">${d.totalAward?(x.amount/d.totalAward*100).toFixed(1)+'%':'—'}</td></tr>`),'Belum ada penetapan valid.')}</section>`;
}
function satriaBriefFilteredRows(d){
 const q=satriaBriefUI.search.trim().toLowerCase();let rows=d.rows.filter(r=>!q||[r.p.rup,r.p.nama,O(r.p.opd).nama,r.win?PY(r.win.w.pen).nama:''].some(v=>String(v||'').toLowerCase().includes(q)));
 if(satriaBriefUI.status==='award')rows=rows.filter(r=>r.win);
 if(satriaBriefUI.status==='pending')rows=rows.filter(r=>!r.win);
 if(satriaBriefUI.status==='risk')rows=rows.filter(r=>r.issues.length);
 rows.sort((a,b)=>(b.high-a.high)||(b.medium-a.medium)||String(a.p.rup||'').localeCompare(String(b.p.rup||''),'id'));
 return rows;
}
function satriaBriefEpPerOpd(d){
 const groups=new Map();
 for(const row of d.rows){const id=String(row.p.opd);if(!groups.has(id))groups.set(id,{id,count:0,awarded:0,hps:0,award:0,attention:0});const a=groups.get(id);a.count++;a.hps+=row.H;if(row.award!==null){a.awarded++;a.award+=row.award;}if(row.issues.length)a.attention++;}
 const rows=[...groups.values()].sort((a,b)=>b.count-a.count||O(a.id).singkat.localeCompare(O(b.id).singkat,'id'));
 return `<section class="card brief-card"><h3>Perbandingan kemajuan per OPD</h3><p class="mut">Khusus OPD yang diizinkan pada tahun aktif. Nilai HPS dan penetapan adalah agregasi paket, bukan pagu unik Bank RUP.</p>${satriaBriefTable(['OPD','Paket','Ditetapkan valid','HPS paket','Penetapan','Paket perlu perhatian'],rows.map(x=>`<tr><td>${esc(O(x.id).singkat)}</td><td class="n">${x.count}</td><td class="n">${x.awarded}</td><td class="n">${rp(x.hps)}</td><td class="n">${rp(x.award)}</td><td class="n">${x.attention}</td></tr>`),'Belum ada paket e-Purchasing.')}</section>`;
}
function satriaBriefEpPrintPackages(d){
 return `<section class="card brief-card"><h3>Lampiran: daftar paket e-Purchasing</h3>${satriaBriefTable(['RUP / Paket','HPS','Penetapan valid','Pemenang','Perhatian'],d.rows.slice(0,60).map(x=>`<tr><td>${esc(x.p.rup)}<small>${esc(x.p.nama)} • ${esc(O(x.p.opd).singkat)}</small></td><td class="n">${rp(x.H)}</td><td class="n">${x.award===null?'—':rp(x.award)}</td><td>${x.win?esc(PY(x.win.w.pen).nama):'Belum ditetapkan'}</td><td>${esc(x.level)}</td></tr>`),'Belum ada paket e-Purchasing.')}${d.rows.length>60?'<p class="mut">Lampiran cetak dibatasi 60 paket. CSV memuat seluruh paket sesuai hak akses.</p>':''}</section>`;
}
function satriaBriefEpPackageTable(d){
 const rows=satriaBriefFilteredRows(d);
 return `<section class="card brief-card"><h3>Daftar paket &amp; briefing individual</h3><div class="brief-filters spse-toolbar no-print"><label>Cari RUP / penyedia / paket<input type="search" data-brief-search value="${esc(satriaBriefUI.search)}" placeholder="Contoh 66898344" /></label><label>Status<select data-brief-filter><option value="all" ${satriaBriefUI.status==='all'?'selected':''}>Semua paket</option><option value="award" ${satriaBriefUI.status==='award'?'selected':''}>Sudah ditetapkan</option><option value="pending" ${satriaBriefUI.status==='pending'?'selected':''}>Belum ditetapkan</option><option value="risk" ${satriaBriefUI.status==='risk'?'selected':''}>Perlu perhatian</option></select></label><button type="button" class="g" data-brief-action="apply">Terapkan filter</button><button type="button" class="g" data-brief-action="reset">Reset</button><button type="button" class="g" data-brief-action="csv-packages">Unduh CSV paket</button><button type="button" class="g" data-brief-action="csv-actions">Unduh CSV tindak lanjut</button><button type="button" class="g" data-brief-action="csv-suppliers">Unduh CSV penyedia</button></div><p class="mut">Menampilkan ${rows.length} dari ${d.rows.length} paket aktif.</p>${satriaBriefTable(['RUP / Paket','Pagu paket','HPS','Penetapan valid','Pemenang','Administrasi','Perhatian','Briefing'],rows.slice(0,250).map(r=>`<tr><td><b>${esc(r.p.rup||'—')}</b><small>${esc(r.p.nama)}</small><small>${esc(O(r.p.opd).singkat)}</small></td><td class="n">${rp(r.p.pagu)}</td><td class="n">${rp(r.H)}</td><td class="n">${r.award===null?'—':rp(r.award)}</td><td>${r.win?esc(PY(r.win.w.pen).nama):'Belum ditetapkan'}</td><td>${r.done}/${r.totalDoc} tanggal</td><td>${satriaBriefRisk(r)}</td><td><a href="#brief/${encodeURIComponent(r.p.id)}">Buka ↗</a></td></tr>`),'Tidak ada paket yang cocok.')}${rows.length>250?'<p class="mut">Ditampilkan maksimum 250 paket. Ekspor CSV mencakup seluruh paket yang cocok dengan pencarian dan status saat ini.</p>':''}</section>`;
}
function satriaBriefPackageData(id){const d=satriaBriefEpData();return d.rows.find(r=>String(r.p.id)===String(id))||null;}
function satriaBriefPackagePage(row){const p=row.p,win=row.win,aw=row.award===null?'Belum ada penetapan valid':rp(row.award),w=win?.w;
 const list=['tglSurvei','tglNego','tglPenetapan','tglDpp','tglBahp','tglSppbj'];const label=['Survei','Negosiasi','Penetapan','DPP','BA Hasil','SPPBJ'];
 return `<section class="brief-package"><div class="spse-hero"><div><b class="spse-eyebrow">✦ SATRIA • EXECUTIVE BRIEFING PER PAKET</b><h2>${esc(p.nama)}</h2><p>RUP ${esc(p.rup||'—')} • ${esc(O(p.opd).nama)} • TA ${esc(p.tahun)}</p></div></div><div class="spse-toolbar no-print"><a href="#brief">← Kembali ke briefing</a><a href="#paket/${encodeURIComponent(p.id)}">Buka data paket ↗</a><button type="button" data-brief-action="print-package" data-id="${esc(p.id)}">Cetak paket / PDF</button></div>
 <div class="brief-kpis">${satriaBriefKpi('Pagu paket',rp(p.pagu),'Alokasi paket, bukan kas')}${satriaBriefKpi('Total HPS',rp(row.H),(row.p.items||[]).length+' item')}${satriaBriefKpi('Penetapan',aw,'Pemenang sesuai pemeriksaan saat ini')}${satriaBriefKpi('Selisih HPS',row.award===null?'—':rp(row.H-row.award),'Bukan realisasi penghematan')}${satriaBriefKpi('Jumlah penawaran',String(row.offerCount),'Berdasarkan input operator')}${satriaBriefKpi('Dokumen tanggal',row.done+'/'+row.totalDoc,'DPP, BA Hasil, SPPBJ')}${satriaBriefKpi('Perhatian',row.level,row.issues.length+' catatan')}
 </div><div class="card brief-card"><h3>Identitas &amp; keputusan</h3><div class="brief-facts"><div><b>Metode</b><span>${esc(p.metodePemilihan||'e-Purchasing (belum dirinci)')}</span></div><div><b>Penyedia ditetapkan</b><span>${w?esc(PY(w.pen).nama):'Belum ada pemenang valid'}</span></div><div><b>Sumber harga</b><span>${w?esc(w.sumberHarga||'Belum dicatat'):'—'}</span></div><div><b>Tanggal harga</b><span>${w?esc(satriaDateId(w.tanggalHarga)):'—'}</span></div><div><b>PPK</b><span>${esc(PJ(p.ppk).nama)}</span></div><div><b>Pejabat Pengadaan</b><span>${esc(PJ(p.pp).nama)}</span></div></div><p class="mut">Hasil penetapan diperoleh dari penawaran yang masih memenuhi gerbang validasi. Nama penyedia bukan bukti terbitnya Surat Pesanan atau pembayaran.</p></div>
 <div class="card brief-card"><h3>Linimasa administrasi (berdasarkan input)</h3>${satriaBriefTable(['Tahap','Tanggal tercatat'],list.map((key,i)=>`<tr><td>${esc(label[i])}</td><td>${esc(satriaDateId(p[key]))}</td></tr>`))}<p class="mut">Tanggal kosong berarti tidak tercatat di SATRIA, bukan berarti aktivitas resmi belum pernah dilakukan.</p></div>
 <div class="card brief-card"><h3>Rincian HPS dan negosiasi penawaran pemenang</h3>${satriaBriefTable(['Barang','Vol','HPS/unit','HPS total','Nego/unit','Nego total'],(p.items||[]).slice(0,200).map(i=>{const n=w&&w.nego?.[i.id]!=null?Number(w.nego[i.id]):null,v=Number(i.vol||0);return `<tr><td>${esc(i.nama)}</td><td class="n">${v.toLocaleString('id-ID',{maximumFractionDigits:4})} ${esc(i.satuan||'')}</td><td class="n">${rp(i.hs)}</td><td class="n">${rp(v*Number(i.hs||0))}</td><td class="n">${n===null?'—':rp(n)}</td><td class="n">${n===null?'—':rp(n*v)}</td></tr>`}),'Belum ada item HPS.')}${(p.items||[]).length>200?'<p class="mut">Rincian dibatasi 200 item untuk cetak; periksa paket untuk daftar lengkap.</p>':''}<p class="mut">Negosiasi/unit hanya dari penawaran pemenang yang tervalidasi; ongkos kirim tercatat terpisah dan termasuk dalam total penetapan. Nilai lain harus diperiksa dari dokumen sumber.</p></div>
 <div class="card brief-card"><h3>Daftar perhatian dan saran tindak lanjut</h3>${satriaBriefTable(['Prioritas','Perhatian','Tindak lanjut'],row.issues.map(x=>`<tr><td>${esc(x.level)}</td><td>${esc(x.detail)}</td><td>${esc(x.action)}</td></tr>`),'Tidak ada temuan menurut aturan otomatis pada data saat ini.')}<p class="mut">Koreksi identitas penyedia dan review historis perlu tetap dibuktikan dengan dokumen transaksi asli; laporan ini bukan pengesahan atau perubahan data.</p></div>
 <p class="brief-foot">Disusun ${esc(satriaSpseDateIdNow())}. Sumber: SATRIA dalam cakupan akun. Pemeriksaan otomatis bukan audit hukum atau validasi pada platform eksternal. Sebelum dipakai dalam rapat/keputusan, cocokkan dengan bukti asli.</p></section>`;
}
function satriaBriefEP(print=false){const d=satriaBriefEpData();return `<section class="brief-ep">${satriaBriefEpSummary(d)}${satriaBriefEpPriorities(d,print)}${satriaBriefEpSuppliers(d)}${satriaBriefEpPerOpd(d)}${print?satriaBriefEpPrintPackages(d):satriaBriefEpPackageTable(d)}</section>`;}
function satriaBriefCombined(){const d=satriaBriefEpData(),sp=satriaSpseMetrics(satriaSpseRows());return `${satriaBriefEpSummary(d)}${satriaBriefEpPriorities(d,false)}<section class="card brief-card"><h3>SPSE — ringkasan untuk keputusan</h3><div class="brief-kpis">${satriaBriefKpi('Paket SPSE',String(sp.count),'Monitoring manual')}${satriaBriefKpi('Kontrak SPSE',rp(sp.contract),'Dengan nilai kontrak tercatat')}${satriaBriefKpi('Pembayaran terverifikasi',rp(sp.paid),'Hanya dari monitoring SPSE')}${satriaBriefKpi('Tahapan terlambat',String(sp.late),'Tindak lanjut sesuai SPSE')}${satriaBriefKpi('Data SPSE >30 hari',String(sp.stale),'Perlu pemeriksaan sumber')}</div><p class="mut">Total RUP unik ditampilkan sekali pada panel e-Purchasing dan tidak ditambah dengan pagu paket SPSE. Penetapan e-Purchasing dan kontrak SPSE dilaporkan terpisah.</p></section>${satriaOpsBriefExtra()}`;}
/* Override only the existing read-only briefing view; all SPSE data/actions stay untouched. */
function vBrief(){
 const current=S.ui.pid?satriaBriefPackageData(S.ui.pid):null;
 if(current)return satriaBriefPackagePage(current);
 const mode=satriaBriefUI.mode;
 return `<section class="brief-page"><div class="spse-hero"><div><b class="spse-eyebrow">✦ SATRIA • BAHAN RAPAT PIMPINAN</b><h2>Executive Briefing 4.1</h2><p>${satriaBriefScope()} • Disusun ${esc(satriaSpseDateIdNow())}</p></div><a class="spse-hero-link" href="#dash">Ringkasan Utama ↗</a></div>${satriaBriefControl()}${mode==='ep'?satriaBriefEP(false):mode==='spse'?satriaSpseBriefMarkup()+satriaOpsBriefExtra():satriaBriefCombined()}<p class="brief-foot">Dokumen baca-saja; tidak membuktikan realisasi pembayaran e-Purchasing, kontrak SPSE, maupun kepatuhan hukum. Periksa data dan dokumen sumber sebelum ditandatangani.</p></section>`;
}
function satriaBriefPrintMarkup(content,title){
 const css=`@page{size:A4 portrait;margin:12mm}body{font:10px/1.45 Arial,sans-serif;color:#131313;background:white;margin:0}h2{font-size:18px;margin:5px 0}h3{font-size:12px;margin:12px 0 7px}p{margin:6px 0}.spse-hero{border-bottom:2px solid #111;margin-bottom:10px;padding-bottom:9px}.spse-eyebrow{font-size:10px;letter-spacing:.08em}.spse-hero-link,.spse-toolbar,.no-print,.brief-filters,a[href]{display:none!important}.brief-kpis,.spse-kpis,.ops-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.brief-kpi,.spse-kpi,.ops-kpi{border:1px solid #bbb;padding:7px;break-inside:avoid}.brief-kpi small,.brief-kpi strong,.brief-kpi span,.spse-kpi small,.spse-kpi strong,.spse-kpi span{display:block}.brief-kpi strong{font-size:13px}.brief-kpi small,.brief-kpi span,small,.mut{font-size:9px}.brief-table,table{width:100%;border-collapse:collapse;font-size:9px}.brief-table td,.brief-table th,table td,table th{border:1px solid #888;text-align:left;padding:5px;vertical-align:top}.brief-table small,table small{display:block}.brief-card,.card{padding:6px 0;break-inside:auto}.brief-card h3,.card h3{border-bottom:1px solid #aaa;padding-bottom:3px}.brief-scroll{overflow:visible}.n{text-align:right!important}.brief-risk{font-weight:700}.brief-facts{display:grid;grid-template-columns:1fr 1fr;gap:5px}.brief-facts div{border-bottom:1px solid #ddd;padding:5px 0}.brief-facts b,.brief-facts span{display:block}.brief-foot,.brief-disclaimer,.spse-note,.spse-footer{font-size:9px;margin-top:12px}.brief-section{break-inside:avoid}.brief-page-break{break-before:page}tr{break-inside:avoid}button,input,select{display:none!important}`;
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>${content}<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),300)})<\/script></body></html>`;
}
function satriaBriefPrint(content,title){const w=window.open('','_blank');if(!w){toast('Jendela cetak diblokir. Izinkan pop-up untuk mencetak laporan.');return false}w.document.open();w.document.write(satriaBriefPrintMarkup(content,title));w.document.close();w.focus();return true;}
function satriaBriefExport(action){const d=satriaBriefEpData(),base='SATRIA-Briefing-'+S.ui.tahun;
 if(action==='csv-packages')satriaLaporanDownloadCsv(base+'-ePurchasing.csv',['TA','OPD','RUP','Nama paket','Pagu paket','HPS','Penetapan valid','Pemenang','Jumlah penawaran','DPP','BA Hasil','SPPBJ','Prioritas','Jumlah temuan'],satriaBriefFilteredRows(d).map(r=>[r.p.tahun,O(r.p.opd).singkat,r.p.rup,r.p.nama,r.p.pagu,r.H,r.award??'',r.win?PY(r.win.w.pen).nama:'',r.offerCount,r.p.tglDpp||'',r.p.tglBahp||'',r.p.tglSppbj||'',r.level,r.issues.length]));
 if(action==='csv-actions')satriaLaporanDownloadCsv(base+'-Tindak-Lanjut.csv',['TA','OPD','RUP','Paket','Prioritas','Jenis','Temuan','Tindak lanjut'],satriaBriefActionRows(d).map(x=>[x.p.tahun,O(x.p.opd).singkat,x.p.rup,x.p.nama,x.level,x.kind,x.detail,x.action]));
 if(action==='csv-suppliers')satriaLaporanDownloadCsv(base+'-Penyedia.csv',['Penyedia','Paket ditetapkan','Nilai penetapan','Porsi nilai (%)'],d.supplierRows.map(x=>[x.name,x.count,x.amount,d.totalAward?(x.amount/d.totalAward*100).toFixed(2):0]));
}
(function(){
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-brief-action]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.briefAction;
  if(a==='mode'){satriaBriefUI.mode=['ep','spse','all'].includes(b.dataset.mode)?b.dataset.mode:'ep';S.ui.pid=null;render();return;}
  if(a==='apply'){satriaBriefUI.search=document.querySelector('[data-brief-search]')?.value||'';satriaBriefUI.status=document.querySelector('[data-brief-filter]')?.value||'all';render();return;}
  if(a==='reset'){satriaBriefUI.search='';satriaBriefUI.status='all';render();return;}
  if(a==='print-package'){const r=satriaBriefPackageData(b.dataset.id);if(!r){toast('Paket tidak ditemukan pada hak akses dan filter saat ini.');return;}satriaBriefPrint(satriaBriefPackagePage(r),'SATRIA-Briefing-RUP-'+String(r.p.rup||'paket'));return;}
  if(a==='print'){
   const mode=satriaBriefUI.mode;
   const body=mode==='ep'?satriaBriefEP(true):mode==='spse'?satriaSpseBriefMarkup()+satriaOpsBriefExtra():satriaBriefCombined();
   satriaBriefPrint(`<div class="spse-hero"><b class="spse-eyebrow">SATRIA • LAPORAN PIMPINAN</b><h2>${mode==='ep'?'Executive Briefing e-Purchasing':mode==='spse'?'Executive Briefing SPSE':'Executive Briefing Pengadaan Terpadu'}</h2><p>${satriaBriefScope()} • ${esc(satriaSpseDateIdNow())}</p></div>`+body+'<p class="brief-foot">Bahan internal rapat; wajib dicocokkan dengan bukti resmi. Angka penetapan tidak sama dengan pembayaran. Pemeriksaan aplikasi tidak menggantikan keputusan pejabat.</p>','SATRIA-Executive-Briefing-'+mode+'-'+S.ui.tahun);return;
  }
  if(a.startsWith('csv-')){satriaBriefExport(a);return;}
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches?.('[data-brief-search]')){e.preventDefault();satriaBriefUI.search=e.target.value;satriaBriefUI.status=document.querySelector('[data-brief-filter]')?.value||'all';render();}},true);
})();
window.SATRIA_BRIEFING_V3=Object.freeze({rows:satriaBriefEpRows,data:satriaBriefEpData,actions:satriaBriefActionRows,packageData:satriaBriefPackageData,printHtml:satriaBriefPrintMarkup});
