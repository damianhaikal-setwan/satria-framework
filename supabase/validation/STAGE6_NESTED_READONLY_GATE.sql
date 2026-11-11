-- SATRIA combined P0–P3: STAGING ONLY / catalog-only security gate.
-- This query cannot prove transaction semantics or a successful backup restoration.
begin;
set transaction read only;
do $check$
declare t oid; st oid;
begin
 if to_regclass('public.satria_nested_trash_entries') is null then
  raise exception 'Migrasi nested Sampah cloud Tahap 6 belum dipasang';end if;
 t:='public.satria_nested_trash_entries'::regclass;
 st:='public.satria_state'::regclass;
 if not exists(select 1 from pg_catalog.pg_class where oid=t and relrowsecurity) then
  raise exception 'RLS nested Sampah belum aktif';end if;
 if has_table_privilege('authenticated',t,'INSERT') or has_table_privilege('authenticated',t,'UPDATE')
  or has_table_privilege('authenticated',t,'DELETE') or has_table_privilege('anon',t,'SELECT')
  or has_table_privilege('anon',t,'INSERT') or has_table_privilege('anon',t,'UPDATE')
  or has_table_privilege('anon',t,'DELETE') then
   raise exception 'Izin tabel nested Sampah terlalu luas';end if;
 if not has_table_privilege('authenticated',t,'SELECT') then
  raise exception 'Browser tidak dapat melihat daftar arsip bersarang';end if;
 if not exists(select 1 from pg_catalog.pg_policies
   where schemaname='public' and tablename='satria_nested_trash_entries' and cmd='SELECT'
    and 'authenticated'=any(roles)) then
  raise exception 'RLS scoped read tidak tersedia';end if;
 if exists(select 1 from pg_catalog.pg_policies
  where schemaname='public' and tablename='satria_nested_trash_entries' and cmd<>'SELECT') then
  raise exception 'RLS WRITE langsung tidak diizinkan';end if;
 if to_regprocedure('public.satria_archive_nested(uuid,bigint,text,text,text)') is null or
  to_regprocedure('public.satria_restore_nested(uuid,bigint,uuid)') is null or
  to_regprocedure('public.satria_require_nested_archive()') is null then
  raise exception 'RPC / guard belum tersedia';end if;
 if not exists(select 1 from pg_catalog.pg_trigger
  where tgname='satria_state_nested_archive_guard' and tgrelid=st
  and tgenabled in ('O','A')) then
  raise exception 'Trigger pengaman penghapusan bersarang tidak aktif';end if;
 if has_function_privilege('anon','public.satria_archive_nested(uuid,bigint,text,text,text)','EXECUTE')
   or has_function_privilege('anon','public.satria_restore_nested(uuid,bigint,uuid)','EXECUTE') then
  raise exception 'Anon dapat menjalankan arsip/pulih nested';end if;
 if not has_function_privilege('authenticated','public.satria_archive_nested(uuid,bigint,text,text,text)','EXECUTE')
   or not has_function_privilege('authenticated','public.satria_restore_nested(uuid,bigint,uuid)','EXECUTE') then
  raise exception 'RPC tidak tersedia untuk akun login';end if;
 raise notice 'PASS metadata Tahap 6: RLS/privilege/guard/RPC. Lakukan tes JWT dan recovery nyata terpisah.';
end
$check$;
rollback;
