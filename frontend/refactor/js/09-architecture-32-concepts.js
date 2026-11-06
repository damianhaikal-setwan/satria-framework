
/* ===== SATRIA CORE: lapisan arsitektur 32 konsep (hanya menambah kemampuan) ===== */
(function(){
const SATRIA = window.SATRIA = window.SATRIA || {};
const MAX_UNDO = 50, MAX_EVENTS = 1000, MAX_ERR = 50, IDEMPOTENCY_MS = 350;
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastRenderMs = 0;

/* [28] Service registry / dependency injection */
const services = new Map();
SATRIA.register = (name, impl) => { services.set(name, impl); return impl; };
SATRIA.resolve = name => { if(!services.has(name)) throw new Error('Service tidak terdaftar: ' + name); return services.get(name); };

/* [4] Event bus: jalur komunikasi antar modul */
const subs = new Map();
const bus = {
  on(evt, fn){ if(!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn); return () => subs.get(evt)?.delete(fn); },
  off(evt, fn){ subs.get(evt)?.delete(fn); },
  emit(evt, data){ for(const fn of [...(subs.get(evt) || [])]){ try { fn(data); } catch(e){ pushErr(e); } } }
};
SATRIA.bus = bus; SATRIA.register('bus', bus);

/* [22] Error handling & recovery: catat error tanpa menghentikan aplikasi */
const errorLog = [];
function pushErr(err){
  const msg = String((err && err.message) || err);
  errorLog.push({t: new Date().toLocaleTimeString('id-ID'), msg});
  if(errorLog.length > MAX_ERR) errorLog.shift();
  if(SATRIA.debug) console.warn('[SATRIA]', msg);
}
window.addEventListener('error', e => pushErr(e.error || e.message));
window.addEventListener('unhandledrejection', e => pushErr(e.reason));
SATRIA.errors = errorLog;

/* [21] Debounce & throttle */
SATRIA.debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; };
SATRIA.throttle = (fn, ms) => { let last = 0, t; return (...a) => { const left = ms - (Date.now() - last); if(left <= 0){ last = Date.now(); fn(...a); } else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...a); }, left); } }; };

/* [19] Memoization berbasis revisi data (cache otomatis tidak basi) */
let dataRev = 0;
const memoStore = new Map();
SATRIA.memo = (key, compute) => {
  const k = dataRev + '|' + key;
  if(memoStore.has(k)) return memoStore.get(k);
  const v = compute();
  if(memoStore.size > 100) memoStore.clear();
  memoStore.set(k, v);
  return v;
};

/* [8] Validasi & konsistensi: penjaga gerbang */
const validators = [];
SATRIA.addValidator = fn => validators.push(fn);
let warnings = [];
function collectIssues(){
  return validators.flatMap(v => { try { return v(S) || []; } catch(e){ return [{level:'error', msg:'Validator gagal: ' + e.message}]; } });
}
function refreshWarnings(){ warnings = collectIssues(); SATRIA.warnings = warnings; }
SATRIA.addValidator(state => {
  const keys=new Set(), out=[], byId=new Map((state.rupBank||[]).map(r=>[String(r.id),r]));
  for(const r of state.rupBank||[]){
    const key=rupBankKey(r);
    if(keys.has(key))out.push({level:'error',msg:'Entri Bank RUP ganda untuk '+r.rup+' / '+r.opd+' / '+r.tahun});
    keys.add(key);
  }
  for(const p of state.paket||[]){
    if(satriaRupLinks(p).length>1&&!satriaRupAlokasiDetail(p).complete)out.push({level:'warn',msg:'Paket konsolidasi '+p.id+' membutuhkan pembagian alokasi per RUP'});
    for(const id of satriaRupLinks(p)){
      const r=byId.get(String(id));
      if(!r)out.push({level:'error',msg:'Link RUP paket '+p.id+' tidak ditemukan: '+id});
      else if(String(p.opd)!==String(r.opd)||Number(p.tahun)!==Number(r.tahun))out.push({level:'error',msg:'Link RUP paket '+p.id+' berbeda OPD/tahun'});
    }
  }
  return out;
});
SATRIA.addValidator(state => {
 const issues=[];
 for(const rup of state.rupBank||[]){
   const status=satriaRupStatusAnggaran(rup,'',state);
   if(status.melebihi)issues.push({level:'error',msg:'Ada rincian paket yang melebihi pagu paket pada RUP '+rup.rup});
   if(!status.valid||status.allocated>status.batas)issues.push({level:'error',msg:'Total alokasi paket '+rp(status.allocated)+' melebihi pagu RUP '+rup.rup+' ('+rp(status.batas)+') untuk OPD/tahun '+rup.opd+'/'+rup.tahun});
 }
 return issues;
});
SATRIA.addValidator(state => {
  const n = (state.paket || []).filter(p => { if(satriaSpseIs(p))return false;const s = SATRIA.lifecycle(p); return s === 'berjalan' || s === 'draf'; }).length;
  return n ? [{level:'warn', msg: `${n} paket belum lengkap datanya`}] : [];
});

