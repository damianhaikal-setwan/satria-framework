-- SATRIA combined P0–P3 release: nested Sampah. Apply to STAGING only after Stage 2.
-- No permanent deletion, no changes to Supabase Storage objects, no approval chain.
-- Separate table avoids mutating the existing Stage 2 collection and scope constraints.
begin;
create table if not exists public.satria_nested_trash_entries (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.satria_organizations(id) on delete restrict,
 collection text not null check (collection in ('penawaran','item','media')),
 parent_id text not null check (length(parent_id) between 1 and 200),
 record_id text not null check (length(record_id) between 1 and 200),
 record_summary text not null default '',
 record jsonb not null check (jsonb_typeof(record)='object'),
 opd_id text,
 fiscal_year integer,
 deleted_at timestamptz not null default now(),
 deleted_by uuid not null,
 delete_xid bigint not null default txid_current(),
 retain_until timestamptz not null default (now()+interval '365 days'),
 restored_at timestamptz,
 restored_by uuid,
 check ((restored_at is null) = (restored_by is null)),
 check ((collection in ('penawaran','item') and opd_id is not null and fiscal_year between 2000 and 2200)
    or (collection='media' and opd_id is null and fiscal_year is null))
);
create unique index if not exists satria_nested_unique_live on public.satria_nested_trash_entries
 (organization_id,collection,parent_id,record_id) where restored_at is null;
create index if not exists satria_nested_scope_date on public.satria_nested_trash_entries
 (organization_id,opd_id,fiscal_year,deleted_at desc) where restored_at is null;
alter table public.satria_nested_trash_entries enable row level security;
revoke all on public.satria_nested_trash_entries from public,anon,authenticated;
grant select on public.satria_nested_trash_entries to authenticated;
drop policy if exists satria_nested_scoped_read on public.satria_nested_trash_entries;
create policy satria_nested_scoped_read on public.satria_nested_trash_entries for select to authenticated using (
 public.satria_is_admin(organization_id)
 or (collection in ('penawaran','item') and exists (
   select 1 from public.satria_memberships m where m.organization_id=satria_nested_trash_entries.organization_id
   and m.user_id=auth.uid() and m.active and m.role in ('operator','viewer'))
   and public.satria_user_can_access_scope(organization_id,opd_id,fiscal_year))
);

