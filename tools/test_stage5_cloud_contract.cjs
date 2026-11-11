'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const html=read('index.html'),sw=read('sw.js'),bridge=read('frontend/refactor/js/05-cloud-sync.js');
const adminCreate=read('frontend/satria-cloud-admin-create.js'),adminRoster=read('frontend/satria-cloud-admin-roster.js'),deltaSrc=read('frontend/satria-cloud-delta.js');
const gate=read('supabase/validation/STAGE5_READONLY_SECURITY_GATE.sql');
const delta=require(path.join(root,'frontend/satria-cloud-delta.js'));
const names=['./frontend/satria-cloud-delta.js','./frontend/satria-cloud-admin-create.js','./frontend/satria-cloud-admin-roster.js','./frontend/refactor/js/05-cloud-sync.js'];
let prev=-1;
for(const n of names){const pos=html.indexOf(`src="${n}"`);assert(pos>prev,`Wrong script order: ${n}`);prev=pos;assert(sw.includes('"'+n+'"'),`Missing PWA entry ${n}`);}
assert.equal(html.split('./frontend/satria-cloud-delta.js').length-1,1);
assert.equal(html.split('./frontend/satria-cloud-admin-create.js').length-1,1);
assert.equal(html.split('./frontend/satria-cloud-admin-roster.js').length-1,1);
assert(sw.includes('combined-p0p3')); // cache version advances with the coordinated release
assert(!bridge.includes('function makeDelta(')&&!bridge.includes('function applyDeltaToPayload('));
assert(bridge.includes('const {cloneJson,payloadEqual,makeDelta,applyDeltaToPayload}=cloudDelta'));
assert(!bridge.includes('window.__satriaAdminUsersInstalled = true'));
assert(bridge.includes("'SATRIA_INSTALL_CLOUD_ADMIN_CREATE','SATRIA_INSTALL_CLOUD_ADMIN_ROSTER'"));
assert(adminCreate.includes('get client(){return getContext().client}')&&adminRoster.includes('get member(){return getContext().member}'));
assert(adminRoster.includes('satria:cloud-session-reset')&&adminRoster.includes('sessionEpoch'));
assert(bridge.includes("new Event('satria:cloud-session-reset')"));
assert(!bridge.includes(".from('satria_memberships').insert("),'Browser must not grant itself admin');
assert(!bridge.includes('Admin pertama berhasil dibuat!'));
for(const text of ['create table','alter table','grant ','revoke ','update public.','delete from public.','insert into public.']){
 assert(!new RegExp('^\\s*'+text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'im').test(gate),'Staging gate may not contain data/schema mutations: '+text);
}
assert(gate.includes('SET TRANSACTION READ ONLY')&&gate.includes('ROLLBACK'));
assert(gate.includes('satria_state_enforce_cloud_archive'));
const before={opd:[{id:'opd-a',name:'A'}],rupBank:[],paket:[{id:'p1',tahun:2026,opd:'opd-a'}],tahun:[2026]};
const after={...before,paket:[],tahun:[2026,2027]};
const beforeText=JSON.stringify(before),afterText=JSON.stringify(after);
const changes=delta.makeDelta(before,after);
assert.deepEqual(changes.map(c=>c.op),['delete','replace']);
assert.deepEqual(delta.applyDeltaToPayload(before,changes),after);
assert.equal(JSON.stringify(before),beforeText);
assert.equal(JSON.stringify(after),afterText);
assert(Object.isFrozen(delta)&&Object.isFrozen(delta.ARRAY_DELTAS));
assert(!/(?:\bdocument\.|\blocalStorage\.|\bfetch\s*\(|\bsupabase\.|\bwindow\.supabase)/.test(deltaSrc),'Pure engine must not depend on browser/network');
console.log('PASS Stage5 contract: isolated delta, live admin session, session cleanup, fail-closed membership, no cloud mutation in gate, PWA cache');
