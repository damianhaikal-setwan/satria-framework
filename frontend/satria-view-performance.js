/* SATRIA Tahap 4 — view performance + document workspace (previously embedded in cloud). */
(function(){
  'use strict';
// ===== SATRIA GLOBAL PERFORMANCE JS PATCH - Lead Dev =====
(function(){
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
  
  // 1. Disable heavy blobs on mobile immediately
  if(isMobile){
    const blobs = document.querySelector('.bg-blobs');
    if(blobs) blobs.style.display='none';
    document.documentElement.style.setProperty('--shadow-glow','0 4px 12px rgba(15,118,110,.12)');
  }
  
  // 2. Debounce search input to reduce renders
  // Passive listeners for scroll/touch
  // Optimize mSearch if exists
  
  // 3. IntersectionObserver for lazy render of heavy sections
  if('IntersectionObserver' in window && isMobile){
    // Defer non-critical renders
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.style.contentVisibility='visible';
        }
      });
    },{rootMargin:'200px'});
    
    // Observe cards after load
    setTimeout(()=>{
      document.querySelectorAll('.card, .satria-kpi-card').forEach(el=>{
        el.style.contentVisibility='auto';
        el.style.containIntrinsicSize='0 200px';
      });
    }, 500);
  }
  
  // Native tap and pinch zoom remain enabled for accessibility.
  // Do not intercept touchend or change maximum-scale at runtime.
  
  // 6. Reduce motion if user prefers
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.style.setProperty('--ease','linear');
  }
  
  console.log('[SATRIA] Performance patch active - Mobile:', isMobile);
})();


// ===== VIRTUAL SCROLL ENGINE - Paket & HPS =====
window.__paketVirtualData = window.__paketVirtualData || [];
window.__hpsVirtualData = window.__hpsVirtualData || [];
window.__hpsPaketId = null;

function renderPaketVirtualSlice(){
  const viewport = document.getElementById('paketVirtualViewport');
  const content = document.getElementById('paketVirtualContent');
  const spacer = document.getElementById('paketVirtualSpacer');
  if(!viewport || !content || !spacer) return;
  const data = window.__paketVirtualData || [];
  const rowH = 56;
  const scrollTop = viewport.scrollTop;
  const viewportH = viewport.clientHeight;
  const buffer = 8;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
  const visible = Math.ceil(viewportH / rowH) + buffer*2;
  const end = Math.min(data.length, start + visible);
  
  // Update spacer height if data changed
  spacer.style.height = (data.length * rowH) + 'px';
  content.style.transform = `translateY(${start * rowH}px)`;
  
  let html = '';
  for(let i=start;i<end;i++){
    const p = data[i];
    if(!p) continue;
    html += `<div class="satria-virtual-row" data-idx="${i}" style="height:${rowH}px">
      <div>${i+1}</div>
      <div title="${esc(p.rup)}">${esc(p.rup)}</div>
      <div title="${esc(p.nama)}"><a href="#paket/${esc(p.id)}">${esc(p.nama)}</a></div>
      <div title="${esc(satriaSubKegiatan(p)||'Subkegiatan belum diisi')}"><b>${esc(satriaSubKegiatan(p)||'Belum diisi')}</b></div>
      <div class="n">${nf(p.pagu)}</div>
      <div class="n">${nf(hps(p))}</div>
      <div class="n">${nf(kontrak(p))}</div>
      <div>${pill(p)}</div>
    </div>`;
  }
  content.innerHTML = html;
}

let paketScrollRaf = null;
const attachedPackageViewports = new WeakSet();
function attachPaketVirtualScroll(){
  const vp = document.getElementById('paketVirtualViewport');
  if(!vp) return;
  if(attachedPackageViewports.has(vp)){renderPaketVirtualSlice();return;}
  attachedPackageViewports.add(vp);
  vp.addEventListener('scroll', ()=>{
    if(paketScrollRaf) cancelAnimationFrame(paketScrollRaf);
    paketScrollRaf = requestAnimationFrame(renderPaketVirtualSlice);
  }, {passive:true});
  renderPaketVirtualSlice();
}

// Auto attach after render
setTimeout(()=>{
  attachPaketVirtualScroll();
}, 300);

