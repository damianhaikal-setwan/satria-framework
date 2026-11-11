'use strict';
// Synthetic-only regression: reads the actual cloud trash paginator. No production DB access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cloud=fs.readFileSync(path.join(root,'frontend/refactor/js/05-cloud-sync.js'),'utf8');
const controller=fs.readFileSync(path.join(root,'frontend/satria-controller-recycle.js'),'utf8');
const app=fs.readFileSync(path.join(root,'frontend/refactor/js/01-app-core.js'),'utf8');
function slice(begin,end){const a=cloud.indexOf(begin),b=cloud.indexOf(end,a);assert(a>=0&&b>a,`Missing production section: ${begin}`);return cloud.slice(a,b)}
const sessionGuard=slice('  let sessionEpoch=0, pullEpoch=0, pendingScopedSave=null;','  const $id=id=>');
const trashFunctions=slice('  // Sampah tidak dibatasi pada 250 arsip:', '  async function performCloudTrash(');
const record=(id,index)=>({id,collection:'paket',record_id:id,record_summary:'Arsip '+id,deleted_at:new Date(Date.UTC(2026,10,12,12,0)-index*1000).toISOString(),deleted_by:'fixture',opd_id:'o1',fiscal_year:2026,retain_until:'2027-11-12'});
function fixture(n,prefix){return Array.from({length:n},(_,i)=>record(prefix+i,i))}
function environment(base,nested,{nestedFailure=false}={}){
  let failBaseOffset=null,hold=null;
  const calls=[];let renderCount=0;
  const query=(name)=>({
    select(){return this},eq(){return this},is(){return this},order(){return this},
    range(start,end){
      calls.push({name,start,end});
      if(hold&&name==='satria_trash_entries'&&start===0)return hold.promise;
      if(name==='satria_trash_entries'&&start===failBaseOffset)return Promise.resolve({data:null,error:{message:'network error'}});
      if(name==='satria_nested_trash_entries'&&nestedFailure)return Promise.resolve({data:null,error:{message:'nested table unavailable'}});
      const rows=(name==='satria_trash_entries'?base:nested).slice(start,end+1);
      return Promise.resolve({data:rows,error:null});
    }
  });
  const ctx=vm.createContext({
    window:{SATRIA_CLOUD_CONFIGURED:true},
    member:{id:'alice',role:'admin'},orgId:'org-a',client:{from:query},cloudStateReady:true,
    S:{ui:{page:'sampah'},dirty:false},version:5,lastSyncedPayload:{},
    autoSaveInFlight:false,autoSaveTimer:null,conflictActive:false,
    currentPayload:()=>({}),payloadEqual:()=>true,route:()=>{renderCount++},
    console,Promise,Object,Array,Set,Number,String,Boolean,Error,Date
  });
  vm.runInContext(`${sessionGuard}\n${trashFunctions}\nthis.api={
    refresh:()=>loadCloudTrash(true),initial:()=>loadCloudTrash(false),more:()=>loadCloudTrash(false,true),
    get rows(){return trashRows.slice()},get loaded(){return trashLoaded},get hasMore(){return trashLoaded&&(!trashBaseDone||!trashNestedDone)},
    get error(){return trashError},get offsets(){return [trashBaseOffset,trashNestedOffset]},
    logout:()=>{invalidateSession();clearCloudTrash()},clear:()=>clearCloudTrash()
  }`,ctx);
  return {ctx,api:ctx.api,calls,get renders(){return renderCount},failAt:offset=>{failBaseOffset=offset},hold:(promise)=>{hold={promise}}};
}
(async()=>{
  assert(controller.includes('data-act="trashmore"')&&app.includes("if(a==='trashmore')"),'Menu must expose the load-more operation');
  assert(cloud.includes(".order('deleted_at',{ascending:false}).order('id',{ascending:false})"),'Order needs stable tie-break');
  const x=environment(fixture(120,'base-'),fixture(63,'nested-'));
  assert.equal((await x.api.initial()).length,100);
  assert.deepEqual(Array.from(x.api.offsets),[50,50]);
  assert(x.api.hasMore);
  assert.equal((await x.api.more()).length,163);
  assert.deepEqual(Array.from(x.api.offsets),[100,63]);
  assert.equal((await x.api.more()).length,183);
  assert.deepEqual(Array.from(x.api.offsets),[120,63]);
  assert.equal(x.api.hasMore,false);
  const calls=x.calls.length;
  await x.api.more();await x.api.initial();
  assert.equal(x.calls.length,calls,'Fully loaded list must not fetch again');
  assert.equal(new Set(x.api.rows.map(x=>x.id)).size,183,'Rows must not be duplicated');
  const huge=environment(fixture(325,'many-base-'),fixture(275,'many-nested-'));
  await huge.api.initial();
  for(let page=0;huge.api.hasMore&&page<20;page++)await huge.api.more();
  assert.equal(huge.api.rows.length,600,'Archives older than 250 must be reachable');
  assert.equal(huge.api.hasMore,false);
  const y=environment(fixture(75,'old-'),[],{nestedFailure:true});
  assert.equal((await y.api.initial()).length,50);
  assert.match(y.api.error,/Arsip penawaran\/media/);
  assert.equal((await y.api.more()).length,75,'Existing top-level trash must remain accessible');
  assert.equal(y.api.hasMore,false);
  const z=environment(fixture(80,'retry-'),[]);
  await z.api.initial();
  z.failAt(50);
  assert.equal(await z.api.more(),false,'Load more must fail gracefully');
  assert.equal(z.api.rows.length,50,'Failed later page must preserve loaded records');
  assert.deepEqual(Array.from(z.api.offsets),[50,0],'Failed page must not advance offset');
  z.failAt(null);
  assert.equal((await z.api.more()).length,80,'Failed page can be retried');
  let resolve;
  const delayed=new Promise(r=>{resolve=r});
  const old=environment(fixture(4,'private-'),[]);
  old.hold(delayed);
  const inflight=old.api.initial();
  old.api.logout();old.ctx.member={id:'bob',role:'viewer'};
  resolve({data:fixture(4,'private-'),error:null});
  assert.equal(await inflight,false,'An old response must not be applied after logout');
  assert.equal(old.api.rows.length,0,'No old-account record may reappear');
  assert.equal(old.api.loaded,false);
  console.log('PASS Sampah pagination: 183 + 600 rows across 2 tables, paginated, no duplicates, fallback nested, failure retry, logout race');
})().catch(e=>{console.error(e);process.exitCode=1});
