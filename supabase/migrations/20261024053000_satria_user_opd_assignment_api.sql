-- SATRIA: atomic administrator API for assigning operator memberships to OPDs.
-- Prerequisite: 20261024052900_satria_opd_assignments_rls.sql and the bootstrap.
begin;

do $$
begin
  if to_regclass('public.satria_opds') is null
     or to_regclass('public.satria_membership_opds') is null
     or to_regclass('public.satria_memberships') is null then
    raise exception 'Apply SATRIA bootstrap and OPD assignment migrations first';
  end if;
  if to_regclass('public.satria_admin_audit_logs') is null then
    raise exception 'Apply SATRIA user creation security migration first';
  end if;
end
$$;

-- Assignment changes use one database transaction so a failed replacement never
-- leaves an operator with a partially replaced OPD list.
create or replace function public.satria_admin_set_membership_opds(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_opd_ids text[]
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_role text;
  v_count bigint;
  v_distinct_count bigint;
  v_invalid_count bigint;
begin
  if p_organization_id is null or p_actor_user_id is null or p_target_user_id is null then
    raise exception 'Required identifiers are missing' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.satria_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_user_id
      and m.role = 'admin'
      and m.active = true
  ) then
    raise exception 'Active organization administrator required' using errcode = '42501';
  end if;

  select m.role into v_role
  from public.satria_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = p_target_user_id
    and m.active = true;
  if not found then
    raise exception 'Target membership is missing or inactive' using errcode = '22023';
  end if;
  if v_role <> 'operator' then
    raise exception 'OPD assignment is available only for active operators' using errcode = '22023';
  end if;

  if p_opd_ids is null or cardinality(p_opd_ids) < 1 or cardinality(p_opd_ids) > 100 then
    raise exception 'Select between 1 and 100 OPDs' using errcode = '22023';
  end if;

  select count(distinct btrim(x)), count(*) filter (where x is null or btrim(x) = '')
    into v_distinct_count, v_invalid_count
  from unnest(p_opd_ids) as ids(x);
  if v_invalid_count <> 0 or v_distinct_count <> cardinality(p_opd_ids) then
    raise exception 'OPD identifiers are empty or duplicated' using errcode = '22023';
  end if;

  select count(*) into v_count
  from unnest(p_opd_ids) as ids(x)
  join public.satria_opds o
    on o.organization_id = p_organization_id
   and o.opd_id = btrim(ids.x)
   and o.active = true;
  if v_count <> cardinality(p_opd_ids) then
    raise exception 'One or more selected OPDs do not belong to this organization or are inactive' using errcode = '22023';
  end if;

  delete from public.satria_membership_opds
  where organization_id = p_organization_id and user_id = p_target_user_id;

  insert into public.satria_membership_opds (organization_id, user_id, opd_id, created_by)
  select p_organization_id, p_target_user_id, btrim(ids.x), p_actor_user_id
  from unnest(p_opd_ids) as ids(x);

  return cardinality(p_opd_ids);
end;
$$;

revoke all on function public.satria_admin_set_membership_opds(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.satria_admin_set_membership_opds(uuid, uuid, uuid, text[]) to service_role;

-- An OPD retired from the canonical catalog must not remain accessible merely
-- because an older assignment row exists.
create or replace function public.satria_user_can_access_opd(
  p_organization_id uuid,
  p_opd_id text
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.satria_opds target_opd
      where target_opd.organization_id = p_organization_id
        and target_opd.opd_id = p_opd_id
        and target_opd.active = true
    )
    and exists (
      select 1
      from public.satria_memberships m
      where m.organization_id = p_organization_id
        and m.user_id = auth.uid()
        and m.active = true
        and (
          m.role = 'admin'
          or exists (
            select 1
            from public.satria_membership_opds mo
            where mo.organization_id = p_organization_id
              and mo.user_id = auth.uid()
              and mo.opd_id = p_opd_id
          )
        )
    );
$$;
revoke all on function public.satria_user_can_access_opd(uuid, text) from public, anon, authenticated;
grant execute on function public.satria_user_can_access_opd(uuid, text) to authenticated;

alter table public.satria_admin_audit_logs
  drop constraint if exists satria_admin_audit_logs_action_check;
alter table public.satria_admin_audit_logs
  add constraint satria_admin_audit_logs_action_check
  check (action in ('user_invited', 'user_created', 'user_opd_assignment_updated'));

commit;
