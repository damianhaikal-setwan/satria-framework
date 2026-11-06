
// Premium UI Enhancements - Kapuas Flow v2
(function(){
  const root=document.documentElement;
  const btn=document.getElementById('themeToggle');
  const KEY='satria-theme';
  const getSys=()=>window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  function apply(t){
    const theme=t==='system'?getSys():t;
    root.setAttribute('data-theme', theme);
    if(btn) btn.textContent = theme==='dark' ? '☀' : '◐';
    try{ localStorage.setItem(KEY,t); }catch(e){}
  }
  let saved='system'; try{saved=localStorage.getItem(KEY)||'system';}catch(e){}
  apply(saved);
  if(btn) btn.addEventListener('click',()=>{
    const cur=root.getAttribute('data-theme');
    apply(cur==='dark'?'light':'dark');
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{
    try{ if((localStorage.getItem(KEY)||'system')==='system') apply('system'); }catch(e){}
  });
  function updateSlider(){
    const nav=document.getElementById('nav');
    const track=nav?.querySelector('.nav-track');
    const slider=document.getElementById('navSlider');
    if(!nav||!track||!slider) return;
    const active=track.querySelector('a.on');
    if(!active){ slider.style.opacity='0'; return; }
    slider.style.opacity='1';
    slider.style.left=active.offsetLeft+'px';
    slider.style.width=active.offsetWidth+'px';
  }
  function assignIcons(){
    const map={dash:'dash', paket:'paket', input:'paket', dok:'dok', lap:'lap', master:'master', set:'set', user:'user', panduan:'panduan', chat:'chat'};
    document.querySelectorAll('#nav a').forEach(a=>{
      const href=a.getAttribute('href')||'';
      const key=Object.keys(map).find(k=>href.includes(k))||href.replace('#','').split('/')[0];
      if(map[key]||key) a.setAttribute('data-icon', map[key]||key||'dash');
    });
  }
  function wrapTables(){
    document.querySelectorAll('table').forEach(tbl=>{
      if(tbl.closest('.table-wrap')||tbl.closest('.doc')) return;
      const wrap=document.createElement('div'); wrap.className='table-wrap';
      tbl.parentNode.insertBefore(wrap, tbl); wrap.appendChild(tbl);
    });
  }
  function enhanceKPI(){
    document.querySelectorAll('.kpi').forEach((k,i)=>{
      if(k.querySelector('.kpi-icon')) return;
      const top=k.querySelector('span');
      if(!top) return;
      const icons=['📦','💰','📊','🤝','✨'];
      const iconDiv=document.createElement('div'); iconDiv.className='kpi-icon'; iconDiv.textContent=icons[i%icons.length]||'📈';
      const topRow=document.createElement('div'); topRow.className='kpi-top';
      top.parentNode.insertBefore(topRow, top); topRow.appendChild(top); topRow.appendChild(iconDiv);
      if(!k.querySelector('.kpi-foot')){
        const foot=document.createElement('div'); foot.className='kpi-foot';
        foot.innerHTML='<span class="kpi-dot"></span> sinkron realtime • Kapuas Hulu';
        k.appendChild(foot);
      }
    });
  }
  if(window.render){
    const orig=window.render;
    window.render=function(){
      orig();
      requestAnimationFrame(()=>{
        const nav=document.getElementById('nav');
        const track=nav?.querySelector('.nav-track');
        if(track){
          const links=[...nav.querySelectorAll('a')];
          if(links.length && links[0].parentElement!==track){
            links.forEach(a=>track.appendChild(a));
          }
        }
        assignIcons(); updateSlider(); wrapTables(); enhanceKPI();
      });
    };
  }
  setTimeout(()=>{ assignIcons(); updateSlider(); wrapTables(); enhanceKPI(); }, 220);
  window.addEventListener('resize', updateSlider);
})();
