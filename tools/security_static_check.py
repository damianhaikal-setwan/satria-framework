from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text()
sql = (ROOT / 'supabase/migrations/20261024053200_satria_scoped_access_and_years.sql').read_text()
create = (ROOT / 'supabase/functions/admin-create-user/index.ts').read_text()
roster = (ROOT / 'supabase/functions/admin-list-users/index.ts').read_text()
checks = {
  'RLS reset removes all existing policies on satria_state': "select policyname from pg_policies" in sql and "tablename = 'satria_state'" in sql and "drop policy %I on public.satria_state" in sql,
  'Direct snapshot SELECT is admin-only': 'create policy satria_state_read_admin_only' in sql and 'using (public.satria_is_admin(organization_id))' in sql,
  'Direct snapshot write privileges revoked': 'revoke insert, update, delete, truncate, references, trigger on table public.satria_state from authenticated' in sql,
  'Full snapshot save requires admin': 'Full organization snapshot replacement is restricted to active administrators' in sql,
  'Scoped read RPC requires OPD and current-snapshot year assignments': 'No active OPD assigned to this account' in sql and 'No assigned fiscal year exists in the current organization snapshot' in sql and "jsonb_array_elements_text(case when jsonb_typeof(v_state.payload->'tahun')='array'" in sql,
  'Scoped read uses allowlisted payload fields': "'paket', v_packages" in sql and "'users', '[]'::jsonb" in sql and "'tahun', to_jsonb(v_years)" in sql,
  'Scoped write requires Operator role': "if v_role <> 'operator' then" in sql,
  'Scoped write validates OPD+year': 'Package is outside the current OPD/year assignment' in sql,
  'Scoped write validates package-to-unit/official OPD references': 'Package unit reference is missing or belongs to another OPD' in sql and 'Package official reference is missing or belongs to another OPD' in sql,
  'Scoped write validates selected winner belongs to its package': 'Selected winner does not belong to an offer in this package' in sql,
  'Scoped write protects shared unit/official rows referenced outside year scope': 'Unit rows referenced by packages outside your OPD/year scope cannot be changed or removed' in sql and 'Official rows referenced by packages outside your OPD/year scope cannot be changed or removed' in sql,
  'Scoped supplier replacement preserves shared suppliers but supports scoped deletion': 'Replace suppliers used only in this scope, including deleting those the Operator removed' in sql and 'v_mutable_supplier_ids' in sql and 'v_keep || v_suppliers' in sql,
  'Scoped write protects optimistic concurrency': 'p_expected_version is null or v_version <> p_expected_version' in sql,
  'Scoped read/write serialize against membership assignment changes': 'for share;' in sql and sql.count('for update;') >= 1 and 'Derive the effective scope after locking the canonical snapshot' in sql,
  'Year assignments are a first-class table': 'create table if not exists public.satria_membership_years' in sql,
  'New Operator creation requires year_ids': 'normalizeYears(body.year_ids)' in create and 'satria_admin_set_membership_years' in create,
  'Roster response includes year_ids': 'year_ids: (yearByUser.get(row.user_id) ?? []).sort((a, b) => a - b)' in roster,
  'Frontend non-admin read uses scoped RPC': "client.rpc('satria_get_scoped_state'" in html and "if(member.role==='admin')" in html,
  'Frontend non-admin save uses versioned per-record delta RPC': "client.rpc('satria_apply_state_delta'" in html and 'p_expected_version:version' in html and 'if(!cloudStateReady||!lastSyncedPayload)' in html,
  'Failed cloud pull disables writes for all roles unless admin explicitly imports a backup': 'cloudStateReady=false' in html and 'Baseline cloud belum tersedia. Tarik data Supabase terlebih dahulu.' in html and 'SATRIA_CLOUD_ADMIN_IMPORT_READY===true' in html,
  'Cloud connection warning documents server-side scoped access': 'akses langsung ke snapshot ditolak RLS' in html and 'Semua anggota organisasi yang aktif dapat membaca seluruh data snapshot' not in html,
  'Non-admin import is blocked': 'Impor backup penuh hanya tersedia bagi admin' in html,
  'Non-admin full reset/global OPD and year edits are blocked': "['addopd','addyear','delyear','rmlogo','reset','clearsample','uadd','utoggle','udel']" in html,
  'Bank RUP included in per-record delta allowlist': "const ARRAY_DELTAS=['rupBank'" in html,
  'Bank RUP cleared at cloud logout': 'penyedia:[],rupBank:[],paket:[]' in html,
  'Bank RUP scoped after operator pull': 'S.rupBank=(S.rupBank||[]).filter(r=>allowedOpdSet.has' in html,
  'Scoped state is used for local reports/export after authentication': 'Object.assign(S,data.payload' in html and 'function csvExport' in html,
}
failed = False
for title, ok in checks.items():
  print(('PASS' if ok else 'FAIL') + ' — ' + title)
  failed |= not ok
print(f"\n{sum(checks.values())}/{len(checks)} static security assertions passed")
sys.exit(1 if failed else 0)
