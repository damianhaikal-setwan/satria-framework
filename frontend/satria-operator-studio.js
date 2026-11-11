/* SATRIA NEXT 3.0.59.32 — Operator Studio.
 * Presentation + navigation only. No writes, storage changes, approval states,
 * business calculations, backend APIs, or automatic transaction actions.
 * Designed for a single Pejabat Pengadaan using existing verified workflows.
 */
(function(){
 'use strict';
 const PAGES=['paket','input','kalk','dok'];
 const E=value=>typeof esc==='function'?esc(String(value??'')):String(value??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[k]));
 const N=value=>Number.isFinite(Number(value))?Number(value):0;
 const Rp=value=>typeof rp==='function'?rp(N(value)):'Rp '+N(value).toLocaleString('id-ID');
 const getPackages=()=>typeof satriaOpsVisiblePaket==='function'?satriaOpsVisiblePaket():[];
 const isSpse=p=>typeof satriaSpseIs==='function'&&satriaSpseIs(p);
 const activePackages=()=>getPackages().filter(p=>!isSpse(p)&&!p.arsip&&Number(p.tahun)===Number(S.ui.tahun)&&(String(S.ui.opd)==='all'||String(p.opd)===String(S.ui.opd)));
 const getP=()=>getPackages().find(p=>!isSpse(p)&&String(p.id)===String(S.ui.pid)&&Number(p.tahun)===Number(S.ui.tahun)&&(String(S.ui.opd)==='all'||String(p.opd)===String(S.ui.opd)))||null;
 const getRup=()=>typeof satriaBankAccessibleRows==='function'?satriaBankAccessibleRows():[];
 const metric=(label,value,note,color='')=>`<div class="sop-metric ${color}"><small>${E(label)}</small><strong>${E(value)}</strong><span>${E(note)}</span></div>`;
 const link=(label,href,icon='↗')=>`<a class="sop-link" href="${E(href)}"><span aria-hidden="true">${icon}</span>${E(label)}</a>`;
 const jump=(label,key,icon='↘')=>`<button type="button" class="sop-link" data-sop-jump="${E(key)}"><span aria-hidden="true">${icon}</span>${E(label)}</button>`;
 const action=(label,key,icon='✦')=>`<button type="button" class="sop-link" data-sop-action="${E(key)}"><span aria-hidden="true">${icon}</span>${E(label)}</button>`;
 const step=(label,key,selected)=>`<button type="button" class="sop-step ${selected?'active':''}" data-sop-tab="${E(key)}" aria-current="${selected?'step':'false'}">${E(label)}</button>`;
 function content(page){
   const ep=activePackages();
   if(page==='paket'){
     const p=getP();
     if(p){
       const H=typeof hps==='function'?hps(p):0;
       const winner=typeof pemenang==='function'?pemenang(p):null;
       const items=Array.isArray(p.items)?p.items:[];
       const offers=Array.isArray(p.penawaran)?p.penawaran:[];
       const next=typeof satriaHumanStage==='function'?satriaHumanStage(p)?.next:null;
       return {kicker:'WORKSPACE / PAKET AKTIF',title:'Satu paket. Satu alur kerja.',sub:`RUP ${p.rup||'—'} • ${p.nama||'Paket tanpa nama'} • Melanjutkan pekerjaan yang sudah Anda catat.`,
         stats:metric('Pagu paket',Rp(p.pagu),'Anggaran paket')+metric('Total HPS',Rp(H),`${items.length} rincian barang`)+metric('Penawaran',offers.length,'Penyedia yang tercatat')+metric('Penetapan',winner?'Valid':'Belum valid',winner?'Tetap periksa bukti':'Lanjutkan evaluasi',winner?'is-good':'is-warn'),
         actions:link('Kembali ke daftar','#paket','←')+link('Kalkulator Nego','#kalk','↗')+link('Dokumen Pengadaan','#dok','▤')+link('360° paket','#satria360/'+encodeURIComponent(p.id),'◈'),
         steps:`<div class="sop-steps" aria-label="Tahapan kerja paket">${step('01 · Data paket','data',S.ui.ptab==='data')}${step('02 · Rincian & HPS','rincian',S.ui.ptab==='rincian')}${step('03 · Penawaran & Nego','nego',S.ui.ptab==='nego')}</div>`,
         note:next?`Berikutnya: ${next.label}. Gunakan tab di atas untuk langsung menuju tahap pekerjaan.`:'Tahapan administratif terisi. Cocokkan kembali dengan dokumen sumber sebelum mencetak.'};
     }
     const awarded=ep.filter(p=>typeof pemenang==='function'&&!!pemenang(p)).length;
     return {kicker:'WORKSPACE / DAFTAR PAKET',title:'Paket pengadaan, tanpa ribet.',sub:'Cari, buka, dan lanjutkan pekerjaan paket. Satu tempat untuk data, HPS, penawaran, dan penetapan.',
       stats:metric('Paket aktif',ep.length,'Tahun dan OPD saat ini')+metric('Sudah ditetapkan',awarded,'Penetapan valid menurut aplikasi','is-good')+metric('Perlu dilanjutkan',ep.length-awarded,'Paket yang belum ditetapkan')+metric('Total HPS',Rp(ep.reduce((a,p)=>a+(typeof hps==='function'?hps(p):0),0)),'Agregat paket, bukan pagu RUP unik'),
       actions:action('Buat dari Bank RUP','newpaket','＋')+jump('Cari paket','paket-search','⌕')+link('Lihat Bank RUP','#input','▤')+link('SATRIA 360°','#satria360','◈'),
       note:'Tombol Buat dari Bank RUP menggunakan proses asli SATRIA; tidak membuat transaksi baru secara otomatis.'};
   }
   if(page==='input'){
     const rup=getRup(),manual=rup.filter(r=>String(r.asal||'').startsWith('Input manual')).length,imports=rup.filter(r=>String(r.asal||'').startsWith('Impor JSON/CSV')).length,missing=rup.filter(r=>!String(r.jenisPengadaan||'').trim()||!String(r.metodePemilihan||'').trim()).length;
     return {kicker:'RUANG KERJA / BANK RUP',title:'RUP lebih mudah ditemukan.',sub:'Satu bank untuk RUP manual dan impor JSON. Pilih tindakan yang Anda butuhkan, tanpa menghapus draf atau mengganti filter diam-diam.',
       stats:metric('RUP dalam akses',rup.length,'Lintas tahun/OPD sesuai hak akses')+metric('Input manual',manual,'Identitas dicatat langsung')+metric('Impor JSON/CSV',imports,'Data hasil impor')+metric('Perlu cek jenis/metode',missing,'Klasifikasi tidak diasumsikan otomatis',missing?'is-warn':'is-good'),
       actions:jump('Lihat Bank RUP','rup-bank','⌕')+jump('Input RUP manual','rup-manual','✎')+jump('Impor JSON/CSV','rup-import','⇧')+link('Daftar paket','#paket','▤'),
       note:'Pagu Bank RUP adalah nilai referensi, bukan saldo kas. Periksa jenis dan metode terhadap SiRUP sebelum memilih template dokumen; HPS dan penetapan tidak diubah.'};
   }
   if(page==='kalk'){
     const total=ep.length,haveOffer=ep.filter(p=>Array.isArray(p.penawaran)&&p.penawaran.length).length;
     return {kicker:'ALAT KERJA / NEGOSIASI',title:'Hitung harga. Catat dengan yakin.',sub:'Pilih paket dan penyedia, cek batas total HPS/pagu, lalu simpan hanya barang yang memang Anda ubah.',
       stats:metric('Paket tersedia',total,'Dalam filter tahun/OPD')+metric('Ada penawaran',haveOffer,'Paket yang siap dipilih')+metric('Review harga','Per item','Koreksi berdasarkan bukti asli')+metric('Aturan utama','Total paket','HPS, pagu, dan harga tayang tetap diperiksa'),
       actions:jump('Pilih paket & penyedia','kalk-pilih','⌕')+jump('Ringkasan harga','kalk-ringkasan','▥')+jump('Negosiasi per barang','kalk-item','✎')+link('Penawaran paket','#paket','↗'),
       note:'Saran kalkulator bukan keputusan penetapan. Hasil negosiasi di atas HPS satuan tetap memerlukan review sesuai bukti.'};
   }
   if(page==='dok'){
     const p=ep.find(x=>String(x.id)===String(S.ui.dpid))||ep[0], ready=p&&typeof docMiss==='function'&&typeof S?.ui?.dok==='string'?(docMiss(p,S.ui.dok)||[]).length:null;
     return {kicker:'DOCUMENT STUDIO / SIAP CETAK',title:'Dokumen rapi, kerja sat-set.',sub:'Pilih paket, tentukan jenis dokumen, periksa pratinjau A4, lalu cetak. Data tidak perlu diketik ulang.',
       stats:metric('Paket tersedia',ep.length,'Dalam filter tahun/OPD')+metric('Paket aktif',p?(p.rup||p.nama||'Terpilih'):'Belum ada','Sumber data dokumen')+metric('Jenis dokumen', '15','Template dokumen pengadaan')+metric('Pemeriksaan isian',ready===null?'—':ready===0?'Terisi':ready+' perlu dicek','Bukan pengesahan dokumen',ready===0?'is-good':ready?'is-warn':''),
       actions:jump('Pilih paket','dok-paket','⌕')+jump('Pilih template','dok-template','▤')+jump('Lihat pratinjau','dok-preview','▣')+link('Lengkapi data paket','#paket','↗'),
       note:'Cetak/PDF tetap menggunakan tombol asli SATRIA agar format dan pemeriksaan dokumen tidak berubah.'};
   }
   return null;
 }
 function enhance(){
   const main=document.getElementById('main'),page=String(S?.ui?.page||'');
   if(!main||!PAGES.includes(page))return;
   if(main.querySelector('.sop-studio'))return;
   const data=content(page);if(!data)return;
   main.dataset.sopPage=page;
   const el=document.createElement('section');el.className='sop-studio no-print';el.setAttribute('aria-label','Ruang kerja Pejabat Pengadaan');
   el.innerHTML=`<div class="sop-stage"><div class="sop-topline"><span class="sop-kicker"><i></i>${E(data.kicker)}</span><span class="sop-persona">✦ Mode Pejabat Pengadaan • Mandiri</span></div><div class="sop-titlebar"><div><h2 style="color:#ffffff!important">${E(data.title)}</h2><p>${E(data.sub)}</p></div><span class="sop-side-icon" aria-hidden="true">✳</span></div><div class="sop-stat-grid">${data.stats}</div></div><div class="sop-action-band"><div><b>Langsung ke pekerjaan</b><small>Tanpa langkah persetujuan tambahan</small></div><div class="sop-action-list">${data.actions}</div></div>${data.steps||''}<p class="sop-help">${E(data.note)}</p>`;
   const top=main.querySelector(':scope > .s4-module-head');
   if(top)top.insertAdjacentElement('afterend',el);else main.prepend(el);
 }
 const SELECTORS={
   'paket-search':'#qPaket',
   'rup-bank':'#rupBankSearch',
   'rup-manual':'.satria-rup-manual',
   'rup-import':'#rupFile',
   'kalk-pilih':'.kn44-toolbar',
   'kalk-ringkasan':'[data-kn-summary]',
   'kalk-item':'.kn44-items',
   'dok-paket':'.dok-package-control, #selPaket, .dok-control-panel',
   'dok-template':'.dok-library, .dok-type-grid',
   'dok-preview':'#dokLazyContainer, .dok-preview-section'
 };
 document.addEventListener('click',event=>{
   const el=event.target.closest?.('[data-sop-jump], [data-sop-action], [data-sop-tab]');if(!el||!el.closest('.sop-studio'))return;
   event.preventDefault();event.stopImmediatePropagation();
   if(el.dataset.sopTab){const tab=el.dataset.sopTab;if(['data','rincian','nego'].includes(tab)&&document.querySelector(`.satria342-workflow-tabs [data-tab="${tab}"]`)){S.ui.ptab=tab;render();}return;}
   if(el.dataset.sopAction==='newpaket'){
     const btn=document.querySelector('[data-act="newpaket"]');if(btn)btn.click();return;
   }
   const selector=SELECTORS[el.dataset.sopJump];if(!selector)return;
   const target=document.querySelector(selector);if(!target){
     if(typeof toast==='function')toast('Bagian ini belum tersedia. Pilih paket atau lengkapi data terlebih dahulu.');return;
   }
   target.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
   target.classList.add('sop-focus');setTimeout(()=>target.classList.remove('sop-focus'),1300);
   if(target.matches('input,select,textarea'))try{target.focus({preventScroll:true});}catch(_){target.focus();}
 },true);
 window.SATRIA_OPERATOR_STUDIO=Object.freeze({enhance,version:'3.0.59.32',readOnly:true,approvalStepsAdded:0});
})();
