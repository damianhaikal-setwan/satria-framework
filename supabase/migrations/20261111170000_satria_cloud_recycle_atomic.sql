-- SATRIA NEXT · Stage 2: transactional cloud recycle / cross-device restore.
-- Apply AFTER 20261028060000_satria_private_media_storage.sql.
-- Requires staging validation and a database backup before production.
-- Does NOT purge historic records or create an approval workflow.
begin;

create table if not exists public.satria_trash_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.satria_organizations(id) on delete restrict,
  collection text not null check (collection in ('paket','rupBank','opd','unit','pejabat','penyedia','akun','kode')),
  record_id text not null check (length(btrim(record_id)) between 1 and 200),
  record_summary text not null default '',
  record jsonb not null check (jsonb_typeof(record)='object'),
  opd_id text,
  fiscal_year integer check (fiscal_year between 2000 and 2200),
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null,
  delete_xid bigint not null default txid_current(),
  retain_until timestamptz not null default (now() + interval '365 days'),
  restored_at timestamptz,
  restored_by uuid,
  check (collection in ('paket','rupBank') or (opd_id is null or fiscal_year is null)),
  check ((restored_at is null and restored_by is null) or (restored_at is not null and restored_by is not null))
);
create index if not exists satria_trash_org_status_date_idx
  on public.satria_trash_entries(organization_id,deleted_at desc) where restored_at is null;
create index if not exists satria_trash_scope_idx
  on public.satria_trash_entries(organization_id,opd_id,fiscal_year,deleted_at desc) where restored_at is null;
create unique index if not exists satria_trash_active_identity_idx
  on public.satria_trash_entries(organization_id,collection,record_id) where restored_at is null;

alter table public.satria_trash_entries enable row level security;
revoke all on public.satria_trash_entries from public,anon,authenticated;
grant select on public.satria_trash_entries to authenticated;
drop policy if exists satria_trash_scoped_read on public.satria_trash_entries;
create policy satria_trash_scoped_read on public.satria_trash_entries
for select to authenticated using (
  public.satria_is_admin(organization_id)
  or (collection in ('paket','rupBank')
      and exists (select 1 from public.satria_memberships m
                  where m.organization_id=satria_trash_entries.organization_id
                    and m.user_id=auth.uid() and m.active=true
                    and m.role in ('operator','viewer'))
      and public.satria_user_can_access_scope(organization_id,opd_id,fiscal_year))
);
-- No INSERT/UPDATE/DELETE permissions or policies for browser roles.

-- Enforce *server-wide* no-unarchived-removal, including admin full snapshot saves.
-- An entry must be inserted for the SAME record in the SAME transaction.
create or replace function public.satria_require_archive_on_removal()
returns trigger language plpgsql security definer
set search_path = pg_catalog,public,auth as $$
declare
  v_collection text;
  v_old jsonb;
  v_old_array jsonb;
  v_new_array jsonb;
  v_new_keys jsonb;
  v_id text;
begin
  foreach v_collection in array array['paket','rupBank','opd','unit','pejabat','penyedia','akun','kode'] loop
    v_old_array:=case when jsonb_typeof(old.payload->v_collection)='array' then old.payload->v_collection else '[]'::jsonb end;
    v_new_array:=case when jsonb_typeof(new.payload->v_collection)='array' then new.payload->v_collection else '[]'::jsonb end;
    if v_old_array=v_new_array then continue; end if;
    -- Precompute identity membership once per changed collection (no O(n²) scan).
    select coalesce(jsonb_object_agg(coalesce(e.value->>'id',e.value->>'kode'),'true'::jsonb),'{}'::jsonb)
      into v_new_keys from jsonb_array_elements(v_new_array) e(value)
      where coalesce(e.value->>'id',e.value->>'kode') is not null;
    for v_old in select value from jsonb_array_elements(v_old_array) e(value) loop
      v_id:=coalesce(v_old->>'id',v_old->>'kode');
      if v_id is null then
        raise exception 'Invalid existing record identity in %',v_collection using errcode='22023';
      end if;
      if not (v_new_keys ? v_id) then
        if not exists (
          select 1 from public.satria_trash_entries t
          where t.organization_id=old.organization_id and t.collection=v_collection
            and t.record_id=v_id and t.record=v_old and t.restored_at is null
            and t.delete_xid=txid_current()
        ) then
          raise exception 'Penghapusan %/% harus melalui Sampah cloud (arsip atomik)',v_collection,v_id
            using errcode='23514';
        end if;
      end if;
    end loop;
  end loop;
  -- Do not make archived packages/Bank RUP permanently unrestorable by removing
  -- their fiscal year through an admin settings delta or full snapshot import.
  if exists (
    select 1 from public.satria_trash_entries t
    where t.organization_id=old.organization_id and t.restored_at is null
      and t.collection in ('paket','rupBank')
      and t.fiscal_year is not null
      and not exists (
        select 1 from jsonb_array_elements_text(case when jsonb_typeof(new.payload->'tahun')='array'
          then new.payload->'tahun' else '[]'::jsonb end) y(value)
        where y.value=t.fiscal_year::text
      )
  ) then
    raise exception 'Tahun anggaran masih dipakai data di Sampah cloud' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function public.satria_require_archive_on_removal() from public,anon,authenticated;