-- Reject unarchived nested removals made by ordinary package upserts and full snapshot saves.
-- Active packages may be removed only through the Stage 2 top-level archive RPC.
create or replace function public.satria_require_nested_archive()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_prev jsonb; v_next jsonb; v_offer jsonb; v_item jsonb; v_id text;
begin
 for v_prev in select value from jsonb_array_elements(
   case when jsonb_typeof(old.payload->'paket')='array' then old.payload->'paket' else '[]'::jsonb end) r(value)
 loop
  v_id:=v_prev->>'id';
  select value into v_next from jsonb_array_elements(
   case when jsonb_typeof(new.payload->'paket')='array' then new.payload->'paket' else '[]'::jsonb end) r(value)
   where value->>'id'=v_id limit 1;
  if not found then continue; end if; -- Stage 2 protects removal of whole package.
  for v_offer in select value from jsonb_array_elements(
   case when jsonb_typeof(v_prev->'penawaran')='array' then v_prev->'penawaran' else '[]'::jsonb end) o(value)
  loop
   if not exists(select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_next->'penawaran')='array' then v_next->'penawaran' else '[]'::jsonb end) o(value)
      where value->>'id'=v_offer->>'id') then
     if not exists(select 1 from public.satria_nested_trash_entries t where t.organization_id=old.organization_id
       and t.collection='penawaran' and t.parent_id=v_id and t.record_id=v_offer->>'id'
       and t.record->'offer'=v_offer and t.delete_xid=txid_current() and t.restored_at is null) then
       raise exception 'Penawaran harus diarsipkan atomik sebelum dihapus' using errcode='23514';
     end if;
   end if;
  end loop;
  for v_item in select value from jsonb_array_elements(
   case when jsonb_typeof(v_prev->'items')='array' then v_prev->'items' else '[]'::jsonb end) i(value)
  loop
   if not exists(select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_next->'items')='array' then v_next->'items' else '[]'::jsonb end) i(value)
      where value->>'id'=v_item->>'id') then
     if not exists(select 1 from public.satria_nested_trash_entries t where t.organization_id=old.organization_id
       and t.collection='item' and t.parent_id=v_id and t.record_id=v_item->>'id'
       and t.record->'item'=v_item and t.delete_xid=txid_current() and t.restored_at is null) then
       raise exception 'Rincian barang harus diarsipkan atomik sebelum dihapus' using errcode='23514';
     end if;
   end if;
  end loop;
 end loop;
 -- Logo and kop are metadata. No physical Storage file is deleted here.
 if coalesce(old.payload->'pemda'->>'logo','')<>'' and coalesce(new.payload->'pemda'->>'logo','')='' then
  if not exists(select 1 from public.satria_nested_trash_entries t where t.organization_id=old.organization_id
    and t.collection='media' and t.parent_id='pemda' and t.record_id='pemda-logo'
    and t.record->>'value'=old.payload->'pemda'->>'logo'
    and t.delete_xid=txid_current() and t.restored_at is null) then
      raise exception 'Logo harus masuk Sampah cloud sebelum dihapus' using errcode='23514';
  end if;
 end if;
 for v_prev in select value from jsonb_array_elements(
   case when jsonb_typeof(old.payload->'opd')='array' then old.payload->'opd' else '[]'::jsonb end) o(value)
 loop
  select value into v_next from jsonb_array_elements(
   case when jsonb_typeof(new.payload->'opd')='array' then new.payload->'opd' else '[]'::jsonb end) o(value)
   where value->>'id'=v_prev->>'id' limit 1;
  if not found then continue; end if; -- Stage 2 guards whole OPD deletion.
  if coalesce(v_prev->>'kop','')<>'' and coalesce(v_next->>'kop','')='' then
   if not exists(select 1 from public.satria_nested_trash_entries t where t.organization_id=old.organization_id
     and t.collection='media' and t.parent_id=v_prev->>'id' and t.record_id=v_prev->>'id'
     and t.record->>'value'=v_prev->>'kop'
     and t.delete_xid=txid_current() and t.restored_at is null) then
      raise exception 'Kop OPD harus masuk Sampah cloud sebelum dihapus' using errcode='23514';
   end if;
  end if;
 end loop;
 return new;
end; $$;
revoke all on function public.satria_require_nested_archive() from public,anon,authenticated;
drop trigger if exists satria_state_nested_archive_guard on public.satria_state;
create trigger satria_state_nested_archive_guard before update of payload on public.satria_state
for each row execute function public.satria_require_nested_archive();

