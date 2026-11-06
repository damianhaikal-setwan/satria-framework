
/* Read-only workflow guidance. No new business fields, no cloud write, no automatic decisions. */
function satriaHumanStage(p){
  const items=Array.isArray(p?.items)?p.items:[];
  const offers=Array.isArray(p?.penawaran)?p.penawaran:[];
  const qty=items.length;
  const itemValid=i=>String(i?.nama||'').trim()&&Number(i?.vol)>0&&Number(i?.hs)>0;
  const identity=!!String(p?.nama||'').trim()&&!!String(p?.rup||'').trim()&&Number(p?.pagu)>0&&!!p?.opd;
  const rincian=qty>0&&items.every(itemValid)&&hps(p)>0&&hps(p)<=Number(p.pagu||0);
  const validPrice=(w,id)=>Number(w?.harga?.[id])>0;
  const hasReference=(w,id)=>{
    const ref=w?.catalogRefs?.[id];
    return !!(ref&&Number(ref.displayPrice)>0&&String(ref.link||'').trim());
  };
  const coverage=qty&&items.filter(i=>offers.some(w=>hasReference(w,i.id))).length||0;
  const survey=qty>0&&coverage===qty;
  const ppk=(S.pejabat||[]).some(x=>String(x.id)===String(p?.ppk)&&String(x.opd)===String(p.opd)&&x.aktif!==false);
  const dpp=!!String(p?.tglDpp||'').trim()&&ppk&&rincian;
  const negotiated=qty>0&&offers.some(w=>items.every(i=>validPrice(w,i.id)&&Number(w?.nego?.[i.id])>0));
  const award=!!pemenang(p);
  const stages=[
    {key:'identity',label:'Data Paket & RUP',done:identity,desc:identity?'Identitas dan pagu tercatat':'Periksa identitas, OPD, kode RUP, dan pagu',page:'paket',tab:'data',focus:!p?.rup?'rup':!(Number(p?.pagu)>0)?'pagu':''},
    {key:'items',label:'Rincian & HPS',done:rincian,desc:rincian?'Rincian terisi; HPS dalam pagu':'Lengkapi barang, volume, dan HPS satuan',page:'paket',tab:'rincian'},
    {key:'survey',label:'Referensi Harga',done:survey,desc:survey?`${coverage}/${qty} barang memiliki referensi bertaut`:`${coverage}/${qty} barang memiliki referensi bertaut`,page:'paket',tab:'nego'},
    {key:'dpp',label:'Persiapan DPP',done:dpp,desc:dpp?'Tanggal dan PPK tercatat; periksa pratinjau':'Lengkapi tanggal DPP dan PPK, lalu periksa dokumen',page:(!ppk||!p.tglDpp)?'paket':'dok',tab:'data',focus:!ppk?'ppk':!p.tglDpp?'tglDpp':'',doc:'dpp'},
    {key:'nego',label:'Harga Negosiasi',done:negotiated,desc:negotiated?'Harga hasil negosiasi tercatat':'Catat hasil nego, termasuk bila di atas HPS',page:'paket',tab:'nego'},
    {key:'award',label:'Evaluasi & Penetapan',done:award,desc:award?'Pemenang memenuhi pemeriksaan aplikasi':'Tinjau kelayakan, jangan tetapkan otomatis',page:'paket',tab:'nego'}
  ];
  return {stages,done:stages.filter(x=>x.done).length,next:stages.find(x=>!x.done)||null};
}
function satriaHumanWorkflow(p){
 if(!p||satriaSpseIs(p))return '';
 const info=satriaHumanStage(p),step=info.next,count=info.stages.length;
 const ctl=step?`<button type="button" data-human-nav="${esc(step.page)}" data-pid="${esc(p.id)}" data-tab="${esc(step.tab||'data')}" data-doc="${esc(step.doc||'')}" data-focus="${esc(step.focus||'')}">Buka ${esc(step.label)} →</button>`:'<span class="pill">Semua data indikator terisi</span>';
 return `<section class="satria-human-panel" aria-label="Panduan pekerjaan paket"><div class="satria-human-head"><div><h3>✦ Lanjutkan pekerjaan paket ini</h3><p>Petunjuk dari data yang sudah ada. Tidak perlu mengisi ulang atau mengikuti langkah berurutan secara kaku.</p></div><div class="satria-human-progress"><strong>${info.done}/${count} indikator</strong><div class="satria-human-track" aria-label="${info.done} dari ${count} indikator" role="progressbar" aria-valuemin="0" aria-valuemax="${count}" aria-valuenow="${info.done}"><span style="width:${Math.round(100*info.done/count)}%"></span></div></div></div><div class="satria-human-primary"><div><b>${step?'Saran berikutnya: '+esc(step.label):'Data indikator telah terisi'}</b><p>${step?esc(step.desc):'Periksa bukti dan keputusan pejabat sebelum menerbitkan dokumen resmi.'}</p></div>${ctl}</div><div class="satria-human-steps">${info.stages.map(x=>`<div class="satria-human-step"><span aria-hidden="true">${x.done?'✓':'○'}</span><div><b>${esc(x.label)}</b><small>${esc(x.desc)}</small></div></div>`).join('')}</div><p class="satria-human-note">Indikator ini bukan persetujuan dokumen, verifikasi keabsahan katalog, realisasi pembayaran, atau keputusan pemenang. Harga di atas HPS boleh dicatat untuk evaluasi. Untuk SPSE gunakan Pusat Monitoring.</p></section>`;
}
function satriaHumanPaketOverview(){
  const list=paketListForView().filter(p=>!satriaSpseIs(p)&&!p.arsip);
  if(!list.length)return '';
  const todo=[];for(const p of list){if(satriaHumanStage(p).next)todo.push(p);if(todo.length===4)break;}
  return `<section class="satria-human-panel satria-human-overview" aria-label="Paket yang perlu ditindaklanjuti"><div class="satria-human-head"><div><h3>✦ Mulai dari pekerjaan yang perlu dilanjutkan</h3><p>Pilih paket di bawah. SATRIA menunjukkan data yang belum lengkap, bukan memutuskan hasil pengadaan.</p></div><span class="pill">${list.length} paket dalam filter</span></div>${todo.length?`<div class="satria-human-overview-list">${todo.map(p=>{const x=satriaHumanStage(p);return `<a class="satria-human-overview-item" href="#paket/${encodeURIComponent(p.id)}"><b>${esc(p.nama||p.rup||p.id)}</b><small>RUP ${esc(p.rup||'-')} · ${x.done}/${x.stages.length} indikator</small><span>Lanjutkan: ${esc(x.next.label)} →</span></a>`}).join('')}</div>`:`<p class="satria-human-note">Tidak ada indikator pekerjaan tertunda pada paket dalam filter. Tinjau dokumen dan bukti secara manual sebelum keputusan resmi.</p>`}</section>`;
}
document.addEventListener('click',function(e){
 const el=e.target.closest?.('[data-human-nav]');if(!el)return;
 e.preventDefault();
 const pid=String(el.dataset.pid||'');const p=P(pid);
 const scope=activeCloudScope();
 if(!p||satriaSpseIs(p)||(scope&&(!scope.opdIds.includes(String(p.opd))||!scope.years.includes(Number(p.tahun))))){toast('Paket ini tidak tersedia dalam cakupan akun.');return;}
 S.ui.tahun=Number(p.tahun);S.ui.opd=String(p.opd);
 if(el.dataset.humanNav==='dok'){
   S.ui.dpid=pid;S.ui.dok=el.dataset.doc||'dpp';S.ui.page='dok';
   if(location.hash!=='#dok')location.hash='#dok';else render();
 }else{
   S.ui.pid=pid;S.ui.ptab=el.dataset.tab||'data';S.ui.page='paket';
   const path='#paket/'+encodeURIComponent(pid);
   if(location.hash!==path)location.hash=path;else render();
   const f=el.dataset.focus||'';
   if(f)setTimeout(()=>{const node=[...document.querySelectorAll('[data-col="paket"][data-f]')].find(x=>String(x.dataset.id)===pid&&x.dataset.f===f);if(node){node.scrollIntoView({block:'center'});node.focus({preventScroll:true})}},130);
 }
});
