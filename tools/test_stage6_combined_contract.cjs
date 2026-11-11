'use strict';
/* Source contract: P0-P3 aggregate. SQL runtime and RLS still require Supabase staging. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const sql=read('supabase/migrations/20261111190000_satria_nested_recycle.sql');
const gate=read('supabase/validation/STAGE6_NESTED_READONLY_GATE.sql');
const js=read('frontend/refactor/js/05-cloud-sync.js');
const app=read('frontend/refactor/js/01-app-core.js');
const recycle=read('frontend/satria-controller-recycle.js');
const master=read('frontend/satria-controller-master-settings.js');
const access=read('frontend/satria-controller-access.js');
const html=read('index.html'),sw=read('sw.js'),care=read('frontend/refactor/maintenance/care-center.js');
for(const needle of ['create table if not exists public.satria_nested_trash_entries',
 'alter table public.satria_nested_trash_entries enable row level security',
 'satria_user_can_access_scope','satria_is_admin',
 'satria_archive_nested','satria_restore_nested','satria_require_nested_archive',
 'satria_state_nested_archive_guard','for update','p_expected_version',
 'delete_xid=txid_current()','p_expected_version is null','record->\'offer\'=v_offer',
 "'wasWinner'","v_entry.record->>'wasWinner'='true'"])
 assert(sql.includes(needle),'SQL archive safety missing: '+needle);
assert(!/delete\s+from\s+storage\./i.test(sql),'Archive must not physically delete private media files');
assert(!/grant\s+(?:insert|update|delete|all)\s+on\s+public\.satria_nested_trash_entries\s+to\s+authenticated/i.test(sql));
assert(!/grant\s+select\s+on\s+public\.satria_nested_trash_entries\s+to\s+anon/i.test(sql));
assert(gate.includes('set transaction read only')&&gate.includes('rollback'));
for(const text of ['drop table','truncate','delete from','insert into','update public.'])assert(!gate.toLowerCase().includes(text),'Validation SQL should not mutate data: '+text);
assert(js.includes("client.rpc('satria_archive_nested'"));
assert(js.includes("selected.nested?'satria_restore_nested':'satria_restore_record'"));
assert(js.includes('trashCanMutate();')&&js.includes('await pull({discardConfirmed:true,source:\'trash\'})'));
assert(app.includes("api.archiveNested('penawaran',p.id,id)"));
assert(app.includes("archiveNested('media',id,id)"));
assert(app.includes("archiveNested('media','pemda','pemda-logo')"));
assert(app.includes('Arsipkan item satu per satu saat draf bersih'));
assert(!app.includes('function vSet()')&&master.includes('function vSet()'));
assert(!app.includes('function vSampah()')&&recycle.includes('function vSampah()'));
assert(access.includes('const ROLE_PAGES=')&&access.includes('const WRITE='));
const order=['./frontend/refactor/js/01-app-core.js','./frontend/satria-controller-access.js','./frontend/satria-controller-master-settings.js','./frontend/satria-controller-recycle.js'];
let last=-1;
for(const file of order){const pos=html.indexOf(`src="${file}"`);assert(pos>last,'Controller load order invalid: '+file);last=pos;assert(sw.includes('"'+file+'"'),'PWA cache missing '+file)}
assert(sw.includes('combined-p0p3'));
assert(html.includes('satria-combined-ux.css')&&sw.includes('satria-combined-ux.css'));
assert(care.includes("case 'storage':")&&care.includes('navigator.storage.estimate()'));
assert(care.includes('Tidak menguji seluruh data cloud'));
console.log('PASS P0–P3 source contracts: RLS/atomic guards, nested client, fail-closed HPS, controllers, PWA, UX, Care Center. Not a PostgreSQL execution test.');