drop trigger if exists satria_state_enforce_cloud_archive on public.satria_state;
create trigger satria_state_enforce_cloud_archive before update of payload on public.satria_state
for each row execute function public.satria_require_archive_on_removal();

-- Retain the old validation engine behind an uncallable internal name; the public
-- delta API below excludes DELETE. Existing UPSERT and settings behavior is preserved.
alter function public.satria_apply_state_delta(uuid,bigint,jsonb)
  rename to satria_apply_state_delta_internal;
revoke all on function public.satria_apply_state_delta_internal(uuid,bigint,jsonb) from public,anon,authenticated;
create function public.satria_apply_state_delta(
  p_organization_id uuid,p_expected_version bigint,p_changes jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
begin
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Delta changes must be a JSON array' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_changes) c(value)
             where lower(coalesce(c.value->>'op',''))='delete') then
    raise exception 'Cloud DELETE wajib melalui satria_archive_record; data harus masuk Sampah' using errcode='42501';
  end if;
  -- Includes rupBank, paket, master, and settings through previous validated implementation.
  return public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,p_changes);
end;
$$;
revoke all on function public.satria_apply_state_delta(uuid,bigint,jsonb) from public,anon;
grant execute on function public.satria_apply_state_delta(uuid,bigint,jsonb) to authenticated;

