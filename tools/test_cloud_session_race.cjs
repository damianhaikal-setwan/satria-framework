'use strict';
/* Race regression: exercise the actual production pull/delta functions with delayed replies.
 * No network, credentials, or production data; all fixtures are synthetic. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/refactor/js/05-cloud-sync.js'), 'utf8');
const section = (begin, end) => {
  const a = source.indexOf(begin), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, 'Production function boundary changed: ' + begin);
  return source.slice(a, b);
};
const guard = section('  let sessionEpoch=0, pullEpoch=0, pendingScopedSave=null;', '  const $id=id=>');
const pull = section('  async function pull(options={}){', '  async function saveDeltaChanges(');
const delta = section('  async function saveDeltaChanges(manual=false){', '  async function push(){');
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => {resolve=ok; reject=fail}); return {promise, resolve, reject}; };
const payload = id => ({paket:[{id}],opd:[{id:'o1'}],rupBank:[],tahun:[2026],unit:[],pejabat:[],akun:[],kode:[],penyedia:[]});
function environment() {
  const log=[];
  const env={
    window:{SATRIA_CLOUD_ADMIN_IMPORT_READY:false},
    S:{ui:{tahun:2026,opd:'all'},dirty:false,users:[],paket:[],opd:[]},
    member:{id:'account-a',email:'a@example.test',role:'admin',scope:null}, orgId:'org-a',
    version:2,cloudStateReady:true,lastSyncedPayload:payload('base'),conflictActive:false,
    autoSaveInFlight:false,autosyncRequested:false,autoRetryTimer:null,autoRetryAttempt:0,
    remoteNoticePending:false,remoteNoticeVersion:0,autoSaveTimer:null,
    ENGINE:'memory',DB:{kv:{delete:async()=>{}}},
    status:(...args)=>log.push(['status',...args]),syncIndicator:(...args)=>log.push(['badge',...args]),
    setButtons:()=>{},clearCloudTrash:()=>{},applyUserLock:()=>{},route:()=>{},
    roleName:role=>role, accountName:()=> 'Admin',currentPayload:()=>payload('newest'),
    showError:e=>log.push(['error',String(e.message||e)]),cancelAutosaveTimer:()=>{},
    cloneJson:value=>JSON.parse(JSON.stringify(value)),
    applyDeltaToPayload:(before,changes)=>({...before,paket:changes[0].row?[changes[0].row]:before.paket}),
    makeDelta:()=>[{collection:'paket',op:'upsert',id:'p2',row:{id:'p2'}}],
    payloadEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    navigator:{onLine:true},console,Promise,Object,JSON,Number,Array,Set,Map,String,Math,Date,
    setTimeout:()=>0,clearTimeout:()=>{},toast:()=>{},
  };
  const ctx=vm.createContext(env);
  vm.runInContext(`${guard}\n${pull}\n${delta}\nthis.pull=pull;this.saveDeltaChanges=saveDeltaChanges;`,ctx);
  return {ctx,log};
}
function query(promise) {return {select:()=>({eq:()=>({maybeSingle:()=>promise})})};}
(async()=>{
  // A cloud reply from account A must never repopulate memory after logout and login B.
  {
    const {ctx,log}=environment(), r=deferred();
    ctx.client={from:()=>query(r.promise)};
    const p=ctx.pull();
    vm.runInContext('invalidateSession()',ctx);
    ctx.member={id:'account-b',role:'viewer'};
    ctx.S={ui:{},dirty:false,marker:'new-user'};
    ctx.cloudStateReady=false;
    r.resolve({data:{payload:payload('old-a'),version:99},error:null});
    assert.equal(await p,false);
    assert.equal(ctx.S.marker,'new-user');
    assert.equal(ctx.S.paket,undefined);
    assert.equal(ctx.cloudStateReady,false);
    assert(!log.some(row=>row[0]==='badge'&&String(row[1]).startsWith('Tersinkron')));
  }
  // Two overlapping pulls: only the newer request can modify the snapshot.
  {
    const {ctx}=environment(), first=deferred(),second=deferred();
    let n=0;
    ctx.client={from:()=>query(++n===1?first.promise:second.promise)};
    const p1=ctx.pull(),p2=ctx.pull();
    second.resolve({data:{payload:payload('newer'),version:10,updated_at:'now'},error:null});
    await p2;
    assert.equal(ctx.S.paket[0].id,'newer');
    first.resolve({data:{payload:payload('stale'),version:8},error:null});
    assert.equal(await p1,false);
    assert.equal(ctx.S.paket[0].id,'newer');
    assert.equal(ctx.version,10);
  }
  // A pull cannot run while a delta batch is in flight; no unintentional overwrite.
  {
    const {ctx}=environment();ctx.autoSaveInFlight=true;
    await assert.rejects(ctx.pull(),/Sinkronisasi kirim masih berlangsung/);
    assert.equal(ctx.cloudStateReady,true);
  }
  // A late delta reply must not touch the current user's version or synchronization badge.
  {
    const {ctx,log}=environment(),r=deferred();
    ctx.client={rpc:()=>r.promise};ctx.S.dirty=true;
    const p=ctx.saveDeltaChanges(false);
    assert.equal(ctx.autoSaveInFlight,true);
    vm.runInContext('invalidateSession()',ctx);
    ctx.member={id:'account-b',role:'operator'};
    ctx.version=12;ctx.lastSyncedPayload=payload('new-user');ctx.S.dirty=true;
    r.resolve({data:{version:9},error:null});
    assert.equal(await p,false);
    assert.equal(ctx.version,12);
    assert.equal(ctx.lastSyncedPayload.paket[0].id,'new-user');
    assert.equal(ctx.autoSaveInFlight,false);
    assert(!log.some(row=>row[0]==='badge'&&String(row[1]).startsWith('Tersinkron')));
  }
  // Cloud trash flows must also reject obsolete session replies.
  for(const name of ['performCloudTrash','archiveNested']){
    const chunk=section('  async function '+name+'(',name==='performCloudTrash'?'  // Nested transactions':'  window.SATRIA_CLOUD_TRASH=');
    assert(chunk.includes('const context=captureSession()'));
    assert(chunk.includes('if(!sameSession(context))return false'));
  }
  console.log('PASS cloud session races: stale pull, overlapping pull, pending delta, stale delta, nested trash guards');
})().catch(e=>{console.error(e);process.exitCode=1});
