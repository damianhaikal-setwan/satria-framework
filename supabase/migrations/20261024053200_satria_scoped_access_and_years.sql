-- SATRIA security hardening, stages 1-3:
-- 1) harden the transitional snapshot: direct reads and full-state writes are admin-only;
-- 2) expose a server-filtered OPD+year payload and merge only the caller's assigned scope;
-- 3) keep all existing UI reports/exports on that scoped payload, and assign years explicitly.
-- Apply after the SATRIA bootstrap and migrations 20261024_satria_user_creation_security.sql,
-- 20261024052900_satria_opd_assignments_rls.sql, 20261024053000_satria_user_opd_assignment_api.sql,
-- and 20261024053100_satria_catalog_and_assignment_repair.sql.

begin;

-- A non-admin must have explicit OPD AND fiscal-year assignments.
create table if not exists public.satria_membership_years (
  organization_id uuid not null,
  user_id uuid not null,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, user_id, fiscal_year),
  foreign key (organization_id, user_id)
    references public.satria_memberships (organization_id, user_id) on delete cascade
);
create index if not exists satria_membership_years_scope_idx
  on public.satria_membership_years (organization_id, fiscal_year, user_id);

alter table public.satria_membership_years enable row level security;
revoke all on table public.satria_membership_years from public, anon, authenticated;
grant select on table public.satria_membership_years to authenticated;
grant select, insert, update, delete on table public.satria_membership_years to service_role;
drop policy if exists satria_membership_years_read_self_or_admin on public.satria_membership_years;
create policy satria_membership_years_read_self_or_admin
  on public.satria_membership_years for select to authenticated
  using (
    public.satria_is_admin(organization_id)
    or (user_id = auth.uid() and public.satria_is_member(organization_id))
  );

-- Security helper for future normalized business tables. Both dimensions are required.
create or replace function public.satria_user_can_access_scope(
  p_organization_id uuid,
  p_opd_id text,
  p_fiscal_year integer
) returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select auth.uid() is not null
    and p_opd_id is not null
    and p_fiscal_year between 2000 and 2200
    and exists (
      select 1 from public.satria_memberships m
      where m.organization_id = p_organization_id
        and m.user_id = auth.uid()
        and m.active = true
        and (
          m.role = 'admin'
          or (
            exists (
              select 1 from public.satria_membership_opds mo
              join public.satria_opds o
                on o.organization_id = mo.organization_id and o.opd_id = mo.opd_id
              where mo.organization_id = p_organization_id
                and mo.user_id = auth.uid()
                and mo.opd_id = p_opd_id
                and o.active = true
            )
            and exists (
              select 1 from public.satria_membership_years my
              where my.organization_id = p_organization_id
                and my.user_id = auth.uid()
                and my.fiscal_year = p_fiscal_year
            )
          )
        )
    );
$$;
revoke all on function public.satria_user_can_access_scope(uuid, text, integer) from public, anon;
grant execute on function public.satria_user_can_access_scope(uuid, text, integer) to authenticated;
comment on function public.satria_user_can_access_scope(uuid, text, integer) is
  'Authorization helper for business records: both active OPD assignment and explicit year assignment are required for non-admins.';

-- Operators and viewers must not use the direct table API to read the whole organization snapshot.
-- Remove every older policy on the snapshot table, including any accidentally permissive
-- FOR ALL policies. Leaving a second permissive policy would OR-bypass the admin-only rule.
do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'satria_state'
  loop
    execute format('drop policy %I on public.satria_state', v_policy.policyname);
  end loop;
end;
$$;
create policy satria_state_read_admin_only on public.satria_state
  for select to authenticated using (public.satria_is_admin(organization_id));
revoke all on table public.satria_state from public, anon;
revoke insert, update, delete, truncate, references, trigger on table public.satria_state from authenticated;
grant select on table public.satria_state to authenticated;