create or replace function public.satria_archive_nested(
 p_organization_id uuid,p_expected_version bigint,p_collection text,p_parent_id text,p_record_id text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_actor uuid:=auth.uid();v_role text;v_state public.satria_state%rowtype;v_parent jsonb;
 v_item jsonb;v_new jsonb;v_payload jsonb;v_result jsonb;v_trash uuid;v_opd text;v_year integer;
begin
 if v_actor is null then raise exception 'Login diperlukan' using errcode='42501';end if;
 select role into v_role from public.satria_memberships where organization_id=p_organization_id
  and user_id=v_actor and active=true for share;
 if not found or v_role not in ('admin','operator') then raise exception 'Tidak berwenang mengarsipkan' using errcode='42501';end if;
 if p_collection not in ('penawaran','item','media') or length(coalesce(p_parent_id,'')) not between 1 and 200
   or length(coalesce(p_record_id,'')) not between 1 and 200 then
  raise exception 'Jenis/ID tidak didukung' using errcode='22023';end if;
 if p_collection='media' and v_role<>'admin' then raise exception 'Media identitas hanya untuk Admin' using errcode='42501';end if;
 select * into v_state from public.satria_state where organization_id=p_organization_id for update;
 if not found then raise exception 'Data organisasi tidak ditemukan' using errcode='P0002';end if;
 if p_expected_version is null or v_state.version<>p_expected_version then
  raise exception 'Konflik versi: tarik ulang data cloud' using errcode='40001';end if;
 v_payload:=v_state.payload;
 if p_collection in ('penawaran','item') then
  select value into v_parent from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array'
   then v_payload->'paket' else '[]'::jsonb end) p(value) where value->>'id'=p_parent_id limit 1;
  if not found then raise exception 'Paket induk tidak ditemukan' using errcode='P0002';end if;
  if p_collection='penawaran' then
   select value into v_item from jsonb_array_elements(case when jsonb_typeof(v_parent->'penawaran')='array'
    then v_parent->'penawaran' else '[]'::jsonb end) o(value) where value->>'id'=p_record_id limit 1;
   if not found then raise exception 'Penawaran tidak ditemukan' using errcode='P0002';end if;
  else
   select value into v_item from jsonb_array_elements(case when jsonb_typeof(v_parent->'items')='array'
    then v_parent->'items' else '[]'::jsonb end) i(value) where value->>'id'=p_record_id limit 1;
   if not found then raise exception 'Rincian barang tidak ditemukan' using errcode='P0002';end if;
   -- Do not erase linked provider/negotiation evidence. Archive offers first or
   -- retain the item until the evidence is no longer referenced.
   if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_parent->'penawaran')='array'
      then v_parent->'penawaran' else '[]'::jsonb end) o(value)
      where (o.value->'harga' ? p_record_id) or (o.value->'nego' ? p_record_id)
         or (o.value->'negoDetails' ? p_record_id) or (o.value->'catalogRefs' ? p_record_id)) then
      raise exception 'Rincian masih memiliki bukti harga/negosiasi; arsip penawaran terkait terlebih dahulu' using errcode='23503';
   end if;
  end if;
  v_opd:=v_parent->>'opd';
  if coalesce(v_parent->>'tahun','') !~ '^[0-9]{4}$' then raise exception 'Tahun paket tidak valid' using errcode='22023';end if;
  v_year:=(v_parent->>'tahun')::integer;
  if not public.satria_user_can_access_scope(p_organization_id,v_opd,v_year) then
   raise exception 'Paket di luar OPD/tahun akun' using errcode='42501';end if;
  if p_collection='penawaran' then
   v_new:=jsonb_set(v_parent,'{penawaran}',
     (select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(
       case when jsonb_typeof(v_parent->'penawaran')='array' then v_parent->'penawaran' else '[]'::jsonb end)
       with ordinality o(value,ord) where value->>'id'<>p_record_id),true);
   if v_parent->>'pemenangId'=p_record_id then v_new:=jsonb_set(v_new,'{pemenangId}','null'::jsonb,true);end if;
   v_item:=jsonb_build_object('paketId',p_parent_id,'offer',v_item,
     'wasWinner',coalesce(v_parent->>'pemenangId','')=p_record_id);
  else
   v_new:=jsonb_set(v_parent,'{items}',
     (select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(
       case when jsonb_typeof(v_parent->'items')='array' then v_parent->'items' else '[]'::jsonb end)
       with ordinality i(value,ord) where value->>'id'<>p_record_id),true);
   v_item:=jsonb_build_object('paketId',p_parent_id,'item',v_item);
  end if;
 else
  if p_parent_id='pemda' and p_record_id='pemda-logo' then
   v_item:=jsonb_build_object('owner','pemda','value',coalesce(v_payload->'pemda'->>'logo',''));
   if v_item->>'value'='' then raise exception 'Logo tidak tersedia' using errcode='P0002';end if;
   v_payload:=jsonb_set(v_payload,'{pemda}',(coalesce(v_payload->'pemda','{}'::jsonb)-'logo'),true);
  elsif p_parent_id=p_record_id then
   select value into v_parent from jsonb_array_elements(case when jsonb_typeof(v_payload->'opd')='array'
     then v_payload->'opd' else '[]'::jsonb end) o(value) where value->>'id'=p_parent_id limit 1;
   if not found or coalesce(v_parent->>'kop','')='' then raise exception 'Kop OPD tidak ditemukan' using errcode='P0002';end if;
   v_item:=jsonb_build_object('owner','opd','opdId',p_parent_id,'value',v_parent->>'kop');
   v_new:=v_parent-'kop';
  else raise exception 'Media hanya mendukung logo Pemda/kop OPD' using errcode='22023';end if;
 end if;
 if octet_length(v_item::text)>6000000 then raise exception 'Arsip melampaui 6 MB; backup data secara manual' using errcode='22023';end if;
 insert into public.satria_nested_trash_entries(organization_id,collection,parent_id,record_id,record_summary,record,opd_id,fiscal_year,deleted_by)
 values(p_organization_id,p_collection,p_parent_id,p_record_id,
   left(case when p_collection='penawaran' then 'Penawaran '||p_record_id when p_collection='item' then 'Rincian barang '||p_record_id else 'Media '||p_parent_id end,240),
   v_item,v_opd,v_year,v_actor) returning id into v_trash;
 if p_collection in ('penawaran','item') then
  v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
   jsonb_build_array(jsonb_build_object('collection','paket','op','upsert','id',p_parent_id,'row',v_new)));
 elsif p_parent_id='pemda' then
  v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
   jsonb_build_array(jsonb_build_object('collection','pemda','op','replace','value',v_payload->'pemda')));
 else
  v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
   jsonb_build_array(jsonb_build_object('collection','opd','op','upsert','id',p_parent_id,'row',v_new)));
 end if;
 return jsonb_build_object('status','archived','trash_id',v_trash,'version',v_result->'version');
