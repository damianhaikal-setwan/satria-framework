

/* SATRIA 3.0.41 visual-only UI maintenance. Data, routing and document engines untouched. */
(function(){
 'use strict';
 const routeNames={dash:'Ringkasan Utama',paket:'Paket Pengadaan',kalk:'Kalkulator Nego',input:'Input RUP',dok:'Dokumen Pengadaan',lap:'Laporan dan Analisis',master:'Data Master',set:'Pengaturan Sistem',care:'Perawatan SATRIA',user:'Pengguna dan Hak Akses',panduan:'Panduan Penggunaan',chat:'Asisten SATRIA'};
 const apply=()=>{
  const page=(location.hash||'#dash').slice(1).split('/')[0]||'dash';
  document.body.dataset.satriaPage=page;
  const n=document.querySelector('#nav');
  if(n){n.setAttribute('aria-label','Navigasi utama SATRIA');
   n.querySelectorAll('a[href^="#"]').forEach(a=>{
    const target=(a.getAttribute('href')||'').slice(1).split('/')[0];
    a.setAttribute('aria-current',target===page?'page':'false');
   });
  }
  const btn=document.querySelector('#satriaMobileMenuToggle');
  if(btn){btn.setAttribute('aria-label','Buka atau tutup menu navigasi SATRIA');}
  document.title='SATRIA NEXT 3.0.59.39 | '+(routeNames[page]||'Integrated Government Intelligence Platform');
 };
 window.addEventListener('hashchange',apply);
 document.addEventListener('DOMContentLoaded',apply,{once:true});
 if(document.readyState!=='loading')apply();
})();

