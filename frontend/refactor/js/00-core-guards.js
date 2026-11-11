/* SATRIA — testable local recovery guards; cloud recovery is handled separately
   by the transactional Supabase RPC contract, not by browser-only state. */
(function (root) {
 'use strict';
 const COLLECTIONS = Object.freeze(['paket', 'rupBank', 'pejabat', 'penyedia', 'unit', 'akun', 'kode', 'opd', 'users']);
 const EXTRAS=Object.freeze(['media','penawaran','item','tahun']);
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
 // Recover the original list order when possible; old archives without position
 // keep the historical append behavior. Clamp positions after unrelated edits.
 function recoverPosition(list,position,priorId,nextId) {
   const fallback=Number.isInteger(position)&&position>=0?Math.min(position,list.length):list.length;
   if(nextId!=null){const i=list.findIndex(x=>String(x.id)===String(nextId));if(i>=0)return i;}
   if(priorId!=null){const i=list.findIndex(x=>String(x.id)===String(priorId));if(i>=0)return Math.max(i+1,fallback);}
   return fallback;
 }
 function originalRank(visiblePosition,previousEntries){
   if(!Number.isInteger(visiblePosition)||visiblePosition<0)return visiblePosition;
   let rank=visiblePosition;
   for(const p of previousEntries.map(e=>e.position).filter(x=>Number.isInteger(x)&&x>=0).sort((a,b)=>a-b)){
     if(p<=rank)rank++;
   }
   return rank;
 }
 function requireParentScope(parent,record) {
   if(!record?.parentScope)return;
   if(String(parent.opd)!==String(record.parentScope.opd)||Number(parent.tahun)!==Number(record.parentScope.tahun))
     throw Error('OPD atau tahun paket induk berubah; pemulihan dibatalkan');
 }
 function validatePackageReferences(state,p) {
   const has=(key,id)=>!id||!Array.isArray(state[key])||state[key].some(x=>String(x.id)===String(id));
   if(!has('opd',p.opd))throw Error('OPD terkait belum dipulihkan');
   if(Array.isArray(state.tahun)&&p.tahun!=null&&!state.tahun.some(y=>Number(y)===Number(p.tahun)))
     throw Error('Tahun anggaran terkait belum dipulihkan');
   for(const id of [p.rupBankId,...(Array.isArray(p.rupBankIds)?p.rupBankIds:[])]){
     if(!has('rupBank',id))throw Error('Bank RUP terkait belum dipulihkan');
   }
   for(const field of ['ppk','pp','kabid'])if(!has('pejabat',p[field]))throw Error('Pejabat terkait belum dipulihkan');
   for(const field of ['unit','akunId'])if(!has(field==='akunId'?'akun':field,p[field]))throw Error('Data Master terkait belum dipulihkan');
   for(const w of Array.isArray(p.penawaran)?p.penawaran:[])if(!has('penyedia',w.pen))
     throw Error('Penyedia penawaran perlu dipulihkan terlebih dahulu');
 }
 function archive(state,collection,id,actor,at) {
   if (!COLLECTIONS.includes(collection)) throw Error('Koleksi Sampah tidak didukung');
   if (!Array.isArray(state[collection])) throw Error('Data aktif tidak tersedia');
   const position=state[collection].findIndex(row=>String(row?.id)===String(id));
   if (position<0) throw Error('Data tidak ditemukan pada koleksi aktif');
   if (!Array.isArray(state.sampah)) state.sampah=[];
   const row=state[collection][position];
   const entry={id:'trash-'+String(at||new Date().toISOString())+'-'+Math.random().toString(36).slice(2,12),
     collection,originalId:String(row.id),position:originalRank(position,state.sampah.filter(e=>e.collection===collection)),priorId:state[collection][position-1]?.id??null,nextId:state[collection][position+1]?.id??null,record:copy(row),deletedAt:at||new Date().toISOString(),deletedBy:String(actor||'-')};
   state.sampah.unshift(entry);
   state[collection].splice(position,1);
   return entry;
 }
 function archiveSpecial(state,kind,originalId,record,actor) {
   if (!EXTRAS.includes(kind)) throw Error('Jenis arsip tidak didukung');
   if (!Array.isArray(state.sampah)) state.sampah=[];
   const recordCopy=copy(record);
   if(['item','penawaran'].includes(kind)&&Number.isInteger(recordCopy.position))
     recordCopy.position=originalRank(recordCopy.position,state.sampah.filter(e=>e.collection===kind&&
       String(e.record?.paketId)===String(recordCopy.paketId)).map(e=>({position:e.record?.position})));
   const entry={id:'trash-'+new Date().toISOString()+'-'+Math.random().toString(36).slice(2,12),
     collection:kind,originalId:String(originalId),record:recordCopy,deletedAt:new Date().toISOString(),deletedBy:String(actor||'-')};
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
       requireParentScope(parent,r);
       parent.penawaran=parent.penawaran||[];
       if(parent.penawaran.some(w=>String(w.id)===String(r.offer.id)))throw Error('Penawaran dengan ID sama masih aktif');
       if(!(state.penyedia||[]).some(y=>String(y.id)===String(r.offer.pen)))throw Error('Penyedia perlu dipulihkan lebih dahulu');
       if(parent.penawaran.some(w=>String(w.pen)===String(r.offer.pen)))throw Error('Penyedia sudah memiliki penawaran aktif');
       if(r.itemsDigest!==undefined&&JSON.stringify(parent.items||[])!==r.itemsDigest)
         throw Error('Rincian/HPS berubah sejak penawaran diarsipkan; periksa data dan dokumen sebelum pemulihan');
       if(r.wasWinner&&parent.pemenangId!=null&&String(parent.pemenangId)!=='')
         throw Error('Pemenang baru sudah ditetapkan; tidak boleh ditimpa');
       parent.penawaran.splice(recoverPosition(parent.penawaran,r.position,r.priorId,r.nextId),0,copy(r.offer));
       if(r.wasWinner)parent.pemenangId=String(r.offer.id);
     } else if(entry.collection==='item') {
       const parent=(state.paket||[]).find(p=>String(p.id)===String(r.paketId));
       if(!parent||!r.item||String(r.item.id)!==String(entry.originalId))throw Error('Paket induk/rincian tidak valid');
       requireParentScope(parent,r);
       parent.items=parent.items||[];
       if(parent.items.some(i=>String(i.id)===String(entry.originalId)))throw Error('Rincian dengan ID sama masih aktif');
       const refs=Array.isArray(r.offerRefs)?r.offerRefs:[];
       // Validate EVERY dependent price reference before mutating anything.
       for(const ref of refs){
         const offer=(parent.penawaran||[]).find(w=>String(w.id)===String(ref.offerId));
         if(!offer)throw Error('Pulihkan penawaran penyedia terkait dahulu');
         for(const field of ['harga','nego','negoDetails','catalogRefs'])if(Object.prototype.hasOwnProperty.call(ref.values||{},field)
            &&Object.prototype.hasOwnProperty.call(offer[field]||{},String(r.item.id)))
           throw Error('Harga/bukti item sudah dipakai; pemulihan tidak boleh menimpa');
       }
       parent.items.splice(recoverPosition(parent.items,r.position,r.priorId,r.nextId),0,copy(r.item));
       for(const ref of refs){
         const offer=parent.penawaran.find(w=>String(w.id)===String(ref.offerId));
         for(const [field,value] of Object.entries(ref.values||{})){
           if(!['harga','nego','negoDetails','catalogRefs'].includes(field))continue;
           if(!offer[field])offer[field]={};
           offer[field][String(r.item.id)]=copy(value);
         }
       }
     }
     entries.splice(pos,1);
     return entry;
   }
   if (!COLLECTIONS.includes(entry.collection)||!Array.isArray(state[entry.collection])) throw Error('Jenis data tidak didukung');
   if (!entry.record||String(entry.record.id)!==String(entry.originalId)) throw Error('Catatan Sampah tidak konsisten');
   if (state[entry.collection].some(row=>String(row.id)===String(entry.originalId))) throw Error('ID sudah digunakan data aktif; pemulihan dibatalkan');
   if(entry.collection==='paket')validatePackageReferences(state,entry.record);
   if(entry.collection==='rupBank'){
     if(Array.isArray(state.opd)&&!state.opd.some(o=>String(o.id)===String(entry.record.opd)))throw Error('OPD Bank RUP belum dipulihkan');
     if(Array.isArray(state.tahun)&&!state.tahun.some(y=>Number(y)===Number(entry.record.tahun)))throw Error('Tahun Bank RUP belum dipulihkan');
   }
   state[entry.collection].splice(recoverPosition(state[entry.collection],entry.position,entry.priorId,entry.nextId),0,copy(entry.record));
   entries.splice(pos,1);
   return entry;
 }
 root.SATRIA_CORE_GUARDS=Object.freeze({imageSrc,csvCell,archive,archiveSpecial,restore,COLLECTIONS,EXTRAS});
})(typeof window!=='undefined'?window:globalThis);
