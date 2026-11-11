/* SATRIA operational integrity checks — pure, read-only, scope-in/scope-out.
 * No external data, network call, mutation, or automatic approval.
 * Caller MUST pass already-authorized Paket and Bank RUP collections.
 */
(function(root){
 'use strict';
 function asText(v){return String(v??'').trim();}
 function safeArray(v){return Array.isArray(v)?v:[];}
 function inspect(input={}){
  const packages=safeArray(input.packages),bank=safeArray(input.rupBank),suppliers=safeArray(input.suppliers);
  const suppliersById=new Set(suppliers.map(s=>asText(s?.id)).filter(Boolean));
  const rupById=new Map(bank.filter(r=>asText(r?.id)).map(r=>[asText(r.id),r]));
  const rupByKey=new Map();
  for(const r of bank){const key=[asText(r?.tahun),asText(r?.opd),asText(r?.rup)].join('|');if(!rupByKey.has(key))rupByKey.set(key,r);}
  const issues=[],usedPackageIds=new Set();
  function add(level,scope,p,code,message,action){issues.push({level,scope,p,code,message,action});}
  for(const p of packages){
   if(!p||typeof p!=='object')continue;
   const id=asText(p.id);
   if(!id||usedPackageIds.has(id))add('Tinggi','Identitas Paket',p,'DUPLICATE_PACKAGE_ID','ID Paket kosong atau berulang dalam cakupan','Periksa identitas paket sebelum mengubah data');
   if(id)usedPackageIds.add(id);
   const itemIds=new Set(),items=safeArray(p.items),offers=safeArray(p.penawaran),offerIds=new Set();
   const links=typeof input.links==='function'?safeArray(input.links(p)).map(asText).filter(Boolean):[];
   const matched=links.length?links.map(rid=>rupById.get(rid)).filter(Boolean):[rupByKey.get([asText(p.tahun),asText(p.opd),asText(p.rup)].join('|'))].filter(Boolean);
   if(links.length&&matched.length!==new Set(links).size){
    add('Tinggi','Relasi RUP',p,'LINKED_RUP_NOT_VISIBLE','Ada referensi Bank RUP yang tidak tersedia dalam cakupan ini','Periksa tautan RUP, OPD, dan tahun; jangan ubah otomatis');
   }
   if(matched.some(r=>asText(r.opd)!==asText(p.opd)||asText(r.tahun)!==asText(p.tahun))){
    add('Tinggi','Relasi RUP',p,'RUP_SCOPE_MISMATCH','Relasi RUP berbeda OPD atau tahun anggaran','Periksa relasi paket terhadap sumber RUP');
   }
   for(const it of items){
    const itemId=asText(it?.id);
    if(!itemId||itemIds.has(itemId))add('Tinggi','Rincian HPS',p,'DUPLICATE_ITEM_ID','ID rincian HPS kosong atau berulang','Periksa identitas dan urutan rincian; jangan hitung ulang otomatis');
    if(itemId)itemIds.add(itemId);
    const vol=Number(it?.vol),hs=Number(it?.hs);
    if(!Number.isFinite(vol)||vol<=0||!Number.isFinite(hs)||hs<0){
     add('Tinggi','Rincian HPS',p,'INVALID_HPS_VALUE','Volume atau harga satuan HPS tidak valid','Periksa rincian sumber dan nominal sebelum menerbitkan dokumen');
    }
   }
   for(const offer of offers){
    const oid=asText(offer?.id);
    if(!oid||offerIds.has(oid))add('Tinggi','Penawaran',p,'DUPLICATE_OFFER_ID','ID penawaran kosong atau berulang','Periksa identitas penawaran, hindari penetapan ulang');
    if(oid)offerIds.add(oid);
    if(offer?.pen&&!suppliersById.has(asText(offer.pen))){
     add('Sedang','Penawaran',p,'MISSING_SUPPLIER','Referensi penyedia tidak ditemukan pada Data Master yang dimuat','Periksa master penyedia dan batas akses; jangan mengganti nama otomatis');
    }
    for(const field of ['harga','nego']){
     const values=offer?.[field];if(!values||typeof values!=='object'||Array.isArray(values))continue;
     for(const [key,value] of Object.entries(values)){
      if(!itemIds.has(asText(key)))add('Sedang','Penawaran',p,'ORPHAN_OFFER_ITEM','Harga penawaran/negosiasi merujuk rincian yang tidak ada','Periksa relasi rincian dan penawaran tanpa mengubah histori');
      if(!Number.isFinite(Number(value))||Number(value)<0)add('Tinggi','Penawaran',p,'INVALID_OFFER_PRICE','Harga penawaran/negosiasi tidak valid','Periksa bukti harga dan angka asli');
     }
    }
   }
   if(p.pemenangId&&!offerIds.has(asText(p.pemenangId))){
    add('Tinggi','Penetapan',p,'MISSING_WINNER','Pemenang tercatat tetapi penawaran terkait tidak ditemukan','Periksa penetapan dan riwayat pemulihan sebelum membuat dokumen');
   }
  }
  const rank={'Tinggi':0,'Sedang':1,'Rendah':2};issues.sort((a,b)=>(rank[a.level]??3)-(rank[b.level]??3));
  return {issues,checked:packages.length,counts:{high:issues.filter(i=>i.level==='Tinggi').length,medium:issues.filter(i=>i.level==='Sedang').length},readOnly:true};
 }
 const api=Object.freeze({inspect,version:'1.0.0',readOnly:true});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SATRIA_OPERATIONAL_INTEGRITY=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null);
