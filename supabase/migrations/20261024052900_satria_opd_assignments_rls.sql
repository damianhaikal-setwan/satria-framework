-- SATRIA: canonical OPD catalog and user-to-OPD assignments with RLS.
-- Prerequisite: the SATRIA bootstrap has created:
--   public.satria_organizations
--   public.satria_memberships (PK: organization_id, user_id)
--   public.satria_is_admin(uuid)
--   public.satria_is_member(uuid)
--
-- opd_id is TEXT intentionally: legacy SATRIA snapshot OPD IDs are strings.
-- Keep these IDs stable when seeding this catalog from the current application.

begin;

-- Fail early if this migration is applied before the SATRIA bootstrap.
do $$
begin
  if to_regclass('public.satria_organizations') is null
     or to_regclass('public.satria_memberships') is null then
    raise exception 'Apply the SATRIA bootstrap before the OPD assignment migration';
  end if;
  if to_regprocedure('public.satria_is_admin(uuid)') is null
     or to_regprocedure('public.satria_is_member(uuid)') is null then
    raise exception 'SATRIA membership helper functions are missing';
  end if;
end
$$;

-- Canonical OPD directory for each organization. Import stable IDs from S.opd.
create table if not exists public.satria_opds (
  organization_id uuid not null
    references public.satria_organizations(id) on delete cascade,
  opd_id text not null
    check (length(btrim(opd_id)) between 1 and 128),
  name text not null
    check (length(btrim(name)) between 1 and 200),
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, opd_id)
);

create unique index if not exists satria_opds_org_code_unique
  on public.satria_opds (organization_id, code)
  where code is not null and btrim(code) <> '';

-- An active organization membership may be assigned to one or more OPDs.
-- Organization-scoped composite foreign keys prevent cross-org assignments.
create table if not exists public.satria_membership_opds (
  organization_id uuid not null,
  user_id uuid not null,
  opd_id text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  primary key (organization_id, user_id, opd_id),
  foreign key (organization_id, user_id)
    references public.satria_memberships (organization_id, user_id)
    on delete cascade,
  foreign key (organization_id, opd_id)
    references public.satria_opds (organization_id, opd_id)
    on delete cascade
);

create index if not exists satria_membership_opds_opd_idx
  on public.satria_membership_opds (organization_id, opd_id, user_id);

-- The helper checks the CURRENT authenticated user only. Active admins are
-- organization-wide; other active members require an explicit OPD assignment.
-- SECURITY DEFINER avoids recursive RLS evaluation while reading memberships.
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

alter table public.satria_opds enable row level security;
alter table public.satria_membership_opds enable row level security;

revoke all on table public.satria_opds from public, anon, authenticated;
revoke all on table public.satria_membership_opds from public, anon, authenticated;
grant select, insert, update, delete on table public.satria_opds to authenticated;
grant select, insert, delete on table public.satria_membership_opds to authenticated;

-- Catalog: admins can see every OPD in their organization; other members only
-- see OPDs explicitly assigned to them.
drop policy if exists satria_opds_read_scoped on public.satria_opds;
create policy satria_opds_read_scoped
  on public.satria_opds
  for select to authenticated
  using (public.satria_user_can_access_opd(organization_id, opd_id));

drop policy if exists satria_opds_insert_admin on public.satria_opds;
create policy satria_opds_insert_admin
  on public.satria_opds
  for insert to authenticated
  with check (public.satria_is_admin(organization_id));

drop policy if exists satria_opds_update_admin on public.satria_opds;
create policy satria_opds_update_admin
  on public.satria_opds
  for update to authenticated
  using (public.satria_is_admin(organization_id))
  with check (public.satria_is_admin(organization_id));

drop policy if exists satria_opds_delete_admin on public.satria_opds;
create policy satria_opds_delete_admin
  on public.satria_opds
  for delete to authenticated
  using (public.satria_is_admin(organization_id));

-- Assignment rows: a member can read their own assignments while active;
-- organization admins can read and maintain every assignment in that org.
drop policy if exists satria_membership_opds_read_self_or_admin
  on public.satria_membership_opds;
create policy satria_membership_opds_read_self_or_admin
  on public.satria_membership_opds
  for select to authenticated
  using (
    public.satria_is_admin(organization_id)
    or (
      user_id = auth.uid()
      and public.satria_is_member(organization_id)
    )
  );

drop policy if exists satria_membership_opds_insert_admin
  on public.satria_membership_opds;
create policy satria_membership_opds_insert_admin
  on public.satria_membership_opds
  for insert to authenticated
  with check (
    public.satria_is_admin(organization_id)
    and (created_by is null or created_by = auth.uid())
    and exists (
      select 1
      from public.satria_memberships target_membership
      where target_membership.organization_id = satria_membership_opds.organization_id
        and target_membership.user_id = satria_membership_opds.user_id
        and target_membership.active = true
    )
  );

drop policy if exists satria_membership_opds_delete_admin
  on public.satria_membership_opds;
create policy satria_membership_opds_delete_admin
  on public.satria_membership_opds
  for delete to authenticated
  using (public.satria_is_admin(organization_id));

comment on table public.satria_opds is
  'Canonical organization-scoped OPD directory; opd_id preserves stable SATRIA legacy IDs.';
comment on table public.satria_membership_opds is
  'OPD access assignments for organization memberships; admins have organization-wide access.';
comment on function public.satria_user_can_access_opd(uuid, text) is
  'RLS helper: returns whether the current authenticated user may access this organization/OPD pair.';

commit;

-- TEMPLATE for every normalized OPD-scoped business table with columns
-- organization_id uuid and opd_id text:
--
-- alter table public.your_opd_scoped_table enable row level security;
-- create policy your_table_read_assigned_opd
--   on public.your_opd_scoped_table for select to authenticated
--   using (public.satria_user_can_access_opd(organization_id, opd_id));
--
-- Add corresponding INSERT/UPDATE/DELETE policies for authorized roles and
-- use satria_user_can_access_opd in WITH CHECK as well as USING. Do not rely
-- on this template to secure the existing single-row JSON snapshot table.
