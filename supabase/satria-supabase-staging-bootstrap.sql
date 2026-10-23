-- SATRIA 3.0: secure transitional snapshot bridge (not the final normalized schema)
-- Run in Supabase SQL Editor for a NEW staging project. Review before production.
create table if not exists public.satria_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.satria_memberships (
  organization_id uuid not null references public.satria_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','operator','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.satria_state (
  organization_id uuid primary key references public.satria_organizations(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.satria_organizations enable row level security;
alter table public.satria_memberships enable row level security;
alter table public.satria_state enable row level security;

create or replace function public.satria_is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (
  select 1 from public.satria_memberships m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.active
); $$;

create or replace function public.satria_is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (
  select 1 from public.satria_memberships m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.active and m.role = 'admin'
); $$;

create or replace function public.satria_can_write(p_org uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (
  select 1 from public.satria_memberships m
  where m.organization_id = p_org and m.user_id = auth.uid() and m.active
    and m.role in ('admin','operator')
); $$;

revoke all on function public.satria_is_member(uuid) from public;
revoke all on function public.satria_is_admin(uuid) from public;
revoke all on function public.satria_can_write(uuid) from public;
grant execute on function public.satria_is_member(uuid) to authenticated;
grant execute on function public.satria_is_admin(uuid) to authenticated;
grant execute on function public.satria_can_write(uuid) to authenticated;

drop policy if exists satria_org_read on public.satria_organizations;
create policy satria_org_read on public.satria_organizations for select to authenticated
  using (public.satria_is_member(id));
drop policy if exists satria_org_admin_update on public.satria_organizations;
create policy satria_org_admin_update on public.satria_organizations for update to authenticated
  using (public.satria_is_admin(id)) with check (public.satria_is_admin(id));

drop policy if exists satria_membership_read on public.satria_memberships;
create policy satria_membership_read on public.satria_memberships for select to authenticated
  using (user_id = auth.uid() or public.satria_is_admin(organization_id));
drop policy if exists satria_membership_admin_insert on public.satria_memberships;
create policy satria_membership_admin_insert on public.satria_memberships for insert to authenticated
  with check (public.satria_is_admin(organization_id));
drop policy if exists satria_membership_admin_update on public.satria_memberships;
create policy satria_membership_admin_update on public.satria_memberships for update to authenticated
  using (public.satria_is_admin(organization_id)) with check (public.satria_is_admin(organization_id));
drop policy if exists satria_membership_admin_delete on public.satria_memberships;
create policy satria_membership_admin_delete on public.satria_memberships for delete to authenticated
  using (public.satria_is_admin(organization_id));

drop policy if exists satria_state_read on public.satria_state;
create policy satria_state_read on public.satria_state for select to authenticated
  using (public.satria_is_member(organization_id));
-- Deliberately no direct INSERT/UPDATE/DELETE policies on satria_state.
-- All writes go through an authenticated, role-checked, version-checked RPC.

grant select on public.satria_organizations to authenticated;
grant update(name) on public.satria_organizations to authenticated;
grant select, insert, update, delete on public.satria_memberships to authenticated;
grant select on public.satria_state to authenticated;

-- Prevent accidental removal/deactivation of the last active organization admin.
create or replace function public.satria_guard_last_admin()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare v_org uuid; v_remaining integer;
begin
  v_org := old.organization_id;
  if old.role = 'admin' and old.active and (
       tg_op = 'DELETE'
       or new.role <> 'admin'
       or not new.active
       or new.organization_id <> old.organization_id
     ) then
    select count(*) into v_remaining from public.satria_memberships m
      where m.organization_id = v_org and m.user_id <> old.user_id
        and m.role = 'admin' and m.active;
    if v_remaining = 0 then
      raise exception 'Organization must retain at least one active admin' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists satria_keep_last_admin on public.satria_memberships;
create trigger satria_keep_last_admin before update or delete on public.satria_memberships
  for each row execute function public.satria_guard_last_admin();

create or replace function public.satria_save_state(
  p_organization_id uuid,
  p_expected_version bigint,
  p_payload jsonb
) returns bigint language plpgsql security definer set search_path = public, auth
as $$
declare v_version bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.satria_can_write(p_organization_id) then
    raise exception 'Insufficient organization role' using errcode = '42501';
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
    if p_expected_version <> 0 then
      raise exception 'Version conflict: pull latest state before retrying' using errcode = '40001';
    end if;
    insert into public.satria_state(organization_id, payload, version, updated_at, updated_by)
      values (p_organization_id, p_payload, 1, now(), auth.uid());
    return 1;
  end if;
  if v_version <> p_expected_version then
    raise exception 'Version conflict: pull latest state before retrying' using errcode = '40001';
  end if;
  update public.satria_state set payload = p_payload, version = v_version + 1,
    updated_at = now(), updated_by = auth.uid()
    where organization_id = p_organization_id;
  return v_version + 1;
end; $$;

revoke all on function public.satria_save_state(uuid,bigint,jsonb) from public;
grant execute on function public.satria_save_state(uuid,bigint,jsonb) to authenticated;

-- Bootstrap, performed manually by a trusted project admin after creating the Auth user:
-- 1. insert into public.satria_organizations(name) values ('Nama Pemda') returning id;
-- 2. insert into public.satria_memberships(organization_id,user_id,role)
--    values ('<ORGANIZATION_UUID>','<AUTH_USER_UUID>','admin');
-- Never put a service_role/secret key in this HTML. Rotate credentials if exposed.
