/* SATRIA PWA status: observational only; never intercept or swallow sync errors. */
(function(){
  'use strict';
  try{
    if('serviceWorker' in navigator){
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('./sw.js')
          .catch(function(e){ console.warn('[SATRIA PWA] Registrasi gagal', e?.name || 'error'); });
      });
    }
    let deferredPrompt=null;
    window.addEventListener('beforeinstallprompt', function(e){
      e.preventDefault(); deferredPrompt=e;
      const b=document.getElementById('pwaInstallBanner');
      let dismissed=false;try{dismissed=!!localStorage.getItem('satria-pwa-dismissed')}catch(_){}
      if(b&&!dismissed)b.hidden=false;
    });
    const ib=document.getElementById('pwaInstallBtn');
    if(ib)ib.addEventListener('click',function(){
      if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}
      const b=document.getElementById('pwaInstallBanner');if(b)b.hidden=true;
    });
    const db=document.getElementById('pwaDismissBtn');
    if(db)db.addEventListener('click',function(){
      const b=document.getElementById('pwaInstallBanner');if(b)b.hidden=true;
      try{localStorage.setItem('satria-pwa-dismissed','1')}catch(_){}
    });
    function setSyncState(state,message){
      const badge=document.getElementById('satriaSyncBadge');
      const text=document.getElementById('syncBadgeText');
      if(!badge||!text)return;
      badge.hidden=false;badge.dataset.state=state;text.textContent=message;
    }
    function updateSyncState(){
      try{
        const health=window.SATRIA_SYNC_HEALTH?.inspect?.();
        if(!health||!health.configured)return; // Config alone is not proof of sync.
        if(health.online===false)setSyncState('error','📴 Offline — perubahan menunggu');
        else if(health.conflict)setSyncState('error','⚠️ Konflik data cloud');
        else if(!health.authenticated)setSyncState('idle','Masuk cloud untuk sinkronisasi');
        else if(!health.baselineLoaded)setSyncState('syncing','Menarik data cloud…');
        else if(health.inFlight)setSyncState('syncing','⏳ Mengirim perubahan…');
        else if(health.pending||health.retryScheduled)setSyncState('syncing','Perubahan belum tersinkron');
        else if(health.lastConfirmedAt)setSyncState('idle','✅ Data tersinkron');
        else setSyncState('idle','Cloud terhubung, belum ada konfirmasi sinkron');
      }catch(_){/* Status UI must not interfere with business operations. */}
    }
    window.addEventListener('online',updateSyncState);
    window.addEventListener('offline',updateSyncState);
    window.addEventListener('satria:cloud-session-reset',updateSyncState);
    window.addEventListener('load',updateSyncState);
    setInterval(function(){if(document.visibilityState!=='hidden')updateSyncState()},6000);
    updateSyncState();
  }catch(e){console.warn('[SATRIA PWA] Inisialisasi status gagal',e?.name||'error')}
})();
