-- Read-only post-deployment assertions for SATRIA OPD/year scope hardening.
-- Run in Supabase SQL Editor after migration 20261024053200. This checks installed DDL,
-- not a substitute for the live user-to-user negative test matrix in docs/SECURITY_SCOPE_HARDENING.md.
do $$
declare
  v_count integer;
  v_definition text;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='satria_state'
      and policyname='satria_state_read_admin_only' and cmd='SELECT'
      and coalesce(qual,'') ilike '%satria_is_admin%'
  ) then
    raise exception 'FAIL: admin-only SELECT policy on satria_state is missing';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname='public' and tablename='satria_state'
    and cmd in ('SELECT','ALL')
    and (policyname <> 'satria_state_read_admin_only' or coalesce(qual,'') not ilike '%satria_is_admin%');
  if v_count <> 0 then
    raise exception 'FAIL: an additional permissive SELECT/ALL policy remains on satria_state';
  end if;

  if has_table_privilege('authenticated','public.satria_state','UPDATE')
     or has_table_privilege('authenticated','public.satria_state','INSERT')
     or has_table_privilege('authenticated','public.satria_state','DELETE') then
    raise exception 'FAIL: authenticated has direct write privileges on satria_state';
  end if;

  if has_table_privilege('anon','public.satria_state','SELECT') then
    raise exception 'FAIL: anon has direct SELECT privilege on satria_state';
  end if;

  if has_function_privilege('authenticated','public.satria_admin_set_membership_years(uuid,uuid,uuid,integer[])','EXECUTE') then
    raise exception 'FAIL: authenticated can call the privileged year assignment function directly';
  end if;

  if has_function_privilege('authenticated','public.satria_get_scoped_state(uuid)','EXECUTE') is false then
    raise exception 'FAIL: authenticated cannot call scoped read RPC';
  end if;

  if has_function_privilege('anon','public.satria_get_scoped_state(uuid)','EXECUTE') then
    raise exception 'FAIL: anon can call scoped read RPC';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='satria_membership_years' and c.relrowsecurity
  ) then
    raise exception 'FAIL: RLS is not enabled on satria_membership_years';
  end if;

  select pg_get_functiondef('public.satria_save_state(uuid,bigint,jsonb)'::regprocedure) into v_definition;
  if v_definition not ilike '%satria_is_admin%' then
    raise exception 'FAIL: full snapshot RPC does not check admin role';
  end if;

  select pg_get_functiondef('public.satria_save_scoped_state(uuid,bigint,jsonb)'::regprocedure) into v_definition;
  if v_definition not ilike '%satria_membership_opds%' or v_definition not ilike '%satria_membership_years%'
     or v_definition not ilike '%current OPD/year assignment%' then
    raise exception 'FAIL: scoped save RPC is missing OPD/year authorization checks';
  end if;

  raise notice 'PASS: static database security assertions passed. Run live negative tests with separate test accounts before production.';
end;
$$;