-- Full replacement is an administrator-only bootstrap/restore path. Operators use the scoped merge RPC below.
create or replace function public.satria_save_state(
  p_organization_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_version bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.satria_is_admin(p_organization_id) then
    raise exception 'Full organization snapshot replacement is restricted to active administrators' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload must be a JSON object' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 20000000 then
    raise exception 'Payload too large; remove embedded images and use Storage' using errcode = '54000';
  end if;
  select version into v_version from public.satria_state
    where organization_id = p_organization_id for update;
  if not found then
    if coalesce(p_expected_version, -1) <> 0 then
      raise exception 'Version conflict: pull latest state before retrying' using errcode = '40001';
    end if;
    insert into public.satria_state(organization_id, payload, version, updated_at, updated_by)
      values (p_organization_id, p_payload, 1, now(), auth.uid());
    return 1;
  end if;
  if p_expected_version is null or v_version <> p_expected_version then
    raise exception 'Version conflict: pull latest state before retrying' using errcode = '40001';
  end if;
  update public.satria_state set payload = p_payload, version = v_version + 1,
    updated_at = now(), updated_by = auth.uid()
    where organization_id = p_organization_id;
  return v_version + 1;
end;
$$;
revoke all on function public.satria_save_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.satria_save_state(uuid, bigint, jsonb) to authenticated;

-- Explicit atomic year assignment for active operator/viewer memberships.
create or replace function public.satria_admin_set_membership_years(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_years integer[]
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_role text;
  v_distinct_count integer;
  v_invalid_count integer;
begin
  if p_organization_id is null or p_actor_user_id is null or p_target_user_id is null then
    raise exception 'Required identifiers are missing' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.satria_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_actor_user_id
      and m.role = 'admin' and m.active = true
  ) then
    raise exception 'Active organization administrator required' using errcode = '42501';
  end if;
  select role into v_role from public.satria_memberships
    where organization_id = p_organization_id and user_id = p_target_user_id and active = true
    for update;
  if not found or v_role not in ('operator', 'viewer') then
    raise exception 'Year assignment is available only for active non-admin memberships' using errcode = '22023';
  end if;
  if p_years is null or cardinality(p_years) < 1 or cardinality(p_years) > 40 then
    raise exception 'Select between 1 and 40 fiscal years' using errcode = '22023';
  end if;
  select count(distinct y), count(*) filter (where y is null or y < 2000 or y > 2200)
    into v_distinct_count, v_invalid_count
  from unnest(p_years) as years(y);
  if v_invalid_count <> 0 or v_distinct_count <> cardinality(p_years) then
    raise exception 'Fiscal years are invalid or duplicated' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_years) as chosen(y)
    where not exists (
      select 1 from public.satria_state st
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(st.payload->'tahun')='array' then st.payload->'tahun' else '[]'::jsonb end
      ) as years(value)
      where st.organization_id=p_organization_id
        and case when years.value ~ '^[0-9]{4}$' then years.value::integer=chosen.y else false end
    )
  ) then
    raise exception 'Every assigned fiscal year must exist in the current organization snapshot' using errcode = '22023';
  end if;

  delete from public.satria_membership_years
    where organization_id = p_organization_id and user_id = p_target_user_id;
  insert into public.satria_membership_years(organization_id, user_id, fiscal_year, created_by)
    select p_organization_id, p_target_user_id, y, p_actor_user_id
    from unnest(p_years) as years(y);

  insert into public.satria_admin_audit_logs
    (organization_id, actor_user_id, target_user_id, action, details)
  values (p_organization_id, p_actor_user_id, p_target_user_id, 'user_year_assignment_updated',
    jsonb_build_object('years', to_jsonb(p_years), 'assignment_count', cardinality(p_years)));
  return cardinality(p_years);
end;
$$;
revoke all on function public.satria_admin_set_membership_years(uuid, uuid, uuid, integer[]) from public, anon, authenticated;
grant execute on function public.satria_admin_set_membership_years(uuid, uuid, uuid, integer[]) to service_role;

