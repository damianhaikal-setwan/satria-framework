/* ============================================================
 * SATRIA Framework 3.0 — Service Worker v3 (offline-first)
 * Peningkatan dari v2:
 *  1. Precache app shell per-file (satu file gagal tidak membatalkan semuanya).
 *  2. CDN (Dexie, D3, supabase-js, fonts) di-cache → app tetap hidup offline.
 *  3. Aset lokal: stale-while-revalidate (cepat + tetap segar).
 *  4. API Supabase: selalu network — data & auth tidak pernah di-cache.
 *  5. Navigasi offline fallback ke cache index.html.
 *  6. Background Sync tag 'satria-sync-queue' → minta page flush perubahan.
 * Naikkan versi CACHE setiap rilis agar cache lama ter-invalidasi.
 * ============================================================ */
const CACHE_NAME='satria-v3-offline-2026-10-24';
const CDN_CACHE='satria-v3-cdn';
const PRECACHE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN_LIMIT=150;

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE.map(u=>c.add(new Request(u,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME&&k!==CDN_CACHE).map(k=>caches.delete(k)));
    const cdn=await caches.open(CDN_CACHE);
    const reqs=await cdn.keys();
    if(reqs.length>CDN_LIMIT) await Promise.all(reqs.slice(0,reqs.length-CDN_LIMIT).map(r=>cdn.delete(r)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  const fetchP=fetch(request).then(res=>{
    if(res&&res.ok) cache.put(request,res.clone()).catch(()=>{});
    return res;
  }).catch(()=>null);
  if(cached){ fetchP.catch(()=>{}); return cached; }
  const fresh=await fetchP;
  return fresh||new Response('Offline',{status:503,statusText:'Offline'});
}

async function cacheFirst(request){
  const cache=await caches.open(CDN_CACHE);
  const cached=await cache.match(request);
  if(cached) return cached;
  const res=await fetch(request);
  if(res&&(res.ok||res.type==='opaque')) cache.put(request,res.clone()).catch(()=>{});
  return res;
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  let url; try{ url=new URL(req.url); }catch(_){ return; }

  // Jangan pernah intervensi Supabase (auth, RPC, storage): data harus segar.
  if(url.hostname.includes('supabase')) return;

  if(req.mode==='navigate'){
    e.respondWith(fetch(req).catch(async()=>
      (await caches.match('./index.html'))||
      new Response('<h1>Offline</h1><p>Halaman belum di-cache. Buka SATRIA sekali saat online lalu muat ulang.</p>',{headers:{'Content-Type':'text/html'}})));
    return;
  }
  if(url.origin===location.origin){
    e.respondWith(staleWhileRevalidate(req,CACHE_NAME));
    return;
  }
  if(/cdnjs|jsdelivr|d3js|fonts\.googleapis|fonts\.gstatic/.test(url.hostname)){
    e.respondWith(cacheFirst(req).catch(async()=>{
      const c=await caches.match(req);
      return c||Response.error();
    }));
  }
});

/* ---------- Sinkronisasi background ---------- */
self.addEventListener('sync',e=>{
  if(e.tag==='satria-sync-queue'){
    e.waitUntil((async()=>{
      const all=await self.clients.matchAll({includeUncontrolled:true,type:'window'});
      for(const cl of all) cl.postMessage({type:'satria:flush-sync-queue'});
    })());
  }
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
  if(e.data&&e.data.type==='REGISTER_SYNC'){
    if(self.registration.sync) self.registration.sync.register('satria-sync-queue').catch(()=>{});
  }
});