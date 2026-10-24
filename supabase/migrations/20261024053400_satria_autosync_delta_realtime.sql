-- SATRIA 3.0 — delta autosave + Supabase Realtime metadata notifications.
-- Apply after 20261024053300_satria_shared_master_collaboration.sql.
-- Normal saves send only changed rows/fields. Full snapshot replacement remains an explicit admin-only restore/bootstrap operation.
begin;

-- This table exposes only a version/timestamp/actor signal to active organization members; no business payload is replicated here.
create table if not exists public.satria_sync_events (
  organization_id uuid primary key references public.satria_organizations(id) on delete cascade,
  version bigint not null check (version > 0),
  updated_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null
);

alter table public.satria_sync_events enable row level security;
revoke all on table public.satria_sync_events from public, anon, authenticated;
grant select on table public.satria_sync_events to authenticated;
drop policy if exists satria_sync_events_active_member_read on public.satria_sync_events;
create policy satria_sync_events_active_member_read
  on public.satria_sync_events for select to authenticated
  using (public.satria_is_member(organization_id));

create or replace function public.satria_publish_sync_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.satria_sync_events(organization_id, version, updated_at, actor_user_id)
  values (new.organization_id, new.version, coalesce(new.updated_at, now()), new.updated_by)
  on conflict (organization_id) do update
    set version = excluded.version,
        updated_at = excluded.updated_at,
        actor_user_id = excluded.actor_user_id;
  return new;
end;
$$;
revoke all on function public.satria_publish_sync_event() from public, anon, authenticated;
drop trigger if exists satria_state_publish_sync_event on public.satria_state;
create trigger satria_state_publish_sync_event
after insert or update on public.satria_state
for each row execute function public.satria_publish_sync_event();

insert into public.satria_sync_events(organization_id, version, updated_at, actor_user_id)
select organization_id, version, coalesce(updated_at, now()), updated_by
from public.satria_state
on conflict (organization_id) do update
  set version=excluded.version, updated_at=excluded.updated_at, actor_user_id=excluded.actor_user_id;

-- Supabase Realtime must publish the metadata signal table. Guard the migration so it is rerunnable.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'satria_sync_events'
     ) then
    execute 'alter publication supabase_realtime add table public.satria_sync_events';
  end if;
end;
$$;

