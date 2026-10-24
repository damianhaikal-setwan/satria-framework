-- SATRIA 3.0 — Shared Data Master collaboration and OPD attribution
-- Apply after 20261024053200_satria_scoped_access_and_years.sql.
-- Operators retain OPD/year scope for packages and OPD-specific masters, while supplier and
-- account master catalogs become organization-wide shared data with FK-style reference guards.
begin;

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
    'penyedia', case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end
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
  v_keep jsonb;
  v_packages jsonb;
  v_units jsonb;
  v_pejabat jsonb;
  v_suppliers jsonb;
  v_accounts jsonb;
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
     or jsonb_typeof(p_payload->'pejabat') is distinct from 'array' or jsonb_typeof(p_payload->'penyedia') is distinct from 'array'
     or jsonb_typeof(p_payload->'akun') is distinct from 'array' then
    raise exception 'Scoped payload must include paket, unit, pejabat, penyedia, and akun arrays' using errcode = '22023';
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

  -- Global shared master catalogs: account codes and suppliers are visible and manageable by every active Admin/Operator.
  -- Optimistic version checks serialize edits; package references are validated before deleting a shared row.
  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'akun') as x(value) loop
    if jsonb_typeof(v_item)<>'object' or nullif(btrim(v_item->>'id'),'') is null
       or nullif(btrim(v_item->>'kode'),'') is null or nullif(btrim(v_item->>'nama'),'') is null then
      raise exception 'Account master row must include a valid ID, code, and name' using errcode='22023';
    end if;
    v_item_id:=btrim(v_item->>'id');
    if v_item_id=any(v_seen) then raise exception 'Duplicate account ID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_item_id);
  end loop;
  if exists (
    select lower(btrim(x.value->>'kode')) from jsonb_array_elements(p_payload->'akun') x(value)
    group by lower(btrim(x.value->>'kode')) having count(*)>1
  ) then raise exception 'Account code must be unique across the organization catalog' using errcode='23505'; end if;
  if exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'akun')='array' then v_state.payload->'akun' else '[]'::jsonb end) old(value)
    where not exists (select 1 from jsonb_array_elements(p_payload->'akun') incoming(value) where incoming.value->>'id'=old.value->>'id')
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
        where p.value->>'akunId'=old.value->>'id')
  ) then raise exception 'Account master cannot be deleted while referenced by any package' using errcode='23503'; end if;

  v_seen := array[]::text[];
  for v_item in select value from jsonb_array_elements(p_payload->'penyedia') as x(value) loop
    if jsonb_typeof(v_item)<>'object' or nullif(btrim(v_item->>'id'),'') is null or nullif(btrim(v_item->>'nama'),'') is null then
      raise exception 'Supplier master row must include a valid ID and name' using errcode='22023';
    end if;
    v_item_id:=btrim(v_item->>'id');
    if v_item_id=any(v_seen) then raise exception 'Duplicate supplier ID' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_item_id);
  end loop;
  if exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'penyedia')='array' then v_state.payload->'penyedia' else '[]'::jsonb end) old(value)
    where not exists (select 1 from jsonb_array_elements(p_payload->'penyedia') incoming(value) where incoming.value->>'id'=old.value->>'id')
      and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_state.payload->'paket')='array' then v_state.payload->'paket' else '[]'::jsonb end) p(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(p.value->'penawaran')='array' then p.value->'penawaran' else '[]'::jsonb end) offer(value)
        where offer.value->>'pen'=old.value->>'id'
      )
  ) then raise exception 'Supplier master cannot be deleted while referenced by any package offer' using errcode='23503'; end if;

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

  -- These two catalogs are intentionally organization-wide and replace atomically after version/ref checks.
  v_suppliers := p_payload->'penyedia';
  v_accounts := p_payload->'akun';

  update public.satria_state
  set payload = v_state.payload || jsonb_build_object('paket',v_packages,'unit',v_units,'pejabat',v_pejabat,'penyedia',v_suppliers,'akun',v_accounts),
      version = v_version + 1, updated_at = now(), updated_by = v_actor
  where organization_id=p_organization_id;

  insert into public.satria_admin_audit_logs(organization_id,actor_user_id,target_user_id,action,details)
  values (p_organization_id,v_actor,v_actor,'scoped_state_saved',jsonb_build_object(
    'opd_ids',to_jsonb(v_opd_ids),'years',to_jsonb(v_years),
    'submitted_packages',jsonb_array_length(p_payload->'paket'),
    'submitted_units',jsonb_array_length(p_payload->'unit'),
    'submitted_officials',jsonb_array_length(p_payload->'pejabat'),
    'submitted_shared_suppliers',jsonb_array_length(p_payload->'penyedia'),
    'submitted_shared_accounts',jsonb_array_length(p_payload->'akun')));

  return v_version+1;
end;
$$;
revoke all on function public.satria_save_scoped_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.satria_save_scoped_state(uuid, bigint, jsonb) to authenticated;

comment on function public.satria_get_scoped_state(uuid) is
  'Returns OPD/year-scoped business records and org-wide shared account/supplier catalogs to authenticated non-admin members; never returns a full organization snapshot.';
comment on function public.satria_save_scoped_state(uuid, bigint, jsonb) is
  'Writes assigned OPD/year records and merges shared supplier/account catalogs for active Operators with concurrency and package reference checks.';

commit;
