
// SATRIA PWA Service Worker - Offline + Auto-sync support
const CACHE_NAME = 'satria-v3-2026-10-24';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/dexie/4.0.8/dexie.min.js',
  'https://d3js.org/d3.v7.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', (e)=>{
  console.log('[SW] Install', CACHE_NAME);
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(URLS_TO_CACHE.map(u=>new Request(u,{mode:'no-cors'}))).catch(err=>console.warn('[SW] Cache addAll partial fail', err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  console.log('[SW] Activate');
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  // Jangan cache Supabase API calls - biar selalu fresh & auto-sync
  if(url.hostname.includes('supabase.co') || url.pathname.includes('satria_state') || url.pathname.includes('satria_sync')){
    return; // network only
  }
  // Untuk CDN, cache-first
  if(url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('d3js.org')){
    e.respondWith(caches.match(e.request).then(r=>r || fetch(e.request).then(res=>{ const clone=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request, clone)); return res; })));
    return;
  }
  // Untuk app sendiri, network-first dengan fallback cache (agar HP tetap bisa buka offline)
  if(url.origin === location.origin){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r || caches.match('./index.html'))));
  }
});

// Background sync untuk Supabase (jika browser support)
self.addEventListener('sync', (e)=>{
  if(e.tag === 'satria-supabase-sync'){
    console.log('[SW] Background sync triggered');
    e.waitUntil(self.clients.matchAll().then(clients=>{ clients.forEach(c=>c.postMessage({type:'SYNC_REQUEST'})); }));
  }
});