/* [9] Lifecycle data: draf → berjalan → lengkap → arsip */
SATRIA.lifecycle = p => {
  if(p.arsip) return 'arsip';
  if(!p.rup) return 'draf';
  let g; try { g = gaps(p); } catch(_){ g = ['gagal dihitung']; }
  return g.length ? 'berjalan' : 'lengkap';
};
SATRIA.archivePaket = id => SATRIA.tx('paket', 'Arsipkan paket', () => {
  const p = S.paket.find(x => String(x.id) === String(id)); if(!p) throw new Error('Paket tidak ditemukan'); p.arsip = true;
});
SATRIA.restorePaket = id => SATRIA.tx('paket', 'Pulihkan paket dari arsip', () => {
  const p = S.paket.find(x => String(x.id) === String(id)); if(!p) throw new Error('Paket tidak ditemukan'); p.arsip = false;
});

/* [3] Otomatisasi: aturan yang berjalan setelah setiap perubahan */
const rules = [];
SATRIA.addRule = (name, fn) => rules.push({name, fn});
let lengkapIds = null;
rules.push({name:'paket-lengkap', fn(){
  const now = new Set((S.paket || []).filter(p => SATRIA.lifecycle(p) === 'lengkap').map(p => p.id));
  if(lengkapIds) for(const id of now) if(!lengkapIds.has(id)){
    const p = S.paket.find(x => x.id === id);
    bus.emit('paket:lengkap', p);
    toast(`Paket "${p.nama || p.rup}" kini lengkap datanya`);
  }
  lengkapIds = now;
}});
function runRules(kind, label){ for(const r of rules){ try { r.fn({kind, label, S}); } catch(e){ pushErr(e); } } }

/* [12][29] Audit trail & event store (append-only, tersimpan bersama data) */
function logEvent(kind, label, extra){
  const actor = (typeof cur === 'function' ? cur() : null) || {};
  S.events = S.events || [];
  S.events.push({id: uid(), t: new Date().toISOString(), actor: actor.nama || '-', role: actor.role || '-', kind, label, ...(extra || {})});
  if(S.events.length > MAX_EVENTS) S.events.splice(0, S.events.length - MAX_EVENTS);
  dataRev++;
  refreshWarnings();
  runRules(kind, label);
  bus.emit('data:changed', {kind, label});
}
SATRIA.audit = (limit = 100) => (S.events || []).slice(-limit).reverse();
SATRIA.register('audit', {list: SATRIA.audit});

