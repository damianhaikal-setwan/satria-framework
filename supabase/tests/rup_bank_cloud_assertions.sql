-- SATRIA 3.0.41: read-only deployment checks, safe on staging/production.
-- Apply 20261028010000 migration first. Run with sufficient SQL Editor privileges.
select
  to_regprocedure('public.satria_get_scoped_state(uuid)') is not null as scoped_read_exists,
  to_regprocedure('public.satria_apply_state_delta(uuid,bigint,jsonb)') is not null as delta_rpc_exists;

select
  position('rupBank' in pg_get_functiondef('public.satria_get_scoped_state(uuid)'::regprocedure)) > 0 as scoped_read_projects_rup_bank,
  position('rupBank' in pg_get_functiondef('public.satria_apply_state_delta(uuid,bigint,jsonb)'::regprocedure)) > 0 as delta_accepts_rup_bank;

-- Historical data diagnostics; no changes are made.
with bank as (
  select s.organization_id, r.value
  from public.satria_state s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.payload->'rupBank')='array' then s.payload->'rupBank' else '[]'::jsonb end
  ) r(value)
)
select organization_id, value->>'opd' as opd, value->>'tahun' as tahun,
       lower(btrim(value->>'rup')) as kode_rup, count(*) as duplicate_count
from bank
where nullif(btrim(value->>'rup'),'') is not null
group by organization_id,value->>'opd',value->>'tahun',lower(btrim(value->>'rup'))
having count(*)>1;

with links as (
  select s.organization_id, p.value as paket, s.payload as payload
  from public.satria_state s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.payload->'paket')='array' then s.payload->'paket' else '[]'::jsonb end
  ) p(value)
)
select organization_id,paket->>'id' as paket_id,paket->>'rupBankId' as bank_id
from links l
where nullif(paket->>'rupBankId','') is not null
  and not exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(l.payload->'rupBank')='array' then l.payload->'rupBank' else '[]'::jsonb end
    ) r(value)
    where r.value->>'id'=l.paket->>'rupBankId'
      and r.value->>'opd'=l.paket->>'opd'
      and r.value->>'tahun'=l.paket->>'tahun'
      and r.value->>'rup'=l.paket->>'rup'
  );