// Re-attach on hash change (when user navigates to paket detail)
window.addEventListener('hashchange', ()=>{
  setTimeout(()=>{
    attachPaketVirtualScroll();
    }, 200);
});


// ===== DOKUMEN PENGADAAN - LAZY LOAD + VIRTUAL SCROLL ENGINE =====
window.__dokLazyObserver = null;
window.__dokVirtualData = {};

function initDokLazyLoad(){
  const container = document.getElementById('dokLazyContainer');
  if(!container) return;
  
  // If already has doc, optimize its tables
  const docEl = container.querySelector('.doc');
  if(docEl){
    optimizeDocTables(docEl);
    lazyLoadDocImages(docEl);
    return;
  }
  
  // Lazy load doc content with skeleton
  const skeleton = container.querySelector('.satria-doc-skeleton');
  if(skeleton){
    // Simulate lazy load with rAF for smooth transition
    requestAnimationFrame(()=>{
      setTimeout(()=>{
        const p = window.S ? (window.S.paket.find(x=>x.id===window.S.ui.dpid) || window.filt()[0]) : null;
        if(!p) return;
        const dokType = window.S ? window.S.ui.dok : 'nodis';
        const docFn = window.DOCS ? window.DOCS[dokType] : null;
        if(docFn && p){
          const html = docFn(p);
          container.innerHTML = `<div class="doc doc-${dokType} ${dokType==='rfi'?'doc-landscape':'doc-portrait'}" data-document-type="${dokType}">${html}</div>`;
          const newDocEl = container.querySelector('.doc');
          if(newDocEl){
            optimizeDocTables(newDocEl);
            lazyLoadDocImages(newDocEl);
          }
        }
      }, 150);
    });
  }
}

function lazyLoadDocImages(docEl){
  if(!docEl) return;
  // Add loading="lazy" to all images
  docEl.querySelectorAll('img').forEach(img=>{
    if(!img.hasAttribute('loading')){
      img.setAttribute('loading','lazy');
      img.setAttribute('decoding','async');
    }
    // Add fade-in on load
    img.style.opacity = '0';
    img.style.transition = 'opacity .3s';
    if(img.complete){
      img.style.opacity = '1';
    } else {
      img.addEventListener('load', ()=>{ img.style.opacity='1'; }, {once:true});
    }
  });
}