create or replace function public.satria_admin_assign_my_membership_years(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_years integer[]
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return public.satria_admin_set_membership_years(
    p_organization_id, auth.uid(), p_target_user_id, p_years
  );
end;
$$;
revoke all on function public.satria_admin_assign_my_membership_years(uuid, uuid, integer[]) from public, anon;
grant execute on function public.satria_admin_assign_my_membership_years(uuid, uuid, integer[]) to authenticated;

-- Allow viewer records to receive explicit scope assignments too; this function is only callable
-- from a trusted server because it takes an actor ID as an argument.
create or replace function public.satria_admin_set_membership_opds(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_opd_ids text[]
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_role text;
  v_count integer;
  v_distinct_count integer;
  v_invalid_count integer;
begin
  if p_organization_id is null or p_actor_user_id is null or p_target_user_id is null then
    raise exception 'Required identifiers are missing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.satria_memberships m where m.organization_id=p_organization_id and m.user_id=p_actor_user_id and m.role='admin' and m.active=true) then
    raise exception 'Active organization administrator required' using errcode = '42501';
  end if;
  select role into v_role from public.satria_memberships where organization_id=p_organization_id and user_id=p_target_user_id and active=true for update;
  if not found or v_role not in ('operator','viewer') then
    raise exception 'OPD assignment is available only for active non-admin memberships' using errcode = '22023';
  end if;
  if p_opd_ids is null or cardinality(p_opd_ids)<1 or cardinality(p_opd_ids)>100 then
    raise exception 'Select between 1 and 100 OPDs' using errcode = '22023';
  end if;
  select count(distinct btrim(x)), count(*) filter(where x is null or btrim(x)='')
    into v_distinct_count,v_invalid_count from unnest(p_opd_ids) as ids(x);
  if v_invalid_count<>0 or v_distinct_count<>cardinality(p_opd_ids) then
    raise exception 'OPD identifiers are empty or duplicated' using errcode = '22023';
  end if;
  select count(*) into v_count from unnest(p_opd_ids) ids(x)
    join public.satria_opds o on o.organization_id=p_organization_id and o.opd_id=btrim(ids.x) and o.active=true;
  if v_count<>cardinality(p_opd_ids) then
    raise exception 'One or more selected OPDs do not belong to this organization or are inactive' using errcode = '22023';
  end if;
  delete from public.satria_membership_opds where organization_id=p_organization_id and user_id=p_target_user_id;
  insert into public.satria_membership_opds(organization_id,user_id,opd_id,created_by)
    select p_organization_id,p_target_user_id,btrim(x),p_actor_user_id from unnest(p_opd_ids) ids(x);
  insert into public.satria_admin_audit_logs(organization_id,actor_user_id,target_user_id,action,details)
    values(p_organization_id,p_actor_user_id,p_target_user_id,'user_opd_assignment_updated',
      jsonb_build_object('opd_ids',to_jsonb(p_opd_ids),'assignment_count',cardinality(p_opd_ids)));
  return cardinality(p_opd_ids);
end;
$$;
revoke all on function public.satria_admin_set_membership_opds(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.satria_admin_set_membership_opds(uuid, uuid, uuid, text[]) to service_role;

create or replace function public.satria_admin_assign_my_membership_opds(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_opd_ids text[]
) returns integer
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return public.satria_admin_set_membership_opds(p_organization_id, auth.uid(), p_target_user_id, p_opd_ids);
end;
$$;
revoke all on function public.satria_admin_assign_my_membership_opds(uuid, uuid, text[]) from public, anon;
grant execute on function public.satria_admin_assign_my_membership_opds(uuid, uuid, text[]) to authenticated;

-- Read RPC returns a whitelist-only projection. Any future top-level field is omitted by default.
create or replace function public.satria_get_scoped_state(p_organization_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_opd_ids text[];
  v_years integer[];
  v_state public.satria_state%rowtype;
  v_packages jsonb;
  v_payload jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select m.role into v_role from public.satria_memberships m
    where m.organization_id=p_organization_id and m.user_id=v_actor and m.active=true
    for share;
  if not found then raise exception 'Active organization membership required' using errcode = '42501'; end if;
  if v_role = 'admin' then
    raise exception 'Administrators must use the full snapshot path' using errcode = '42501';
  end if;
  if v_role not in ('operator','viewer') then raise exception 'Unsupported membership role' using errcode = '42501'; end if;

  select * into v_state from public.satria_state s where s.organization_id=p_organization_id;
  if not found then raise exception 'Organization snapshot is not initialized' using errcode = 'P0002'; end if;

  select coalesce(array_agg(mo.opd_id order by mo.opd_id), array[]::text[]) into v_opd_ids
    from public.satria_membership_opds mo
    join public.satria_opds o on o.organization_id=mo.organization_id and o.opd_id=mo.opd_id and o.active=true
    where mo.organization_id=p_organization_id and mo.user_id=v_actor;
  select coalesce(array_agg(my.fiscal_year order by my.fiscal_year), array[]::integer[]) into v_years
    from public.satria_membership_years my
    where my.organization_id=p_organization_id and my.user_id=v_actor
      and exists (
        select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_state.payload->'tahun')='array' then v_state.payload->'tahun' else '[]'::jsonb end) y(value)
        where case when y.value ~ '^[0-9]{4}$' then y.value::integer=my.fiscal_year else false end
      );
  if cardinality(v_opd_ids)=0 then raise exception 'No active OPD assigned to this account' using errcode = '42501'; end if;
  if cardinality(v_years)=0 then raise exception 'No assigned fiscal year exists in the current organization snapshot' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(p.value order by p.ord), '[]'::jsonb) into v_packages
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end)
       with ordinality as p(value,ord)
  where p.value->>'opd' = any(v_opd_ids)
    and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$'
             then (p.value->>'tahun')::integer = any(v_years) else false end;

  select jsonb_build_object(
    'pemda', coalesce(v_state.payload->'pemda','{}'::jsonb),
    'meta', coalesce(v_state.payload->'meta','{}'::jsonb),
    'penomoran', coalesce(v_state.payload->'penomoran','{}'::jsonb),
    'akun', case when jsonb_typeof(v_state.payload->'akun')='array' then v_state.payload->'akun' else '[]'::jsonb end,
    'kode', case when jsonb_typeof(v_state.payload->'kode')='array' then v_state.payload->'kode' else '[]'::jsonb end,
    'tahun', to_jsonb(v_years),
    'users', '[]'::jsonb,
    'opd', coalesce((select jsonb_agg(o.value order by o.ord)
      from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'opd')='array' then v_state.payload->'opd' else '[]'::jsonb end)
      with ordinality as o(value,ord) where o.value->>'id'=any(v_opd_ids)), '[]'::jsonb),
    'unit', coalesce((select jsonb_agg(u.value order by u.ord)
      from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'unit')='array' then v_state.payload->'unit' else '[]'::jsonb end)
      with ordinality as u(value,ord) where u.value->>'opd'=any(v_opd_ids)), '[]'::jsonb),
    'pejabat', coalesce((select jsonb_agg(j.value order by j.ord)
      from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'pejabat')='array' then v_state.payload->'pejabat' else '[]'::jsonb end)
      with ordinality as j(value,ord) where j.value->>'opd'=any(v_opd_ids)), '[]'::jsonb),
    'paket', v_packages,
    'penyedia', coalesce((select jsonb_agg(y.value order by y.ord)
      from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end)
      with ordinality as y(value,ord)
      where exists (
        select 1 from jsonb_array_elements(v_packages) p(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) w(value)
        where w.value->>'pen' = y.value->>'id'
      )), '[]'::jsonb)
  ) into v_payload;

  return jsonb_build_object(
    'payload', v_payload,
    'version', v_state.version,
    'updated_at', v_state.updated_at,
    'updated_by', v_state.updated_by,
    'scope', jsonb_build_object('role',v_role,'opd_ids',to_jsonb(v_opd_ids),'years',to_jsonb(v_years),'can_write',v_role='operator')
  );
