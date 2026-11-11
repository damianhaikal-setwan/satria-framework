-- SATRIA NEXT Stage 2 readiness checks. READ ONLY.
-- Run after 20261111170000_satria_cloud_recycle_atomic.sql in STAGING SQL Editor.
-- These catalog checks DO NOT replace live Admin/Operator/Viewer transaction tests.
do $$
declare
 v_table regclass;
 v_rpc regprocedure;
begin
 v_table:=to_regclass('public.satria_trash_entries');
 if v_table is null then raise exception 'Stage2 trash table missing'; end if;
 if not (select relrowsecurity from pg_class where oid=v_table) then
   raise exception 'RLS not enabled on cloud trash';
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='satria_trash_entries'
       and policyname='satria_trash_scoped_read' and cmd='SELECT') then
   raise exception 'Scoped trash RLS policy missing';
 end if;
 if has_table_privilege('authenticated',v_table,'INSERT') or
    has_table_privilege('authenticated',v_table,'UPDATE') or
    has_table_privilege('authenticated',v_table,'DELETE') then
   raise exception 'Browser role can directly mutate trash';
 end if;
 if not has_table_privilege('authenticated',v_table,'SELECT') then
   raise exception 'Authenticated users cannot view RLS-scoped trash';
 end if;
 if to_regprocedure('public.satria_archive_record(uuid,bigint,text,text)') is null or
    to_regprocedure('public.satria_restore_record(uuid,bigint,uuid)') is null then
   raise exception 'Atomic archive/restore RPCs missing';
 end if;
 if to_regprocedure('public.satria_apply_state_delta_internal(uuid,bigint,jsonb)') is null then
   raise exception 'Internal validated delta engine missing';
 end if;
 if has_function_privilege('authenticated','public.satria_apply_state_delta_internal(uuid,bigint,jsonb)','EXECUTE') then
   raise exception 'Unsafe delta engine still directly callable by authenticated';
 end if;
 if not has_function_privilege('authenticated','public.satria_archive_record(uuid,bigint,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.satria_restore_record(uuid,bigint,uuid)','EXECUTE') then
   raise exception 'Missing scoped cloud trash RPC permissions';
 end if;
 if not exists (select 1 from pg_trigger t where t.tgrelid='public.satria_state'::regclass
                 and t.tgname='satria_state_enforce_cloud_archive' and t.tgenabled in ('O','A')) then
   raise exception 'Server-side archive guard trigger is missing/disabled';
 end if;
 if position('delete' in lower(pg_get_functiondef('public.satria_apply_state_delta(uuid,bigint,jsonb)'::regprocedure)))=0 then
   raise exception 'Public delta wrapper does not mention delete guard';
 end if;
 raise notice 'PASS Stage2 catalog checks: trash schema, RLS, atomic RPCs, guarded delta, trigger';
end $$;
