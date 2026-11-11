'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../frontend/refactor/js/06-pwa-startup.js'),'utf8');
const callbacks={},nodes={satriaSyncBadge:{hidden:true,dataset:{}},syncBadgeText:{textContent:''}};
const health={configured:true,authenticated:false,online:true,baselineLoaded:false,pending:false,conflict:false,inFlight:false,retryScheduled:false,lastConfirmedAt:null};
const updater={setInterval:null};const original=()=>{throw Error('Do not intercept')};
const win={SATRIA_SYNC_HEALTH:{inspect:()=>health},SATRIA_AUTO_SYNC_REQUEST:original,
 addEventListener:(k,v)=>{callbacks[k]=v}};
const doc={getElementById:id=>nodes[id]||null,visibilityState:'visible'};
vm.runInNewContext(code,{window:win,document:doc,navigator:{},localStorage:{getItem:()=>null},
  setInterval:f=>{updater.setInterval=f},console});
assert.equal(win.SATRIA_AUTO_SYNC_REQUEST,original,'PWA status must not wrap business sync');
assert(nodes.syncBadgeText.textContent.includes('Masuk cloud'));
health.authenticated=true;health.baselineLoaded=true;health.pending=true;updater.setInterval();
assert(nodes.syncBadgeText.textContent.includes('belum tersinkron'));
health.pending=false;health.lastConfirmedAt='2026-11-11T00:00:00Z';updater.setInterval();
assert(nodes.syncBadgeText.textContent.includes('Data tersinkron'));
health.conflict=true;updater.setInterval();assert(nodes.syncBadgeText.textContent.includes('Konflik'));
health.conflict=false;health.online=false;callbacks.offline();assert(nodes.syncBadgeText.textContent.includes('Offline'));
console.log('PASS sync badge reads observed health, no false active state, no swallowed errors');
