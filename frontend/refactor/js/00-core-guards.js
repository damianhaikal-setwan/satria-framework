/* SATRIA — small, testable safety and reversible-delete foundation.
   Do not turn local recovery into a cloud guarantee: server contract has no trash delta yet. */
(function (root) {
 'use strict';
 const COLLECTIONS = Object.freeze(['paket', 'rupBank', 'pejabat', 'penyedia', 'unit', 'akun', 'kode', 'opd', 'users']);
 const EXTRAS=Object.freeze(['media','penawaran','tahun']);
 function imageSrc(value) {
   const raw=typeof value==='string'?value.trim():'';
   if (!raw || raw.length>2_000_000 || /[\u0000-\u001f\u007f]/.test(raw)) return '';
   if (/^data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw.replace(/\s/g,'');
   try {
     const url=new URL(raw, 'https://satria.invalid');
     if (url.protocol==='https:' && raw.startsWith('https://') && !url.username && !url.password) return raw;
   } catch (_) { /* untrusted URL */ }
   return '';
 }
 function csvCell(value) {
   let v=String(value??'').replace(/\r\n?|\n/g,' ');
   if (/^[\s\uFEFF]*[=+@-]/.test(v)) v="'"+v;
   return '"'+v.replace(/"/g,'""')+'"';
 }
 function copy(value) { return JSON.parse(JSON.stringify(value)); }
 function archive(state,collection,id,actor,at) {
   if (!COLLECTIONS.includes(collection)) throw Error('Koleksi Sampah tidak didukung');
   if (!Array.isArray(state[collection])) throw Error('Data aktif tidak tersedia');
   const position=state[collection].findIndex(row=>String(row?.id)===String(id));
   if (position<0) throw Error('Data tidak ditemukan pada koleksi aktif');
   if (!Array.isArray(state.sampah)) state.sampah=[];
   const row=state[collection][position];
   const entry={id:'trash-'+String(at||new Date().toISOString())+'-'+Math.random().toString(36).slice(2,12),
     collection,originalId:String(row.id),record:copy(row),deletedAt:at||new Date().toISOString(),deletedBy:String(actor||'-')};
   state.sampah.unshift(entry);
   state[collection].splice(position,1);
   return entry;
 }
 function archiveSpecial(state,kind,originalId,record,actor) {
   if (!EXTRAS.includes(kind)) throw Error('Jenis arsip tidak didukung');
   if (!Array.isArray(state.sampah)) state.sampah=[];
   const entry={id:'trash-'+new Date().toISOString()+'-'+Math.random().toString(36).slice(2,12),
     collection:kind,originalId:String(originalId),record:copy(record),deletedAt:new Date().toISOString(),deletedBy:String(actor||'-')};
   state.sampah.unshift(entry);
   return entry;
 }
 function restore(state,entryId) {
   const entries=Array.isArray(state.sampah)?state.sampah:[];
   const pos=entries.findIndex(entry=>String(entry.id)===String(entryId));
   if (pos<0) throw Error('Data Sampah tidak ditemukan');
   const entry=entries[pos];
   if (EXTRAS.includes(entry.collection)) {
     const r=entry.record||{};
     if (entry.collection==='media') {
       const target=r.owner==='pemda'?state.pemda:r.owner==='opd'?(state.opd||[]).find(o=>String(o.id)===String(r.opdId)):null;
       const field=r.owner==='pemda'?'logo':'kop';
       if(!target||typeof r.value!=='string'||target[field])throw Error('Identitas/media masih dipakai atau induk tidak tersedia');
       target[field]=r.value;
     } else if(entry.collection==='tahun') {
       if(!Number.isInteger(r.year)||r.year<2000||r.year>2200||(state.tahun||[]).includes(r.year))throw Error('Tahun tidak valid atau sudah aktif');
       state.tahun.push(r.year);state.tahun.sort((a,b)=>a-b);
     } else if(entry.collection==='penawaran') {
       const parent=(state.paket||[]).find(p=>String(p.id)===String(r.paketId));
       if(!parent||!r.offer||!r.offer.id)throw Error('Paket induk tidak tersedia');
       parent.penawaran=parent.penawaran||[];
       if(parent.penawaran.some(w=>String(w.id)===String(r.offer.id)))throw Error('Penawaran dengan ID sama masih aktif');
       if(!(state.penyedia||[]).some(y=>String(y.id)===String(r.offer.pen)))throw Error('Penyedia perlu dipulihkan lebih dahulu');
       parent.penawaran.push(copy(r.offer));
       // Winner stays unset; the operator must choose again based on current calculations.
     }
     entries.splice(pos,1);
     return entry;
   }
   if (!COLLECTIONS.includes(entry.collection)||!Array.isArray(state[entry.collection])) throw Error('Jenis data tidak didukung');
   if (!entry.record||String(entry.record.id)!==String(entry.originalId)) throw Error('Catatan Sampah tidak konsisten');
   if (state[entry.collection].some(row=>String(row.id)===String(entry.originalId))) throw Error('ID sudah digunakan data aktif; pemulihan dibatalkan');
   state[entry.collection].push(copy(entry.record));
   entries.splice(pos,1);
   return entry;
 }
 root.SATRIA_CORE_GUARDS=Object.freeze({imageSrc,csvCell,archive,archiveSpecial,restore,COLLECTIONS,EXTRAS});
})(typeof window!=='undefined'?window:globalThis);
