/* SATRIA NEXT 3.0.59.31 — Procurement 360 + navigation + quality signals.
   READ ONLY: no modification of S, business state, Supabase, or backup schema.
   Loaded after core engine. All results scoped through satriaOpsVisiblePaket(). */
(function(){
  'use strict';
  const PAGE={
    dash:['Ringkasan Utama','Analitik pengadaan lintas OPD, HPS, penetapan, dan pekerjaan prioritas'],
    paket:['Paket Pengadaan','Kelola rincian paket, penawaran, negosiasi, dan penetapan'],
    kalk:['Kalkulator Negosiasi','Bandingkan harga dengan HPS, pagu, dan perhitungan pajak'],
    input:['Input dan Bank RUP','Kelola rencana pengadaan, JSON, serta alokasi anggaran'],
    spse:['Monitoring SPSE','Pantau jadwal, kontrak, kendala, dan bukti pembayaran'],
    monitor:['Pusat Monitoring','Peringatan tenggat dan pekerjaan yang perlu ditindaklanjuti'],
    finance:['Keuangan dan Kontrak','Pisahkan pagu, penetapan, kontrak, dan pembayaran'],
    quality:['Kualitas Data','Periksa konsistensi serta temuan administrasi'],
    brief:['Executive Briefing 4.1','Analisis visual dan bahan rapat pimpinan'],
    dok:['Dokumen Pengadaan','Susun, pratinjau, dan cetak dokumen pengadaan'],
    lap:['Laporan dan Analisis','Analisis, filter, ekspor, dan laporan pengadaan'],
    master:['Data Master','Kelola referensi organisasi, pejabat, dan penyedia'],
    set:['Pengaturan Sistem','Konfigurasi organisasi, backup, dan pemulihan'],
    care:['Perawatan SATRIA','Pemeriksaan konfigurasi, kualitas data, error aplikasi, dan backup'],
    user:['Pengguna dan Hak Akses','Kelola pengguna dan kewenangan'],
    panduan:['Panduan Penggunaan','Petunjuk operasional dan bantuan kontekstual'],
    chat:['Asisten SATRIA','Cari data dan pahami proses berbasis catatan SATRIA'],
    satria360:['SATRIA 360°','Peta lengkap perjalanan pengadaan dan risiko per paket']
  };
  const H=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const I=n=>Number.isFinite(Number(n))?Number(n):0;
  const money=n=>typeof rp==='function'?rp(I(n)):'Rp '+I(n).toLocaleString('id-ID');
  const enc=s=>encodeURIComponent(String(s??''));
  const hasScope=(p)=>satriaOpsVisiblePaket().some(x=>String(x.id)===String(p?.id));
  const visible=()=>satriaOpsVisiblePaket();
  const isSpse=p=>typeof satriaSpseIs==='function'&&satriaSpseIs(p);
  let quickQuery='',listQuery='';

  function classify(p){
    if(isSpse(p)){
      const m=p.spseMonitoring||{};
      const stage=[
        {label:'Paket SPSE',done:!!String(m.tenderCode||p.rup||'').trim(),desc:'Identitas dari SPSE tercatat'},
        {label:'Sumber & tanggal',done:!!String(m.source||'').trim()&&!!String(m.sourceAsOf||'').trim(),desc:'Referensi monitoring tersedia'},
        {label:'Jadwal tahapan',done:Array.isArray(m.stages)&&m.stages.length>0,desc:'Jadwal monitoring diisi'},
        {label:'Nomor kontrak',done:!!String(m.contractNo||'').trim(),desc:'Kontrak telah direferensikan'},
        {label:'Kontrak bernilai',done:I(satriaSpseContractValue(m))>0,desc:'Nilai kontrak dalam catatan'},
        {label:'Dokumen pembayaran',done:Array.isArray(m.payments)&&m.payments.length>0,desc:'Ada pencatatan pembayaran (bukan otomatis terverifikasi)'}
      ];
      return {stage,done:stage.filter(s=>s.done).length,score:Math.round(100*stage.filter(s=>s.done).length/stage.length),method:'SPSE'};
    }
    const o=satriaHumanStage(p);
    return {stage:o.stages.map(x=>({label:x.label,done:!!x.done,desc:x.desc})),done:o.done,score:Math.round(o.done/o.stages.length*100),method:'e-Purchasing'};
  }
  function simpleFlags(p){
    const f=[];
    if(!(I(p.pagu)>0))f.push({level:'Tinggi',text:'Pagu paket belum valid',action:'Periksa anggaran paket'});
    if(isSpse(p)){
      const m=p.spseMonitoring||{},ct=I(satriaSpseContractValue(m)),paid=I(satriaSpsePayments(m,true));
      if(paid>ct)f.push({level:'Tinggi',text:'Pembayaran terverifikasi di atas nilai kontrak',action:'Cocokkan pembayaran dan addendum'});
      if(!String(m.contractNo||'').trim()&&ct>0)f.push({level:'Sedang',text:'Nilai kontrak tersedia tetapi nomor kontrak belum ada',action:'Periksa sumber SPSE'});
    }else{
      const linked=satriaRupLinks(p),visibleBank=satriaOpsVisibleRup();
      const found=linked.length?visibleBank.filter(r=>linked.some(id=>String(id)===String(r.id))):visibleBank.filter(r=>String(r.rup)===String(p.rup)&&String(r.opd)===String(p.opd)&&Number(r.tahun)===Number(p.tahun));
      if(!found.length)f.push({level:'Tinggi',text:'Referensi Bank RUP belum ditemukan dalam cakupan akun',action:'Periksa tautan RUP dan tahun/OPD'});
      if(found.length>1)f.push({level:'Tinggi',text:'Referensi Bank RUP ganda atau tidak tunggal',action:'Periksa data Bank RUP sebelum menghitung alokasi'});
      const h=I(hps(p)),win=pemenang(p);
      if(h>I(p.pagu)&&h>0)f.push({level:'Tinggi',text:'HPS melebihi pagu paket',action:'Periksa rincian HPS'});
      if(p.pemenangId&&!win)f.push({level:'Tinggi',text:'Penetapan tersimpan tetapi tidak lolos validasi saat ini',action:'Periksa evaluasi pemenang'});
      if(!win)f.push({level:'Sedang',text:'Pemenang belum ditetapkan valid',action:'Lanjutkan evaluasi sesuai bukti'});
      if(win&&(!p.tglDpp||!p.tglBahp||!p.tglSppbj))f.push({level:'Sedang',text:'Tanggal dokumen penetapan belum lengkap',action:'Periksa DPP, BA Hasil, dan SPPBJ'});
    }
    return f;
  }
  function quality(p){const stage=classify(p);const issues=simpleFlags(p);return {...stage,issues};}
  function stats(list){const ep=list.filter(p=>!isSpse(p));const sp=list.filter(isSpse);return {
    total:list.length,ep:ep.length,sp:sp.length,award:ep.filter(p=>!!pemenang(p)).length,
    incomplete:list.filter(p=>classify(p).score<100).length,risks:list.filter(p=>simpleFlags(p).some(x=>x.level==='Tinggi')).length,
    spContract:sp.reduce((a,p)=>a+I(satriaSpseContractValue(p.spseMonitoring||{})),0),
    spPaid:sp.reduce((a,p)=>a+I(satriaSpsePayments(p.spseMonitoring||{},true)),0)
  };}
  function agenda(list){
    const rows=list.flatMap(p=>simpleFlags(p).map(x=>({p,...x})));
    const priority={Tinggi:0,Sedang:1};
    return rows.sort((a,b)=>(priority[a.level]??2)-(priority[b.level]??2)||String(a.p.rup).localeCompare(String(b.p.rup),'id'));
  }
  function agendaMarkup(list){
    const rows=agenda(list),top=rows.slice(0,7);
    return `<div class="s4-panel"><h3>Agenda cepat • tindak lanjut</h3><p class="s4-panel-sub">Prioritas dihitung dari data yang terlihat, bukan penilaian kepatuhan hukum. Tinjau bukti sebelum keputusan.</p><div class="s4-items">${top.length?top.map(x=>`<div class="s4-rowcard"><div><div class="s4-kicker">RUP ${H(x.p.rup)}</div><h4>${H(x.text)}</h4><p>${H(x.action)}</p></div><div class="s4-row-actions">${tag(x.level)}<a href="#satria360/${enc(x.p.id)}">Tinjau</a></div></div>`).join(''):'<p class="s4-notes">Tidak ada temuan dari pemeriksaan ringkas ini. Tetap lakukan verifikasi dokumen sumber.</p>'}</div><p class="s4-notes">${rows.length} temuan tercatat dalam scope ini. Tindakan tidak dijalankan otomatis.</p><button type="button" class="g" data-s4-action="360-actions-csv">Ekspor daftar tindak lanjut CSV</button></div>`;
  }
  function meter(t,v,desc){return `<div class="s4-metric"><small>${H(t)}</small><b>${H(v)}</b><span>${H(desc)}</span></div>`;}
  function tag(level){return `<span class="s4-tag ${level==='Tinggi'?'danger':level==='Sedang'?'warn':'good'}">${H(level||'Normal')}</span>`;}
  function flowBar(label,value,base){const pct=base>0?Math.min(100,Math.max(0,value/base*100)):0;return `<div class="s4-mini-bar"><div class="s4-mini-bar-head"><span>${H(label)}</span><b>${H(String(value))}</b></div><div class="s4-mini-bar-track"><div class="s4-mini-bar-fill" style="width:${pct.toFixed(2)}%"></div></div></div>`;}
  function href(p){return '#'+(isSpse(p)?'spse':'paket')+'/'+enc(p.id);}
  function healthLevel(p){const q=quality(p);return q.issues.some(x=>x.level==='Tinggi')?'Tinggi':q.issues.length?'Sedang':'Normal';}
  function row(p){const q=quality(p),status=healthLevel(p);return `<article class="s4-rowcard"><div><div class="s4-kicker">RUP ${H(p.rup||'—')} • ${H(O(p.opd).singkat||O(p.opd).nama)} • TA ${H(p.tahun)}</div><h4>${H(p.nama||'Paket tanpa nama')}</h4><p>${H(q.method)} • ${q.done}/${q.stage.length} indikator terisi • Pagu ${H(money(p.pagu))}</p></div><div class="s4-row-actions">${tag(status)}<a href="#satria360/${enc(p.id)}">Lihat 360°</a><a href="${href(p)}">Buka paket</a></div></article>`;}
  function headActions(p){return `<div class="s4-row-actions"><a href="${href(p)}">Buka data asli ↗</a>${!isSpse(p)?`<a href="#brief/${enc(p.id)}">Briefing paket ↗</a>`:''}<button type="button" data-s4-action="print">Cetak halaman ini</button></div>`;}
  function eventTimeline(p){
    const ep=[['tglSurvei','Survei'],['tglDpp','DPP'],['tglNego','Negosiasi'],['tglPenetapan','Penetapan'],['tglBahp','BA Hasil'],['tglSppbj','SPPBJ']];
    const events=isSpse(p)?(p.spseMonitoring?.stages||[]).filter(x=>x.planEnd||x.actual).map(x=>[x.actual||x.planEnd,x.title||x.key||'Tahap SPSE']):ep.filter(([key])=>!!p[key]).map(([key,label])=>[p[key],label]);
    events.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    return events.length?events.map(([dt,label])=>`<div class="s4-rowcard"><div><h4>${H(label)}</h4><p>${H(dt)} • Berdasarkan tanggal yang dicatat operator</p></div>${tag('Normal')}</div>`).join(''):'<p class="s4-notes">Belum ada tanggal tahapan yang tercatat. Ini tidak membuktikan bahwa proses resmi belum dilakukan.</p>';
  }
  function matchingRup(p){
    const records=satriaOpsVisibleRup();const links=satriaRupLinks(p);
    return links.length?records.filter(r=>links.some(id=>String(id)===String(r.id))):records.filter(r=>String(r.tahun)===String(p.tahun)&&String(r.opd)===String(p.opd)&&String(r.rup)===String(p.rup));
  }
  function details(p){
    const q=quality(p),met=isSpse(p),rup=matchingRup(p),win=met?null:pemenang(p),m=met?p.spseMonitoring||{}:{};
    const fields=[['Nomor RUP',p.rup||'—'],['Tahun anggaran',p.tahun],['OPD',O(p.opd).nama||O(p.opd).singkat||'—'],['Metode',met?'SPSE — '+(m.method||'Belum dirinci'):p.metodePemilihan||'e-Purchasing'],['Pagu paket',money(p.pagu)],['Bank RUP cocok',rup.length===1?'1 RUP':rup.length+' RUP (perlu diperiksa)']];
    if(met)fields.push(['Nilai kontrak',money(satriaSpseContractValue(m))],['Pembayaran SPSE terverifikasi',money(satriaSpsePayments(m,true))]);
    else fields.push(['Total HPS',money(hps(p))],['Penetapan valid',win?money(win.t):'Belum tervalidasi'],['Pemenang tercatat',win?PY(win.w.pen).nama:'Belum ditetapkan valid']);
    const rupNote=rup.length===1?`RUP sumber ${H(rup[0].rup)} • Pagu RUP ${H(money(rup[0].pagu))}. Alokasi dan sisa harus diperiksa di Bank RUP; pagu RUP tidak otomatis sama dengan pagu paket.`:'Referensi Bank RUP belum ditemukan atau lebih dari satu. Periksa tautan dan hak akses OPD/tahun.';
    return `<section class="s4-main-360"><div class="s4-hero"><div class="s4-kicker">✦ SATRIA 360° • Detail per paket</div><h2 style="color:#fff!important">${H(p.nama||p.rup||'Paket')}</h2><p>RUP ${H(p.rup||'—')} • ${H(O(p.opd).nama||'—')} • TA ${H(p.tahun)} • Tampilan baca-saja. Tidak mengubah transaksi atau dokumen asli.</p><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px"><a class="s4-action s4-action-primary" href="#satria360">← Semua paket</a><a class="s4-action" href="${href(p)}">Buka data paket</a>${!met?`<a class="s4-action" href="#brief/${enc(p.id)}">Briefing paket</a>`:''}</div></div><div class="s4-metrics">${meter('Kelengkapan indikator',q.score+'%',q.done+' dari '+q.stage.length+' indikator')}${meter('Pagu paket',money(p.pagu),'Bukan saldo kas')}${meter(met?'Nilai kontrak SPSE':'HPS paket',money(met?satriaSpseContractValue(m):hps(p)),'Tidak disamakan dengan pembayaran')}${meter(met?'Pembayaran terverifikasi':'Penetapan valid',met?money(satriaSpsePayments(m,true)):(win?money(win.t):'—'),'Berdasarkan data dan validasi yang tercatat')}</div><div class="s4-two"><div class="s4-panel"><h3>Linimasa 360°</h3><p class="s4-panel-sub">Tahapan yang telah dicatat, bukan sumber waktu resmi eksternal.</p><div class="s4-items">${eventTimeline(p)}</div></div><div class="s4-panel"><h3>Kesehatan administrasi</h3><p class="s4-panel-sub">Indikator keterisian; tidak menilai keabsahan atau kepatuhan hukum.</p><div class="s4-mini-bars">${flowBar('Indikator terisi',q.done,q.stage.length)}${flowBar('Indikator belum terisi',q.stage.length-q.done,q.stage.length)}</div><p class="s4-notes">Pemeriksaan data ini tidak menggantikan penelaahan bukti, persetujuan pejabat, atau audit resmi.</p></div></div><div class="s4-panel"><h3>Alur kerja yang terhubung</h3><p class="s4-panel-sub">Klik paket asli untuk melengkapi tahapan yang belum terisi.</p><div class="s4-steps">${q.stage.map((s,i)=>`<div class="s4-stage ${s.done?'done':''}"><span>${s.done?'✓':'○'} ${i+1}/${q.stage.length}</span><strong>${H(s.label)}</strong><small>${H(s.desc)}</small></div>`).join('')}</div></div><div class="s4-two"><div class="s4-panel"><h3>Identitas dan anggaran</h3><div class="s4-facts">${fields.map(([k,v])=>`<div><b>${H(k)}</b><span>${H(v)}</span></div>`).join('')}</div><p class="s4-notes">${rupNote}</p></div><div class="s4-panel"><h3>Temuan dan tindak lanjut</h3><p class="s4-panel-sub">Masalah yang dapat dideteksi dari catatan yang tersedia.</p><div class="s4-items">${q.issues.length?q.issues.map(x=>`<div class="s4-rowcard"><div><h4>${H(x.text)}</h4><p>${H(x.action)}</p></div>${tag(x.level)}</div>`).join(''):'<p class="s4-notes">Tidak ada temuan dalam pemeriksaan ringkas ini. Bukan jaminan tidak ada masalah.</p>'}</div></div></div><div class="s4-panel"><h3>Tindakan yang dapat dilakukan</h3><p class="s4-panel-sub">Semua tombol menuju data asli, tanpa menyimpan perubahan otomatis.</p>${headActions(p)}<p class="s4-notes">Penetapan bukan pembayaran. Total HPS bukan jumlah yang telah dibayarkan. Lihat dokumen dan bukti sumber sebelum mengambil keputusan.</p></div></section>`;
  }
  function overview(){
    const list=visible(),d=stats(list),rup=satriaOpsVisibleRup(),top=list.filter(p=>!listQuery||[p.rup,p.nama,O(p.opd).nama].some(v=>String(v||'').toLowerCase().includes(listQuery.toLowerCase()))).slice(0,200);
    return `<section class="s4-main-360"><div class="s4-hero"><div class="s4-kicker">✦ SATRIA NEXT • Procurement Intelligence</div><h2 style="color:#fff!important">360° Procurement Command Center</h2><p>Perjalanan RUP sampai pengendalian paket dalam satu tampilan. Berbasis data lokal yang telah dimuat sesuai hak akses, tahun dan OPD. Tidak menambah transaksi atau menyimpulkan realisasi e-Purchasing.</p><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px"><a class="s4-action s4-action-primary" href="#brief">Executive Briefing</a><a class="s4-action" href="#quality">Kualitas Data</a><a class="s4-action" href="#monitor">Pusat Monitoring</a></div></div><div class="s4-metrics">${meter('Paket dalam scope',d.total,d.ep+' e-Purchasing • '+d.sp+' SPSE')}${meter('RUP tercatat',rup.length,'Belum berarti semuanya tervalidasi')}${meter('Penetapan valid',d.award,'Jumlah paket e-Purchasing')}${meter('Perhatian tinggi',d.risks,'Paket dengan anomali dasar')}</div><div class="s4-two"><div class="s4-panel"><h3>Progres pengadaan</h3><p class="s4-panel-sub">Gambaran lintas metode; tidak menyatukan kontrak dan penetapan.</p><div class="s4-mini-bars">${flowBar('Paket e-Purchasing',d.ep,d.total)}${flowBar('Penetapan e-Purchasing valid',d.award,d.ep)}${flowBar('Paket SPSE dimonitor',d.sp,d.total)}${flowBar('Paket memerlukan kelengkapan',d.incomplete,d.total)}</div></div><div class="s4-panel"><h3>Ringkasan lanjutan</h3><div class="s4-facts"><div><b>Kontrak SPSE tercatat</b><span>${H(money(d.spContract))}</span></div><div><b>Pembayaran SPSE terverifikasi</b><span>${H(money(d.spPaid))}</span></div><div><b>Paket risiko tinggi</b><span>${d.risks}</span></div><div><b>Catatan pemeriksaan</b><span>Periksa sumber data</span></div></div><p class="s4-notes">Pembayaran e-Purchasing tidak dihitung jika belum ada ledger yang diverifikasi.</p></div></div>${agendaMarkup(list)}<div class="s4-panel"><h3>Daftar paket • 360° view</h3><p class="s4-panel-sub">Cari paket, buka perjalanan administrasi, atau lanjutkan data asli. Ditampilkan maksimal 200 paket.</p><div class="s4-filter"><label>Cari RUP / paket / OPD<input type="search" id="s4-360-search" value="${H(listQuery)}" placeholder="Ketik nomor RUP atau nama paket" autocomplete="off"></label><button class="g" type="button" data-s4-action="360-filter">Terapkan</button><button class="g" type="button" data-s4-action="360-reset">Reset</button><button class="g" type="button" data-s4-action="360-csv">Ekspor ringkasan CSV</button></div><p class="s4-notes">Menampilkan ${top.length} dari ${list.length} paket dalam scope yang diizinkan.</p><div class="s4-items">${top.length?top.map(row).join(''):'<p class="s4-notes">Tidak ditemukan paket yang cocok dalam hak akses, OPD dan tahun aktif.</p>'}</div></div></section>`;
  }
  function vSatria360(){
    const id=S.ui.pid;
    if(!id)return overview();
    const p=visible().find(p=>String(p.id)===String(id));
    return p?details(p):`<section class="s4-panel"><h3>Paket tidak tersedia</h3><p class="s4-panel-sub">Paket tidak ditemukan dalam OPD, tahun dan hak akses akun ini.</p><a href="#satria360">Kembali ke daftar</a></section>`;
  }
  function enhance(){
    const main=document.getElementById('main');if(!main||!S?.ui)return;
    const page=String(S.ui.page||'dash');
    main.dataset.satriaModule=page;
    if(page!=='satria360' && page!=='care'){
      const item=PAGE[page]||[page,'Pekerjaan SATRIA'];
      const module=document.createElement('section');module.className='s4-module-head no-print';module.setAttribute('aria-label','Navigasi modul SATRIA');
      const p=typeof P==='function'?P(S.ui.pid):null;
      const context=p&&hasScope(p)?`<a class="s4-action" href="#satria360/${enc(p.id)}">360° paket</a>`:'<a class="s4-action" href="#satria360">SATRIA 360°</a>';
      module.innerHTML=`<div><div class="s4-kicker">SATRIA NEXT • ${H(S.ui.tahun)} • ${H(S.ui.opd==='all'?'OPD sesuai hak akses':O(S.ui.opd).singkat)}</div><h2 style="color:#fff!important">${H(item[0])}</h2><p>${H(item[1])}</p></div><div class="s4-module-actions"><button type="button" class="s4-action s4-action-primary" data-s4-action="palette-open" aria-label="Cari menu dan paket">⌕ Cari Cepat · Ctrl+K</button>${context}</div>`;
      main.prepend(module);
    }
    renderPaletteIfNeeded();
  }
  function renderPaletteIfNeeded(){
    if(document.getElementById('s4-palette'))return;
    const div=document.createElement('div');div.id='s4-palette';div.hidden=true;
    div.innerHTML=`<div class="s4-dialog" role="dialog" aria-modal="true" aria-label="Cari menu SATRIA"><div class="s4-dhead"><strong>⌕ SATRIA Quick Navigator</strong><button type="button" data-s4-action="palette-close">Tutup Esc</button></div><label for="s4-search" class="mut">Cari menu, kode RUP, atau nama paket</label><input type="search" id="s4-search" autocomplete="off" placeholder="Contoh: Bank RUP, Dokumen, 66898344"><div class="s4-hits" id="s4-hits"></div><p>Hasil dibatasi sesuai hak akses, tahun dan OPD. Tidak membuka paket di luar scope.</p></div>`;
    document.body.append(div);
  }
  function matches(){
    const q=quickQuery.trim().toLowerCase();
    const nav=Array.isArray(NAV)?NAV.filter(([key])=>allowed(key)):[];
    const menu=nav.filter(([key,label])=>!q||[key,label,PAGE[key]?.[1]].some(x=>String(x||'').toLowerCase().includes(q))).map(([key,label])=>({title:label,detail:'Menu • '+(PAGE[key]?.[1]||'SATRIA'),href:'#'+key}));
    const pack=visible().filter(p=>!q||[p.rup,p.nama,O(p.opd).nama].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,q?20:6).map(p=>({title:p.nama||p.rup||'Paket',detail:'RUP '+p.rup+' • '+O(p.opd).singkat+' • TA '+p.tahun,href:'#satria360/'+enc(p.id)}));
    return [...menu,...pack].slice(0,32);
  }
  function updateHits(){
    const box=document.getElementById('s4-hits');if(!box)return;
    box.innerHTML=matches().map(x=>`<button type="button" class="s4-hit" data-s4-go="${H(x.href)}"><span>${H(x.title)}</span><small>${H(x.detail)}</small></button>`).join('')||'<p class="s4-notes">Tidak ada menu atau paket yang cocok.</p>';
  }
  function openPalette(){renderPaletteIfNeeded();const d=document.getElementById('s4-palette');if(!d)return;d.hidden=false;quickQuery='';const search=document.getElementById('s4-search');if(search){search.value='';search.focus();}updateHits();}
  function closePalette(){const d=document.getElementById('s4-palette');if(d)d.hidden=true;}
  function downloadAgendaCsv(){
    satriaLaporanDownloadCsv('SATRIA-360-Agenda-'+S.ui.tahun+'.csv',
      ['Tahun','OPD','RUP','Paket','Prioritas','Perhatian','Tindak lanjut'],
      agenda(visible()).map(x=>[x.p.tahun,O(x.p.opd).singkat,x.p.rup,x.p.nama,x.level,x.text,x.action]));
  }
  function downloadCsv(){
    const list=visible().filter(p=>!listQuery||[p.rup,p.nama,O(p.opd).nama].some(v=>String(v||'').toLowerCase().includes(listQuery.toLowerCase())));
    satriaLaporanDownloadCsv('SATRIA-360-'+S.ui.tahun+'.csv', ['Tahun','OPD','RUP','Paket','Metode','Pagu Paket','Total HPS','Penetapan Valid','Nilai Kontrak SPSE','Pembayaran SPSE Terverifikasi','Kelengkapan Indikator (%)','Perhatian'],list.map(p=>{const q=quality(p),win=isSpse(p)?null:pemenang(p),m=p.spseMonitoring||{};return [p.tahun,O(p.opd).singkat,p.rup,p.nama,q.method,p.pagu,isSpse(p)?'':hps(p),win?win.t:'',isSpse(p)?satriaSpseContractValue(m):'',isSpse(p)?satriaSpsePayments(m,true):'',q.score,healthLevel(p)];}));
  }
  document.addEventListener('click',e=>{
    const go=e.target.closest?.('[data-s4-go]');if(go){e.preventDefault();closePalette();location.hash=go.dataset.s4Go;return;}
    const t=e.target.closest?.('[data-s4-action]');if(!t){if(e.target?.id==='s4-palette')closePalette();return;}
    e.preventDefault();const a=t.dataset.s4Action;
    if(a==='palette-open')openPalette();if(a==='palette-close')closePalette();
    if(a==='360-filter'){listQuery=document.getElementById('s4-360-search')?.value||'';render();}
    if(a==='360-reset'){listQuery='';render();}
    if(a==='360-csv')downloadCsv();
    if(a==='360-actions-csv')downloadAgendaCsv();
    if(a==='print')window.print();
  },true);
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();openPalette();return;}
    if(e.key==='Escape')closePalette();
    if(e.key==='Enter'&&e.target?.id==='s4-360-search'){listQuery=e.target.value||'';render();}
  },true);
  document.addEventListener('input',e=>{if(e.target?.id==='s4-search'){quickQuery=e.target.value;updateHits();}},true);
  window.SATRIA_NEXT4=Object.freeze({enhance,vSatria360,quality,stats,version:'3.0.59.31',readOnly:true});
  try{if(typeof S==='object'&&S?.ui)enhance()}catch(e){console.warn('SATRIA NEXT4 initial enhancement skipped:',e?.message||e)}
})();
