/* SATRIA Perawatan — pusat pemeriksaan baca-saja; memakai pemeriksa yang sudah ada.
   Tidak mengubah data bisnis, tidak memperbaiki otomatis, tidak mengirim data ke server. */
(function () {
  'use strict';
  const escCare = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => escCare(value == null ? '—' : value);
  const kpi = (title, number, detail, tone='') =>
    `<div class="satria-care-kpi ${tone}"><span>${text(title)}</span><strong>${text(number)}</strong><small>${text(detail)}</small></div>`;

  // Pengaturan organisasi dan backup data penuh dibatasi kepada Admin yang telah dikenali.
  function adminAllowed() {
    try {
      if (typeof cur !== 'function' || cur()?.role !== 'Admin') return false;
      if (window.SATRIA_CLOUD_CONFIGURED && window.SATRIA_CLOUD_ROLE !== 'admin') return false;
      return true;
    } catch (_) { return false; }
  }

  // Hanya mengambil hitungan, tidak menyertakan nama paket, data akun, URL atau token.
  function scan() {
    let runtime = null, runtimeUnavailable=false;
    try { runtime = window.SATRIA_MAINTENANCE?.inspect?.() || null; }
    catch (_) { runtimeUnavailable=true; }
    const isAdmin = adminAllowed();
    let config = null, data = null;
    if (isAdmin) {
      try {
        const groups = typeof satriaSettingsCheck === 'function' ? satriaSettingsCheck() : null;
        const completeness = typeof satriaSettingsWarnings === 'function' ? satriaSettingsWarnings() : null;
        if (groups) config=Object.freeze({
          count:Object.values(groups).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0),
          incomplete:completeness ? completeness.length : null,
          groups:Object.freeze(Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,a.length])))
        });
      } catch (_) { /* Status tidak tersedia; bukan otomatis berarti nol temuan. */ }
    }
    try {
      const health=window.SATRIA_OPS_V2?.health?.();
      if (health && Array.isArray(health.issues)) data=Object.freeze({
        count:health.issues.length,
        high:health.issues.filter(i=>i.level==='Tinggi').length,
        checked:health.records?.length ?? null
      });
    } catch (_) { /* Laporan tidak tersedia; jangan menampilkan angka nol palsu. */ }
    const persistFailed=typeof S!=='undefined' && Boolean(S?.persistError);
    const rtBad=runtimeUnavailable||!runtime||runtime.errorCount>0||runtime.stylesLoaded!==runtime.stylesExpected||!runtime.coreReady||!runtime.priceAnalysisReady;
    const issues=Math.max(config?.count||0,config?.incomplete||0)+(data?.count||0)+(runtime?.errorCount||0)+(persistFailed?1:0);
    const complete=Boolean(runtime && data && (!isAdmin || config));
    return Object.freeze({
      checkedAt:new Date().toISOString(),
      version:'3.0.59.39',
      admin:isAdmin,
      config,
      data,
      runtime:runtime ? Object.freeze({
        errorCount:Number(runtime.errorCount)||0,
        scriptsExpected:Number(runtime.scriptsExpected)||0,
        stylesExpected:Number(runtime.stylesExpected)||0,
        stylesLoaded:Number(runtime.stylesLoaded)||0,
        coreReady:Boolean(runtime.coreReady),
        priceAnalysisReady:Boolean(runtime.priceAnalysisReady)
      }) : null,
      runtimeUnavailable,
      persistFailed,
      complete,
      issues,
      attention:rtBad||persistFailed||issues>0||!complete,
      // Kesehatan cloud tidak disimpulkan dari pemeriksaan lokal.
      cloudConfigured:Boolean(window.SATRIA_CLOUD_CONFIGURED)
    });
  }

  function tile(title, status, body, action, tone='') {
    return `<article class="satria-care-tile"><div class="satria-care-tile-head"><h3>${text(title)}</h3><span class="satria-care-tag ${tone}">${text(status)}</span></div><p>${text(body)}</p><div class="satria-care-tile-actions">${action}</div></article>`;
  }
  function page() {
    const s=scan();
    const rt=s.runtime;
    const configContent=s.admin
      ? tile('Konfigurasi instansi',s.config ? `${s.config.count} referensi · ${s.config.incomplete ?? '—'} kelengkapan` : 'Belum dapat diperiksa',
        'Identitas daerah, referensi Bank RUP, nomor dokumen, dan konsistensi konfigurasi.',
        '<a href="#set" class="satria-care-button secondary">Buka Pengaturan Sistem</a>',(s.config?.count || s.config?.incomplete)?'warn':'')
      : tile('Konfigurasi instansi','Khusus Admin',
        'Pemeriksaan lengkap pengaturan organisasi dan backup tidak ditampilkan untuk Operator/Viewer.',
        '<span class="satria-care-muted">Hubungi Admin untuk pemeriksaan pengaturan.</span>');
    const qualityContent=tile('Kualitas data',s.data ? `${s.data.count} temuan`:'Belum dapat diperiksa',
      s.data ? `${s.data.high} prioritas tinggi pada data dalam cakupan tahun, OPD, dan hak akses aktif.` : 'Pemeriksa kualitas data belum tersedia pada sesi ini.',
      '<a href="#quality" class="satria-care-button secondary">Buka Kualitas Data</a>',s.data?.high?'warn':'');
    const runtimeContent=tile('Error dan aset aplikasi',rt ? `${rt.errorCount} error tercatat`:'Belum dapat diperiksa',
      rt ? `CSS termuat ${rt.stylesLoaded}/${rt.stylesExpected}. Inti aplikasi: ${rt.coreReady?'termuat':'perlu dicek'}. Analisa Harga: ${rt.priceAnalysisReady?'termuat':'perlu dicek'}.` : 'Pencatatan diagnostik tidak tersedia pada sesi ini.',
      '<button type="button" class="satria-care-button secondary" data-care-action="diagnostic">Unduh Diagnostik</button>',rt?.errorCount?'warn':'');
    return `<section class="satria-care-page" aria-label="Perawatan SATRIA">
      <div class="satria-care-hero"><div><span class="satria-care-eyebrow">SATRIA NEXT · Pusat Perawatan</span><h2>Perawatan SATRIA</h2><p>Pemeriksaan konfigurasi, kualitas data, dan error aplikasi di satu tempat.</p></div>
        <div class="satria-care-hero-actions"><button type="button" class="satria-care-button primary" data-care-action="scan">Periksa Ulang</button><button type="button" class="satria-care-button ghost" data-care-action="report">Unduh Ringkasan</button></div>
      </div>
      <div class="satria-care-summary" role="status" aria-live="polite">
        <div><strong>${s.attention?'Ada hal yang perlu diperiksa':'Tidak ada masalah terdeteksi'}</strong><p>${s.complete?'Pemeriksaan lokal berhasil dijalankan.':'Sebagian pemeriksaan belum tersedia; lihat rincian di bawah.'} Hasil ini bukan jaminan aplikasi bebas error, keamanan cloud, atau kepatuhan dokumen.</p></div>
        <span class="satria-care-status ${s.attention?'warn':'ok'}">${s.attention?'Perlu perhatian':'Lokal normal'}</span>
      </div>
      <div class="satria-care-kpis">
        ${kpi('Temuan kualitas data',s.data?.count ?? '—','Menurut hak akses dan filter aktif',s.data?.high?'warn':'')}
        ${kpi('Perlu dilengkapi',s.admin ? (s.config?.incomplete ?? '—') : '—',s.admin?'Kelengkapan Pengaturan Sistem':'Hanya tersedia untuk Admin')}
        ${kpi('Error terpantau',rt?.errorCount ?? '—','Sejak aplikasi dibuka pada tab ini',rt?.errorCount?'warn':'')}
        ${kpi('Penyimpanan lokal',s.persistFailed?'Bermasalah':'Tidak ada gagal tercatat','Tidak menguji seluruh data cloud',s.persistFailed?'warn':'')}
      </div>
      <div class="satria-care-tiles">${configContent}${qualityContent}${runtimeContent}</div>
      <div class="satria-care-bottom">
        <section class="satria-care-panel"><h3>Diagnostik dan pemeriksaan teknis</h3><p>Pantau informasi browser dan rekam error tanpa menampilkan atau mengirim isi data paket maupun kredensial.</p>
          <ul class="satria-care-checks"><li><span>JavaScript inti</span><b>${rt?.coreReady?'Termuat':'Belum terverifikasi'}</b></li><li><span>Modul Analisa Harga</span><b>${rt?.priceAnalysisReady?'Termuat':'Belum terverifikasi'}</b></li><li><span>Aset CSS</span><b>${rt ? `${rt.stylesLoaded} / ${rt.stylesExpected}`:'—'}</b></li><li><span>Sinkronisasi Supabase</span><b>Periksa indikator cloud di header</b></li></ul>
          <div class="satria-care-actions"><button type="button" class="satria-care-button secondary" data-care-action="diagnostic">Unduh Laporan Error</button>${s.admin?'<button type="button" class="satria-care-button secondary" data-care-action="debug">Buka SATRIA Debug</button>':''}</div>
        </section>
        <section class="satria-care-panel"><h3>Backup dan pemulihan</h3><p>Backup disimpan sebagai berkas JSON di perangkat Anda. Pemeriksaan ini tidak menjalankan reset, impor, atau perbaikan otomatis.</p>
          <div class="satria-care-actions">${s.admin?'<button type="button" class="satria-care-button primary" data-care-action="backup">Backup Data JSON</button><a class="satria-care-button secondary" href="#set">Pengaturan & Pemulihan</a>':'<span class="satria-care-muted">Backup dan pemulihan organisasi melalui akun Admin.</span>'}</div>
          <p class="satria-care-footnote">Sebelum memperbaiki data secara manual, buat backup. Jika sinkronisasi cloud bermasalah, periksa hak akses dan status Supabase secara terpisah.</p>
        </section>
      </div>
      <p class="satria-care-footnote">Terakhir diperiksa: ${text(new Date(s.checkedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))}. Pemeriksaan bersifat baca-saja; tidak ada data yang diperbaiki otomatis.</p>
    </section>`;
  }
  function downloadSummary() {
    const s=scan();
    const report={
      aplikasi:'SATRIA',versi:s.version,diperiksaPada:s.checkedAt,
      catatan:'Ringkasan pemeriksaan lokal. Bukan jaminan bebas error, audit kepatuhan atau verifikasi cloud.',
      kualitasData:s.data,konfigurasi:s.config,diagnostik:s.runtime,
      penyimpananLokalBermasalah:s.persistFailed,
      pemeriksaanLengkap:s.complete,
      supabase:'Status sinkronisasi harus diperiksa pada indikator cloud aplikasi.'
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='SATRIA-Ringkasan-Perawatan.json';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return true;
  }
  function notify(message) {
    const e=document.getElementById('satriaCareFeedback');
    if(e){e.textContent=message;return;}
    if(typeof toast==='function')toast(message);
  }
  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('[data-care-action]');
    if(!button)return;
    if(!document.getElementById('main')?.contains(button))return;
    event.preventDefault();
    switch(button.getAttribute('data-care-action')){
      case 'scan': {
        if(location.hash.split('/')[0]!=='#care')return;
        const main=document.getElementById('main');main.innerHTML=page();
        main.querySelector('[data-care-action="scan"]')?.focus();
        break;
      }
      case 'diagnostic':
        if(!window.SATRIA_MAINTENANCE?.downloadReport?.())notify('Diagnostik belum tersedia.');
        break;
      case 'report': downloadSummary();break;
      case 'debug':
        if(!adminAllowed())return;
        if(window.SATRIA?.setDebug)window.SATRIA.setDebug(true);
        else notify('Panel SATRIA Debug belum tersedia.');
        break;
      case 'backup': {
        if(!adminAllowed())return;
        const backup=document.querySelector('header [data-act="export"]');
        if(backup)backup.click();else notify('Backup tidak tersedia pada sesi ini.');
        break;
      }
    }
  });
  window.SATRIA_CARE=Object.freeze({page,scan,downloadSummary});
})();
