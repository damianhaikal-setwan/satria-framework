
/* SATRIA NEXT 3.0.59 — private image storage. No images are saved as new Base64 data in business JSON.
   Supabase Storage bucket: satria-media (private). Uses authenticated user's session + RLS.
   Assets are referenced by satria-media://<organization>/<path>; cloud downloads are blob URLs in memory. */
(function(){
'use strict';
const BUCKET='satria-media';
const PREFIX='satria-media://';
const TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
const TRANSPARENT='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const resolved=new Map(), loading=new Map(), failures=new Map();
let sessionEpoch=0;
const getAccess=()=>window.SATRIA_MEDIA_GET_ACCESS?.()||{};
function newUuid(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=[...b].map(x=>x.toString(16).padStart(2,'0'));return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
}
const isRef=s=>typeof s==='string'&&s.startsWith(PREFIX)&&/^satria-media:\/\/[0-9a-f-]{36}\/(?:opd|shared)\//i.test(s);
const pathOf=s=>s.slice(PREFIX.length);
const setStatus=(text)=>{const el=document.getElementById('satria354-media-status');if(el)el.textContent=text};
function context(){
 const {client,member,orgId,cloudStateReady}=getAccess();
 if(!client||!member||!orgId||!cloudStateReady)throw Error('Login Supabase dan Tarik dari Supabase terlebih dahulu agar gambar tersimpan di cloud.');
 if(!/^[0-9a-f-]{36}$/i.test(String(orgId)))throw Error('Organization ID tidak valid.');
 return {client,member,orgId};
}
function mime(file){const type=String(file?.type||'').toLowerCase();if(!TYPES[type])throw Error('Gunakan foto PNG, JPG, atau WEBP saja.');if(!file.size||file.size>1024*1024)throw Error('Ukuran gambar harus 1 KB–1 MB.');return type}
function assetPath(kind,opts,access){
 if(!['product','ttd','cap','kop','logo'].includes(kind))throw Error('Jenis gambar tidak dikenal.');
 const uuid=newUuid();
 if(kind==='logo')return `${access.orgId}/shared/logo/${uuid}`;
 const opd=String(opts?.opd||'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(opd))throw Error('OPD gambar belum dipilih atau ID tidak valid.');
 if(kind==='product'){
   const year=Number(opts?.year);
   if(!Number.isInteger(year)||year<2000||year>2200)throw Error('Tahun paket tidak valid.');
   return `${access.orgId}/opd/${opd}/product/${year}/${uuid}`;
 }
 return `${access.orgId}/opd/${opd}/${kind}/${uuid}`;
}
async function upload(file,kind,opts={}){
 const c=context();if(c.member.role==='viewer')throw Error('Viewer tidak boleh mengunggah gambar.');
 if(kind!=='product'&&c.member.role!=='admin')throw Error('Hanya Admin Supabase dapat mengganti logo, kop, tanda tangan dan stempel master.');
 const type=mime(file);if(kind==='product'&&!opts?.evidence&&file.size>250*1024)throw Error('Foto Smart Survey maksimal 250 KB.');
 const path=assetPath(kind,opts,c)+'.'+TYPES[type];
 const {error}=await c.client.storage.from(BUCKET).upload(path,file,{contentType:type,upsert:false,cacheControl:'3600'});
 if(error)throw Error('Unggah Supabase Storage gagal: '+error.message+' — pastikan migrasi Storage sudah dijalankan dan akun memiliki hak OPD/tahun.');
 const ref=PREFIX+path;
 resolved.set(ref,URL.createObjectURL(file));
 return ref;
}
async function fromSource(s,kind,opts={}){
 if(isRef(s))return s;
 let blob;
 if(/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(s||'')){
   const response=await fetch(s);blob=await response.blob();
 }else if(/^https:\/\//i.test(s||'')){
   const response=await fetch(s,{mode:'cors'});
   if(!response.ok)throw Error('HTTP '+response.status);
   blob=await response.blob();
 }else throw Error('Sumber gambar tidak didukung; unggah PNG/JPG/WEBP langsung.');
 if(!TYPES[blob.type])throw Error('Sumber gambar bukan PNG, JPG atau WEBP.');
 return upload(blob,kind,opts);
}
async function ensure(ref){
 if(!isRef(ref))return ref;
 const c=context();
 if(!ref.startsWith(PREFIX+c.orgId+'/'))throw Error('Gambar milik organisasi lain.');
 if(resolved.has(ref))return resolved.get(ref);
 if(loading.has(ref))return loading.get(ref);
 const currentEpoch=sessionEpoch;
 const req=(async()=>{
   const {data,error}=await c.client.storage.from(BUCKET).download(pathOf(ref));
   if(error)throw Error('Gambar cloud tidak dapat diakses: '+error.message);
   if(currentEpoch!==sessionEpoch)throw Error('Sesi gambar telah berakhir.');
   const url=URL.createObjectURL(data);resolved.set(ref,url);failures.delete(ref);return url;
 })().finally(()=>loading.delete(ref));
 loading.set(ref,req);return req;
}
function processImage(img){
 const ref=img.getAttribute('src');if(!isRef(ref))return;
 img.dataset.satriaMediaRef=ref;
 img.src=resolved.get(ref)||TRANSPARENT;
 if(resolved.has(ref))return;
 ensure(ref).then(url=>{if(img.isConnected&&img.dataset.satriaMediaRef===ref){img.src=url;img.style.display='';img.style.opacity='1';}}).catch(e=>{
   failures.set(ref,String(e.message||e));console.warn('SATRIA media:',e);
   if(img.isConnected&&img.dataset.satriaMediaRef===ref){img.alt=(img.alt||'Gambar')+' — tidak dapat dimuat dari Supabase';}
   setStatus('Ada gambar cloud yang belum dapat dimuat. Cek login dan izin OPD.');
 });
}
function scan(root){if(root.nodeType!==1)return;
 if(root.matches?.('img[src^="satria-media://"]'))processImage(root);
 root.querySelectorAll?.('img[src^="satria-media://"]').forEach(processImage);
}
const observer=new MutationObserver(m=>{for(const item of m){if(item.type==='attributes')scan(item.target);else for(const n of item.addedNodes)scan(n)}});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
scan(document.documentElement);
function clear(){sessionEpoch++;for(const url of resolved.values())if(url.startsWith('blob:'))URL.revokeObjectURL(url);resolved.clear();loading.clear();failures.clear();setStatus('Keluar — cache gambar cloud dikosongkan.');}
function oldData(s){return /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(String(s||''));}
function oldRemote(s){return /^https:\/\//i.test(String(s||''));}
function countLegacy(){let n=0;
 const test=x=>{if(oldData(x)||oldRemote(x))n++};
 test(S.pemda?.logo);for(const o of S.opd||[])test(o.kop);
 for(const j of S.pejabat||[]){test(j.ttd);test(j.cap)}
 for(const p of S.paket||[])for(const w of p.penawaran||[])for(const ref of Object.values(w.catalogRefs||{}))test(ref?.imageUrl);
 return n;
}
async function migrate(){
 const c=context();if(c.member.role!=='admin')throw Error('Migrasi gambar lama hanya untuk Admin.');
 const total=countLegacy();if(!total){setStatus('Tidak ditemukan gambar lama yang perlu dipindahkan.');return;}
 if(!confirm(`Ada ${total} gambar lama (Base64/URL) yang akan dicoba unggah ke Supabase Storage. BACKUP JSON dulu sebelum memulai. Perubahan gambar akan disinkronkan sebagai referensi Storage. Lanjutkan?`))return;
 const errors=[];let done=0;const tasks=[];
 const queue=(label,old,kind,opts,assign)=>{if(oldData(old)||oldRemote(old))tasks.push({label,old,kind,opts,assign})};
 queue('Logo pemda',S.pemda?.logo,'logo',{},v=>S.pemda.logo=v);
 for(const o of S.opd||[])queue('Kop '+o.singkat,o.kop,'kop',{opd:o.id},v=>o.kop=v);
 for(const j of S.pejabat||[]){queue('TTD '+j.nama,j.ttd,'ttd',{opd:j.opd},v=>j.ttd=v);queue('Cap '+j.nama,j.cap,'cap',{opd:j.opd},v=>j.cap=v)}
 for(const p of S.paket||[])for(const w of p.penawaran||[])for(const ref of Object.values(w.catalogRefs||{}))queue('Foto produk '+(ref?.name||''),ref?.imageUrl,'product',{opd:p.opd,year:p.tahun},v=>ref.imageUrl=v);
 for(const t of tasks){try{t.assign(await fromSource(t.old,t.kind,t.opts));done++;setStatus(`Migrasi gambar: ${done}/${tasks.length} berhasil. ${errors.length} gagal.`)}catch(e){errors.push(t.label+': '+e.message)}}
 if(done){sync('settings','Migrasi referensi gambar ke Supabase Storage');if(typeof render==='function')render()}
 const message=`Migrasi selesai: ${done}/${tasks.length} berhasil, ${errors.length} gagal. Klik Sinkronkan perubahan dan pastikan status Tersinkron sebelum berpindah perangkat.`;
 setStatus(message);if(errors.length){console.warn('Gambar belum terunggah:',errors);alert(message+'\n\nGambar yang gagal tidak dihapus dari data lama. Lihat console untuk rincian.')}else alert(message);
}
function panel(){
 const parent=document.querySelector('#satriaCloudModal .sc-note')?.parentElement||document.querySelector('#satriaCloudModal');
 if(!parent||document.getElementById('satria354-media-panel'))return;
 const el=document.createElement('div');el.id='satria354-media-panel';el.className='sc-note';el.innerHTML=`<b>Media Cloud (Privat)</b><p style="margin:8px 0">Foto katalog, TTD, cap, logo, dan kop disimpan di bucket privat <code>${BUCKET}</code>. Data paket hanya menyimpan referensi berkas; tampilan dibuka memakai login dan hak OPD/tahun.</p><button type="button" id="satria354-migrate" class="primary">Migrasikan gambar lama ke Supabase</button><p id="satria354-media-status" role="status" aria-live="polite" style="font-size:12px;margin-top:8px">Jalankan migrasi SQL Storage terlebih dahulu. Lakukan backup JSON sebelum migrasi gambar lama.</p>`;
 parent.append(el);el.querySelector('button').onclick=()=>migrate().catch(e=>{setStatus(e.message);alert(e.message)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();
window.SATRIA_MEDIA=Object.freeze({upload,fromSource,ensure,isRef,clear,countLegacy,migrate});
// Highest priority during file selection: block old FileReader/Base64 implementation.
window.addEventListener('change',async ev=>{
 const t=ev.target;if(!(t instanceof HTMLInputElement)||t.type!=='file'||!t.files?.[0])return;
 const master=t.dataset.up,opdKop=t.dataset.kopup,logo=t.id==='logoFile';
 const photo=t.matches('[data-smart-photo]');if(!master&&!opdKop&&!logo&&!photo)return;
 ev.stopImmediatePropagation();ev.stopPropagation();
 const file=t.files[0];
 if(photo){
  const panel=t.closest('[data-smart-panel]');if(!panel)return;
  panel._smartFile=file;panel._smartImage='';
  const previous=panel._satriaPreviewURL;if(previous)URL.revokeObjectURL(previous);
  panel._satriaPreviewURL=URL.createObjectURL(file);
  const wrap=panel.querySelector('[data-smart-preview]');const img=wrap?.querySelector('img')||document.createElement('img');
  img.src=panel._satriaPreviewURL;img.alt='Foto produk yang akan diunggah';if(wrap&&!img.parentNode)wrap.prepend(img);
  const message=panel.querySelector('[data-smart-status]');if(message)message.textContent='Foto siap diunggah ke Supabase Storage saat Anda menekan Simpan.';
  return;
 }
 const label=master?'Gambar '+master:opdKop?'Kop OPD':'Logo pemda';
 try{
   if(!Array.isArray(S?.pejabat))throw Error('Data Master belum siap.');
   const x=master?S.pejabat.find(r=>String(r.id)===String(t.dataset.id)):null;
   const o=opdKop?S.opd.find(r=>String(r.id)===String(opdKop)):null;
   if(master&&!x||opdKop&&!o)throw Error('Record pejabat/OPD tidak ditemukan.');
   const ref=await upload(file,master|| (opdKop?'kop':'logo'),{opd:x?.opd||o?.id});
   if(master)x[master]=ref;else if(opdKop)o.kop=ref;else S.pemda.logo=ref;
   sync(master?'master':'settings',label+' tersimpan ke Supabase Storage');render();toast(label+' tersimpan ke cloud.');
 }catch(e){alert('Gambar belum disimpan: '+e.message);t.value='';}
},true);
// Smart Survey saves only after cloud upload succeeds. Prevents references to unpersisted local data.
window.addEventListener('click',async ev=>{
 const btn=ev.target.closest?.('[data-smart-action="save"]');if(!btn)return;
 if(btn._satriaMediaReady){btn._satriaMediaReady=false;return;}
 const p=btn.closest('[data-smart-panel]');if(!p)return;
 const file=p._smartFile,field=p.querySelector('[data-smart-field="imageUrl"]');
 if(!p.querySelector('[data-smart-field="name"]')?.value?.trim()||!(Number(String(p.querySelector('[data-smart-field="displayPrice"]')?.value||'').replace(/[^0-9]/g,''))>0))return;
 const source=field?.value?.trim()||'';
 const originalRef=S.paket?.find(x=>String(x.id)===String(p.dataset.pid))?.penawaran?.find(w=>String(w.id)===String(p.dataset.wid))?.catalogRefs?.[p.dataset.iid]?.imageUrl||'';
 if(!file&&!source)return;
 if(!file&&source===originalRef)return;
 ev.stopImmediatePropagation();ev.stopPropagation();ev.preventDefault();btn.disabled=true;
 try{
  const packet=S.paket.find(x=>String(x.id)===String(p.dataset.pid));if(!packet)throw Error('Paket tidak ditemukan.');
  const ref=file?await upload(file,'product',{opd:packet.opd,year:packet.tahun}):await fromSource(source,'product',{opd:packet.opd,year:packet.tahun});
  p._smartImage=ref;p._smartFile=null;
  if(field)field.value='';
  btn._satriaMediaReady=true;btn.disabled=false;btn.click();
 }catch(e){btn.disabled=false;const el=p.querySelector('[data-smart-status]');if(el)el.textContent='Gagal menyimpan foto di Supabase: '+e.message;alert('Foto tidak tersimpan. '+e.message+' Unggah foto langsung jika URL katalog tidak dapat diambil (CORS).');}
},true);
// Ensure print is not started while private images are unresolved.
window.addEventListener('click',ev=>{
 const btn=ev.target.closest?.('[data-act="print"]');if(!btn)return;
 const doc=document.querySelector('#dokLazyContainer .doc');if(!doc)return;
 const refs=[...doc.querySelectorAll('img[data-satria-media-ref]')].map(e=>e.dataset.satriaMediaRef);
 const pending=refs.filter(ref=>!resolved.has(ref));
 if(pending.length){ev.stopImmediatePropagation();ev.stopPropagation();ev.preventDefault();Promise.allSettled(pending.map(ensure)).then(()=>{scan(doc);alert('Gambar cloud telah diperiksa. Klik Cetak / Simpan PDF sekali lagi untuk memastikan foto dan tanda tangan ikut tercetak.');});alert('Menyiapkan '+pending.length+' gambar privat dari Supabase. Cetak akan tersedia setelah gambar selesai dimuat.');}
},true);
})();

