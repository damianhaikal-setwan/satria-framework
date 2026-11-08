/* SATRIA PWA: network-first, precache all refactored assets for offline use. */
const CACHE_NAME = 'satria-v3.0.59.40-source-supplier-20261108';
const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./frontend/refactor/maintenance/diagnostics.js",
  "./frontend/refactor/maintenance/care-center.js",
  "./frontend/refactor/maintenance/care-center.css",
  "./frontend/satria-next4.css",
  "./frontend/satria-next4.js",
  "./frontend/satria-operator-studio.css",
  "./frontend/satria-operator-studio.js",
  "./frontend/satria-price-analysis.css",
  "./frontend/satria-price-analysis.js",
  "./frontend/refactor/css/01-base-design.css",
  "./frontend/refactor/css/02-legacy-theme-print.css",
  "./frontend/refactor/css/03-dpp-control-panel.css",
  "./frontend/refactor/css/04-cloud-bridge.css",
  "./frontend/refactor/css/05-shell-mobile.css",
  "./frontend/refactor/css/06-genz-design.css",
  "./frontend/refactor/css/07-mobile-navigation.css",
  "./frontend/refactor/css/08-smart-survey-and-theme.css",
  "./frontend/refactor/css/09-seller-ui.css",
  "./frontend/refactor/css/10-survey-one-door.css",
  "./frontend/refactor/css/11-branding-photo.css",
  "./frontend/refactor/css/12-photo-controls.css",
  "./frontend/refactor/css/13-dpp-layout-and-print.css",
  "./frontend/refactor/css/14-dpp-pagination.css",
  "./frontend/refactor/css/15-dpp-quality-and-ppk.css",
  "./frontend/refactor/css/16-idkb.css",
  "./frontend/refactor/css/17-bahp-and-dpp-example.css",
  "./frontend/refactor/css/18-ops.css",
  "./frontend/refactor/css/19-executive-briefing.css",
  "./frontend/refactor/css/20-human-first.css",
  "./frontend/refactor/css/21-human-first-docs.css",
  "./frontend/refactor/css/22-briefing-visual.css",
  "./frontend/refactor/js/01-app-core.js",
  "./frontend/refactor/js/02-premium-ui.js",
  "./frontend/refactor/js/03-analytics-dashboard.js",
  "./frontend/refactor/js/05-cloud-sync.js",
  "./frontend/refactor/js/06-pwa-startup.js",
  "./frontend/refactor/js/07-cloud-config-bridge.js",
  "./frontend/refactor/js/08-satriaheaderheightsync.js",
  "./frontend/refactor/js/09-architecture-32-concepts.js",
  "./frontend/refactor/js/10-lifecycle-table.js",
  "./frontend/refactor/js/11-access-guard.js",
  "./frontend/refactor/js/12-document-field-navigation.js",
  "./frontend/refactor/js/13-data-validation.js",
  "./frontend/refactor/js/14-satria-document-print-engine-v31.js",
  "./frontend/refactor/js/15-satria-integrity-v32.js",
  "./frontend/refactor/js/16-satria-mobile-menu-334.js",
  "./frontend/refactor/js/17-satria-smart-survey-code.js",
  "./frontend/refactor/js/18-satria326-seller-correction.js",
  "./frontend/refactor/js/19-satria-359-smart-survey-pro.js",
  "./frontend/refactor/js/20-satria-survey-one-door-v1.js",
  "./frontend/refactor/js/21-satria-document-quality-engine-v340.js",
  "./frontend/refactor/js/22-satria-genz-shell-341.js",
  "./frontend/refactor/js/23-satria-351-photo-appendix-script.js",
  "./frontend/refactor/js/24-satria-354-cloud-media.js",
  "./frontend/refactor/js/25-satria-3594-dpp-validation.js",
  "./frontend/refactor/js/26-satria-3597-dpp-signature-controls.js",
  "./frontend/refactor/js/27-satria35914-doc-ppk-control.js",
  "./frontend/refactor/js/28-satria35917-idkb-preparer-control.js",
  "./frontend/refactor/js/29-satria-dpp-example-controls-20261102.js",
  "./frontend/refactor/js/30-satria-spse-monitor-v1.js",
  "./frontend/refactor/js/31-satria-ops-v2.js",
  "./frontend/refactor/js/32-satria-exec-brief-327.js",
  "./frontend/refactor/js/33-satria-human-first-flow-20261103.js",
  "./frontend/refactor/js/34-satria-human-first-spse-dok-20261103.js",
  "./frontend/refactor/js/35-satria-brief-hotfix-329-script.js"
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Atomic install: do not activate a release with missing JS/CSS assets.
      await cache.addAll(APP_ASSETS);
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      console.warn('[SATRIA PWA] Cache versi baru tidak lengkap; versi lama tetap dipakai.', error);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('satria-v') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/auth/') || url.search.includes('grant_type=password')) return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(async response => {
    if (response.ok) {
      const copy = response.clone();
      try { (await caches.open(CACHE_NAME)).put(request, copy).catch(() => {}); } catch (_) {}
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    // An HTML fallback must never masquerade as JavaScript/CSS.
    if (request.mode === 'navigate') return await caches.match('./index.html') || Response.error();
    return Response.error();
  }));
});
