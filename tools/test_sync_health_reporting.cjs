'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const cloud=fs.readFileSync(path.join(__dirname,'../frontend/refactor/js/05-cloud-sync.js'),'utf8');
const care=fs.readFileSync(path.join(__dirname,'../frontend/refactor/maintenance/care-center.js'),'utf8');
const start=cloud.indexOf('  window.SATRIA_SYNC_HEALTH=Object.freeze(');
const end=cloud.indexOf('  // Stage 5B: use the pure calculation engine',start);
assert(start>0 && end>start);
const secret='jangan-tampil-private-credential';
const state={dirty:true,records:[{name:secret}]};
const context={
 window:{SATRIA_CLOUD_CONFIGURED:true},navigator:{onLine:false},S:state,
 member:{id:'sensitive-user-id',email:'user-secret@example.test'},cloudStateReady:true,
 conflictActive:false,autoSaveInFlight:false,autoRetryTimer:123,lastCloudConfirmedAt:null,
 lastCloudErrorAt:'2026-11-06T00:00:00.000Z',Object,Boolean};
vm.runInNewContext(cloud.slice(start,end),context);
let health=context.window.SATRIA_SYNC_HEALTH.inspect();
assert.equal(health.pending,true);assert.equal(health.online,false);
assert.equal(health.retryScheduled,true);assert.equal(health.authenticated,true);
assert(!JSON.stringify(health).includes(secret));assert(!JSON.stringify(health).includes('user-secret'));
const before=JSON.stringify(state),listeners={};
const careCtx={window:{...context.window,SATRIA_MAINTENANCE:{inspect:()=>({stylesExpected:22,stylesLoaded:22,coreReady:true,priceAnalysisReady:true,errorCount:0})},SATRIA_OPS_V2:{health:()=>({issues:[],records:[]})},SATRIA_CLOUD_ROLE:'admin'},
 S:state,cur:()=>({role:'Admin'}),satriaSettingsCheck:()=>({refs:[]}),satriaSettingsWarnings:()=>[],
 document:{addEventListener:(k,f)=>{listeners[k]=f},getElementById:()=>null},
 location:{hash:'#care'},Date,JSON,Math,Object,Number,String,Array,Boolean,Blob,URL,setTimeout};
vm.runInNewContext(care,careCtx);
let scan=careCtx.window.SATRIA_CARE.scan();
assert.equal(scan.sync.pending,true);assert.equal(scan.sync.online,false);assert.equal(scan.attention,true);
assert(careCtx.window.SATRIA_CARE.page().includes('Ada perubahan tertunda'));
assert(!JSON.stringify(scan).includes('sensitive-user-id'));
assert(!JSON.stringify(scan).includes(secret));
assert.equal(JSON.stringify(state),before,'Perawatan tidak boleh mengubah status/data');
context.S.dirty=false;context.navigator.onLine=true;context.autoRetryTimer=null;
scan=careCtx.window.SATRIA_CARE.scan();
assert.equal(scan.sync.pending,false);assert.equal(scan.sync.online,true);
assert.equal(scan.attention,false);
context.conflictActive=true;
scan=careCtx.window.SATRIA_CARE.scan();assert.equal(scan.sync.conflict,true);assert.equal(scan.attention,true);
console.log('PASS P4: observability pending/offline/conflict, audit read-only, identitas/token tidak bocor');
