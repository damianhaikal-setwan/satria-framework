-- SATRIA OPD repair: profile cache + authenticated atomic assignment RPC.
-- Apply after the bootstrap and migrations 20261024_satria_user_creation_security.sql,
-- 20261024052900_satria_opd_assignments_rls.sql, and 20261024053000_satria_user_opd_assignment_api.sql.
begin;

alter table public.satria_memberships
  add column if not exists login_email text,
  add column if not exists display_name text;

-- Backfill existing memberships from Supabase Auth (server/database-side only).
update public.satria_memberships m
set login_email = coalesce(nullif(m.login_email, ''), u.email),
    display_name = coalesce(nullif(m.display_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), u.email)
from auth.users u
where u.id = m.user_id
  and (m.login_email is null or m.login_email = '' or m.display_name is null or m.display_name = '');

alter table public.satria_admin_audit_logs
  drop constraint if exists satria_admin_audit_logs_action_check;
alter table public.satria_admin_audit_logs
  add constraint satria_admin_audit_logs_action_check
  check (action in ('user_invited', 'user_created', 'user_opd_assignment_updated'));

-- This RPC is safe for browser use: actor is always auth.uid(), never a supplied user ID.
create or replace function public.satria_admin_assign_my_membership_opds(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_opd_ids text[]
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_count bigint;
  v_distinct_count bigint;
  v_invalid_count bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_target_user_id is null then
    raise exception 'Required identifiers are missing' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.satria_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = v_actor
      and m.role = 'admin' and m.active = true
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
  select p_organization_id, p_target_user_id, btrim(ids.x), v_actor
  from unnest(p_opd_ids) as ids(x);

  insert into public.satria_admin_audit_logs
    (organization_id, actor_user_id, target_user_id, action, details)
  values
    (p_organization_id, v_actor, p_target_user_id, 'user_opd_assignment_updated',
     jsonb_build_object('opd_ids', to_jsonb(p_opd_ids), 'assignment_count', cardinality(p_opd_ids), 'source', 'authenticated_rpc'));

  return cardinality(p_opd_ids);
end;
$$;

revoke all on function public.satria_admin_assign_my_membership_opds(uuid, uuid, text[]) from public, anon;
grant execute on function public.satria_admin_assign_my_membership_opds(uuid, uuid, text[]) to authenticated;

commit;