create or replace function public.satria_archive_record(
  p_organization_id uuid,p_expected_version bigint,p_collection text,p_record_id text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
declare
  v_actor uuid:=auth.uid();
  v_role text;
  v_state public.satria_state%rowtype;
  v_record jsonb;
  v_result jsonb;
  v_trash_id uuid;
  v_opd text;
  v_year integer;
  v_dep jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select role into v_role from public.satria_memberships
  where organization_id=p_organization_id and user_id=v_actor and active=true for share;
  if not found or v_role not in ('admin','operator') then
    raise exception 'Akun tidak memiliki izin menghapus' using errcode='42501';
  end if;
  if p_collection not in ('paket','rupBank','opd','unit','pejabat','penyedia','akun','kode')
     or p_record_id is null or length(btrim(p_record_id)) not between 1 and 200 then
    raise exception 'Jenis/ID arsip cloud tidak didukung' using errcode='22023';
  end if;
  if v_role='operator' and p_collection not in ('paket','rupBank') then
    raise exception 'Master organisasi hanya dapat diarsipkan oleh Admin' using errcode='42501';
  end if;
  select * into v_state from public.satria_state where organization_id=p_organization_id for update;
  if not found then raise exception 'Data organisasi cloud belum ada' using errcode='P0002'; end if;
  if p_expected_version is null or v_state.version<>p_expected_version then
    raise exception 'Version conflict: tarik data terbaru sebelum menghapus' using errcode='40001';
  end if;
  select e.value into v_record
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->p_collection)='array'
                            then v_state.payload->p_collection else '[]'::jsonb end) e(value)
  where coalesce(e.value->>'id',e.value->>'kode')=p_record_id limit 1;
  if v_record is null then raise exception 'Data aktif tidak ditemukan' using errcode='P0002'; end if;
  v_opd:=nullif(v_record->>'opd','');
  if coalesce(v_record->>'tahun','') ~ '^[0-9]{4}$' then v_year:=(v_record->>'tahun')::integer; end if;
  if p_collection not in ('paket','rupBank') then v_year:=null; end if;
  if octet_length(v_record::text)>6000000 then
    raise exception 'Catatan terlalu besar untuk Sampah cloud (maks 6 MB)' using errcode='22023';
  end if;
  if p_collection in ('paket','rupBank') then
    if v_opd is null or v_year is null or v_year not between 2000 and 2200 then
      raise exception 'Data tidak memiliki OPD/tahun yang valid' using errcode='22023';
    end if;
    if not public.satria_user_can_access_scope(p_organization_id,v_opd,v_year) then
      raise exception 'Data di luar kewenangan OPD/tahun' using errcode='42501';
    end if;
  end if;
  -- Prevent archiving references required for restoring previously archived packages.
  if p_collection<>'paket' and exists (
    select 1 from public.satria_trash_entries t
    where t.organization_id=p_organization_id and t.collection='paket' and t.restored_at is null
      and (
        (p_collection='rupBank' and (t.record->>'rupBankId'=p_record_id
          or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(t.record->'rupBankIds')='array'
                                                then t.record->'rupBankIds' else '[]'::jsonb end) x(value)
                     where x.value=p_record_id)))
        or (p_collection='opd' and t.record->>'opd'=p_record_id)
        or (p_collection='unit' and t.record->>'unit'=p_record_id)
        or (p_collection='pejabat' and (t.record->>'ppk'=p_record_id or t.record->>'pp'=p_record_id or t.record->>'kabid'=p_record_id))
        or (p_collection='penyedia' and exists (
             select 1 from jsonb_array_elements(case when jsonb_typeof(t.record->'penawaran')='array' then t.record->'penawaran' else '[]'::jsonb end) o(value)
             where o.value->>'pen'=p_record_id))
        or (p_collection='akun' and t.record->>'akunId'=p_record_id)
        or (p_collection='kode' and t.record->>'sub'=p_record_id)
      )
  ) then raise exception 'Master masih dipakai oleh paket di Sampah; pulihkan paket terlebih dahulu' using errcode='23503'; end if;
  -- An archived RUP or OPD-dependent master also requires its OPD for restoration.
  if p_collection='opd' and exists (
    select 1 from public.satria_trash_entries t
    where t.organization_id=p_organization_id and t.restored_at is null
      and t.collection in ('rupBank','unit','pejabat') and t.opd_id=p_record_id
  ) then
    raise exception 'OPD masih dipakai Bank RUP/master di Sampah cloud' using errcode='23503';
  end if;
  -- Prevent archiving a Bank RUP referenced from any currently active package.
  if p_collection='rupBank' and exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array'
      then v_state.payload->'paket' else '[]'::jsonb end) p(value)
    where p.value->>'rupBankId'=p_record_id
      or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(p.value->'rupBankIds')='array'
        then p.value->'rupBankIds' else '[]'::jsonb end) x(value) where x.value=p_record_id)
  ) then raise exception 'Bank RUP masih dipakai paket aktif' using errcode='23503'; end if;
  insert into public.satria_trash_entries(organization_id,collection,record_id,record_summary,record,opd_id,fiscal_year,deleted_by)
  values(p_organization_id,p_collection,p_record_id,left(coalesce(nullif(v_record->>'nama',''),nullif(v_record->>'rup',''),p_record_id),240),v_record,v_opd,v_year,v_actor) returning id into v_trash_id;
  -- Old, server-validated delta enforces all OPD, year, RUP and foreign-key checks.
  v_result:=public.satria_apply_state_delta_internal(
    p_organization_id,p_expected_version,
    jsonb_build_array(jsonb_build_object('collection',p_collection,'op','delete','id',p_record_id))
  );
  return jsonb_build_object('trash_id',v_trash_id,'version',v_result->'version','status','archived');
end;
$$;
revoke all on function public.satria_archive_record(uuid,bigint,text,text) from public,anon;
grant execute on function public.satria_archive_record(uuid,bigint,text,text) to authenticated;

