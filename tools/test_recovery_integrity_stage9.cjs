'use strict';
// Regression uses real local archive/restore helpers; no user data or Supabase access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../frontend/refactor/js/00-core-guards.js');
const api=globalThis.SATRIA_CORE_GUARDS;
const root=path.resolve(__dirname,'..');
const original=()=>({
  opd:[{id:'opd1'}],tahun:[2026],rupBank:[{id:'rup1',opd:'opd1',tahun:2026},{id:'rup2',opd:'opd1',tahun:2026}],
  pejabat:[{id:'ppk1',opd:'opd1'}],penyedia:[{id:'v1'},{id:'v2'}],unit:[],akun:[],
  paket:[{id:'p0',opd:'opd1',tahun:2026,items:[],penawaran:[]},
    {id:'p1',nama:'Pengadaan uji',opd:'opd1',tahun:2026,rupBankId:'rup1',ppk:'ppk1',
      items:[{id:'i1',nama:'Buku',hs:1000,vol:2},{id:'i2',nama:'Kertas',hs:500,vol:3},{id:'i3',nama:'Pensil',hs:300,vol:4}],
      penawaran:[{id:'w1',pen:'v1',harga:{i1:1100,i2:550,i3:330},nego:{i1:1000,i2:500,i3:300}},
       {id:'w2',pen:'v2',harga:{i1:1200,i2:600,i3:350},nego:{i1:1100,i2:550,i3:310}}],
      pemenangId:'w1',tglBahp:'2026-11-10',tglDpp:'2026-11-09',docPpkSettings:{bahp:{ppkId:'ppk1'}}},
    {id:'p2',opd:'opd1',tahun:2026,items:[],penawaran:[]}],sampah:[]
});
const snapshot=x=>JSON.stringify(x);
const findP=s=>s.paket.find(p=>p.id==='p1');
function ids(a){return a.map(x=>x.id)}
// Package: exact source row, numbering, docs, HPS fields and original position.
{
 const s=original(), row=snapshot(findP(s)), entry=api.archive(s,'paket','p1','Tester');
 assert.equal(entry.position,1);assert.deepEqual(ids(s.paket),['p0','p2']);
 api.restore(s,entry.id);assert.deepEqual(ids(s.paket),['p0','p1','p2']);
 assert.equal(snapshot(findP(s)),row,'Documents and HPS values must remain byte-identical at JSON serialization level');
}
// Adjacent package archives recovered in either order use saved sibling anchors.
for(const recoveryOrder of [['p1','p2'],['p2','p1']]){
 const s=original(),e1=api.archive(s,'paket','p1','Tester'),e2=api.archive(s,'paket','p2','Tester');
 const entries={p1:e1,p2:e2};
 for(const id of recoveryOrder)api.restore(s,entries[id].id);
 assert.deepEqual(ids(s.paket),['p0','p1','p2'],`Adjacent recovery ${recoveryOrder} should preserve original sequence`);
}
// Missing supplier/master/RUP blocks a restore before touching the trash or package arrays.
{
 const s=original(),entry=api.archive(s,'paket','p1','Tester');s.rupBank=[];
 const before=snapshot(s);
 assert.throws(()=>api.restore(s,entry.id),/Bank RUP/);
 assert.equal(snapshot(s),before,'No partial restore on failed dependency check');
 s.rupBank=[{id:'rup1',opd:'opd1',tahun:2026}];api.restore(s,entry.id);
 assert.equal(findP(s).rupBankId,'rup1');
}
// Nested item restores in place, evidence preserved, stale/missing providers blocked.
{
 const s=original(),p=findP(s),it=p.items[1];const entry=api.archiveSpecial(s,'item',it.id,
  {paketId:p.id,item:it,position:1,parentScope:{opd:p.opd,tahun:p.tahun},offerRefs:[]},'Tester');
 p.items.splice(1,1);api.restore(s,entry.id);
 assert.deepEqual(ids(p.items),['i1','i2','i3']);
 assert.equal(p.items[1].hs,500);assert.equal(p.penawaran[0].nego.i2,500);
}
// Deleted winner preserves its former position and status ONLY while HPS is unchanged.
{
 const s=original(),p=findP(s),offer=p.penawaran[0];const archived=snapshot(offer);
 const entry=api.archiveSpecial(s,'penawaran','w1',
  {paketId:p.id,offer,position:0,wasWinner:true,itemsDigest:snapshot(p.items),parentScope:{opd:p.opd,tahun:p.tahun}},'Tester');
 p.penawaran.splice(0,1);p.pemenangId=null;
 api.restore(s,entry.id);
 assert.deepEqual(ids(p.penawaran),['w1','w2']);assert.equal(p.pemenangId,'w1');
 assert.equal(snapshot(p.penawaran[0]),archived);
}
// A new winner or modified item price must not silently invalidate generated documents.
for(const mode of ['new-winner','hps-changed','scope-changed','same-supplier']){
 const s=original(),p=findP(s),offer=p.penawaran[0];
 const entry=api.archiveSpecial(s,'penawaran','w1',
  {paketId:p.id,offer,position:0,wasWinner:true,itemsDigest:snapshot(p.items),parentScope:{opd:p.opd,tahun:p.tahun}},'Tester');
 p.penawaran.splice(0,1);p.pemenangId=null;
 if(mode==='new-winner')p.pemenangId='w2';
 if(mode==='hps-changed')p.items[0].hs=9999;
 if(mode==='scope-changed')p.tahun=2027;
 if(mode==='same-supplier')p.penawaran[0].pen='v1';
 const before=snapshot(s);
 assert.throws(()=>api.restore(s,entry.id));
 assert.equal(snapshot(s),before,`Restore ${mode} must fail atomically`);
}
// Legacy archive lacking position is supported via append, with no fabricated old position.
{
 const s=original(),p=findP(s),offer=p.penawaran[0];
 const legacy=api.archiveSpecial(s,'penawaran','w1',{paketId:p.id,offer},'Tester');
 p.penawaran.splice(0,1);p.pemenangId=null;api.restore(s,legacy.id);
 assert.deepEqual(ids(p.penawaran),['w2','w1']);
}
// SQL schema migration: additive fields + role checks in original RPCs + original position.
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261112030000_satria_recovery_order_integrity.sql'),'utf8');
for(const part of [
 'add column if not exists original_position integer',
 'satria_archive_record_preorder','satria_restore_record_preorder',
 'satria_archive_nested_preorder','satria_restore_nested_preorder',
 'satria_recover_original_order','itemsDigest','for update',
 'md5(coalesce(v_parent->\'items\'',
 'revoke all on function public.satria_restore_record_preorder',
 'revoke all on function public.satria_restore_nested_preorder',
 'using errcode=\'23503\''
])assert(sql.includes(part),`SQL contract missing: ${part}`);
assert(!/drop table|truncate |delete from public\.satria_state/i.test(sql),'Migration must not destroy active data');
assert(!/grant execute on function public\.satria_\w+_preorder/.test(sql),'Private prior RPC must stay uncallable');
console.log('PASS Stage 9: package/RUP position, HPS/doc snapshot, offer winner/position, nested items, conflicts, legacy archives, SQL contract');
