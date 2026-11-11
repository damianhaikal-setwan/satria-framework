/* SATRIA Tahap 5B — pure, side-effect-free delta synchronization engine.
 * Contract: makeDelta(base,target), applyDeltaToPayload(base,changes).
 * This file does not touch credentials, DOM, localStorage or cloud state.
 */
(function(root,factory){
  'use strict';
  const api=Object.freeze(factory());
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SATRIA_CLOUD_DELTA=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function cloneJson(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function payloadEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  const ARRAY_DELTAS=['rupBank','paket','opd','unit','pejabat','penyedia','akun','kode'];
  const SETTING_DELTAS=['pemda','meta','penomoran','tahun'];
  function rowKey(collection,row){return String(row?.id??row?.kode??'')}
  function makeDelta(base,target){
    const changes=[];
    for(const collection of ARRAY_DELTAS){
      const before=Array.isArray(base?.[collection])?base[collection]:[];
      const after=Array.isArray(target?.[collection])?target[collection]:[];
      const bm=new Map(),am=new Map();
      for(const row of before){const id=rowKey(collection,row);if(!id)throw new Error('Baseline cloud '+collection+' mempunyai baris tanpa ID. Periksa backup sebelum sinkronisasi.');if(bm.has(id))throw new Error('ID duplikat pada baseline '+collection+': '+id);bm.set(id,row)}
      for(const row of after){const id=rowKey(collection,row);if(!id)throw new Error('Data '+collection+' memiliki baris tanpa ID. Sinkronisasi dihentikan agar integritas data tidak rusak.');if(am.has(id))throw new Error('ID duplikat pada master '+collection+': '+id);am.set(id,row)}
      for(const [id,row] of bm){if(!am.has(id))changes.push({collection,op:'delete',id})}
      for(const [id,row] of am){if(!bm.has(id)||!payloadEqual(bm.get(id),row))changes.push({collection,op:'upsert',id,row:cloneJson(row)})}
    }
    for(const key of SETTING_DELTAS){if(!payloadEqual(base?.[key],target?.[key]))changes.push({collection:key,op:'replace',value:cloneJson(target?.[key])})}
    // Dependency order matters across bounded 50-row RPC batches:
    // unlink packages before deleting a Bank RUP, establish OPD/year before Bank RUP upserts,
    // and upsert referenced Bank RUP rows before packages.
    const deltaRank=c=>c.op==='delete'&&c.collection==='paket'?0
      :c.op==='delete'&&c.collection==='rupBank'?1
      :c.op==='upsert'&&c.collection!=='paket'&&c.collection!=='rupBank'?2
      :c.op==='replace'&&c.collection==='tahun'?3
      :c.op==='upsert'&&c.collection==='rupBank'?4
      :c.op==='replace'?5
      :c.op==='upsert'&&c.collection==='paket'?6
      :c.op==='delete'&&c.collection==='opd'?8
      :7;
    changes.sort((a,b)=>deltaRank(a)-deltaRank(b));
    return changes;
  }
  function applyDeltaToPayload(base,changes){
    if(!Array.isArray(changes))throw new Error('Delta cloud harus berupa daftar perubahan');
    const out=cloneJson(base||{});
    for(const change of changes){
      if(!change||!String(change.collection||''))throw new Error('Delta cloud tidak valid');
      if(change.op==='replace'&&!SETTING_DELTAS.includes(change.collection))throw new Error('Kolom konfigurasi delta tidak diizinkan');
      if(change.op!=='replace'&&(!ARRAY_DELTAS.includes(change.collection)||!['delete','upsert'].includes(change.op)))
        throw new Error('Operasi/koleksi delta tidak dikenal');
      if(change.op==='upsert'&&(rowKey(change.collection,change.row)!==String(change.id)||!String(change.id)))
        throw new Error('Identitas baris delta tidak konsisten');
      if(change.op==='replace'){out[change.collection]=cloneJson(change.value);continue}
      const rows=Array.isArray(out[change.collection])?out[change.collection].slice():[];
      const key=row=>rowKey(change.collection,row);
      const index=rows.findIndex(row=>key(row)===String(change.id));
      if(change.op==='delete'){if(index>=0)rows.splice(index,1)}
      else if(index>=0)rows[index]=cloneJson(change.row);else rows.push(cloneJson(change.row));
      out[change.collection]=rows;
    }
    return out;
  }
  return {cloneJson,payloadEqual,rowKey,makeDelta,applyDeltaToPayload,
    ARRAY_DELTAS:Object.freeze(ARRAY_DELTAS.slice()),SETTING_DELTAS:Object.freeze(SETTING_DELTAS.slice())};
});