-- Atomic delta API. Array deltas operate on one entity at a time; replacements are reserved for small admin-only settings.
create or replace function public.satria_apply_state_delta(
  p_organization_id uuid,
  p_expected_version bigint,
  p_changes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_state public.satria_state%rowtype;
  v_payload jsonb;
  v_change jsonb;
  v_collection text;
  v_operation text;
  v_id text;
  v_row jsonb;
  v_old jsonb;
  v_value jsonb;
  v_array jsonb;
  v_next_array jsonb;
  v_found boolean;
  v_opd_ids text[] := array[]::text[];
  v_years integer[] := array[]::integer[];
  v_year_text text;
  v_year integer;
  v_old_year integer;
  v_changed_packages text[] := array[]::text[];
  v_changed_entities integer := 0;
  v_new_version bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select m.role into v_role
  from public.satria_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = v_actor
    and m.active = true
  for share;
  if not found then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;
  if v_role = 'viewer' then
    raise exception 'Viewer is read-only' using errcode = '42501';
  end if;
  if v_role not in ('admin','operator') then
    raise exception 'Unsupported membership role' using errcode = '42501';
  end if;
  if p_changes is null then
    raise exception 'Delta changes are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Delta changes must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) < 1 or jsonb_array_length(p_changes) > 100
     or octet_length(p_changes::text) > 6000000 then
    raise exception 'Delta must contain 1–100 changes and be no larger than 6 MB' using errcode = '22023';
  end if;

  select * into v_state
  from public.satria_state s
  where s.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Organization snapshot is not initialized; an administrator must initialize it first' using errcode = 'P0002';
  end if;
  if p_expected_version is null or v_state.version <> p_expected_version then
    raise exception 'Version conflict: another user has saved newer data. Pull latest data and reconcile local changes before retrying.' using errcode = '40001';
  end if;
  v_payload := v_state.payload;

  if v_role <> 'admin' then
    select coalesce(array_agg(mo.opd_id order by mo.opd_id), array[]::text[])
    into v_opd_ids
    from public.satria_membership_opds mo
    join public.satria_opds o
      on o.organization_id = mo.organization_id
     and o.opd_id = mo.opd_id
     and o.active = true
    where mo.organization_id = p_organization_id
      and mo.user_id = v_actor;

    select coalesce(array_agg(my.fiscal_year order by my.fiscal_year), array[]::integer[])
    into v_years
    from public.satria_membership_years my
    where my.organization_id = p_organization_id
      and my.user_id = v_actor
      and exists (
        select 1
        from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'tahun') = 'array' then v_payload->'tahun' else '[]'::jsonb end) y(value)
        where y.value ~ '^[0-9]{4}$' and y.value::integer = my.fiscal_year
      );
    if cardinality(v_opd_ids) = 0 or cardinality(v_years) = 0 then
      raise exception 'Operator requires at least one active OPD and assigned fiscal year' using errcode = '42501';
    end if;
  end if;

  for v_change in select value from jsonb_array_elements(p_changes) x(value) loop
    if jsonb_typeof(v_change) is distinct from 'object' then
      raise exception 'Each delta must be a JSON object' using errcode = '22023';
    end if;
    v_collection := nullif(btrim(v_change->>'collection'), '');
    v_operation := lower(coalesce(v_change->>'op',''));
    if v_collection is null then
      raise exception 'Delta collection is required' using errcode = '22023';
    end if;

    -- Small, admin-only scalar/object settings. They are sent only when the setting changed.
    if v_collection = any(array['pemda','meta','penomoran','tahun']::text[]) then
      if v_role <> 'admin' then
        raise exception 'Only an administrator can change organization-wide settings or fiscal years' using errcode = '42501';
      end if;
      if v_operation <> 'replace' or not (v_change ? 'value') then
        raise exception 'Settings delta must use op=replace and include value' using errcode = '22023';
      end if;
      v_value := v_change->'value';
      if v_collection = 'tahun' then
        if jsonb_typeof(v_value) is distinct from 'array' then
          raise exception 'Fiscal years must be supplied as an array' using errcode = '22023';
        end if;
        if jsonb_array_length(v_value) < 1 then
          raise exception 'At least one fiscal year is required' using errcode = '22023';
        end if;
        for v_year_text in select value from jsonb_array_elements_text(v_value) y(value) loop
          if v_year_text !~ '^[0-9]{4}$' or v_year_text::integer < 2000 or v_year_text::integer > 2200 then
            raise exception 'Fiscal year must be a four-digit year from 2000 through 2200' using errcode = '22023';
          end if;
        end loop;
        if exists (
          select 1 from jsonb_array_elements_text(v_value) y(value)
          group by y.value having count(*) > 1
        ) then raise exception 'Fiscal years must be unique' using errcode = '23505'; end if;
        if exists (
          select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
          where coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$'
            and not exists (select 1 from jsonb_array_elements_text(v_value) y(value) where y.value = p.value->>'tahun')
        ) then raise exception 'Cannot remove a fiscal year still used by packages' using errcode = '23503'; end if;
        if exists (
          select 1 from public.satria_membership_years my
          where my.organization_id = p_organization_id
            and not exists (select 1 from jsonb_array_elements_text(v_value) y(value) where y.value::integer = my.fiscal_year)
        ) then raise exception 'Remove fiscal-year assignments before removing a year from the organization' using errcode = '23503'; end if;
      elsif jsonb_typeof(v_value) is distinct from 'object' then
        raise exception 'Organization setting must be a JSON object' using errcode = '22023';
      end if;
      v_payload := jsonb_set(v_payload, array[v_collection], v_value, true);
      v_changed_entities := v_changed_entities + 1;
      continue;
    end if;

    if v_collection not in ('paket','opd','unit','pejabat','penyedia','akun','kode') then
      raise exception 'Unsupported delta collection: %', v_collection using errcode = '22023';
    end if;
    if v_operation not in ('upsert','delete') then
      raise exception 'Array delta operation must be upsert or delete' using errcode = '22023';
    end if;
    v_array := case when jsonb_typeof(v_payload->v_collection) = 'array' then v_payload->v_collection else '[]'::jsonb end;
    v_id := nullif(btrim(v_change->>'id'), '');
    if v_operation = 'upsert' then
      v_row := v_change->'row';
      if jsonb_typeof(v_row) is distinct from 'object' then
        raise exception 'Upsert row must be a JSON object' using errcode = '22023';
      end if;
      v_id := coalesce(v_id, nullif(btrim(v_row->>'id'),''), nullif(btrim(v_row->>'kode'),''));
      if v_id is null or coalesce(v_row->>'id',v_row->>'kode') is distinct from v_id then
        raise exception 'Delta ID must match row.id (or row.kode for code catalog)' using errcode = '22023';
      end if;
    elsif v_id is null then
      raise exception 'Delete delta requires an ID' using errcode = '22023';
    end if;

    v_old := null;
    select e.value into v_old
    from jsonb_array_elements(v_array) e(value)
    where coalesce(e.value->>'id', e.value->>'kode') = v_id
    limit 1;

    if v_role <> 'admin' then
      if v_collection = 'paket' then
        if v_old is not null and (
          not ((v_old->>'opd') = any(v_opd_ids))
          or coalesce(v_old->>'tahun','') !~ '^[0-9]{4}$'
          or not ((v_old->>'tahun')::integer = any(v_years))
        ) then raise exception 'Existing package is outside your assigned OPD/year scope' using errcode = '42501'; end if;
        v_value := case when v_operation='upsert' then v_row else v_old end;
        if v_value is null or not ((v_value->>'opd') = any(v_opd_ids))
           or coalesce(v_value->>'tahun','') !~ '^[0-9]{4}$'
           or not ((v_value->>'tahun')::integer = any(v_years)) then
          raise exception 'Package delta is outside your assigned OPD/year scope' using errcode = '42501';
        end if;
      elsif v_collection in ('unit','pejabat') then
        if v_old is not null and not ((v_old->>'opd') = any(v_opd_ids)) then
          raise exception 'Existing master row is outside your assigned OPD scope' using errcode = '42501';
        end if;
        v_value := case when v_operation='upsert' then v_row else v_old end;
        if v_value is null or not ((v_value->>'opd') = any(v_opd_ids)) then
          raise exception 'Master row is outside your assigned OPD scope' using errcode = '42501';
        end if;
      elsif v_collection not in ('penyedia','akun') then
        raise exception 'Operators cannot modify the % catalog', v_collection using errcode = '42501';
      end if;
    end if;

    if v_operation = 'delete' and v_old is null then
      raise exception 'Cannot delete missing row % from %', v_id, v_collection using errcode = 'P0002';
    end if;

    -- Validate master rows and stable identities before writing the delta.
    if v_operation = 'upsert' then
      if v_collection = 'paket' then
        if coalesce(v_row->>'tahun','') !~ '^[0-9]{4}$' or (v_row->>'tahun')::integer not between 2000 and 2200
           or nullif(btrim(v_row->>'opd'),'') is null then
          raise exception 'Package must contain a valid OPD and fiscal year' using errcode = '22023';
        end if;
        if not exists (
          select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'opd')='array' then v_payload->'opd' else '[]'::jsonb end) o(value)
          where o.value->>'id'=v_row->>'opd'
        ) then raise exception 'Package references an unknown OPD' using errcode='23503'; end if;
        if not exists (
          select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'tahun')='array' then v_payload->'tahun' else '[]'::jsonb end) y(value)
          where y.value=v_row->>'tahun'
        ) then raise exception 'Package references a fiscal year not registered in the organization' using errcode='23503'; end if;
      elsif v_collection in ('unit','pejabat') then
        if nullif(btrim(v_row->>'opd'),'') is null or not exists (
          select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'opd')='array' then v_payload->'opd' else '[]'::jsonb end) o(value)
          where o.value->>'id' = v_row->>'opd'
        ) then raise exception 'Master row references an unknown OPD' using errcode = '23503'; end if;
      elsif v_collection = 'opd' then
        if v_role <> 'admin' then raise exception 'Only an administrator can manage OPD catalog' using errcode = '42501'; end if;
        if nullif(btrim(v_row->>'nama'),'') is null or nullif(btrim(v_row->>'singkat'),'') is null then
          raise exception 'OPD requires name and abbreviation' using errcode = '22023';
        end if;
      elsif v_collection = 'akun' then
        if nullif(btrim(v_row->>'kode'),'') is null or nullif(btrim(v_row->>'nama'),'') is null then
          raise exception 'Account catalog requires code and name' using errcode = '22023';
        end if;
      elsif v_collection = 'penyedia' then
        if nullif(btrim(v_row->>'nama'),'') is null then raise exception 'Supplier name is required' using errcode = '22023'; end if;
      elsif v_collection = 'kode' and v_role <> 'admin' then
        raise exception 'Only an administrator can manage the reference code catalog' using errcode = '42501';
      end if;
    end if;

    -- Referential integrity: do not delete masters still referenced by any package.
    if v_operation = 'delete' then
      if v_collection = 'unit' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'unit' = v_id
      ) then raise exception 'Unit is still referenced by packages; deactivate it instead of deleting' using errcode = '23503'; end if;
      if v_collection = 'pejabat' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'ppk'=v_id or p.value->>'pp'=v_id or p.value->>'kabid'=v_id
      ) then raise exception 'Official is still referenced by packages; deactivate it instead of deleting' using errcode = '23503'; end if;
      if v_collection = 'opd' and exists (
        select 1 from public.satria_membership_opds mo
        where mo.organization_id=p_organization_id and mo.opd_id=v_id
      ) then raise exception 'OPD is still assigned to user accounts; reassign users before deleting the OPD' using errcode = '23503'; end if;
      if v_collection = 'opd' and (
        exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value) where p.value->>'opd'=v_id)
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'unit')='array' then v_payload->'unit' else '[]'::jsonb end) u(value) where u.value->>'opd'=v_id)
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'pejabat')='array' then v_payload->'pejabat' else '[]'::jsonb end) j(value) where j.value->>'opd'=v_id)
      ) then raise exception 'OPD is still referenced by business records or masters' using errcode = '23503'; end if;
      if v_collection = 'penyedia' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) offer(value)
        where offer.value->>'pen' = v_id
      ) then raise exception 'Supplier is still referenced by package offers; deactivate it instead of deleting' using errcode = '23503'; end if;
      if v_collection = 'akun' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'akunId' = v_id
      ) then raise exception 'Account master is still referenced by packages; deactivate it instead of deleting' using errcode = '23503'; end if;
    end if;

    -- Do not move a unit/official to another OPD while any package still references the stable ID.
    if v_old is not null and v_operation='upsert'
       and v_collection in ('unit','pejabat') and (v_old->>'opd') is distinct from (v_row->>'opd') then
      if v_collection='unit' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'unit'=v_id
      ) then raise exception 'Unit is referenced by packages and cannot be moved to another OPD' using errcode = '23503'; end if;
      if v_collection='pejabat' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'ppk'=v_id or p.value->>'pp'=v_id or p.value->>'kabid'=v_id
      ) then raise exception 'Official is referenced by packages and cannot be moved to another OPD' using errcode = '23503'; end if;
    end if;

    -- A master referenced by a package outside an Operator's OPD/year scope cannot be moved or edited in a way that changes its OPD.
    if v_role <> 'admin' and v_old is not null and v_operation='upsert'
       and v_collection in ('unit','pejabat') and v_old is distinct from v_row then
      if v_collection='unit' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'unit'=v_id
          and not (p.value->>'opd'=any(v_opd_ids)
            and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end)
      ) then raise exception 'Unit referenced outside your OPD/year scope cannot be moved' using errcode = '42501'; end if;
      if v_collection='pejabat' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
        where (p.value->>'ppk'=v_id or p.value->>'pp'=v_id or p.value->>'kabid'=v_id)
          and not (p.value->>'opd'=any(v_opd_ids)
            and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end)
      ) then raise exception 'Official referenced outside your OPD/year scope cannot be moved' using errcode = '42501'; end if;
    end if;

    if v_operation='delete' then
      select coalesce(jsonb_agg(e.value order by e.ord),'[]'::jsonb)
      into v_next_array
      from jsonb_array_elements(v_array) with ordinality e(value,ord)
      where coalesce(e.value->>'id',e.value->>'kode') <> v_id;
    else
      select exists (
        select 1 from jsonb_array_elements(v_array) e(value)
        where coalesce(e.value->>'id',e.value->>'kode')=v_id
      ) into v_found;
      select coalesce(jsonb_agg(case when coalesce(e.value->>'id',e.value->>'kode')=v_id then v_row else e.value end order by e.ord),'[]'::jsonb)
      into v_next_array
      from jsonb_array_elements(v_array) with ordinality e(value,ord);
      if not v_found then v_next_array := v_next_array || jsonb_build_array(v_row); end if;
    end if;
    v_payload := jsonb_set(v_payload, array[v_collection], v_next_array, true);

    if v_collection='opd' then
      if v_operation='delete' then
        delete from public.satria_opds where organization_id=p_organization_id and opd_id=v_id;
      else
        insert into public.satria_opds(organization_id,opd_id,name,code,active)
        values (
          p_organization_id,
          v_id,
          btrim(v_row->>'nama'),
          nullif(btrim(v_row->>'singkat'),''),
          case lower(coalesce(v_row->>'aktif','true')) when 'false' then false when '0' then false when 'nonaktif' then false else true end
        )
        on conflict (organization_id,opd_id) do update
          set name=excluded.name,code=excluded.code,active=excluded.active;
      end if;
    end if;

    if v_collection='paket' then v_changed_packages := array_append(v_changed_packages, v_id); end if;
    v_changed_entities := v_changed_entities + 1;
  end loop;

  -- Validate package references after all deltas in this batch have been applied, allowing a package and its master to be saved together.
  for v_id in select distinct unnest(v_changed_packages) loop
    v_row := null;
    select p.value into v_row
    from jsonb_array_elements(case when jsonb_typeof(v_payload->'paket')='array' then v_payload->'paket' else '[]'::jsonb end) p(value)
    where p.value->>'id'=v_id limit 1;
    if v_row is null then continue; end if; -- deletion
    if nullif(v_row->>'unit','') is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'unit')='array' then v_payload->'unit' else '[]'::jsonb end) u(value)
      where u.value->>'id'=v_row->>'unit' and u.value->>'opd'=v_row->>'opd'
    ) then raise exception 'Package references a unit outside its OPD or a missing unit' using errcode='23503'; end if;
    if nullif(v_row->>'ppk','') is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'pejabat')='array' then v_payload->'pejabat' else '[]'::jsonb end) j(value)
      where j.value->>'id'=v_row->>'ppk' and j.value->>'opd'=v_row->>'opd'
    ) then raise exception 'Package PPK reference is missing or belongs to another OPD' using errcode='23503'; end if;
    if nullif(v_row->>'pp','') is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'pejabat')='array' then v_payload->'pejabat' else '[]'::jsonb end) j(value)
      where j.value->>'id'=v_row->>'pp' and j.value->>'opd'=v_row->>'opd'
    ) then raise exception 'Package Pejabat Pengadaan reference is missing or belongs to another OPD' using errcode='23503'; end if;
    if nullif(v_row->>'kabid','') is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'pejabat')='array' then v_payload->'pejabat' else '[]'::jsonb end) j(value)
      where j.value->>'id'=v_row->>'kabid' and j.value->>'opd'=v_row->>'opd'
    ) then raise exception 'Package Kepala Bidang reference is missing or belongs to another OPD' using errcode='23503'; end if;
    if jsonb_typeof(v_row->'penawaran')='array' and exists (
      select 1 from jsonb_array_elements(v_row->'penawaran') o(value)
      where nullif(o.value->>'pen','') is not null and not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'penyedia')='array' then v_payload->'penyedia' else '[]'::jsonb end) s(value)
        where s.value->>'id'=o.value->>'pen'
      )
    ) then raise exception 'Package offer references an unknown supplier' using errcode='23503'; end if;
    if nullif(v_row->>'akunId','') is not null and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_payload->'akun')='array' then v_payload->'akun' else '[]'::jsonb end) a(value)
      where a.value->>'id'=v_row->>'akunId'
    ) then raise exception 'Package references an unknown account master' using errcode='23503'; end if;
  end loop;

  if exists (
    select lower(btrim(a.value->>'kode'))
    from jsonb_array_elements(case when jsonb_typeof(v_payload->'akun')='array' then v_payload->'akun' else '[]'::jsonb end) a(value)
    where nullif(btrim(a.value->>'kode'),'') is not null
    group by lower(btrim(a.value->>'kode')) having count(*)>1
  ) then raise exception 'Account code must be unique across the organization catalog' using errcode='23505'; end if;

  v_new_version := v_state.version + 1;
  update public.satria_state
  set payload = v_payload, version = v_new_version, updated_at = now(), updated_by = v_actor
  where organization_id = p_organization_id;

  -- Keep a concise audit record without copying business data or passwords into the log.
  -- The allowed audit action is added by this migration; insert only metadata here.
  insert into public.satria_admin_audit_logs(organization_id,actor_user_id,target_user_id,action,details)
  values (p_organization_id,v_actor,v_actor,'state_delta_saved',jsonb_build_object('version',v_new_version,'change_count',v_changed_entities,'collections',(
    select coalesce(jsonb_agg(distinct c.value->>'collection'),'[]'::jsonb) from jsonb_array_elements(p_changes) c(value)
  )));

  return jsonb_build_object('version',v_new_version,'changes_applied',v_changed_entities,'updated_at',now());
end;
$$;

-- Extend the existing audit action CHECK constraint in a repeatable way.
alter table public.satria_admin_audit_logs
  drop constraint if exists satria_admin_audit_logs_action_check;
alter table public.satria_admin_audit_logs
  add constraint satria_admin_audit_logs_action_check
  check (action in ('user_invited','user_created','user_opd_assignment_updated','user_year_assignment_updated','scoped_state_saved','state_delta_saved'));
revoke all on function public.satria_apply_state_delta(uuid,bigint,jsonb) from public, anon;
grant execute on function public.satria_apply_state_delta(uuid,bigint,jsonb) to authenticated;

comment on function public.satria_apply_state_delta(uuid,bigint,jsonb) is
  'Applies optimistic-version-checked per-row or settings deltas. Enforces role and assigned OPD/year server-side; does not accept full organization snapshots.';
comment on table public.satria_sync_events is
  'Realtime notification metadata only: current version, timestamp, and actor. Contains no business payload.';

commit;
