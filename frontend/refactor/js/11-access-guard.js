
(function(){
  /* Kunci operasional: w = boleh ubah, r = hanya baca, kosong = tidak boleh akses */
  const LOCK = {
    input:  {Admin:'rw', Operator:'rw', Viewer:''},
    paket:  {Admin:'rw', Operator:'rw', Viewer:'r'},
    kerja:  {Admin:'rw', Operator:'rw', Viewer:'r'},
    dok:    {Admin:'rw', Operator:'rw', Viewer:'r'},
    master: {Admin:'rw', Operator:'r',  Viewer:'r'},
    set:    {Admin:'rw', Operator:'r',  Viewer:'r'}
  };
  const WRITE_ACT = /new|add|tambah|save|simpan|del|hapus|remove|reset|import|impor|copy|edit|update|assign|create|archiv|arsip|pulih|upload|toggle/i;
  const FREE_CONTROL = /^(qPaket|mSearch|pLife|selPaket)$/;
  const role = () => (typeof cur === 'function' && cur().role) || 'Viewer';
  function canEditPage(page){ const m = LOCK[page]; if(!m) return true; return (m[role()] || '').includes('w'); }
  const locked = () => !canEditPage(S.ui.page);
  window.satriaCanEditPage = canEditPage;
  const MSG = 'Menu ini hanya dapat dibaca dengan peran Anda';

  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act]');
    if(!el || !locked() || !WRITE_ACT.test(el.dataset.act)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    toast(MSG);
  }, true);

  const guardField = e => {
    const t = e.target;
    if(!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || !locked()) return;
    if(FREE_CONTROL.test(t.id) || (t.closest && t.closest('.no-print,.satria-dok-toolbar'))) return;
    e.stopImmediatePropagation();
    toast(MSG);
    setTimeout(() => render(), 0);
  };
  document.addEventListener('input', guardField, true);
  document.addEventListener('change', guardField, true);

  const _render = render;
  render = function(){
    const out = _render.apply(this, arguments);
    const isLocked = locked();
    let badge = document.getElementById('satriaRoLock');
    if(!badge){
      badge = document.createElement('div');
      badge.id = 'satriaRoLock';
      badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:999px;padding:6px 12px;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.12)';
      document.body.appendChild(badge);
    }
    badge.hidden = !isLocked;
    badge.textContent = 'Mode baca saja · peran ' + role();
    if(isLocked) document.querySelectorAll('[data-act]').forEach(b => {
      if(WRITE_ACT.test(b.dataset.act)){ b.disabled = true; b.title = MSG; }
    });
    return out;
  };
})();
