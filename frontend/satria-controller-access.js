// SATRIA P2: navigation and local UI role gating. Database RLS remains the security boundary.
/* ===== ROLE & HAK AKSES ===== */
const ROLE_PAGES={Operator:['sampah','dash','paket','kerja','kalk','input','spse','monitor','finance','quality','care','brief','satria360','analisa','dok','lap','master','panduan','chat'],Viewer:['sampah','dash','paket','kerja','kalk','spse','monitor','finance','quality','care','brief','satria360','analisa','dok','lap','panduan','chat']};
const WRITE=['newpaket','rupsave','rupimport','rupmanualsave','rupclasssave','copy','delpaket','additem','delitem','delpw','winner','autowin','correctOfferProvider','saveHpsTotalReview','removeHpsTotalReview','addrow','delrow','addopd','addyear','delyear','rmlogo','reset','addunit','madd','mtoggle','medit','uadd','utoggle','udel','clearsample','rmkop','satriaFixDemoSub','trashrestore'];
const cur=()=>S.users.find(u=>u.id===S.ui.user)||{role:'Viewer',nama:'-'};
const allowed=k=>{const r=cur().role;return !ROLE_PAGES[r]||ROLE_PAGES[r].includes(k)};
const canWrite=()=>cur().role!=='Viewer';
const isLastAdmin=id=>{const u=S.users.find(x=>x.id===id);return !!u&&u.role==='Admin'&&u.aktif!==false&&S.users.filter(x=>x.role==='Admin'&&x.aktif!==false).length<=1};
