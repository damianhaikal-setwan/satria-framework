'use strict';
/* Security regression against the production scoped projection and pull.
 * Synthetic fixtures only; PostgreSQL/RLS must still be tested on staging. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const cloudScope=require(path.join(ROOT,'frontend/satria-cloud-scope.js'));
const js=fs.readFileSync(path.join(ROOT,'frontend/refactor/js/05-cloud-sync.js'),'utf8');
const section=(begin,end)=>{
  const a=js.indexOf(begin),b=js.indexOf(end,a);
  assert(a>=0&&b>a,'Cloud implementation section missing: '+begin);
  return js.slice(a,b);
};
const input=()=>({
  opd:[{id:'o1'},{id:'o2'}],
  tahun:[2025,2026],
  unit:[{id:'u1',opd:'o1'},{id:'u2',opd:'o2'}],
  pejabat:[{id:'j1',opd:'o1'},{id:'j2',opd:'o2'}],
  paket:[{id:'p1',opd:'o1',tahun:2026},{id:'p2',opd:'o2',tahun:2026},{id:'p3',opd:'o1',tahun:2025}],
  rupBank:[{id:'r1',opd:'o1',tahun:2026},{id:'r2',opd:'o2',tahun:2025}],
  penyedia:[{id:'s1'}], akun:[],kode:[],pemda:{nama:'Contoh'},meta:{},penomoran:{},
  secretForeignPayload:'never-ever-apply',users:[{email:'secret@example.test'}]
});
const assigned={role:'operator',opd_ids:['o1'],years:[2026],can_write:true};
function checkProjection(){
  const source=input(),original=JSON.stringify(source);
  const result=cloudScope.project(source,assigned,'operator');
  assert.deepEqual(result.payload.paket.map(x=>x.id),['p1']);
  assert.deepEqual(result.payload.rupBank.map(x=>x.id),['r1']);
  assert.deepEqual(result.payload.opd.map(x=>x.id),['o1']);
  assert.deepEqual(result.payload.unit.map(x=>x.id),['u1']);
  assert.deepEqual(result.payload.pejabat.map(x=>x.id),['j1']);
  assert.deepEqual(result.payload.tahun,[2026]);
  assert.equal(result.payload.secretForeignPayload,undefined);
  assert.deepEqual(result.payload.users,[]);
  result.payload.paket[0].id='changed';assert.equal(source.paket[0].id,'p1');
  assert.equal(JSON.stringify(source),original,'projection must not mutate incoming payload');
  for(const [payload,scope,role] of [
    [source,{...assigned,role:'admin'},'operator'],
    [source,{...assigned,opd_ids:['o1','o1']},'operator'],
    [source,{...assigned,opd_ids:['not-in-master']},'operator'],
    [source,{...assigned,years:[2031]},'operator'],
    [{...source,paket:null},assigned,'operator'],
    [source,{...assigned,years:[]},'operator'],
    [source,assigned,'admin']
  ]) assert.throws(()=>cloudScope.project(payload,scope,role));
  const viewer=cloudScope.project(source,{...assigned,role:'viewer',can_write:true},'viewer');
  assert.equal(viewer.scope.can_write,false,'client must not trust can_write flag');
}
function createEnv(response){
  const events=[];
  const env={
    window:{SATRIA_CLOUD_ADMIN_IMPORT_READY:false},
    S:{ui:{tahun:2025,opd:'o2'},dirty:false,users:[],paket:[{id:'preexisting'}],opd:[]},
    member:{id:'account-a',email:'a@example.test',role:'operator',scope:null},orgId:'org-a',
    client:{rpc:async()=>response},version:1,cloudStateReady:true,
    lastSyncedPayload:null,autoSaveInFlight:false,
    status:(...values)=>events.push(['status',...values]),syncIndicator:(...values)=>events.push(['indicator',...values]),
    setButtons:()=>{},clearCloudTrash:()=>{},applyUserLock:()=>{},route:()=>{},
    roleName:x=>x,accountName:()=> 'Operator',
    resetCloudScopedView:()=>{assert.equal(env.S?.secretForeignPayload,undefined,'unscoped object must never enter state'); env.S={ui:{},paket:[],opd:[],dirty:false}},
    showError:e=>events.push(['error',String(e?.message||e)]),
    currentPayload:()=>({paket:env.S.paket,opd:env.S.opd}),
    DB:{kv:{delete:async()=>{events.push(['cache-deleted'])}}},ENGINE:'memory',
    JSON,Object,Number,Set,Array,String,Boolean,Date,Promise,Math,Error,console,
  };
  const guard=section('  let sessionEpoch=0, pullEpoch=0, pendingScopedSave=null;', '  const $id=id=>');
  const pull=section('  async function pull(options={}){','  async function saveDeltaChanges(');
  const scopeVar='const cloudScope=window.SATRIA_CLOUD_SCOPE;';
  env.window.SATRIA_CLOUD_SCOPE=cloudScope;
  const ctx=vm.createContext(env);
  vm.runInContext(`${guard}\n${scopeVar}\n${pull}\nthis.pull=pull;`,ctx);
  return {ctx,events};
}
async function checkPull(){
  const healthy={data:{payload:input(),scope:assigned,version:3,updated_at:'now'},error:null};
  let {ctx,events}=createEnv(healthy);
  await ctx.pull();
  assert.equal(ctx.cloudStateReady,true);
  assert.deepEqual(Array.from(ctx.S.paket.map(x=>x.id)),['p1']);
  assert.deepEqual(Array.from(ctx.S.rupBank.map(x=>x.id)),['r1']);
  assert.equal(ctx.member.scope.role,'operator');
  assert.equal(ctx.S.secretForeignPayload,undefined);
  assert.equal(ctx.S.ui.opd,'o1');
  assert.equal(ctx.S.ui.tahun,2026);
  assert(events.some(x=>x[0]==='cache-deleted'),'memory mode must remove previous unscoped cache');
  ({ctx,events}=createEnv({data:{payload:input(),scope:{...assigned,role:'admin'},version:4},error:null}));
  await ctx.pull();
  assert.equal(ctx.cloudStateReady,false);
  assert.equal(ctx.member.scope,null,'invalid scope cannot update member');
  assert.equal(ctx.S.secretForeignPayload,undefined);
  assert.equal(ctx.S.paket.length,0,'failed pull must lock active data');
  assert(events.some(x=>x[0]==='error'));
  // Delayed old scoped RPC must not update even the NEW user's member.scope.
  let resolve;
  const deferred=new Promise(r=>{resolve=r});
  ({ctx}=createEnv(deferred));
  const operation=ctx.pull();
  vm.runInContext('invalidateSession()',ctx);
  ctx.member={id:'account-b',email:'b@example.test',role:'viewer',scope:null};
  ctx.S={ui:{},marker:'new-account'};
  resolve(healthy);
  assert.equal(await operation,false);
  assert.equal(ctx.member.scope,null);
  assert.equal(ctx.S.marker,'new-account');
}
async function checkRealtime(){
  const marker=section('  async function checkRemoteVersion(){','  function handleRealtimeNotice(');
  const guard=section('  let sessionEpoch=0, pullEpoch=0, pendingScopedSave=null;', '  const $id=id=>');
  let resolve;
  const pending=new Promise(r=>{resolve=r});
  const events=[];
  const env={
    member:{id:'account-a'},orgId:'org-a',version:3,cloudStateReady:true,
    client:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>pending})})})},
    handleRealtimeNotice:row=>events.push(row),console,Number,Boolean,Object,Array,Promise,
  };
  const ctx=vm.createContext(env);
  vm.runInContext(`${guard}\n${marker}\nthis.checkRemoteVersion=checkRemoteVersion;`,ctx);
  const operation=ctx.checkRemoteVersion();
  vm.runInContext('invalidateSession()',ctx);
  ctx.member={id:'account-b'};ctx.version=1;
  resolve({data:{version:99},error:null});
  await operation;
  assert.equal(events.length,0,'old event must not affect next user');
  assert(marker.includes('if(!sameSession(context))return;'));
}
(async()=>{checkProjection();await checkPull();await checkRealtime();console.log('PASS scoped pull prevalidation, fail-closed roles/OPD/year, stale session, realtime guards')})().catch(e=>{console.error(e);process.exitCode=1});
