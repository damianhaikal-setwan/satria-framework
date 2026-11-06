
function syncHeaderH(){
  const h = document.querySelector('header');
  if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
}
window.addEventListener('resize', syncHeaderH);
window.addEventListener('load', syncHeaderH);
syncHeaderH();
