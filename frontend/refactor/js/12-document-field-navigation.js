
(function(){
  /* Peta field: setiap isian dokumen menunjuk ke tab dan field di menu Paket Pengadaan */
  const TAB_LABEL = {data:'Data Paket', rincian:'Rincian Kebutuhan dan HPS', nego:'Penawaran dan Negosiasi'};
  const FIELD = {
    rup:       {label:'Kode RUP',tab:'data',f:'rup'}, nama:{label:'Nama paket',tab:'data',f:'nama'},
    opd:       {label:'OPD paket valid',tab:'data',f:'opd'}, tahun:{label:'Tahun anggaran paket',tab:'data',f:'tahun'},
    pagu:      {label:'Pagu positif dan valid',tab:'data',f:'pagu'}, items:{label:'Minimal satu rincian kebutuhan',tab:'rincian'},
    metode:    {label:'Metode paket sesuai E-Purchasing',tab:'data',f:'metodePemilihan'},
    itemData:  {label:'Nama, volume, satuan dan HPS satuan tiap item terisi',tab:'rincian'},
    hpsPagu:   {label:'Total HPS tidak melebihi pagu',tab:'rincian'},
    penawaran: {label:'Penawaran/referensi penyedia tersedia',tab:'nego'},
    harga:     {label:'Harga tayang positif untuk rincian yang dirujuk',tab:'nego'},
    bukti:     {label:'Sumber dan tanggal referensi harga',tab:'nego'},
    cakupan:   {label:'Setiap rincian memiliki setidaknya satu referensi harga',tab:'nego'},
    sinkron:   {label:'Harga Smart Survey konsisten dengan harga penawaran dan negosiasi',tab:'nego'},
    pemenang:  {label:'Penyedia telah ditetapkan dan hasil negosiasi valid',tab:'nego'},
    pajak:     {label:'Ongkir bernilai sah dan direkap satu kali; rincian PPN tetap harus diperiksa',tab:'nego'},
    lokasi:    {label:'Lokasi penyerahan',tab:'data',f:'lokasiPengiriman'},
    akun:      {label:'Rekening anggaran terdaftar',tab:'data',f:'akunId'},
    ppk:       {label:'PPK terdaftar di Data Master',tab:'data',f:'ppk'},
    pp:        {label:'Pejabat Pengadaan terdaftar di Data Master',tab:'data',f:'pp'},
    kabid:     {label:'Kepala Bidang terdaftar di Data Master',tab:'data',f:'kabid'},
    tglNodis:  {label:'Tanggal Nota Dinas',tab:'data',f:'tglNodis'},
    tglDpp:    {label:'Tanggal DPP',tab:'data',f:'tglDpp'},
    tglSppbj:  {label:'Tanggal SPPBJ',tab:'data',f:'tglSppbj'},
    tglNego:   {label:'Tanggal negosiasi',tab:'data',f:'tglNego'},
    tglBahp:   {label:'Tanggal BAHP',tab:'data',f:'tglBahp'},
    tglEvaluasi:{label:'Tanggal evaluasi penyedia',tab:'data',f:'tglEvaluasi'},
    nomor:     {label:'Format nomor dokumen tersedia',tab:'data'}
  };
  const NUM_CODE={nodis:'NODIS',dpp:'DPP',reviu:'BAHR',bahepe:'BAHEPE',bahp:'BAHP',sppbj:'PPBJ',kknego:'KKNEGO'};
  const needsPrice=['survei','rfi','lamp','hpsnego','bahepe','bahp','kknego'];
  const needsOffers=['survei','rfi','lamp','hpsnego','bahepe','bahp','kknego'];
  const needsProof=['survei','rfi','lamp','hpsnego','bahepe','bahp','kknego'];
  function docReqs(p,k){
    if(k==='analisa')return window.SATRIA_PRICE_ANALYSIS?.docChecks?.(p)||[{id:'module',label:'Modul analisis harga belum dimuat',tab:'nego',f:null,ok:false}];
    const R=[],items=Array.isArray(p.items)?p.items:[],offers=Array.isArray(p.penawaran)?p.penawaran:[];
    const add=(id,ok)=>{const f=FIELD[id];R.push({id,label:f.label,tab:f.tab,f:f.f||null,ok:!!ok})};
    const isValidDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&!Number.isNaN(new Date(d+'T00:00:00').getTime());
    const validItem=i=>String(i.nama||'').trim().length>0&&Number.isFinite(+i.vol)&&+i.vol>0&&String(i.satuan||'').trim()&&Number.isFinite(+i.hs)&&+i.hs>0;
    const validPrice=(w,i)=>Number.isFinite(+(w.harga||{})[i.id])&&+(w.harga||{})[i.id]>0;
    const trustedOfficer=id=>!!(id&&(S.pejabat||[]).some(x=>x.id===id&&(!x.opd||String(x.opd)===String(p.opd))));
    add('rup',String(p.rup||'').trim());add('nama',String(p.nama||'').trim());
    add('metode',/e[- ]?purchasing/i.test(String(p.metodePemilihan||'')));
    add('opd',(S.opd||[]).some(x=>x.id===p.opd));add('tahun',(S.tahun||[]).some(y=>String(y)===String(p.tahun)));
    add('pagu',Number.isFinite(+p.pagu)&&+p.pagu>0);
    add('items',items.length>0);add('itemData',items.length>0&&items.every(validItem));
    add('hpsPagu',items.length>0&&hps(p)>0&&hps(p)<=+p.pagu);
    const officers={nodis:['kabid','ppk'],idkb:['ppk'],spek:['ppk'],dpp:[],reviu:['ppk','pp'],bahepe:['pp'],bahp:['ppk','pp'],sppbj:['ppk','pp'],metode:['ppk','pp'],rfi:[],survei:['pp'],lamp:[],hpsnego:['pp'],kknego:['pp']};
    (officers[k]||[]).forEach(id=>{
      const selected=id==='ppk'?(p.docPpkSettings?.[k]?.ppkId||p[id]):p[id];
      add(id,trustedOfficer(selected));
    });
    if(k==='dpp'){
      const customId=p.docPpkSettings?.dpp?.ppkId||p.dppPpkId||p.ppk;
      const chosen=(S.pejabat||[]).find(x=>String(x.id)===String(customId)&&String(x.opd)===String(p.opd)&&x.peran==='PPK');
      add('ppk',!!chosen&&chosen.aktif!==false);
    }
    if(NUM_CODE[k])add('nomor',!!(S.penomoran&&String(S.penomoran[NUM_CODE[k]]||'').trim()));
    const dateFields={nodis:'tglNodis',dpp:'tglDpp',reviu:'tglDpp',sppbj:'tglSppbj',bahp:'tglBahp',bahepe:'tglEvaluasi',kknego:'tglNego'};
    if(dateFields[k])add(dateFields[k],isValidDate(p[dateFields[k]]));
    if(['bahp'].includes(k))add('tglNego',isValidDate(p.tglNego));
    if(['nodis','idkb'].includes(k))add('akun',!!p.akunId&&(S.akun||[]).some(x=>x.id===p.akunId));
    if(['survei','rfi','lamp','hpsnego','dpp','spek'].includes(k))add('lokasi',String(p.lokasiPengiriman||'').trim());
    if(needsOffers.includes(k))add('penawaran',offers.length>0);
    if(needsPrice.includes(k))add('harga',offers.length>0&&offers.some(w=>items.some(i=>validPrice(w,i))));
    if(needsPrice.includes(k))add('cakupan',items.length>0&&items.every(i=>offers.some(w=>validPrice(w,i))));
    if(needsOffers.includes(k))add('sinkron',offers.every(w=>items.every(i=>{
      const ref=w.catalogRefs&&w.catalogRefs[i.id];if(!ref)return true;
      const price=Number(ref.displayPrice||0),offer=Number((w.harga||{})[i.id]||0);
      const nego=Number(ref.negotiatedBase||0),tax=Number(ref.negotiatedTax||0),saved=Number((w.nego||{})[i.id]||0);
      return (!price||Math.abs(price-offer)<=1)&&(!nego||Math.abs(nego+tax-saved)<=1);
    })));
    if(needsProof.includes(k))add('bukti',offers.length>0&&offers.every(w=>String(w.sumberHarga||'').trim()&&isValidDate(w.tanggalHarga)));
    if(['bahp','kknego'].includes(k))add('pemenang',!!pemenang(p));
    // Do not certify VAT reconciliation from display gross prices alone.
    if(['bahp','kknego'].includes(k))add('pajak',!!pemenang(p)&&offers.every(w=>Number.isFinite(Number(w.ongkir||0))&&Number(w.ongkir||0)>=0));
    return R;
  }
  docMiss=(p,k)=>docReqs(p,k).filter(r=>!r.ok&&!r.manual).map(r=>r.label);
  window.docReqs=docReqs;

  /* Pedoman isian: menampilkan status tiap isian dan tombol menuju field-nya */
  warnDoc = function(p){
    const k = S.ui.dok;
    const reqs = docReqs(p, k).filter(r=>!r.manual);
    const missing = reqs.filter(r => !r.ok).length;
    const judul = (DINFO.find(d => d.k === k) || {}).n || k;
    if(!missing) return `<div class="card no-print" style="border-color:#7bd7a6"><b>Pedoman isian ${esc(judul)} terpenuhi</b><p class=mut>Pemeriksaan isian dasar terpenuhi; verifikasi isi dan bukti tetap diperlukan sebelum penggunaan resmi.</p></div>`;
    const baris = reqs.map(r => {
      const tanda = r.ok ? '✔' : '✖';
      const aksi = r.ok ? '' : `<button type="button" class="g" data-act="gotoField" data-pid="${esc(p.id)}" data-tab="${r.tab}"${r.f ? ` data-f="${r.f}"` : ''}>Isi di ${esc(TAB_LABEL[r.tab])}${r.f ? ' › ' + esc(r.label) : ''}</button>`;
      return `<li style="margin:4px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>${tanda}</span><span>${esc(r.label)}</span>${aksi}</li>`;
    }).join('');
    const baris2 = '';
    return `<div class="card no-print" style="border-color:#e0a800"><b>Pedoman isian ${esc(judul)}</b><p class=mut>Setiap isian mengikuti menu Paket Pengadaan. Tekan tombol untuk membuka field yang dimaksud.</p><ul style="list-style:none;padding:0;margin:0">${baris}${baris2}</ul></div>`;
  };

  /* Navigasi dari pedoman ke field di Paket Pengadaan */
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act="gotoField"]');
    if(!el) return;
    e.preventDefault();
    S.ui.ptab = el.dataset.tab || 'data';
    const pid = el.dataset.pid, f = el.dataset.f || '';
    location.hash = '#paket/' + pid;
    render();
    setTimeout(() => {
      const target = f ? document.querySelector(`[data-f="${f}"][data-id="${pid}"]`) : null;
      if(target){ target.scrollIntoView({block:'center'}); target.focus(); }
    }, 80);
  });
})();