function optimizeDocTables(docEl){
  if(!docEl) return;
  // Find large tables (>15 rows) and convert to virtual scroll
  docEl.querySelectorAll('table').forEach(table=>{
    const rows = table.querySelectorAll('tbody tr');
    if(rows.length > 20){
      // Only virtualize if not already virtualized
      if(table.closest('.doc-virtual-table')) return;
      
      const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
      const colCount = headers.length || 6;
      
      // Create virtual table wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'doc-virtual-table';
      wrapper.setAttribute('aria-hidden', 'true');
      
      const headerDiv = document.createElement('div');
      headerDiv.className = 'doc-virtual-header';
      headerDiv.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
      headerDiv.innerHTML = headers.map(h=>`<div>${esc(h)}</div>`).join('');
      
      const viewport = document.createElement('div');
      viewport.className = 'doc-virtual-viewport';
      viewport.style.maxHeight = rows.length > 30 ? '420px' : (rows.length*44+10)+'px';
      
      const spacer = document.createElement('div');
      spacer.style.height = (rows.length * 44) + 'px';
      spacer.style.position = 'relative';
      
      const content = document.createElement('div');
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      content.style.right = '0';
      
      // Store data for virtual scroll
      const tableData = Array.from(rows).map(tr=>tr.innerHTML);
      let rafId = null;
      
      function renderSlice(){
        const scrollTop = viewport.scrollTop;
        const viewportH = viewport.clientHeight;
        const rowH = 44;
        const buffer = 5;
        const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
        const visible = Math.ceil(viewportH / rowH) + buffer*2;
        const end = Math.min(tableData.length, start + visible);
        
        content.style.transform = `translateY(${start * rowH}px)`;
        let html = '';
        for(let i=start;i<end;i++){
          html += `<div class="doc-virtual-row" style="height:${rowH}px;grid-template-columns:repeat(${colCount}, 1fr)"><div style="display:contents">${tableData[i]}</div></div>`;
        }
        content.innerHTML = html;
      }
      
      viewport.addEventListener('scroll', ()=>{
        if(rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(renderSlice);
      }, {passive:true});
      
      spacer.appendChild(content);
      viewport.appendChild(spacer);
      
      const footer = document.createElement('div');
      footer.className = 'doc-virtual-footer';
      footer.innerHTML = `<span>${rows.length} baris • pratinjau bertahap</span><span class="mut">Scroll untuk lihat semua</span>`;
      
      wrapper.appendChild(headerDiv);
      wrapper.appendChild(viewport);
      wrapper.appendChild(footer);
      
      // Replace original table with virtual
      table.parentNode.insertBefore(wrapper, table);
      table.dataset.satriaVirtualSource = 'true';
      table.classList.add('satria-sr-only-table');
      
      // Initial render
      setTimeout(renderSlice, 50);
    }
  });
}

// Enhanced vDok with lazy load
const originalVDok = window.vDok;
function vDokOptimized(){
  const L = filt();
  // The legacy filter intentionally excludes SPSE packages. Document Studio must not
  // use that filter alone: the PP selection-document builder needs SPSE packages too.
  const scope=activeCloudScope();
  const spseL=(S.paket||[]).filter(x=>satriaSpseIs(x)&&
    (S.ui.plife==='arsip'?!!x.arsip:!x.arsip)&&Number(x.tahun)===Number(S.ui.tahun)&&
    (S.ui.opd==='all'||String(x.opd)===String(S.ui.opd))&&
    (!scope||(scope.years.includes(Number(x.tahun))&&scope.opdIds.includes(String(x.opd)))));
  const allPackages=[...L,...spseL];
  const p=allPackages.find(x=>x.id===S.ui.dpid)||allPackages[0];
  if(p&&satriaSpseIs(p)){
    return `<div class="dok-studio dok-spse-workspace">
      <section class="dok-hero no-print"><div class="dok-hero-copy"><span class="dok-eyebrow"><i></i> SATRIA / SPSE DOCUMENT WORKSPACE</span><h2>Dokumen Pemilihan.<br><em>Disusun dari paket, diperiksa pejabat.</em></h2><p>Pengadaan Langsung: dokumen untuk sistem SPSE resmi. Tanpa mengisi ulang HPS dan identitas RUP.</p></div></section>
      <section class="dok-control-panel no-print"><div class="dok-control-title"><span class="dok-section-kicker">01 / PAKET</span><h3>Pilih paket kerja</h3><p>Metode asli paket tetap dipertahankan.</p></div>
        <div class="dok-package-control"><label for="selPaket">PAKET / KODE RUP</label><select id="selPaket" class="satria-select">${allPackages.slice().sort((a,b)=>String(a.rup).localeCompare(String(b.rup))).map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.rup||'RUP BELUM DIISI')} — ${esc(x.nama||'Paket tanpa nama')}</option>`).join('')}</select><div class="dok-package-meta"><span class="dok-meta-tag">${esc(p.rup||'RUP BELUM DIISI')}</span><span>TA ${esc(p.tahun)} · Pengadaan Langsung/SPSE</span></div></div>
        <a class="g" href="#spse/${encodeURIComponent(p.id)}">Monitoring SPSE →</a></section>
      ${window.SATRIA_PBJ_WORKSPACE?.panel?.(p)||'<section class="card">Modul PBJ 2026 tidak dimuat. Muat ulang aplikasi.</section>'}
      <p class="pbj-note">Berkas diunduh menggunakan dialog cetak browser. Periksa penetapan/tanda tangan dan panduan SPSE sebelum unggah manual. Tidak ada unggah otomatis.</p>
    </div>`;
  }
  if(!p) return `
    <div class="dok-studio">
      <section class="dok-hero no-print">
        <div class="dok-hero-copy">
          <span class="dok-eyebrow"><i></i> SATRIA / PROCUREMENT STUDIO</span>
          <h2>Dokumen rapi.<br><em>Proses lebih sat-set.</em></h2>
          <p>Area kerja dokumen pengadaan—pilih paket, cek data, lalu cetak.</p>
        </div>
        <div class="dok-hero-art" aria-hidden="true"><span class="dok-art-orbit"></span><span class="dok-art-chip">DOCS<br><b>01—15</b></span></div>
      </section>
      <section class="dok-empty-state">
        <div class="dok-empty-icon">＋</div>
        <h3>Belum ada paket di filter ini</h3>
        <p>Buat atau impor paket terlebih dahulu melalui menu <b>Paket Pengadaan</b>. Dokumen akan mengambil data dari paket yang tersedia.</p>
      </section>
    </div>`;

  const T=[
    ['nodis','1 Nota Dinas'],['idkb','2 Identifikasi Kebutuhan Pengadaan'],['rfi','3 Hasil Permintaan Informasi (RFI)'],
    ['bahepe','4 Berita Acara Evaluasi Penyedia'],['metode','5 Formulir Penetapan E-Purchasing'],['sppbj','6 Surat Perintah Pengadaan kepada PP'],
    ['spek','7 Spesifikasi Teknis'],['dpp','8 Dokumen Persiapan Pengadaan (DPP)'],['lamp','9 Lampiran Referensi Harga'],
    ['reviu','10 Berita Acara Reviu DPP'],['bahp','11 Berita Acara Hasil Pemilihan'],['survei','12 Survei Harga'],
    ['hpsnego','13 HPS dan Negosiasi'],['kknego','14 Kertas Kerja Negosiasi'],['analisa','15 Analisis Kewajaran Harga & Bukti']
  ];
  const hints={
    nodis:'Pengantar dan permohonan proses', idkb:'Merumuskan kebutuhan paket', rfi:'Permintaan informasi pasar',
    bahepe:'Catatan evaluasi penyedia', metode:'Formulir penetapan barang/jasa', sppbj:'Penunjukan penyedia terpilih',
    spek:'Rincian teknis barang/jasa', dpp:'Dokumen persiapan e-Purchasing', lamp:'Referensi sumber harga',
    reviu:'Pemeriksaan dokumen persiapan', bahp:'Ringkasan hasil pemilihan', survei:'Perbandingan harga pasar',
    hpsnego:'Harga perkiraan dan negosiasi', kknego:'Rekap kerja negosiasi',analisa:'Referensi harga dan analisis kewajaran otomatis per paket'
  };
  const groups=[
    {title:'Rencana & persiapan',sub:'Rapikan kebutuhan sebelum proses berjalan',keys:['nodis','idkb','spek','dpp','lamp','reviu','metode']},
    {title:'Survei & evaluasi',sub:'Bandingkan informasi, harga, dan penawaran',keys:['rfi','survei','bahepe','hpsnego','kknego','analisa']},
    {title:'Hasil pemilihan',sub:'Dokumen hasil dan penunjukan',keys:['bahp','sppbj']}
  ];
  const docCheck = k => docMiss(p,k);
  const readyDocs=T.filter(([k])=>docCheck(k).length===0).length;
  const pct=Math.round(readyDocs/T.length*100);
  const currentMissing=docCheck(S.ui.dok);
  const auditItem=()=>({id:p.id,rup:p.rup,type:S.ui.dok,title:(T.find(x=>x[0]===S.ui.dok)||T[0])[1],checks:window.docReqs?window.docReqs(p,S.ui.dok):[],checkedAt:new Date().toISOString()});
  const checkRows=(window.docReqs?window.docReqs(p,S.ui.dok):[]).filter(r=>!r.ok&&!r.manual).slice(0,7);
  const docQualityHtml=`<section class="satria340-quality no-print" aria-label="Pemeriksaan sebelum PDF"><div class="satria340-quality-head"><div><span class="dok-section-kicker">QUALITY CONTROL / PENERBITAN</span><h3>Periksa hasil dokumen sebelum dicetak</h3><p>${currentMissing.length?currentMissing.length+' isian perlu diperiksa':'Isian dasar telah diperiksa'} · Validasi administratif dan hukum tetap menjadi kewenangan pejabat.</p></div><button type="button" class="g" data-act="satriaDocAuditExport">Unduh hasil pemeriksaan</button></div>${checkRows.length?`<div class="satria340-quality-grid">${checkRows.map(r=>`<div class="satria340-check"><span>!</span><span>${esc(r.label)}</span><button class="g" data-act="gotoField" data-pid="${esc(p.id)}" data-tab="${esc(r.tab)}" ${r.f?`data-f="${esc(r.f)}"`:''}>Perbaiki</button></div>`).join('')}</div>`:`<p class="satria340-allchecked">✔ Semua pemeriksaan isian terprogram terpenuhi. Periksa kesesuaian bukti, redaksi, dan pratinjau halaman secara manual.</p>`}${S.ui.dok==='analisa'?'<p class="satria340-quality-note"><b>Verifikasi manual wajib:</b> periksa kesetaraan spesifikasi, keaslian referensi, tanggal pengambilan harga, pajak, ongkir, dan lampiran bukti. Indikator kelengkapan di atas hanya menghitung isian yang dapat diperiksa aplikasi.</p>':''}<p class="satria340-quality-note">Status ini bukan penetapan pemenang, persetujuan pejabat, atau jaminan kepatuhan hukum. Pada harga e-Katalog termasuk pajak, jangan menambahkan PPN kembali tanpa data DPP/pajak yang jelas.</p></section>`;
  const relationHealth = window.SATRIA_DATA_HEALTH?.inspect?.(p) || {issues:[],warningCount:0};
  const activeT=T.find(([k])=>k===S.ui.dok)||T[0];
  const docLandscape = S.ui.dok==='rfi' || (['survei','hpsnego'].includes(S.ui.dok) && (p.penawaran||[]).length>=3);
  const docContent = DOCS[S.ui.dok] ? satriaSafeDocHtml(DOCS[S.ui.dok](p)) : '<p class=mut>Dokumen tidak tersedia</p>';
  const groupsHtml=groups.map((g,gi)=>{
    const docs=g.keys.map(k=>T.find(x=>x[0]===k)).filter(Boolean);
    return `<section class="dok-group">
      <div class="dok-group-heading">
        <span class="dok-group-number">0${gi+1}</span>
        <div class="dok-group-title"><h3>${g.title}</h3><p>${g.sub}</p></div>
        <span class="dok-group-count">${docs.length} template</span>
      </div>
      <div class="dok-type-grid">${docs.map(([k,t])=>{
        const missing=docCheck(k),idx=T.findIndex(x=>x[0]===k)+1,selected=k===S.ui.dok;
        return `<button type="button" class="dok-type-card ${selected?'is-selected':''}" data-act="dtype" data-tab="${k}" aria-pressed="${selected?'true':'false'}" title="${t}">
          <span class="dok-type-index">${String(idx).padStart(2,'0')}</span>
          <span class="dok-type-copy"><strong>${t.replace(/^\d+\s/,'')}</strong><small>${hints[k]}</small></span>
          <span class="dok-type-state ${missing.length?'is-pending':'is-ready'}">${missing.length?missing.length+' cek':'Isian OK'}</span>
          <span class="dok-type-arrow" aria-hidden="true">↗</span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');

  return `
    <div class="dok-studio">
      <section class="dok-hero no-print">
        <div class="dok-hero-copy">
          <span class="dok-eyebrow"><i></i> SATRIA / PROCUREMENT STUDIO <span>•</span> TA ${esc(p.tahun)}</span>
          <h2>Dokumen rapi.<br><em>Proses lebih sat-set.</em></h2>
          <p>15 template dalam satu workspace. Pilih paket, cek kelengkapan, lalu cetak dengan lebih nyaman.</p>
          <div class="dok-hero-note"><span>✳</span> Data tetap bersumber dari paket dan master SATRIA.</div>
        </div>
        <div class="dok-hero-art" aria-hidden="true"><span class="dok-art-orbit"></span><span class="dok-art-chip">DOCS<br><b>01—15</b></span><span class="dok-art-spark dok-spark-a">✳</span><span class="dok-art-spark dok-spark-b">✦</span></div>
      </section>

      ${!satriaPemdaOfficial('nama')?`<section class="card no-print" role="alert" style="border:1px solid #e0a800;background:#fff9ed;color:#854d0e"><b>Identitas Pemerintah Daerah belum diatur secara resmi.</b> Sebelum menerbitkan dokumen, admin harus memverifikasi identitas pada <a href="#set">Pengaturan Sistem</a> → Identitas Pemerintah Daerah. Nilai Demo/Contoh tidak akan dicetak sebagai identitas resmi; bila belum tersedia, dokumen menampilkan penanda belum diatur. Kop gambar OPD yang sudah tersimpan tetap dipakai.</section>`:''}
      <section class="dok-metrics no-print" aria-label="Ringkasan paket">
        <article class="dok-metric dok-metric-progress"><div class="dok-metric-top"><span>CHECKLIST DOKUMEN</span><span class="dok-metric-glyph">↗</span></div><div class="dok-metric-value">${readyDocs}<small>/${T.length}</small></div><div class="dok-progress-track"><span style="width:${pct}%"></span></div><p>${pct}% template lolos pemeriksaan data aplikasi</p></article>
        <article class="dok-metric"><div class="dok-metric-top"><span>RINCIAN BARANG</span><span class="dok-metric-glyph">▦</span></div><div class="dok-metric-value">${p.items.length}</div><p>Item pada paket aktif</p></article>
        <article class="dok-metric"><div class="dok-metric-top"><span>PENAWARAN MASUK</span><span class="dok-metric-glyph">↔</span></div><div class="dok-metric-value">${p.penawaran.length}</div><p>Penyedia tercatat di paket</p></article>
        <article class="dok-metric dok-metric-hps"><div class="dok-metric-top"><span>TOTAL HPS</span><span class="dok-metric-glyph">Rp</span></div><div class="dok-metric-value dok-value-currency">${rp(hps(p))}</div><p>Terhitung dari rincian barang</p></article>
      </section>

      <section class="dok-control-panel no-print">
        <div class="dok-control-title"><span class="dok-section-kicker">01 / WORKSPACE</span><h3>Pilih paket kerja</h3><p>Jenis dokumen akan mengikuti paket aktif yang dipilih.</p></div>
        <div class="dok-package-control">
          <label for="selPaket">PAKET PENGADAAN · KODE RUP</label>
          <select id="selPaket" class="satria-select">${allPackages.slice().sort((a,b)=>String(a.rup).localeCompare(String(b.rup))).map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.rup||'KODE RUP BELUM DIISI')} — ${esc(x.nama)}</option>`).join('')}</select>
          <div class="dok-package-meta"><span class="dok-meta-tag">${esc(p.rup||'RUP BELUM DIISI')}</span><span>TA ${esc(p.tahun)} · ${esc(O(p.opd).singkat||O(p.opd).nama||'OPD belum diisi')}</span></div>
        </div>
        <button type="button" data-act="print" class="dok-print-button"><span class="dok-print-icon">↗</span><span><b>Cetak / Simpan PDF</b><small>A4 • Arial • Seluruh tabel</small></span></button>
      </section>

      <!-- PBJ 2026 is rendered from the SAME selected package as the active document studio. -->
      ${window.SATRIA_PBJ_WORKSPACE?.panel?.(p)||''}
      ${window.SATRIA_HPS_GENERATOR?.panel?.(p)||''}

      <div class="spha-quick no-print"><div><h3>Analisis Kewajaran Harga & Bukti Referensi</h3><p>Diambil otomatis dari penawaran/negosiasi paket ini; cocok untuk lampiran permintaan data per paket.</p></div><button type="button" class="spha-btn" data-act="dtype" data-tab="analisa">Buka laporan analisis →</button></div>
      ${satriaHumanDocGuide(p,S.ui.dok,currentMissing)}
      <div class="satria-integrity-strip no-print" role="status"><span class="satria-integrity-icon">✦</span><div><b>Kualitas relasi data</b><small>${relationHealth.issues.length ? relationHealth.issues.length+' temuan yang perlu diperiksa sebelum finalisasi' : 'Referensi paket dan data master terhubung'}</small></div><button type="button" data-act="satriaAudit">Periksa data →</button></div>
      <div class="dok-print-standard no-print" role="note"><strong>Standar keluaran</strong><span>ISO A4</span><span>Arial</span><span>Portrait / Landscape otomatis</span><span>Tabel lengkap, termasuk lebih dari 20 baris</span><span>Simpan PDF: Skala 100%, tanpa header/footer browser</span></div>

      <details class="satria-human-doc-library no-print" id="satriaHumanDocLibrary"><summary>Semua 15 template dokumen dan pemeriksaan isian • Buka bila diperlukan</summary>
      <section class="dok-library no-print">
        <div class="dok-library-heading"><div><span class="dok-section-kicker">02 / DOCUMENT LIBRARY</span><h3>Pilih dokumen</h3><p>Pilih salah satu kartu untuk membuka pratinjau. Status merangkum pemeriksaan isian di aplikasi, bukan validasi hukum.</p></div><div class="dok-library-counter"><strong>15</strong><span>template</span></div></div>
        ${groupsHtml}
      </section>
      </details>

      <section class="dok-preview-section">
        <div class="dok-preview-heading no-print"><div><span class="dok-section-kicker">03 / LIVE PREVIEW</span><h3>Pratinjau dokumen</h3><p>${activeT[1]} · Paket ${esc(p.rup||'belum memiliki Kode RUP')}</p></div><span class="dok-preview-status ${currentMissing.length?'is-pending':'is-ready'}"><i></i>${currentMissing.length?currentMissing.length+' hal perlu dicek':'Isian dasar OK'}</span></div>
        ${S.ui.dok==='analisa'?`<p class="satria340-quality-note no-print" data-satria-analisa-date-help style="margin:12px 0;padding:11px 13px;border:1px solid #d6d5ed;border-radius:10px"><b>Tanggal dokumen Analisis Harga:</b> ${window.SATRIA_PRICE_ANALYSIS?.documentDate?.(p)?esc(satriaDateId(window.SATRIA_PRICE_ANALYSIS.documentDate(p))):'<strong>Belum diisi</strong>'}. Otomatis mengikuti <b>Tanggal negosiasi</b> di Paket Pengadaan → Data Paket atau Kalkulator Nego. ${window.SATRIA_PRICE_ANALYSIS?.documentDate?.(p)?'':'Isi tanggal negosiasi sebelum mencetak dokumen resmi.'}</p>`:''}
        ${docQualityHtml}
        ${satria35912WarningPanel(p,S.ui.dok)}
        ${window.SATRIA_DOC_PPK?.panel?.(p,S.ui.dok)||''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_PREFLIGHT?.panel?.(p)||''):''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_FORMAT?.panel?.(p)||''):''}
        ${warnDoc(p)}
        <div class="dok-preview-frame" id="dokLazyContainer">
          <div class="dok-preview-caption no-print"><span><i></i> LIVE PREVIEW <b>·</b> FORMAT DOKUMEN RESMI</span><span>${docLandscape?'A4 LANDSCAPE':'A4 PORTRAIT'}</span></div>
          <div class="doc doc-${S.ui.dok} ${docLandscape?'doc-landscape':'doc-portrait'}" data-document-type="${esc(S.ui.dok)}" data-lazy="true">
            ${docContent}
          </div>
        </div>
      </section>
      <footer class="dok-footer-note no-print"><span>✳</span><p><b>Reminder:</b> pastikan sumber harga, tanggal, data pejabat, dan hasil evaluasi didukung bukti yang dapat diverifikasi sebelum dokumen ditetapkan atau digunakan secara resmi.</p></footer>
    </div>
  `;
}

// Override vDok with optimized version
window.vDok = vDokOptimized;

// Auto init lazy load on hash change to dok
window.addEventListener('hashchange', ()=>{
  if(location.hash.startsWith('#dok')){
    setTimeout(()=>{
      const container = document.getElementById('dokLazyContainer');
      if(container){
        const docEl = container.querySelector('.doc');
        if(docEl){
          optimizeDocTables(docEl);
          lazyLoadDocImages(docEl);
        }
      }
    }, 200);
  }
});

// Init on load if already on dok page
if(location.hash.startsWith('#dok')){
  setTimeout(()=>{
    const container = document.getElementById('dokLazyContainer');
    if(container){
      const docEl = container.querySelector('.doc');
      if(docEl){
        optimizeDocTables(docEl);
        lazyLoadDocImages(docEl);
      }
    }
  }, 500);
}

console.log('[SATRIA] Dokumen Pengadaan lazy load + virtual scroll active');

// Stable integration API to app-core table rendering.
window.renderPaketVirtualSlice = renderPaketVirtualSlice;
window.attachPaketVirtualScroll = attachPaketVirtualScroll;

})();
