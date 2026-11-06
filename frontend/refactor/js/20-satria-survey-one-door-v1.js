
/* SATRIA SMART SURVEY: UI orchestration only. No schema migration, no replacement of underlying save/media guards. */
(function(){'use strict';
let mode='simple'; // Per-session UI preference only. Never written to business data.
const drafts=new Map(),pending=new Map();
const str=v=>String(v??'');
const field=(p,k)=>p.querySelector('[data-smart-field="'+k+'"]');
const meta=(p,k)=>p.querySelector('[data-s59-field="'+k+'"]');
const val=(p,k)=>str(field(p,k)?.value).trim();
const money=n=>'Rp'+Math.round(Number(n)||0).toLocaleString('id-ID');
const amount=s=>{let z=str(s).trim().replace(/^rp\.?\s*/i,'').replace(/\s+/g,'');if(!z)return null;if(/^\d{1,3}(?:[.,]\d{3})+[.,]\d{2}$/.test(z))z=z.replace(/[.,]\d{2}$/,'');const x=z.replace(/[^\d]/g,'');return x?Number(x):null};
const key=p=>[p.dataset.pid,p.dataset.wid,p.dataset.iid].map(str).join('|');
const models=p=>{const x=S.paket?.find(x=>str(x.id)===str(p.dataset.pid)),w=x?.penawaran?.find(w=>str(w.id)===str(p.dataset.wid)),i=x?.items?.find(i=>str(i.id)===str(p.dataset.iid));return {x,w,i}};
function state(p,msg){const el=p.querySelector('[data-satria-survey-message]');if(el)el.textContent=msg;}
function refresh(p){const {i,w,x}=models(p);if(!i||!w||!x)return;const net=amount(val(p,'beforeTax')),tax=amount(val(p,'taxAmount'));const price=net!==null&&tax!==null?net+tax:null;const qty=Number(i.vol)||0,hps=Number(i.hs)||0,over=price!==null&&hps>0&&price>hps;
 const el=p.querySelector('[data-satria-survey-summary]');if(el){el.dataset.over=str(over);el.textContent=price===null?'Isi harga sebelum pajak dan PPN sesuai tayangan (boleh PPN Rp0 jika memang tercantum Rp0). Jangan menebak nilai yang belum diketahui.':('Harga tayang '+money(price)+' /unit × '+qty+' '+str(i.sat||'')+' = '+money(price*qty)+'. HPS satuan '+money(hps)+(over?' — DI ATAS HPS: tetap boleh dicatat, bukan otomatis pemenang.':' — periksa kesesuaian spesifikasi sebelum memilih penyedia.'));}
 const button=p.querySelector('[data-satria-survey-action="save-next"]');if(button){const index=x.items.findIndex(a=>str(a.id)===str(i.id));button.textContent=index>=0&&index<x.items.length-1?'Simpan Survei & Lanjut Barang Berikutnya':'Simpan Survei';}}
function applyMode(p){p.dataset.satriaSurveyMode=mode;for(const b of p.querySelectorAll('[data-satria-mode]'))b.setAttribute('aria-pressed',str(b.dataset.satriaMode===mode));refresh(p)}
function init(root){if(!root)return;const panels=root.matches?.('[data-smart-panel]')?[root]:Array.from(root.querySelectorAll?.('[data-smart-panel]')||[]);for(const p of panels){applyMode(p);}}
// A mode switch alters only CSS visibility. Fields remain mounted and input values are retained.
document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-satria-mode]');if(!b)return;const p=b.closest('[data-smart-panel]');if(!p)return;ev.preventDefault();ev.stopImmediatePropagation();mode=b.dataset.satriaMode==='full'?'full':'simple';for(const el of document.querySelectorAll('[data-smart-panel]'))applyMode(el);},true);
document.addEventListener('change',ev=>{const t=ev.target;if(!t.matches?.('[data-satria-survey-target]'))return;ev.stopImmediatePropagation();const p=t.closest('[data-smart-panel]');if(p)refresh(p);},true);
document.addEventListener('input',ev=>{const p=ev.target.closest?.('[data-smart-panel]');if(p&&ev.target.matches('[data-smart-field="beforeTax"],[data-smart-field="taxAmount"]'))refresh(p)},true);
function saveSessionDraft(p){const data={fields:{},meta:{},target:p.querySelector('[data-satria-survey-target]')?.value||'primary'};for(const el of p.querySelectorAll('[data-smart-field]'))data.fields[el.dataset.smartField]=el.value;for(const el of p.querySelectorAll('[data-s59-field]'))data.meta[el.dataset.s59Field]=el.value;drafts.set(key(p),data);state(p,'Draf disimpan di memori sesi ini saja. Belum masuk Bank Survei maupun Supabase.');}
function restoreSessionDraft(p){const d=drafts.get(key(p));if(!d){state(p,'Belum ada draf sesi untuk barang ini.');return}for(const [k,v] of Object.entries(d.fields)){const el=field(p,k);if(el)el.value=v;}for(const [k,v] of Object.entries(d.meta)){const el=meta(p,k);if(el)el.value=v;}const target=p.querySelector('[data-satria-survey-target]');if(target)target.value=d.target;field(p,'taxAmount')?.dispatchEvent(new Event('input',{bubbles:true}));refresh(p);state(p,'Draf sesi dimuat ke form. Periksa sebelum menyimpan sebagai referensi/pembanding.');}
function permitted(){return typeof canWrite!=='function'||canWrite()}
function execute(p,next){if(!permitted()){state(p,'Akun hanya-baca tidak dapat menyimpan survei.');return}
 const {x,w,i}=models(p);if(!x||!w||!i){state(p,'Paket atau rincian tidak ditemukan.');return}
 const target=p.querySelector('[data-satria-survey-target]')?.value==='candidate'?'candidate':'primary';const net=amount(val(p,'beforeTax')),tax=amount(val(p,'taxAmount'));
 if(!val(p,'name')||net===null||net<=0||tax===null||!Number.isSafeInteger(net+tax)||net+tax<=0){state(p,'Nama produk, harga sebelum pajak, dan nilai PPN harus jelas. Jika belum tersedia, klik Simpan draf sesi; data belum bisa menjadi referensi resmi.');return}
 const saved=w.catalogRefs?.[i.id];if(target==='primary'&&saved?.name&&!confirm('Produk aktif penyedia ini sudah tercatat. Perbarui harga tayangnya? Riwayat dicatat; HPS, negosiasi, dan pemenang tidak diganti otomatis.'))return;
 const seller=val(p,'seller').replace(/\s+/g,' ').toLowerCase(),actual=str(S.penyedia?.find(y=>str(y.id)===str(w.pen))?.nama).replace(/\s+/g,' ').toLowerCase();
 if(seller&&actual&&seller!==actual&&!confirm('Nama penyedia di katalog berbeda dari penyedia penawaran terpilih. Referensi akan tetap tersimpan dalam konteks penawaran '+actual+'. Sudah benar?'))return;
 if(target==='candidate'&&p._smartFile){state(p,'Foto produk yang dipilih masih menunggu unggah. Simpan sebagai produk aktif penyedia ini terlebih dahulu atau kosongkan pilihan foto untuk menyimpan pembanding.');return}
 const nativeButton=target==='primary'?p.querySelector('[data-smart-action="save"]'):p.querySelector('[data-s59-action="add-candidate"]');if(!nativeButton){state(p,'Fungsi simpan lama tidak tersedia; data belum diubah.');return}
 pending.set(key(p),{kind:target,next});state(p,'Memproses melalui penyimpanan SATRIA yang sudah ada; menunggu konfirmasi keberhasilan.');nativeButton.click();
}
document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-satria-survey-action]');if(!b)return;const p=b.closest('[data-smart-panel]');if(!p)return;ev.preventDefault();ev.stopImmediatePropagation();const act=b.dataset.satriaSurveyAction;
 if(act==='draft')saveSessionDraft(p);else if(act==='restore')restoreSessionDraft(p);else if(act==='save-next'||act==='save-only')execute(p,act==='save-next');},true);
// Only the existing native save functions emit this event, *after* a successful local business-data commit.
document.addEventListener('satria:survey-saved',ev=>{const d=ev.detail||{},k=[d.pid,d.wid,d.iid].map(str).join('|'),req=pending.get(k);if(!req||req.kind!==d.kind)return;pending.delete(k);const x=S.paket?.find(x=>str(x.id)===str(d.pid)),w=x?.penawaran?.find(w=>str(w.id)===str(d.wid));if(!x||!w)return;drafts.delete(k);if(req.next){const pos=x.items?.findIndex(i=>str(i.id)===str(d.iid))??-1,next=x.items?.[pos+1];if(next)w.surveyItemId=next.id;}
},true);
const observer=new MutationObserver(ms=>{for(const m of ms)for(const node of m.addedNodes)if(node.nodeType===1)init(node)});
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init(document),{once:true});else init(document);
window.SATRIA_SURVEY_SIMPLE=Object.freeze({getMode:()=>mode,summary:refresh,sessionDraftCount:()=>drafts.size});
})();