end;
$$;
revoke all on function public.satria_get_scoped_state(uuid) from public, anon;
grant execute on function public.satria_get_scoped_state(uuid) to authenticated;

-- Non-admin write path. It merges only whitelisted scoped arrays into the canonical snapshot.
-- It never accepts replacement of organization metadata, OPD catalogue, years, account lists, or coding masters.
create or replace function public.satria_save_scoped_state(
  p_organization_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns bigint
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_opd_ids text[];
  v_years integer[];
  v_state public.satria_state%rowtype;
  v_item jsonb;
  v_item_id text;
  v_item_opd text;
  v_item_year integer;
  v_ref text;
  v_ref_field text;
  v_seen text[] := array[]::text[];
  v_old_scoped_supplier_ids text[] := array[]::text[];
  v_outside_supplier_ids text[] := array[]::text[];
  v_mutable_supplier_ids text[] := array[]::text[];
  v_keep jsonb;
  v_packages jsonb;
  v_units jsonb;
  v_pejabat jsonb;
  v_suppliers jsonb;
  v_old_supplier jsonb;
  v_new_supplier_ids text[] := array[]::text[];
  v_supplier_ids text[] := array[]::text[];
  v_version bigint;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select role into v_role from public.satria_memberships
    where organization_id=p_organization_id and user_id=v_actor and active=true
    for share;
  if not found then raise exception 'Active organization membership required' using errcode = '42501'; end if;
  if v_role <> 'operator' then
    raise exception 'Only an active Operator can save scoped business data; Viewer is read-only' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000000 then
    raise exception 'Scoped payload is invalid or too large' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'paket') is distinct from 'array' or jsonb_typeof(p_payload->'unit') is distinct from 'array'
     or jsonb_typeof(p_payload->'pejabat') is distinct from 'array' or jsonb_typeof(p_payload->'penyedia') is distinct from 'array' then
    raise exception 'Scoped payload must include paket, unit, pejabat, and penyedia arrays' using errcode = '22023';
  end if;

  select * into v_state from public.satria_state where organization_id=p_organization_id for update;
  if not found then raise exception 'Organization snapshot is not initialized' using errcode = 'P0002'; end if;

  -- Derive the effective scope after locking the canonical snapshot so year removal cannot leave stale access.
  select coalesce(array_agg(mo.opd_id order by mo.opd_id), array[]::text[]) into v_opd_ids
    from public.satria_membership_opds mo join public.satria_opds o
      on o.organization_id=mo.organization_id and o.opd_id=mo.opd_id and o.active=true
    where mo.organization_id=p_organization_id and mo.user_id=v_actor;
  select coalesce(array_agg(my.fiscal_year order by my.fiscal_year), array[]::integer[]) into v_years
    from public.satria_membership_years my
    where my.organization_id=p_organization_id and my.user_id=v_actor
      and exists (
        select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_state.payload->'tahun')='array' then v_state.payload->'tahun' else '[]'::jsonb end) y(value)
        where case when y.value ~ '^[0-9]{4}$' then y.value::integer=my.fiscal_year else false end
      );
  if cardinality(v_opd_ids)=0 or cardinality(v_years)=0 then
    raise exception 'Operator requires at least one active OPD and one assigned fiscal year present in the current snapshot' using errcode = '42501';
  end if;
  v_version := v_state.version;
  if p_expected_version is null or v_version <> p_expected_version then
    raise exception 'Version conflict: pull latest scoped state before retrying' using errcode = '40001';
  end if;

  -- Validate every incoming package against the server-derived OPD + year scope.
  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'paket') as x(value) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'Package row is invalid' using errcode='22023'; end if;
    v_item_id := nullif(btrim(v_item->>'id'),'');
    v_item_opd := nullif(btrim(v_item->>'opd'),'');
    if v_item_id is null or v_item_opd is null or coalesce(v_item->>'tahun','') !~ '^[0-9]{4}$' then
      raise exception 'Package must have a valid ID, OPD, and fiscal year' using errcode='22023';
    end if;
    v_item_year := (v_item->>'tahun')::integer;
    if not (v_item_opd = any(v_opd_ids)) or not (v_item_year = any(v_years)) then
      raise exception 'Package is outside the current OPD/year assignment' using errcode='42501';
    end if;
    if jsonb_typeof(v_item->'penawaran') is distinct from 'array' then
      raise exception 'Package offer list must be an array' using errcode='22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_item->'penawaran') offer(value)
      where nullif(btrim(offer.value->>'pen'),'') is null
        or not exists (
          select 1 from jsonb_array_elements(p_payload->'penyedia') supplier(value)
          where supplier.value->>'id'=offer.value->>'pen'
        )
    ) then
      raise exception 'Package references a supplier outside the scoped payload or with an invalid ID' using errcode='42501';
    end if;
    -- Referential-integrity guard: package references must resolve to master rows from the same OPD.
    v_ref := nullif(btrim(v_item->>'unit'), '');
    if v_ref is not null and not exists (
      select 1 from jsonb_array_elements(p_payload->'unit') u(value)
      where u.value->>'id'=v_ref and u.value->>'opd'=v_item_opd
    ) then
      raise exception 'Package unit reference is missing or belongs to another OPD' using errcode='42501';
    end if;
    foreach v_ref_field in array array['ppk','pp','kabid'] loop
      v_ref := nullif(btrim(v_item->>v_ref_field), '');
      if v_ref is not null and not exists (
        select 1 from jsonb_array_elements(p_payload->'pejabat') j(value)
        where j.value->>'id'=v_ref and j.value->>'opd'=v_item_opd
      ) then
        raise exception 'Package official reference is missing or belongs to another OPD' using errcode='42501';
      end if;
    end loop;
    -- A selected winner must resolve to an offer contained in this exact package.
    v_ref := nullif(btrim(v_item->>'pemenangId'), '');
    if v_ref is not null and not exists (
      select 1 from jsonb_array_elements(v_item->'penawaran') offer(value)
      where offer.value->>'id'=v_ref
    ) then
      raise exception 'Selected winner does not belong to an offer in this package' using errcode='23503';
    end if;
    if v_item_id = any(v_seen) then raise exception 'Duplicate package ID in scoped payload' using errcode='22023'; end if;
    v_seen := array_append(v_seen,v_item_id);
    if exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) old(value)
      where old.value->>'id'=v_item_id
        and not (old.value->>'opd'=any(v_opd_ids)
          and case when coalesce(old.value->>'tahun','') ~ '^[0-9]{4}$' then (old.value->>'tahun')::integer=any(v_years) else false end)
    ) then raise exception 'Package ID collides with a record outside this assignment' using errcode='42501'; end if;
  end loop;

  -- Master records are scoped by OPD (they are not year-specific). Reject moving IDs across OPDs.
  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'unit') as x(value) loop
    if jsonb_typeof(v_item)<>'object' or nullif(btrim(v_item->>'id'),'') is null or not ((v_item->>'opd')=any(v_opd_ids)) then
      raise exception 'Unit row is invalid or outside assigned OPDs' using errcode='42501';
    end if;
    v_item_id := btrim(v_item->>'id');
    if v_item_id=any(v_seen) then raise exception 'Duplicate unit ID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_item_id);
    if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'unit')='array' then v_state.payload->'unit' else '[]'::jsonb end) old(value)
      where old.value->>'id'=v_item_id and not ((old.value->>'opd')=any(v_opd_ids))) then
      raise exception 'Unit ID collides with a row outside assigned OPDs' using errcode='42501';
    end if;
  end loop;

  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'pejabat') as x(value) loop
    if jsonb_typeof(v_item)<>'object' or nullif(btrim(v_item->>'id'),'') is null or not ((v_item->>'opd')=any(v_opd_ids)) then
      raise exception 'Official row is invalid or outside assigned OPDs' using errcode='42501';
    end if;
    v_item_id := btrim(v_item->>'id');
    if v_item_id=any(v_seen) then raise exception 'Duplicate official ID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_item_id);
    if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'pejabat')='array' then v_state.payload->'pejabat' else '[]'::jsonb end) old(value)
      where old.value->>'id'=v_item_id and not ((old.value->>'opd')=any(v_opd_ids))) then
      raise exception 'Official ID collides with a row outside assigned OPDs' using errcode='42501';
    end if;
  end loop;

  -- Unit and official master rows are OPD-level, not year-level. Prevent an Operator scoped to
  -- only some years from mutating/deleting a master row still referenced by a package outside
  -- their OPD+year scope; otherwise another year's package could be left with a broken reference.
  if exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'unit')='array' then v_state.payload->'unit' else '[]'::jsonb end) old(value)
    where old.value->>'opd'=any(v_opd_ids)
      and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'unit'=old.value->>'id'
          and not (p.value->>'opd'=any(v_opd_ids)
            and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end)
      )
      and not exists (
        select 1 from jsonb_array_elements(p_payload->'unit') incoming(value)
        where incoming.value->>'id'=old.value->>'id' and incoming.value=old.value
      )
  ) then
    raise exception 'Unit rows referenced by packages outside your OPD/year scope cannot be changed or removed' using errcode='42501';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'pejabat')='array' then v_state.payload->'pejabat' else '[]'::jsonb end) old(value)
    where old.value->>'opd'=any(v_opd_ids)
      and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
        where (p.value->>'ppk'=old.value->>'id' or p.value->>'pp'=old.value->>'id' or p.value->>'kabid'=old.value->>'id')
          and not (p.value->>'opd'=any(v_opd_ids)
            and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end)
      )
      and not exists (
        select 1 from jsonb_array_elements(p_payload->'pejabat') incoming(value)
        where incoming.value->>'id'=old.value->>'id' and incoming.value=old.value
      )
  ) then
    raise exception 'Official rows referenced by packages outside your OPD/year scope cannot be changed or removed' using errcode='42501';
  end if;

  -- Resolve current scoped and out-of-scope supplier references. A supplier used outside the
  -- caller scope is visible only as existing package context and cannot be edited by this caller.
  select coalesce(array_agg(distinct w.value->>'pen'),array[]::text[]) into v_old_scoped_supplier_ids
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) w(value)
  where p.value->>'opd'=any(v_opd_ids)
    and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end
    and nullif(w.value->>'pen','') is not null;
  select coalesce(array_agg(distinct w.value->>'pen'),array[]::text[]) into v_outside_supplier_ids
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) w(value)
  where not (p.value->>'opd'=any(v_opd_ids)
    and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end)
    and nullif(w.value->>'pen','') is not null;

  -- Replace suppliers used only in this scope, including deleting those the Operator removed.
  -- Suppliers also referenced by out-of-scope packages remain immutable and preserved.
  select coalesce(array_agg(ids.supplier_id),array[]::text[]) into v_mutable_supplier_ids
  from unnest(v_old_scoped_supplier_ids) as ids(supplier_id)
  where not (ids.supplier_id=any(v_outside_supplier_ids));

  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'penyedia') as x(value) loop
    if jsonb_typeof(v_item)<>'object' or nullif(btrim(v_item->>'id'),'') is null then
      raise exception 'Supplier row must have a valid ID' using errcode='22023';
    end if;
    v_item_id:=btrim(v_item->>'id');
    if v_item_id=any(v_seen) then raise exception 'Duplicate supplier ID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_item_id);
    select y.value into v_old_supplier from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end) y(value)
      where y.value->>'id'=v_item_id limit 1;
    if v_item_id=any(v_outside_supplier_ids) then
      if (jsonb_build_object(
            'statusKatalog','Perlu verifikasi','pdn','Perlu verifikasi','tipe','Perlu verifikasi',
            'kbliSesuai','Perlu verifikasi','daftarHitam','Perlu verifikasi'
          ) || v_old_supplier)
         is distinct from
         (jsonb_build_object(
            'statusKatalog','Perlu verifikasi','pdn','Perlu verifikasi','tipe','Perlu verifikasi',
            'kbliSesuai','Perlu verifikasi','daftarHitam','Perlu verifikasi'
          ) || v_item) then
        raise exception 'Supplier is referenced by records outside your OPD/year scope and cannot be changed' using errcode='42501';
      end if;
    elsif v_old_supplier is not null then
      if not (v_item_id=any(v_old_scoped_supplier_ids)) then
        raise exception 'Supplier row is not in the current assigned scope' using errcode='42501';
      end if;
      if not (v_item_id=any(v_mutable_supplier_ids)) then
        v_mutable_supplier_ids:=array_append(v_mutable_supplier_ids,v_item_id);
      end if;
    else
      if not exists (
        select 1 from jsonb_array_elements(p_payload->'paket') p(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) w(value)
        where w.value->>'pen'=v_item_id
      ) then raise exception 'New supplier must be linked to a package in your assigned scope' using errcode='42501'; end if;
      if exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end) y(value) where y.value->>'id'=v_item_id) then
        raise exception 'Supplier ID already exists outside the current assigned scope' using errcode='42501';
      end if;
      if not (v_item_id=any(v_mutable_supplier_ids)) then
        v_mutable_supplier_ids:=array_append(v_mutable_supplier_ids,v_item_id);
      end if;
    end if;
    v_old_supplier:=null;
  end loop;

  select coalesce(jsonb_agg(p.value order by p.ord),'[]'::jsonb) into v_keep
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) with ordinality p(value,ord)
  where not (p.value->>'opd'=any(v_opd_ids)
    and case when coalesce(p.value->>'tahun','') ~ '^[0-9]{4}$' then (p.value->>'tahun')::integer=any(v_years) else false end);
  v_packages := v_keep || p_payload->'paket';

  select coalesce(jsonb_agg(u.value order by u.ord),'[]'::jsonb) into v_keep
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'unit')='array' then v_state.payload->'unit' else '[]'::jsonb end) with ordinality u(value,ord)
  where not ((u.value->>'opd')=any(v_opd_ids));
  v_units := v_keep || p_payload->'unit';

  select coalesce(jsonb_agg(j.value order by j.ord),'[]'::jsonb) into v_keep
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'pejabat')='array' then v_state.payload->'pejabat' else '[]'::jsonb end) with ordinality j(value,ord)
  where not ((j.value->>'opd')=any(v_opd_ids));
  v_pejabat := v_keep || p_payload->'pejabat';

  select coalesce(jsonb_agg(y.value order by y.ord),'[]'::jsonb) into v_keep
  from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end) with ordinality y(value,ord)
  where not ((y.value->>'id')=any(v_mutable_supplier_ids));
  select coalesce(jsonb_agg(x.value),'[]'::jsonb) into v_suppliers
  from jsonb_array_elements(p_payload->'penyedia') x(value)
  where not ((x.value->>'id')=any(v_outside_supplier_ids));
  v_suppliers := v_keep || v_suppliers;

  update public.satria_state
  set payload = v_state.payload || jsonb_build_object('paket',v_packages,'unit',v_units,'pejabat',v_pejabat,'penyedia',v_suppliers),
      version = v_version + 1, updated_at = now(), updated_by = v_actor
  where organization_id=p_organization_id;

  insert into public.satria_admin_audit_logs(organization_id,actor_user_id,target_user_id,action,details)
  values (p_organization_id,v_actor,v_actor,'scoped_state_saved',jsonb_build_object(
    'opd_ids',to_jsonb(v_opd_ids),'years',to_jsonb(v_years),
    'submitted_packages',jsonb_array_length(p_payload->'paket'),
    'submitted_units',jsonb_array_length(p_payload->'unit'),
    'submitted_officials',jsonb_array_length(p_payload->'pejabat')));

  return v_version+1;
end;
$$;
revoke all on function public.satria_save_scoped_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.satria_save_scoped_state(uuid, bigint, jsonb) to authenticated;

alter table public.satria_admin_audit_logs drop constraint if exists satria_admin_audit_logs_action_check;
alter table public.satria_admin_audit_logs add constraint satria_admin_audit_logs_action_check
  check (action in ('user_invited','user_created','user_opd_assignment_updated','user_year_assignment_updated','scoped_state_saved'));

comment on function public.satria_save_scoped_state(uuid, bigint, jsonb) is
  'Optimistic concurrency write bridge for Operators. Preserves org-wide fields and out-of-scope records; replaces only assigned OPD/year package rows and assigned-OPD master rows.';
comment on table public.satria_membership_years is
  'Explicit fiscal-year access assignments. Non-admin snapshot reads require at least one assigned year as well as an active OPD assignment.';

commit;
