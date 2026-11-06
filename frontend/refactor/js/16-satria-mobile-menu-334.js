
(function(){
 const init=()=>{
  const nav=document.getElementById('nav');if(!nav||document.getElementById('satriaMobileMenuToggle'))return;
  const btn=document.createElement('button');btn.type='button';btn.id='satriaMobileMenuToggle';btn.className='satria-mobile-menu-button no-print';btn.setAttribute('aria-controls','nav');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span>☰ &nbsp; Menu SATRIA</span><span aria-hidden="true">▾</span>';
  nav.parentNode.insertBefore(btn,nav);
  const close=()=>{document.body.classList.remove('satria-mobile-nav-open');btn.setAttribute('aria-expanded','false');btn.lastElementChild.textContent='▾'};
  btn.addEventListener('click',()=>{const open=document.body.classList.toggle('satria-mobile-nav-open');btn.setAttribute('aria-expanded',String(open));btn.lastElementChild.textContent=open?'▴':'▾'});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
  window.addEventListener('resize',()=>{if(innerWidth>768)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
