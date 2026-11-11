-- SATRIA | Recovery integrity v1 — STAGING FIRST, after Stage 2 + nested recycle.
-- Preserve original array order and reject stale offer/HPS evidence.
-- No approval workflow, no permanent deletion, no physical media mutation.
-- Migration is intentionally additive: old archives have NULL original_position.
begin;

alter table public.satria_trash_entries
  add column if not exists original_position integer,
  add column if not exists prior_record_id text,
  add column if not exists next_record_id text;
alter table public.satria_nested_trash_entries
  add column if not exists original_position integer,
  add column if not exists prior_record_id text,
  add column if not exists next_record_id text;
-- Future archives use zero-based positions; existing legacy entries remain NULL.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='satria_trash_position_nonnegative') then
    alter table public.satria_trash_entries add constraint satria_trash_position_nonnegative
      check (original_position is null or original_position>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='satria_nested_position_nonnegative') then
    alter table public.satria_nested_trash_entries add constraint satria_nested_position_nonnegative
      check (original_position is null or original_position>=0);
  end if;
end $$;

-- Pure JSONB reorder: changes ONLY array position, never stored row/price/doc contents.
-- Legacy NULL positions preserve previous append semantics.
create or replace function public.satria_recover_original_order(
  p_array jsonb,p_record_id text,p_original_position integer,p_prior_id text,p_next_id text
) returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_found jsonb;v_before jsonb;v_after jsonb;v_other jsonb;v_matches integer;v_insert integer;v_anchor integer;
begin
 if p_original_position is null then return p_array;end if;
 if p_original_position<0 or jsonb_typeof(p_array) is distinct from 'array' then
   raise exception 'Invalid recovery position/array' using errcode='22023';
 end if;
 select count(*) into v_matches
 from jsonb_array_elements(p_array) e(value)
 where coalesce(e.value->>'id',e.value->>'kode')=p_record_id;
 if v_matches<>1 then
   raise exception 'Recovered record missing or duplicated' using errcode='23514';
 end if;
 select e.value into v_found from jsonb_array_elements(p_array) e(value)
 where coalesce(e.value->>'id',e.value->>'kode')=p_record_id limit 1;
 select coalesce(jsonb_agg(e.value order by e.ord),'[]'::jsonb) into v_other
 from jsonb_array_elements(p_array) with ordinality e(value,ord)
 where coalesce(e.value->>'id',e.value->>'kode') is distinct from p_record_id;
 -- Original zero-based index; clamp if unrelated rows have since been removed.
 -- Prefer an existing following sibling, then preceding sibling, then old index.
 -- This also preserves order when adjacent deleted rows are recovered in either order.
 v_insert:=least(p_original_position,jsonb_array_length(v_other));
 if p_next_id is not null then
   select (e.ord-1)::integer into v_anchor
   from jsonb_array_elements(v_other) with ordinality e(value,ord)
   where coalesce(e.value->>'id',e.value->>'kode')=p_next_id limit 1;
   if found then v_insert:=v_anchor;end if;
 end if;
 if v_anchor is null and p_prior_id is not null then
   select e.ord::integer into v_anchor
   from jsonb_array_elements(v_other) with ordinality e(value,ord)
   where coalesce(e.value->>'id',e.value->>'kode')=p_prior_id limit 1;
   if found then v_insert:=greatest(v_anchor,v_insert);end if;
 end if;
 select coalesce(jsonb_agg(e.value order by e.ord),'[]'::jsonb) into v_before
 from jsonb_array_elements(v_other) with ordinality e(value,ord)
 where e.ord<=v_insert;
 select coalesce(jsonb_agg(e.value order by e.ord),'[]'::jsonb) into v_after
 from jsonb_array_elements(v_other) with ordinality e(value,ord)
 where e.ord>v_insert;
 return v_before||jsonb_build_array(v_found)||v_after;
end $$;
revoke all on function public.satria_recover_original_order(jsonb,text,integer,text,text) from public,anon,authenticated;

