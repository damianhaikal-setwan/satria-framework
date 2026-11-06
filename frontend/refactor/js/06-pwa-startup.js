
// PWA Safe
(function(){
  try{
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if('serviceWorker' in navigator){
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('./sw.js').then(function(r){ console.log('[PWA] SW', r.scope); }).catch(function(e){ console.warn('SW fail', e); });
      });
    }
    let deferredPrompt=null;
    window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferredPrompt=e; const b=document.getElementById('pwaInstallBanner'); if(b && !localStorage.getItem('satria-pwa-dismissed')) b.hidden=false; });
    const ib=document.getElementById('pwaInstallBtn'); if(ib) ib.addEventListener('click', function(){ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; } const b=document.getElementById('pwaInstallBanner'); if(b) b.hidden=true; });
    const db=document.getElementById('pwaDismissBtn'); if(db) db.addEventListener('click', function(){ const b=document.getElementById('pwaInstallBanner'); if(b) b.hidden=true; try{localStorage.setItem('satria-pwa-dismissed','1');}catch(_){} });
    function setSyncState(s,t){ const b=document.getElementById('satriaSyncBadge'), tx=document.getElementById('syncBadgeText'); if(!b||!tx) return; b.hidden=false; b.dataset.state=s; tx.textContent=t; if(s==='idle') setTimeout(function(){b.hidden=true;},3500); }
    let hookInt=setInterval(function(){
      if(typeof window.SATRIA_AUTO_SYNC_REQUEST==='function' && !window.__satriaSyncHooked){
        const orig=window.SATRIA_AUTO_SYNC_REQUEST;
        window.SATRIA_AUTO_SYNC_REQUEST=function(k,l){ setSyncState('syncing','⏳ Sync...'); try{orig(k,l);}catch(e){} };
        window.__satriaSyncHooked=true; clearInterval(hookInt);
      }
    },800);
    setTimeout(function(){clearInterval(hookInt);},15000);
    window.addEventListener('online', function(){ setSyncState('idle','🌐 Online'); });
    window.addEventListener('offline', function(){ setSyncState('error','📴 Offline di HP'); });
    setTimeout(function(){
      try{
        const hasConfig=!!localStorage.getItem('satria-supabase-bridge-config-v1') || (window.SATRIA_EMBEDDED_SUPABASE_CONFIG && window.SATRIA_EMBEDDED_SUPABASE_CONFIG.url);
        if(hasConfig) setSyncState('idle','✅ Auto-sync aktif');
      }catch(_){}
    },2500);
  }catch(e){ console.warn('PWA init', e); }
})();