/* [25] Undo / Redo + [5][6] state terpusat: semua perubahan lewat sync() */
const undoStack = [], redoStack = [];
let lastSnap = null, snapRev = -1, snapPaketRef = null;
const snapshotJson = () => JSON.stringify({...persistable(), events: undefined});
function applySnapshot(json){
  const data = JSON.parse(json);
  const keep = {ui: S.ui, log: S.log, chat: S.chat, chatCtx: S.chatCtx, events: S.events};
  Object.assign(S, data, keep);
  normalizeData();
  dataRev++;
  lastSnap = snapshotJson(); snapRev = persistRevision; snapPaketRef = S.paket;
}
const cloudLocked = () => !!window.SATRIA_CLOUD_CONFIGURED;
function finishChange(kind, label){
  logEvent(kind, label);
  S.dirty = true; persistRevision++;
  schedulePersist(); render();
}
SATRIA.undo = () => {
  if(window.satriaCanEditPage && !satriaCanEditPage(S.ui.page)) return toast('Menu ini hanya dapat dibaca dengan peran Anda');
  if(cloudLocked()) return toast('Undo hanya tersedia pada mode lokal');
  if(!undoStack.length) return toast('Tidak ada aksi untuk dibatalkan');
  redoStack.push(snapshotJson());
  applySnapshot(undoStack.pop());
  finishChange('undo', 'Membatalkan perubahan terakhir');
};
SATRIA.redo = () => {
  if(window.satriaCanEditPage && !satriaCanEditPage(S.ui.page)) return toast('Menu ini hanya dapat dibaca dengan peran Anda');
  if(cloudLocked()) return toast('Redo hanya tersedia pada mode lokal');
  if(!redoStack.length) return toast('Tidak ada aksi untuk diulang');
  undoStack.push(snapshotJson());
  applySnapshot(redoStack.pop());
  finishChange('redo', 'Mengulang perubahan');
};
SATRIA.register('undo', {undo: SATRIA.undo, redo: SATRIA.redo, depth: () => ({undo: undoStack.length, redo: redoStack.length})});

