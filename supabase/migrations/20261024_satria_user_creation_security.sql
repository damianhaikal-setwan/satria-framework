-- Prerequisite: satria-supabase-staging-bootstrap.sql has already been applied.
-- Rate-limit user creation to 5 attempts per minute per admin and organization.
create table if not exists public.satria_user_creation_rate_limits (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.satria_organizations(id) on delete cascade,
  window_start timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count > 0),
  primary key (actor_user_id, organization_id, window_start)
);

alter table public.satria_user_creation_rate_limits enable row level security;
revoke all on table public.satria_user_creation_rate_limits from public, anon, authenticated;

create or replace function public.satria_consume_user_creation_rate_limit(
  p_actor_user_id uuid,
  p_organization_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_attempt_count integer;
begin
  if p_actor_user_id is null or p_organization_id is null then
    return false;
  end if;

  insert into public.satria_user_creation_rate_limits (
    actor_user_id, organization_id, window_start, attempt_count
  ) values (
    p_actor_user_id, p_organization_id, v_window, 1
  )
  on conflict (actor_user_id, organization_id, window_start)
  do update set attempt_count = public.satria_user_creation_rate_limits.attempt_count + 1
  returning attempt_count into v_attempt_count;

  return v_attempt_count <= 5;
end;
$$;

revoke all on function public.satria_consume_user_creation_rate_limit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.satria_consume_user_creation_rate_limit(uuid, uuid) to service_role;

-- Admin-only read access to user-creation audit records. Writes are performed by the Edge Function.
create table if not exists public.satria_admin_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.satria_organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('user_created')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

-- Also allow the action written by the earlier invitation-based version, if it exists.
alter table public.satria_admin_audit_logs
  drop constraint if exists satria_admin_audit_logs_action_check;
alter table public.satria_admin_audit_logs
  add constraint satria_admin_audit_logs_action_check
  check (action in ('user_invited', 'user_created'));

create index if not exists satria_admin_audit_logs_org_created_idx
  on public.satria_admin_audit_logs (organization_id, created_at desc);

alter table public.satria_admin_audit_logs enable row level security;
revoke all on table public.satria_admin_audit_logs from public, anon, authenticated;
grant select on table public.satria_admin_audit_logs to authenticated;
grant insert on table public.satria_admin_audit_logs to service_role;

drop policy if exists satria_admin_audit_logs_read_admin
  on public.satria_admin_audit_logs;
create policy satria_admin_audit_logs_read_admin
  on public.satria_admin_audit_logs
  for select to authenticated
  using (public.satria_is_admin(organization_id));