end; $$;
revoke all on function public.satria_archive_nested(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.satria_archive_nested(uuid,bigint,text,text,text) to authenticated;

create or replace function public.satria_restore_nested(
 p_organization_id uuid,p_expected_version bigint,p_trash_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_actor uuid:=auth.uid();v_role text;v_state public.satria_state%rowtype;v_entry public.satria_nested_trash_entries%rowtype;
 v_parent jsonb;v_new jsonb;v_result jsonb;v_value jsonb;
begin
 if v_actor is null then raise exception 'Login diperlukan' using errcode='42501';end if;
 select role into v_role from public.satria_memberships where organization_id=p_organization_id
 and user_id=v_actor and active=true for share;
 if not found or v_role not in ('admin','operator') then raise exception 'Tidak berwenang memulihkan' using errcode='42501';end if;
 select * into v_state from public.satria_state where organization_id=p_organization_id for update;
 if not found then raise exception 'Organisasi tidak ditemukan' using errcode='P0002';end if;
 if p_expected_version is null or v_state.version<>p_expected_version then raise exception 'Konflik versi' using errcode='40001';end if;
 select * into v_entry from public.satria_nested_trash_entries where id=p_trash_id and organization_id=p_organization_id
 and restored_at is null for update;
 if not found then raise exception 'Arsip tidak ditemukan / sudah dipulihkan' using errcode='P0002';end if;
 if v_entry.collection in ('penawaran','item') then
  if not public.satria_user_can_access_scope(p_organization_id,v_entry.opd_id,v_entry.fiscal_year) then
   raise exception 'Di luar kewenangan OPD/tahun' using errcode='42501';end if;
  select value into v_parent from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array'
   then v_state.payload->'paket' else '[]'::jsonb end) p(value) where value->>'id'=v_entry.parent_id limit 1;
  if not found then raise exception 'Pulihkan paket induk dahulu' using errcode='23503';end if;
  if v_parent->>'opd' is distinct from v_entry.opd_id or (v_parent->>'tahun')::integer is distinct from v_entry.fiscal_year then
   raise exception 'OPD/tahun induk telah berubah' using errcode='23503';end if;
  if v_entry.collection='penawaran' then
   v_value:=v_entry.record->'offer';
   if jsonb_typeof(v_value) is distinct from 'object' or v_value->>'id' is distinct from v_entry.record_id then
    raise exception 'Isi arsip penawaran tidak konsisten' using errcode='23514';end if;
   if not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array'
     then v_state.payload->'penyedia' else '[]'::jsonb end) y(value) where value->>'id'=v_value->>'pen') then
     raise exception 'Pulihkan penyedia dahulu' using errcode='23503';end if;
   if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_parent->'penawaran')='array'
     then v_parent->'penawaran' else '[]'::jsonb end) o(value)
     where value->>'id'=v_entry.record_id or value->>'pen'=v_value->>'pen') then
     raise exception 'Penawaran ID/penyedia sudah aktif; tidak boleh menimpa' using errcode='23505';end if;
   v_new:=jsonb_set(v_parent,'{penawaran}',coalesce(v_parent->'penawaran','[]'::jsonb)||jsonb_build_array(v_value),true);
   -- Restore the previously selected winner only when the slot is still free.
   -- A newer winner must never be silently overwritten by a restore.
   if v_entry.record->>'wasWinner'='true' then
    if nullif(v_parent->>'pemenangId','') is not null then
     raise exception 'Paket sudah menetapkan pemenang baru; batalkan penetapan dahulu sebelum pemulihan' using errcode='23505';
    end if;
    v_new:=jsonb_set(v_new,'{pemenangId}',to_jsonb(v_entry.record_id),true);
   end if;
  else
   v_value:=v_entry.record->'item';
   if jsonb_typeof(v_value) is distinct from 'object' or v_value->>'id' is distinct from v_entry.record_id then
    raise exception 'Isi arsip rincian barang tidak konsisten' using errcode='23514';end if;
   if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_parent->'items')='array'
     then v_parent->'items' else '[]'::jsonb end) i(value) where value->>'id'=v_entry.record_id) then
     raise exception 'ID rincian sudah dipakai; pemulihan tidak boleh menimpa' using errcode='23505';end if;
   v_new:=jsonb_set(v_parent,'{items}',coalesce(v_parent->'items','[]'::jsonb)||jsonb_build_array(v_value),true);
  end if;
  v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
   jsonb_build_array(jsonb_build_object('collection','paket','op','upsert','id',v_entry.parent_id,'row',v_new)));
 else
  if v_role<>'admin' then raise exception 'Media identitas hanya dapat dipulihkan Admin' using errcode='42501';end if;
  if jsonb_typeof(v_entry.record) is distinct from 'object' or coalesce(v_entry.record->>'value','')='' then
   raise exception 'Isi media tidak valid' using errcode='23514';end if;
  if v_entry.parent_id='pemda' and v_entry.record_id='pemda-logo' then
   if coalesce(v_state.payload->'pemda'->>'logo','')<>'' then raise exception 'Logo baru sudah terpasang' using errcode='23505';end if;
   v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
    jsonb_build_array(jsonb_build_object('collection','pemda','op','replace','value',
      jsonb_set(coalesce(v_state.payload->'pemda','{}'::jsonb),'{logo}',v_entry.record->'value',true))));
  else
   select value into v_parent from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'opd')='array'
    then v_state.payload->'opd' else '[]'::jsonb end) o(value) where value->>'id'=v_entry.parent_id limit 1;
   if not found then raise exception 'Pulihkan OPD lebih dahulu' using errcode='23503';end if;
   if coalesce(v_parent->>'kop','')<>'' then raise exception 'Kop OPD baru sudah terpasang' using errcode='23505';end if;
   v_new:=jsonb_set(v_parent,'{kop}',v_entry.record->'value',true);
   v_result:=public.satria_apply_state_delta_internal(p_organization_id,p_expected_version,
    jsonb_build_array(jsonb_build_object('collection','opd','op','upsert','id',v_entry.parent_id,'row',v_new)));
  end if;
 end if;
 update public.satria_nested_trash_entries set restored_at=now(),restored_by=v_actor where id=v_entry.id;
 return jsonb_build_object('status','restored','trash_id',v_entry.id,'version',v_result->'version');
end; $$;
revoke all on function public.satria_restore_nested(uuid,bigint,uuid) from public,anon;
grant execute on function public.satria_restore_nested(uuid,bigint,uuid) to authenticated;
comment on table public.satria_nested_trash_entries is
 'SATRIA nested recycle penawaran/rincian barang/media; archival snapshot only. Media cloud Storage objects are NOT deleted or restored by this migration.';
commit;