create or replace function public.satria_restore_record(
  p_organization_id uuid,p_expected_version bigint,p_trash_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth as $$
declare
  v_actor uuid:=auth.uid();
  v_role text;
  v_state public.satria_state%rowtype;
  v_entry public.satria_trash_entries%rowtype;
  v_result jsonb;
  v_link text;
  v_links jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select role into v_role from public.satria_memberships
  where organization_id=p_organization_id and user_id=v_actor and active=true for share;
  if not found or v_role not in ('admin','operator') then
    raise exception 'Akun tidak memiliki izin memulihkan' using errcode='42501';
  end if;
  select * into v_state from public.satria_state where organization_id=p_organization_id for update;
  if not found then raise exception 'Data organisasi cloud belum ada' using errcode='P0002'; end if;
  if p_expected_version is null or v_state.version<>p_expected_version then
    raise exception 'Version conflict: tarik data terbaru sebelum memulihkan' using errcode='40001';
  end if;
  select * into v_entry from public.satria_trash_entries
  where id=p_trash_id and organization_id=p_organization_id and restored_at is null for update;
  if not found then raise exception 'Item Sampah tidak ditemukan atau sudah dipulihkan' using errcode='P0002'; end if;
  if v_role='operator' and v_entry.collection not in ('paket','rupBank') then
    raise exception 'Master organisasi hanya dapat dipulihkan oleh Admin' using errcode='42501';
  end if;
  if v_entry.collection in ('paket','rupBank') and
     not public.satria_user_can_access_scope(p_organization_id,v_entry.opd_id,v_entry.fiscal_year) then
    raise exception 'Pemulihan di luar kewenangan OPD/tahun' using errcode='42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->v_entry.collection)='array'
      then v_state.payload->v_entry.collection else '[]'::jsonb end) r(value)
    where coalesce(r.value->>'id',r.value->>'kode')=v_entry.record_id
  ) then raise exception 'ID sudah aktif. Pemulihan tidak boleh menimpa data' using errcode='23505'; end if;
  if v_entry.collection='paket' then
    v_links:=case when jsonb_typeof(v_entry.record->'rupBankIds')='array' then v_entry.record->'rupBankIds' else '[]'::jsonb end;
    if nullif(v_entry.record->>'rupBankId','') is not null then
      v_links:=v_links||jsonb_build_array(v_entry.record->>'rupBankId');
    end if;
    for v_link in select distinct value from jsonb_array_elements_text(v_links) t(value) loop
      if not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'rupBank')='array'
          then v_state.payload->'rupBank' else '[]'::jsonb end) r(value)
        where r.value->>'id'=v_link and r.value->>'opd'=v_entry.record->>'opd'
          and r.value->>'tahun'=v_entry.record->>'tahun'
      ) then raise exception 'Bank RUP terkait belum tersedia; pulihkan RUP dahulu' using errcode='23503'; end if;
    end loop;
  end if;
  v_result:=public.satria_apply_state_delta_internal(
    p_organization_id,p_expected_version,
    jsonb_build_array(jsonb_build_object('collection',v_entry.collection,'op','upsert',
      'id',v_entry.record_id,'row',v_entry.record))
  );
  update public.satria_trash_entries
    set restored_at=now(),restored_by=v_actor
    where id=v_entry.id;
  return jsonb_build_object('trash_id',v_entry.id,'version',v_result->'version','status','restored');
end;
$$;
revoke all on function public.satria_restore_record(uuid,bigint,uuid) from public,anon;
grant execute on function public.satria_restore_record(uuid,bigint,uuid) to authenticated;

comment on table public.satria_trash_entries is 'SATRIA Tahap 2 cloud recycle; 365-day retention marker, NO automatic purge. Metadata + snapshot retained for recovery and audit.';
comment on function public.satria_archive_record(uuid,bigint,text,text) is 'Atomic archive + server-side scoped delete; optimistic concurrency and rollback on error.';
comment on function public.satria_restore_record(uuid,bigint,uuid) is 'Atomic scoped restore; rejects occupied IDs and missing dependencies.';
notify pgrst, 'reload schema';
commit;
