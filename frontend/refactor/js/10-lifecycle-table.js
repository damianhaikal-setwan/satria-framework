
(function(){
  window.satriaLifeRow = function(p){
    const s = SATRIA.lifecycle(p);
    const label = {draf:'Draf', berjalan:'Berjalan', lengkap:'Lengkap', arsip:'Diarsipkan'}[s] || s;
    const btn = s === 'arsip'
      ? `<button type="button" class="g" data-act="pulihkanPaket" data-id="${esc(p.id)}">Pulihkan dari arsip</button>`
      : `<button type="button" class="g" data-act="arsipPaket" data-id="${esc(p.id)}">Arsipkan paket</button>`;
    return `<div class="row" style="gap:8px;margin:8px 0;align-items:center"><span class="pill">Siklus: ${esc(label)}</span>${btn}</div>`;
  };
  document.addEventListener('change', e => {
    if(e.target && e.target.id === 'pLife'){ S.ui.plife = e.target.value; render(); }
  });
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act="arsipPaket"],[data-act="pulihkanPaket"]');
    if(!el) return;
    e.preventDefault();
    if(!canWrite()) return toast('Akun Viewer tidak dapat mengubah data');
    const fn = el.dataset.act === 'arsipPaket' ? SATRIA.archivePaket : SATRIA.restorePaket;
    fn(el.dataset.id);
    render();
  });
})();