-- Keep the tested Stage 2/5C transaction functions underneath compatibility wrappers.
-- No browser permission is granted on the underlying functions.
alter function public.satria_archive_record(uuid,bigint,text,text) rename to satria_archive_record_preorder;
alter function public.satria_restore_record(uuid,bigint,uuid) rename to satria_restore_record_preorder;
alter function public.satria_archive_nested(uuid,bigint,text,text,text) rename to satria_archive_nested_preorder;
alter function public.satria_restore_nested(uuid,bigint,uuid) rename to satria_restore_nested_preorder;
revoke all on function public.satria_archive_record_preorder(uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.satria_restore_record_preorder(uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.satria_archive_nested_preorder(uuid,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.satria_restore_nested_preorder(uuid,bigint,uuid) from public,anon,authenticated;

create function public.satria_archive_record(
 p_organization_id uuid,p_expected_version bigint,p_collection text,p_record_id text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_pos integer;v_result jsonb;v_actor uuid:=auth.uid();v_prior text;v_next text;v_array jsonb;v_saved integer;
begin
 -- Lock the snapshot BEFORE reading the position to prevent concurrent reorders.
 perform 1 from public.satria_state where organization_id=p_organization_id for update;
 -- A failed/unauthorized legacy RPC rolls back the entire transaction.
 select (e.ord-1)::integer into v_pos from public.satria_state s,
   lateral jsonb_array_elements(case when jsonb_typeof(s.payload->p_collection)='array'
       then s.payload->p_collection else '[]'::jsonb end) with ordinality e(value,ord)
 where s.organization_id=p_organization_id and coalesce(e.value->>'id',e.value->>'kode')=p_record_id
 limit 1;
 select payload->p_collection into v_array from public.satria_state where organization_id=p_organization_id;
 select coalesce(e.value->>'id',e.value->>'kode') into v_prior from jsonb_array_elements(v_array) with ordinality e(value,ord) where e.ord=v_pos;
 select coalesce(e.value->>'id',e.value->>'kode') into v_next from jsonb_array_elements(v_array) with ordinality e(value,ord) where e.ord=v_pos+2;
 -- Account for other un-restored siblings so multiple successive deletions keep
 -- their relative ranks even if restored in a different order.
 for v_saved in select original_position from public.satria_trash_entries
   where organization_id=p_organization_id and collection=p_collection and restored_at is null
     and original_position is not null order by original_position loop
   if v_saved<=v_pos then v_pos:=v_pos+1;end if;
 end loop;
 v_result:=public.satria_archive_record_preorder(p_organization_id,p_expected_version,p_collection,p_record_id);
 update public.satria_trash_entries set original_position=v_pos,prior_record_id=v_prior,next_record_id=v_next
 where id=(v_result->>'trash_id')::uuid and organization_id=p_organization_id
   and deleted_by=v_actor and delete_xid=txid_current() and restored_at is null;
 if not found or v_pos is null then
   raise exception 'Tidak dapat menyimpan posisi arsip; transaksi dibatalkan' using errcode='23514';
 end if;
 return v_result;
end $$;
revoke all on function public.satria_archive_record(uuid,bigint,text,text) from public,anon;
grant execute on function public.satria_archive_record(uuid,bigint,text,text) to authenticated;

create function public.satria_restore_record(
 p_organization_id uuid,p_expected_version bigint,p_trash_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_entry public.satria_trash_entries%rowtype;v_result jsonb;v_array jsonb;v_reordered jsonb;
begin
 perform 1 from public.satria_state where organization_id=p_organization_id for update;
 select * into v_entry from public.satria_trash_entries
 where organization_id=p_organization_id and id=p_trash_id and restored_at is null for update;
 -- Legacy permission/scope/version/reference checks still enforce the entire restore.
 v_result:=public.satria_restore_record_preorder(p_organization_id,p_expected_version,p_trash_id);
 if v_entry.original_position is not null then
   select payload->v_entry.collection into v_array from public.satria_state
   where organization_id=p_organization_id for update;
   v_reordered:=public.satria_recover_original_order(v_array,v_entry.record_id,v_entry.original_position,v_entry.prior_record_id,v_entry.next_record_id);
   if v_reordered is distinct from v_array then
     update public.satria_state set payload=jsonb_set(payload,array[v_entry.collection],v_reordered,true)
       where organization_id=p_organization_id;
   end if;
 end if;
 return v_result;
end $$;
revoke all on function public.satria_restore_record(uuid,bigint,uuid) from public,anon;
grant execute on function public.satria_restore_record(uuid,bigint,uuid) to authenticated;

create function public.satria_archive_nested(
 p_organization_id uuid,p_expected_version bigint,p_collection text,p_parent_id text,p_record_id text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_parent jsonb;v_pos integer;v_digest text;v_result jsonb;v_actor uuid:=auth.uid();v_field text;v_prior text;v_next text;v_list jsonb;v_saved integer;
begin
 perform 1 from public.satria_state where organization_id=p_organization_id for update;
 if p_collection in ('penawaran','item') then
   select p.value into v_parent from public.satria_state s,
     lateral jsonb_array_elements(case when jsonb_typeof(s.payload->'paket')='array'
       then s.payload->'paket' else '[]'::jsonb end) p(value)
   where s.organization_id=p_organization_id and p.value->>'id'=p_parent_id limit 1;
   v_field:=case when p_collection='penawaran' then 'penawaran' else 'items' end;
   select (e.ord-1)::integer into v_pos
   from jsonb_array_elements(case when jsonb_typeof(v_parent->v_field)='array'
      then v_parent->v_field else '[]'::jsonb end) with ordinality e(value,ord)
   where e.value->>'id'=p_record_id limit 1;
   v_list:=case when jsonb_typeof(v_parent->v_field)='array' then v_parent->v_field else '[]'::jsonb end;
   select coalesce(e.value->>'id',e.value->>'kode') into v_prior from jsonb_array_elements(v_list) with ordinality e(value,ord) where e.ord=v_pos;
   select coalesce(e.value->>'id',e.value->>'kode') into v_next from jsonb_array_elements(v_list) with ordinality e(value,ord) where e.ord=v_pos+2;
   for v_saved in select original_position from public.satria_nested_trash_entries
     where organization_id=p_organization_id and collection=p_collection and parent_id=p_parent_id
       and restored_at is null and original_position is not null order by original_position loop
     if v_saved<=v_pos then v_pos:=v_pos+1;end if;
   end loop;
   if p_collection='penawaran' then
     v_digest:=md5(coalesce(v_parent->'items','[]'::jsonb)::text);
   end if;
 end if;
 v_result:=public.satria_archive_nested_preorder(p_organization_id,p_expected_version,p_collection,p_parent_id,p_record_id);
 update public.satria_nested_trash_entries set original_position=v_pos,prior_record_id=v_prior,next_record_id=v_next,
   record=case when p_collection='penawaran' then record||jsonb_build_object('itemsDigest',v_digest)
          else record end
 where id=(v_result->>'trash_id')::uuid and organization_id=p_organization_id
  and deleted_by=v_actor and delete_xid=txid_current() and restored_at is null;
 if not found or (p_collection in ('penawaran','item') and v_pos is null) then
   raise exception 'Posisi/rincian arsip tidak lengkap; transaksi dibatalkan' using errcode='23514';
 end if;
 return v_result;
end $$;
revoke all on function public.satria_archive_nested(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.satria_archive_nested(uuid,bigint,text,text,text) to authenticated;

create function public.satria_restore_nested(
 p_organization_id uuid,p_expected_version bigint,p_trash_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_entry public.satria_nested_trash_entries%rowtype;v_parent jsonb;v_current jsonb;
 v_value jsonb;v_field text;v_reordered jsonb;v_packages jsonb;v_result jsonb;
begin
 -- Authorization BEFORE reading data/digests. Legacy RPC still checks full OPD/year scope.
 if auth.uid() is null or not exists(
    select 1 from public.satria_memberships m
    where m.organization_id=p_organization_id and m.user_id=auth.uid()
      and m.active=true and m.role in ('admin','operator')
 ) then raise exception 'Tidak berwenang memulihkan' using errcode='42501';end if;
 perform 1 from public.satria_state where organization_id=p_organization_id for update;
 select * into v_entry from public.satria_nested_trash_entries
 where organization_id=p_organization_id and id=p_trash_id and restored_at is null for update;
 if v_entry.collection='penawaran' then
   select p.value into v_parent from public.satria_state s,
     lateral jsonb_array_elements(case when jsonb_typeof(s.payload->'paket')='array'
       then s.payload->'paket' else '[]'::jsonb end) p(value)
   where s.organization_id=p_organization_id and p.value->>'id'=v_entry.parent_id limit 1;
   if v_entry.record ? 'itemsDigest' and
       md5(coalesce(v_parent->'items','[]'::jsonb)::text) is distinct from v_entry.record->>'itemsDigest' then
     raise exception 'Rincian/HPS paket berubah sejak penawaran diarsipkan. Pemulihan ditolak agar dokumen dan harga tidak berubah diam-diam.'
       using errcode='23503';
   end if;
 end if;
 -- All original permission, collision, FK, winner and optimistic-lock checks remain active.
 v_result:=public.satria_restore_nested_preorder(p_organization_id,p_expected_version,p_trash_id);
 if v_entry.original_position is not null and v_entry.collection in ('penawaran','item') then
   v_field:=case when v_entry.collection='penawaran' then 'penawaran' else 'items' end;
   select p.value into v_parent from public.satria_state s,
     lateral jsonb_array_elements(case when jsonb_typeof(s.payload->'paket')='array'
       then s.payload->'paket' else '[]'::jsonb end) p(value)
   where s.organization_id=p_organization_id and p.value->>'id'=v_entry.parent_id limit 1;
   if v_parent is null then raise exception 'Paket hasil pemulihan tidak ditemukan' using errcode='23514';end if;
   v_current:=v_parent->v_field;
   v_reordered:=public.satria_recover_original_order(v_current,v_entry.record_id,v_entry.original_position,v_entry.prior_record_id,v_entry.next_record_id);
   if v_reordered is distinct from v_current then
     v_parent:=jsonb_set(v_parent,array[v_field],v_reordered,true);
     select coalesce(jsonb_agg(case when p.value->>'id'=v_entry.parent_id then v_parent else p.value end order by p.ord),'[]'::jsonb)
     into v_packages
     from jsonb_array_elements((select payload->'paket' from public.satria_state where organization_id=p_organization_id))
       with ordinality p(value,ord);
     update public.satria_state set payload=jsonb_set(payload,'{paket}',v_packages,true)
       where organization_id=p_organization_id;
   end if;
 end if;
 return v_result;
end $$;
revoke all on function public.satria_restore_nested(uuid,bigint,uuid) from public,anon;
grant execute on function public.satria_restore_nested(uuid,bigint,uuid) to authenticated;

comment on function public.satria_recover_original_order(jsonb,text,integer,text,text)
 is 'Repositions restored record by captured zero-based position; never modifies item/HPS/offer payloads.';
comment on function public.satria_restore_nested(uuid,bigint,uuid)
 is 'Atomic restore with original order; refuses newly archived offers if HPS item snapshot has changed.';
notify pgrst,'reload schema';
commit;
