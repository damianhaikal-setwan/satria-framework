// Stage 2 source contract assertions. Does not execute PostgreSQL; staging SQL tests are mandatory.
const fs=require('fs'), assert=require('node:assert/strict'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261111170000_satria_cloud_recycle_atomic.sql'),'utf8');
const cloud=fs.readFileSync(path.join(root,'frontend/refactor/js/05-cloud-sync.js'),'utf8');
const app=fs.readFileSync(path.join(root,'frontend/refactor/js/01-app-core.js'),'utf8');
for(const s of ['create table if not exists public.satria_trash_entries','enable row level security',
  'satria_user_can_access_scope','satria_is_admin','on public.satria_state','satria_require_archive_on_removal',
  'satria_apply_state_delta_internal','satria_archive_record','satria_restore_record',
  'p_expected_version','for update','txid_current()',"raise exception 'ID sudah aktif",'set restored_at=now()'])
  assert(sql.toLowerCase().includes(s.toLowerCase()),'Missing server guard: '+s);
assert(sql.includes('revoke all on public.satria_trash_entries from public,anon,authenticated'));
assert(sql.includes('grant select on public.satria_trash_entries to authenticated'));
assert(!/grant\s+(?:insert|update|delete|all)\s+on\s+public\.satria_trash_entries\s+to\s+authenticated/i.test(sql));
assert(sql.includes("lower(coalesce(c.value->>'op',''))='delete'"),'Must reject old direct cloud DELETE');
assert(sql.includes('v_entry.record_id'),'Must restore original server-stored ID');
assert(sql.includes('v_entry.record'),'Must restore original server-stored snapshot');
assert(sql.includes('v_entry.opd_id,v_entry.fiscal_year'),'Must scope restore by original row');
assert(sql.includes('t.record=v_old'),'Trigger must verify exact archived row');
assert(sql.includes('t.delete_xid=txid_current()'),'Trigger requires same DB transaction');
assert(cloud.includes('performCloudTrash('));
assert(cloud.includes("client.rpc(rpc,args)"));
assert(cloud.includes(".select('id,collection,record_id,record_summary"),"Do not download raw payload for list");
assert(cloud.includes('S.dirty||'),'Do not lose pending local edits');
assert(cloud.includes('!payloadEqual(currentPayload(),lastSyncedPayload)'),'Do not race pending delta');
assert(cloud.includes("member.role==='viewer'"));
assert(cloud.includes('clearCloudTrash();member=null;'));
assert(app.includes('api.archive(collection,id)'));
assert(app.includes('api.restore(id)'));
assert(app.includes('data-act="trashrefresh"'));
assert(app.includes("!['opd','unit','pejabat','penyedia','akun','kode'].includes(d.c)"));
assert(app.includes("if(satriaRecycleBlocked())return;"),'Local recycle still exists');
console.log('PASS Stage 2 contract: cloud RPC, atomic archive trigger, RLS, optimistic version, UI, local fallback');