const _sync = sync;
sync = function(k, label){
  _sync(k, label);
  const now = snapshotJson();
  if(lastSnap !== null && now !== lastSnap){
    undoStack.push(lastSnap);
    if(undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }
  lastSnap = now; snapRev = persistRevision; snapPaketRef = S.paket;
  logEvent(k, label);
  schedulePersist();
  // Cross-tab notice is sent ONLY after IndexedDB transaction commits.
};

const _render = render;
render = function(){
  const t0 = performance.now();
  const loaded = S && S.paket !== snapPaketRef;
  if(loaded) dataRev++;
  try { return _render.apply(this, arguments); }
  finally {
    lastRenderMs = performance.now() - t0;
    if(S && !S.dirty && (snapRev !== persistRevision || loaded)){ lastSnap = snapshotJson(); snapRev = persistRevision; }
    if(S) snapPaketRef = S.paket;
  }
};

/* [10] Transaksional & atomic: berhasil semua atau gagal semua */
const errorsOf = list => list.filter(i => i.level === 'error');
SATRIA.tx = function(kind, label, fn){
  const before = snapshotJson();
  const pre = new Set(errorsOf(collectIssues()).map(i => i.msg));
  try {
    const result = fn();
    const fresh = errorsOf(collectIssues()).filter(i => !pre.has(i.msg));
    if(fresh.length) throw new Error(fresh[0].msg);
    sync(kind, label);
    return result;
  } catch(e){
    applySnapshot(before);
    render();
    toast('Perubahan dibatalkan: ' + e.message);
    pushErr(e);
    return null;
  }
};
SATRIA.register('tx', SATRIA.tx);

/* [24] Concurrency: antrean penyimpanan agar tulisan tidak saling tabrakan */
let persistChain = Promise.resolve();
window.persistNow = function(){
  const run = persistChain.then(() => persistNowRaw());
  persistChain = run.catch(() => {});
  return run;
};

/* [26] Multi-tab sync: notify after commit; no unsafe snapshot overwrite. */
const TAB_ID=uid();
let channel=null;
if('BroadcastChannel' in window){
 channel=new BroadcastChannel('satria-framework-sync');
 channel.onmessage=ev=>{
  const m=ev.data||{};
  if(m.from===TAB_ID||m.kind!=='persisted')return;
  // Cloud users must refresh through authenticated, scoped Supabase pull/realtime.
  if(window.SATRIA_CLOUD_CONFIGURED)return;
  void (async()=>{
   if(ENGINE!=='dexie'||!DB)return;
   if(satriaLocalConflict||persistRevision>lastPersistedRevision){
    toast('Ada perubahan di tab lain. Cadangkan isian tab ini sebelum memuat ulang.');return;
   }
   try{
    const before=satriaLocalBaseStamp;
    const row=await DB.kv.get('main');
    const latest=row?(row.localStamp||'legacy:'+row.at):null;
    if(!row||latest===before)return;
    // Recheck after awaited read; edits made during the read must not be lost.
    if(persistRevision>lastPersistedRevision)return;
    await loadSaved();
    lastSnap=snapshotJson();snapRev=persistRevision;snapPaketRef=S.paket;dataRev++;render();
    toast('Data terbaru dari tab lain telah dimuat.');
   }catch(e){console.warn('Sinkron tab SATRIA gagal:',e)}
  })();
 };
}
function postSync(kind,stamp){if(kind==='persisted')channel?.postMessage({from:TAB_ID,kind,stamp,at:Date.now()});}
window.SATRIA_NOTIFY_LOCAL_PERSISTED=stamp=>postSync('persisted',stamp);

/* [27] Idempotency: klik ganda pada aksi yang sama diabaikan */
const lastClick = new Map();
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act]');
  if(!el) return;
  const key = el.dataset.act + '|' + (el.dataset.id || el.dataset.pid || el.dataset.d || '');
  const now = Date.now(), prev = lastClick.get(key) || 0;
  lastClick.set(key, now);
  if(now - prev < IDEMPOTENCY_MS){ e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

/* [16] Indexing: indeks token untuk pencarian paket tanpa memindai semua baris */
function buildPaketIndex(){
  const map = new Map();
  for(const p of S.paket || []){
    const words = `${p.rup || ''} ${p.nama || ''}`.toLocaleLowerCase('id-ID').split(/[\s,.;:()\/\-]+/).filter(Boolean);
    for(const w of words){ if(!map.has(w)) map.set(w, new Set()); map.get(w).add(p.id); }
  }
  return map;
}
SATRIA.searchPaketIds = q => {
  const words = String(q || '').trim().toLocaleLowerCase('id-ID').split(/\s+/).filter(Boolean);
  if(!words.length) return null;
  const idx = SATRIA.memo('paketIdx', buildPaketIndex);
  let result = null;
  for(const w of words){
    const hit = new Set();
    for(const [tok, ids] of idx) if(tok.includes(w)) for(const id of ids) hit.add(id);
    result = result ? new Set([...result].filter(id => hit.has(id))) : hit;
  }
  return result;
};

/* [31] Compression: ekspor backup terkompresi gzip (bila browser mendukung) */
SATRIA.exportCompressed = async function(){
  const json = JSON.stringify(persistable());
  let blob, name;
  if(typeof CompressionStream === 'function'){
    blob = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    name = 'SATRIA-Framework-3-0-backup.json.gz';
  } else {
    blob = new Blob([json], {type: 'application/json'});
    name = 'SATRIA-Framework-3-0-backup.json';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return {raw: json.length, packed: blob.size, name};
};

/* [23] Memory management: flush data & jalankan pembersihan saat halaman ditutup */
const cleanups = [];
SATRIA.onCleanup = fn => cleanups.push(fn);
if(channel) SATRIA.onCleanup(() => channel.close());
window.addEventListener('pagehide', () => {
  if(S && S.dirty && ENGINE === 'dexie'){ clearTimeout(pTimer); persistNow(); }
  cleanups.splice(0).forEach(f => { try { f(); } catch(_){} });
});

/* [32] Plugin system + theming + [1] modul terdaftar */
const themes = new Map();
SATRIA.theme = {
  register(name, vars){ themes.set(name, vars); },
  apply(name){
    const v = themes.get(name); if(!v) return false;
    for(const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    return true;
  },
  list: () => [...themes.keys()]
};
const plugins = new Map();
SATRIA.use = function(plugin){
  if(!plugin || !plugin.name) throw new Error('Plugin wajib memiliki name');
  if(plugins.has(plugin.name)) return false;
  const api = {
    on: bus.on, emit: bus.emit,
    addValidator: SATRIA.addValidator, addRule: SATRIA.addRule,
    theme: SATRIA.theme, register: SATRIA.register, resolve: SATRIA.resolve,
    tx: SATRIA.tx,
    read: () => JSON.parse(snapshotJson())   // salinan baca-saja; perubahan wajib lewat tx()
  };
  try { plugin.setup && plugin.setup(api); }
  catch(e){ pushErr(e); return false; }
  plugins.set(plugin.name, plugin);
  return true;
};

/* [32] Observability: panel debug (Ctrl+Shift+D) */
SATRIA.debug = false;
const panel = document.createElement('div');
panel.id = 'satriaDebug'; panel.hidden = true;
panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;width:340px;max-height:60vh;overflow:auto;background:#0f172a;color:#e2e8f0;font:12px/1.5 ui-monospace,monospace;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.35)';
panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>SATRIA Debug</b><button type="button" id="sdClose" style="background:none;border:0;color:#e2e8f0;cursor:pointer">✕</button></div><div id="sdBody"></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button type="button" id="sdUndo">↶ Undo</button><button type="button" id="sdRedo">↷ Redo</button><button type="button" id="sdExport">⬇ Backup terkompresi</button></div>';
document.body.appendChild(panel);
const body = panel.querySelector('#sdBody');
function renderDebug(){
  if(panel.hidden) return;
  const counts = {};
  for(const p of S.paket || []){ const s = SATRIA.lifecycle(p); counts[s] = (counts[s] || 0) + 1; }
  const rows = [
    ['Mesin penyimpanan', ENGINE],
    ['Revisi data', dataRev],
    ['Revisi persist (tertunda)', persistRevision + ' / ' + lastPersistedRevision],
    ['Undo / Redo', undoStack.length + ' / ' + redoStack.length],
    ['Event tersimpan', (S.events || []).length],
    ['Render terakhir', lastRenderMs.toFixed(1) + ' ms'],
    ['Siklus hidup', Object.entries(counts).map(([k, v]) => k + ': ' + v).join(', ') || '-'],
    ['Plugin', [...plugins.keys()].join(', ') || '-'],
    ['Tema', SATRIA.theme.list().join(', ') || '-']
  ];
  body.innerHTML =
    rows.map(([a, b]) => `<div><span style="color:#94a3b8">${esc(a)}:</span> ${esc(b)}</div>`).join('') +
    '<div style="margin-top:6px;color:#94a3b8">Peringatan:</div>' +
    (warnings.map(w => `<div style="color:${w.level === 'error' ? '#f87171' : '#fbbf24'}">• ${esc(w.msg)}</div>`).join('') || '<div>-</div>') +
    '<div style="margin-top:6px;color:#94a3b8">Audit terbaru:</div>' +
    (SATRIA.audit(5).map(e => `<div>${esc(new Date(e.t).toLocaleTimeString('id-ID'))} ${esc(e.actor)}: ${esc(e.label)}</div>`).join('') || '<div>-</div>') +
    '<div style="margin-top:6px;color:#94a3b8">Error terakhir:</div>' +
    (errorLog.slice(-3).map(e => `<div>${esc(e.t)} ${esc(e.msg)}</div>`).join('') || '<div>-</div>');
}
function setDebug(on){ SATRIA.debug = on; panel.hidden = !on; renderDebug(); }
SATRIA.setDebug = setDebug;
const debugTimer = setInterval(renderDebug, 1000);
SATRIA.onCleanup(() => clearInterval(debugTimer));
panel.querySelector('#sdClose').onclick = () => setDebug(false);
panel.querySelector('#sdUndo').onclick = () => SATRIA.undo();
panel.querySelector('#sdRedo').onclick = () => SATRIA.redo();
panel.querySelector('#sdExport').onclick = () => SATRIA.exportCompressed()
  .then(r => toast(`${r.name}: ${r.raw} → ${r.packed} byte`)).catch(pushErr);
SATRIA.register('debug', {setDebug, errors: errorLog});

document.addEventListener('keydown', e => {
  const k = (e.key || '').toLowerCase();
  if(e.ctrlKey && e.shiftKey && k === 'd'){ e.preventDefault(); setDebug(panel.hidden); return; }
  const ae = document.activeElement;
  const typing = !!ae && (/INPUT|TEXTAREA|SELECT/.test(ae.tagName) || ae.isContentEditable);
  if(typing || !(e.ctrlKey || e.metaKey) || e.altKey) return;
  if(k === 'z' && !e.shiftKey){ e.preventDefault(); SATRIA.undo(); }
  else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); SATRIA.redo(); }
});

/* Inisialisasi aman: boot() membuat S pada DOMContentLoaded. Jangan jalankan aturan yang membaca S sebelum state dibuat. */
if(S && Array.isArray(S.paket)){
  lastSnap = snapshotJson(); snapRev = persistRevision; snapPaketRef = S.paket;
  rules[0].fn({});
  refreshWarnings();
}
SATRIA.ready = true;
})();

