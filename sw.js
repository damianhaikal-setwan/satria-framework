const CACHE_NAME='satria-v3.0.59.37-product-price-comparison-v1';
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['./','./index.html','./frontend/satria-next4.css','./frontend/satria-next4.js','./frontend/satria-operator-studio.css','./frontend/satria-operator-studio.js','./frontend/satria-price-analysis.js','./frontend/satria-price-analysis.css']).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(u.hostname.includes('supabase.co') || u.pathname.includes('/auth/') || u.search.includes('grant_type=password')) return;
  if(e.request.method!=='GET') return;
  if(u.origin===location.origin){
    e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cl=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request, cl)).catch(()=>{}); } return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
  }
});
