/* SATRIA NEXT 3.0.59.57 — Ruang Kerja Pejabat Pengadaan.
 * Integrates existing package data, E-Purchasing and Pengadaan Langsung.
 * No extra database/login, no SPSE or e-Katalog API, no approval workflow.
 * Work notes and evidence references are part of existing package snapshot.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (root) root.SATRIA_PP_ECOSYSTEM = Object.freeze(api);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';
  const core = root?.SATRIA_PROCUREMENT_CORE || (typeof module === 'object' && module.exports ? require('./satria-procurement-core.js') : null);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const str = (v, max = 1000) => String(v ?? '').trim().slice(0, max);
  const iso = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) && !Number.isNaN(Date.parse(x + 'T12:00:00Z')) && new Date(x + 'T12:00:00Z').toISOString().slice(0, 10) === x;
  const code = p => str(p?.rup || p?.id || '', 100);
  const pathId = p => encodeURIComponent(String(p.id));
  const validRef = url => !url || /^https:\/\/[^\s<>"']+$/i.test(url) && url.length <= 600;
  const TOPICS = Object.freeze({persiapan:'Persiapan dan RUP',harga:'Kebutuhan, HPS, survei',proses:'Pelaksanaan metode',dokumen:'Dokumen pendukung',arsip:'Arsip dan tindak lanjut'});
  function method(p) {
    const route = (root?.SATRIA_PBJ_POLICY || (typeof globalThis !== 'undefined' ? globalThis.SATRIA_PBJ_POLICY : null))?.route?.(p);
    if (route === 'katalog') return 'ep';
    if (route === 'pengadaan-langsung') return 'pl';
    return 'other';
  }
  function logItems(p, kind) {
    const entries = p?.ppEkosistem?.[kind];
    return Array.isArray(entries) ? entries.filter(x => x && typeof x === 'object' && !Array.isArray(x)).slice(-100) : [];
  }
  function assess(p) {
    const mode = method(p), items = Array.isArray(p?.items) ? p.items : [], offers = Array.isArray(p?.penawaran) ? p.penawaran : [], m = p?.spseMonitoring || {};
    const cross = core.packageSnapshot(p, typeof S !== 'undefined' ? S.rupBank : []);
    const total = cross.hps;
    const basic = !!str(p?.rup) && !!str(p?.nama) && Number(p?.pagu) > 0;
    const itemsGood = items.length > 0 && items.every(i => str(i.nama) && Number(i.vol) > 0 && Number(i.hs) > 0) && total <= Number(p.pagu) && Number.isSafeInteger(Math.round(total));
    const source = offers.some(w => str(w.sumberHarga) && str(w.tanggalHarga));
    const notes = logItems(p, 'notes'), refs = logItems(p, 'evidence');
    let awardValid = !!p?.pemenangId;
    if (awardValid && typeof pemenang === 'function') {
      try { awardValid = !!pemenang(p); } catch (_) { awardValid = false; }
    }

    const stages = [
      {id:'persiapan', name:'Paket & RUP', recorded:basic, detail:basic?'Identitas dan pagu tercatat':'Periksa kode RUP, nama, dan pagu'},
      {id:'harga', name:'Kebutuhan & HPS', recorded:itemsGood, detail:itemsGood?'Rincian HPS tersedia dan tidak melebihi pagu':'Periksa rincian volume, HPS, dan pagu; monitoring SPSE boleh menggunakan DPP eksternal'},
      {id:'proses', name:mode==='ep'?'Survei, negosiasi & penetapan':mode==='pl'?'Proses Pengadaan Langsung SPSE':'Konfirmasi metode paket',
        recorded:mode==='ep' ? !!(source && awardValid && p?.tglPenetapan) : mode==='pl' ? !!(m.sourceAsOf && Array.isArray(m.stages) && m.stages.some(s => s.actual)) : false,
        detail:mode==='ep'?'Pastikan sumber harga, penawaran, hasil negosiasi dan penetapan':'Catat hanya perkembangan yang terjadi di SPSE resmi'},
      {id:'dokumen', name:'Dokumen pendukung', recorded:mode==='ep' ? !!p?.tglDpp && itemsGood : false,
        detail:mode==='ep'?'Pilih DPP/HPS dan periksa pratinjau':'Draf pemilihan, BA reviu DPP dan analisa pasar harus diperiksa isinya'},
      {id:'arsip', name:'Bukti & catatan pekerjaan', recorded:refs.length > 0, detail:'Lampirkan tautan atau nomor referensi bukti; tidak mengunggah berkas ke sistem resmi'}
    ];
    const concerns=[...cross.rup.issues];
    if(mode==='other') concerns.push('Metode belum dikenali sebagai E-Purchasing atau Pengadaan Langsung. Jangan membuat dokumen pemilihan yang tidak sesuai kewenangan.');
    if(!str(p?.jenisPengadaan)||!str(p?.metodePemilihan)&&!str(m.method)) concerns.push('Jenis atau metode belum lengkap. Cocokkan dengan SiRUP dan data paket sebelum menyiapkan dokumen.');
    if(total>Number(p?.pagu||0) && total>0) concerns.push('Total HPS tercatat melebihi pagu paket.');
    if(!itemsGood && mode==='pl' && p?.jalurPengadaan==='SPSE_MONITOR') concerns.push('Monitoring SPSE belum memuat rincian HPS di SATRIA; cocokkan DPP/HPS dari sumber resmi.');
    if(mode==='ep' && !source) concerns.push('Belum ada sumber harga dan tanggal referensi yang dapat diperiksa pada penawaran paket.');
    if(mode==='ep' && p?.pemenangId && !awardValid) concerns.push('Penetapan tercatat, tetapi hasil evaluasi penetapannya belum valid. Periksa total HPS dan pagu pada modul asal.');
    if(mode==='pl' && p?.jalurPengadaan!=='SPSE_MONITOR') concerns.push('Metode Pengadaan Langsung tercatat, namun paket belum terkait monitoring SPSE SATRIA; periksa pencatatannya.');
    return {mode, total, rupStatus:cross.rup, stages, concerns, docs: root?.SATRIA_PBJ_POLICY?.documentPlan?.(p) || null, notes, refs, recorded:stages.filter(s=>s.recorded).length};
  }
  function canAccess(p, visible) { return !!p && (!Array.isArray(visible) || visible.some(x => String(x.id) === String(p.id))); }
  function canEdit(p) {
    if (p?.arsip || typeof canWrite !== 'function' || !canWrite()) return false;
    const scope = typeof activeCloudScope === 'function' ? activeCloudScope() : null;
    return !scope || (Array.isArray(scope.opdIds) && scope.opdIds.includes(String(p.opd)) && Array.isArray(scope.years) && scope.years.includes(Number(p.tahun)));
  }
  function steps(a) { return `<ol class="pp-steps">${a.stages.map(s => `<li><span class="pp-step-mark ${s.recorded?'pp-data':'pp-needs'}">${s.recorded?'✓':'•'}</span><div><b>${safe(s.name)}</b><small>${safe(s.detail)}</small><small>${s.recorded?'Data pendukung tercatat — belum berarti disahkan':'Perlu pemeriksaan / belum ada data di SATRIA'}</small></div></li>`).join('')}</ol>`; }
  function docs(p,a) {
    const list=a.docs?.docs||[];
    const labels=list.map(d=>`<li>${safe(d.label)} <span>${d.available?'Draf/fitur terkait tersedia':'Format belum dikonfirmasi — jangan dibuat otomatis'}</span></li>`).join('');
    const ep=a.mode==='ep';const pl=a.mode==='pl';const spse=pl&&p.jalurPengadaan==='SPSE_MONITOR';
    return `<section class="pp-block"><h3>Dokumen berdasarkan metode</h3><p>${safe(a.docs?.note||'Metode harus dipastikan agar dokumen tepat.')}</p><ul class="pp-document-list">${labels||'<li>Belum ada dokumen yang direkomendasikan otomatis.</li>'}</ul>
    <div class="pp-actions">${ep?`<button type="button" data-pp-go="docs">Buka 15 template & generator HPS</button><a href="#dok">Dokumen Pengadaan →</a>`:''}${spse?`<button type="button" data-pp-go="spse-docs">Susun Dokumen Pemilihan SPSE</button><button type="button" data-pp-draft="reviu-dpp">Cetak draf BA Reviu DPP</button><button type="button" data-pp-draft="analisa-pasar">Cetak draf Analisa Pasar</button>`:''}<a href="#${spse?'spse':'paket'}/${pathId(p)}">Buka ${spse?'Monitoring SPSE':'Paket Pengadaan'} →</a></div>
    <p class="pp-muted">Tidak ada unggah otomatis ke SPSE/INAPROC. HRS belum digenerasikan karena formatnya belum terverifikasi. Dokumen draf tetap memerlukan pemeriksaan pejabat yang berwenang.</p></section>`;
  }
  function records(p,a,readonly) {
    const entries = arr => arr.slice(-10).reverse().map(r=>`<li><b>${safe(r.title||TOPICS[r.topic]||'Catatan')}</b><small>${safe((r.date||r.at||'').slice(0,16))} · ${safe(r.by||'-')}</small><span>${safe(r.text||r.reference||'')}</span>${r.url?`<a href="${safe(r.url)}" target="_blank" rel="noopener noreferrer">Buka referensi eksternal</a>`:''}</li>`).join('')||'<li>Belum ada catatan.</li>';
    return `<section class="pp-block"><h3>Catatan kerja dan referensi bukti</h3><p>Catatan ini hanya penunjang pekerjaan, bukan audit trail resmi atau tanda persetujuan.</p>
    <div class="pp-record-grid"><div><h4>Riwayat catatan (${a.notes.length})</h4><ul class="pp-records">${entries(a.notes)}</ul></div><div><h4>Referensi bukti (${a.refs.length})</h4><ul class="pp-records">${entries(a.refs)}</ul></div></div>
    ${readonly?'<p class="pp-muted">Hanya dapat membaca paket ini.</p>':`<div class="pp-editor"><h4>Tambah catatan kerja</h4><label>Topik<select data-pp-field="topic">${Object.entries(TOPICS).map(([k,v])=>`<option value="${k}">${safe(v)}</option>`).join('')}</select></label><label>Uraian<textarea rows="3" maxlength="1000" data-pp-field="note" placeholder="Hasil pekerjaan yang benar-benar sudah dilakukan, hal yang belum lengkap, dan tindak lanjut"></textarea></label><button type="button" data-pp-action="note">Simpan catatan kerja</button></div>
      <div class="pp-editor"><h4>Tambah referensi bukti</h4><label>Judul bukti<input maxlength="120" data-pp-field="title" placeholder="Contoh: Hasil survei harga tanggal ..."></label><label>Nomor / lokasi berkas<input maxlength="250" data-pp-field="reference" placeholder="Nomor dokumen atau lokasi arsip internal"></label><label>URL resmi atau sumber (opsional, HTTPS)<input type="url" maxlength="600" data-pp-field="url" placeholder="https://..."></label><label>Tanggal bukti<input type="date" data-pp-field="date"></label><button type="button" data-pp-action="evidence">Simpan referensi bukti</button></div>`}
    <div class="pp-actions"><button type="button" data-pp-action="export">Unduh ringkasan paket (JSON)</button><button type="button" data-pp-action="print">Cetak kertas kerja (draf PDF)</button></div>
    <p class="pp-muted">Hanya metadata/referensi yang tersimpan bersama paket. Berkas aslinya tetap disimpan di tempat yang sesuai kebijakan instansi; jangan menempelkan kredensial atau data rahasia.</p></section>`;
  }
  function page(list=[], selected='') {
    const rows=(Array.isArray(list)?list:[]).filter(p => p && typeof p.id === 'string').sort((a,b)=>String(a.rup||'').localeCompare(String(b.rup||''),'id'));
    const p=rows.find(x=>String(x.id)===String(selected))||rows[0];
    if(!p) return '<section class="pp-ecosystem card"><h2>Ruang Kerja Pejabat Pengadaan</h2><p>Belum ada paket yang dapat diakses pada filter tahun/OPD ini. Buka Paket Pengadaan atau Monitoring SPSE untuk mulai dari Bank RUP.</p></section>';
    const a=assess(p),readonly=!canEdit(p);
    return `<div class="pp-ecosystem" data-pp-panel="${safe(p.id)}"><div class="pp-hero"><div><span>✦ SATRIA • EKOSISTEM PEJABAT PENGADAAN</span><h2 style="color:#fff!important">Satu paket, satu ruang kerja.</h2><p>E-Purchasing dan Pengadaan Langsung dipisahkan otomatis. Data dipakai ulang; keputusan dan unggahan tetap di sistem resmi.</p></div><div class="pp-hero-badge">${a.mode==='ep'?'E-Purchasing':a.mode==='pl'?'Pengadaan Langsung':'Metode perlu diperiksa'}</div></div>
     <div class="pp-picker card"><label for="ppWorkspaceSelect">Pilih paket dari filter TA / OPD</label><select id="ppWorkspaceSelect" data-pp-select>${rows.map(x=>`<option value="${safe(x.id)}" ${x.id===p.id?'selected':''}>${safe(x.rup||'RUP belum diisi')} — ${safe(x.nama)} (${safe(x.jalurPengadaan==='SPSE_MONITOR'?'SPSE':'Paket')})</option>`).join('')}</select><div class="pp-headline"><div><b>${safe(p.nama)}</b><small>RUP ${safe(code(p))} · TA ${safe(p.tahun)} · OPD ${safe(typeof O === 'function' ? O(p.opd)?.nama || p.opd : p.opd)}</small></div><div><small>Alokasi paket</small><b>${fmt(p.pagu)}</b></div><div><small>HPS rincian tercatat</small><b>${fmt(a.total)}</b></div></div></div>
     <section class="pp-block pp-summary"><h3>Alur kerja yang relevan</h3><p><b>${a.recorded}/${a.stages.length}</b> kelompok memiliki data pendukung di SATRIA. Indikator ini <b>bukan persetujuan atau penilaian kepatuhan</b>.</p><p class="pp-muted">Relasi Bank RUP: ${a.rupStatus.ids.length?`${a.rupStatus.references.length}/${a.rupStatus.ids.length} tautan ditemukan`:'Belum ada tautan ID (paket manual/legacy)'}. Angka HPS memakai satu sumber perhitungan paket dan tidak mengubah data RUP.</p>${steps(a)}${a.concerns.length?`<div class="pp-alert">${a.concerns.map(t=>`<p>⚠ ${safe(t)}</p>`).join('')}</div>`:''}</section>
     ${docs(p,a)}${records(p,a,readonly)}<div class="pp-footer">Rujukan: <a href="https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026" target="_blank" rel="noopener noreferrer">Perlem LKPP 2/2026 (Katalog)</a> · <a href="https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026" target="_blank" rel="noopener noreferrer">Perlem LKPP 3/2026 (Melalui Penyedia)</a> · <a href="https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026" target="_blank" rel="noopener noreferrer">SE transisi</a></div></div>`;
  }
  function downloadable(p) {
    const a=assess(p);
    return {type:'SATRIA_PP_KERTAS_KERJA',schema:1,exportedAt:new Date().toISOString(),note:'Salinan data pendukung, bukan keputusan resmi, tanda tangan atau pengganti SPSE/INAPROC.',package:{id:p.id,rup:p.rup,nama:p.nama,tahun:p.tahun,opd:p.opd,jenisPengadaan:p.jenisPengadaan,metodePemilihan:p.spseMonitoring?.method||p.metodePemilihan,pagu:p.pagu,hpsRincian:a.total},method:a.mode,stages:a.stages,issues:a.concerns,documents:a.docs?.docs||[],notes:a.notes,evidence:a.refs};
  }
  function downloadJson(p) {
    const data=new Blob([JSON.stringify(downloadable(p),null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(data),link=document.createElement('a');
    link.href=url;link.download='SATRIA-Kertas-Kerja-'+code(p).replace(/[^a-z0-9_-]/gi,'_')+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function printHtml(p) {
    const a=assess(p),d=downloadable(p),doc=a.docs?.docs||[];
    const lis=(arr,format)=>arr.length?arr.map(x=>'<li>'+format(x)+'</li>').join(''):'<li>Belum ada catatan.</li>';
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Draf Kertas Kerja ${safe(p.rup)}</title><style>@page{size:A4 portrait;margin:18mm}body{font:12px/1.55 Arial;color:#111}h1{font-size:20px}h2{font-size:14px;border-bottom:1px solid #999;padding-bottom:4px}li{margin:5px 0;overflow-wrap:anywhere}.draft{border:2px solid #555;padding:8px;font-weight:bold}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:6px;text-align:left;vertical-align:top}th{width:30%}</style></head><body><p class="draft">DRAF / BAHAN KERJA — BUKAN DOKUMEN RESMI ATAU BUKTI PERSETUJUAN</p><h1>Ringkasan Kertas Kerja Pejabat Pengadaan</h1><table>${Object.entries(d.package).filter(([k])=>k!=='id').map(([k,v])=>`<tr><th>${safe(k)}</th><td>${safe(v)}</td></tr>`).join('')}</table><h2>Alur kerja dan kelengkapan</h2><ol>${lis(a.stages,s=>`${safe(s.name)} — ${s.recorded?'data tercatat':'perlu diperiksa'}; ${safe(s.detail)}`)}</ol><h2>Dokumen sesuai metode</h2><ul>${lis(doc,x=>safe(x.label)+(x.available?' (draf/fitur tersedia)':' (belum tersedia)'))}</ul><h2>Catatan kerja</h2><ol>${lis(a.notes,x=>`${safe(x.at)} — ${safe(x.text)}`)}</ol><h2>Referensi bukti</h2><ol>${lis(a.refs,x=>`${safe(x.title)}: ${safe(x.reference)} ${x.url?safe(x.url):''}`)}</ol><p>Periksa dasar hukum, kewenangan, rincian dan seluruh bukti sebelum dokumen digunakan dalam sistem resmi. SATRIA tidak menggantikan SPSE/Katalog.</p></body></html>`;
  }
  function openPrint(html) {
    const win=root.open('','_blank');if(!win){root.alert('Izinkan pop-up jendela cetak SATRIA.');return;}
    win.document.open();win.document.write(html);win.document.close();win.focus();win.print();
  }
  function findCurrent(host) {
    const id=host?.dataset.ppPanel;if(!id || typeof P!=='function')return null;
    const p=P(id),scope=typeof activeCloudScope==='function'?activeCloudScope():null;
    if(!p||typeof S==='undefined'||Number(p.tahun)!==Number(S.ui.tahun)||(S.ui.opd!=='all'&&String(p.opd)!==String(S.ui.opd))||(scope&&(!scope.opdIds.includes(String(p.opd))||!scope.years.includes(Number(p.tahun)))))return null;
    return p;
  }
  function commit(p,kind,record) {
    if(!canEdit(p)||typeof SATRIA==='undefined'||typeof SATRIA.tx!=='function'){root.alert('Tidak memiliki hak tulis untuk paket ini.');return;}
    const done=SATRIA.tx('paket','Kertas kerja PP: '+kind+' paket '+code(p),()=>{
      const meta=p.ppEkosistem && typeof p.ppEkosistem==='object'&&!Array.isArray(p.ppEkosistem)?p.ppEkosistem:{schema:1,notes:[],evidence:[]};
      if(!Array.isArray(meta.notes))meta.notes=[];
      if(!Array.isArray(meta.evidence))meta.evidence=[];
      meta[kind].push(record);
      if(meta[kind].length>100)meta[kind].splice(0,meta[kind].length-100);
      p.ppEkosistem=meta;
    });
    if(done!==null && typeof render==='function')render();
  }
  if(root && typeof document!=='undefined') {
    document.addEventListener('change', ev=>{
      const target=ev.target;
      if(target?.matches?.('[data-pp-select]')){ev.stopImmediatePropagation();const next=str(target.value);const host=target.closest('[data-pp-panel]');if(!host||!next)return;location.hash='#kerja/'+encodeURIComponent(next);return;}
      if(target?.closest?.('[data-pp-panel]')&&target.matches?.('[data-pp-field]')) ev.stopImmediatePropagation();
    },true);
    document.addEventListener('input',ev=>{if(ev.target?.closest?.('[data-pp-panel]')&&ev.target.matches?.('[data-pp-field]'))ev.stopImmediatePropagation();},true);
    document.addEventListener('click', ev=>{
      const button=ev.target?.closest?.('[data-pp-action],[data-pp-draft],[data-pp-go]');if(!button)return;
      const host=button.closest('[data-pp-panel]');if(!host)return;
      ev.preventDefault();ev.stopImmediatePropagation();
      const p=findCurrent(host);if(!p){root.alert('Paket tidak tersedia dalam hak akses/filter tahun dan OPD aktif.');return;}
      if(button.hasAttribute('data-pp-go')){if(typeof S!=='undefined'){S.ui.dpid=p.id;S.ui.dok='dpp';}location.hash='#dok';if(typeof render==='function')render();return;}
      if(button.hasAttribute('data-pp-draft')){
        const kind=button.dataset.ppDraft;
        if(method(p)!=='pl'||p.jalurPengadaan!=='SPSE_MONITOR'||!['pemilihan','reviu-dpp','analisa-pasar'].includes(kind)||!root.SATRIA_PBJ_POLICY?.documentPlan(p).docs.some(d=>d.code===kind&&d.available)){root.alert('Draf hanya untuk Pengadaan Langsung SPSE pada kewenangan yang telah diperiksa.');return;}
        const html=root.SATRIA_PBJ_WORKSPACE?.draft?.(p,kind);if(!html){root.alert('Modul draf belum tersedia.');return;}
        openPrint('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Draf '+safe(kind)+'</title><style>@page{size:A4 portrait;margin:18mm}body{font:12px/1.5 Arial;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:6px;text-align:left;vertical-align:top}tr{break-inside:avoid}th{background:#eee}h2{font-size:17px;text-align:center}</style></head><body><p style="border:2px solid #555;padding:10px">DRAF BELUM LENGKAP — bukan dokumen resmi atau bukti persetujuan</p>'+html+'<p>Periksa dan lengkapi seluruh isi sesuai proses pemilihan resmi sebelum digunakan.</p></body></html>');return;
      }
      const action=button.dataset.ppAction;
      if(action==='print'){openPrint(printHtml(p));return;}
      if(action==='export'){downloadJson(p);return;}
      if(!canEdit(p)){root.alert('Akses baca-saja atau paket telah diarsipkan.');return;}
      const get=key=>host.querySelector('[data-pp-field="'+key+'"]')?.value||'';
      const at=new Date().toISOString(),by=str(root.SATRIA_CLOUD_MEMBER?.email || (typeof cur==='function'?cur()?.nama:'Pengguna SATRIA'),120);
      const uid=()=> (root.crypto?.randomUUID?.()||('pp-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
      if(action==='note'){
        const topic=get('topic'),text=str(get('note'),1000);
        if(!TOPICS[topic]||!text){root.alert('Pilih topik dan isi uraian catatan kerja.');return;}
        commit(p,'notes',{id:uid(),topic,text,at,by});return;
      }
      if(action==='evidence'){
        const title=str(get('title'),120),reference=str(get('reference'),250),url=str(get('url'),600),date=get('date');
        if(!title||(!reference&&!url)||!validRef(url)||date&&!iso(date)){root.alert('Isi judul dan referensi/URL HTTPS valid. Tanggal bukti harus valid bila diisi.');return;}
        commit(p,'evidence',{id:uid(),title,reference,url,date,at,by});
      }
    },true);
  }
  return Object.freeze({method,assess,page,downloadable,printHtml,canAccess,validRef,topics:TOPICS});
});
