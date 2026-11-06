/* SATRIA maintenance bootstrap: read-only diagnostics; no network, no data repair, no cloud writes. */
(function () {
  'use strict';
  const MAX_EVENTS = 60;
  const events = [];
  const clean = value => String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').slice(0, 220);
  function log(kind, detail) {
    events.push(Object.freeze({kind, detail:clean(detail), time:new Date().toISOString()}));
    if (events.length > MAX_EVENTS) events.shift();
  }
  // Capture errors while the early dependencies/core are still being parsed.
  window.addEventListener('error', event => {
    if (event.target && event.target !== window) {
      const node = event.target;
      if (node.tagName === 'SCRIPT' || node.tagName === 'LINK') {
        try {
          const url = new URL(node.src || node.href, location.href);
          // Only a filename is recorded; do not log URLs, credentials or query strings.
          log('asset', url.pathname.split('/').pop() || '(tanpa nama)');
        } catch (_) { log('asset', '(tidak dapat dibaca)'); }
      }
      return;
    }
    log('javascript', event.error && event.error.name || event.message || 'Error tanpa detail');
  }, true);
  window.addEventListener('unhandledrejection', event => {
    log('promise', event.reason && event.reason.name || 'Unhandled promise rejection');
  });
  function inspect() {
    const scripts = Array.from(document.querySelectorAll('script[data-satria-refactor="script"]'));
    const styles = Array.from(document.querySelectorAll('link[data-satria-refactor="style"]'));
    const loadedStyles = styles.filter(node => !!node.sheet).length;
    const result = {
      version:'refactor-index-2026-11-06',
      status:events.length === 0 && styles.length === loadedStyles ? 'tidak ada error terdeteksi' : 'perlu diperiksa',
      scriptsExpected:scripts.length,
      stylesExpected:styles.length,
      stylesLoaded:loadedStyles,
      coreReady:typeof window.SATRIA === 'object',
      priceAnalysisReady:typeof window.SATRIA_PRICE_CORE?.analyze === 'function',
      errorCount:events.length,
      errors:events.slice()
    };
    return Object.freeze(result);
  }
  function downloadReport() {
    const report=inspect();
    const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url; anchor.download='SATRIA-Laporan-Diagnostik.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }
  window.SATRIA_MAINTENANCE=Object.freeze({inspect, downloadReport});
  // Reuse the existing Ctrl+Shift+D debug panel; no additional floating UI or business-state changes.
  document.addEventListener('DOMContentLoaded', () => {
    const actionBar=document.querySelector('#satriaDebug #sdExport')?.parentElement;
    if (!actionBar || document.getElementById('sdDiagnostics')) return;
    const button=document.createElement('button');
    button.id='sdDiagnostics';button.type='button';button.textContent='⬇ Diagnostik';
    button.title='Unduh pemeriksaan aset dan ringkasan error, tanpa data paket atau kredensial';
    button.addEventListener('click', downloadReport);
    actionBar.appendChild(button);
  }, {once:true});
})();
