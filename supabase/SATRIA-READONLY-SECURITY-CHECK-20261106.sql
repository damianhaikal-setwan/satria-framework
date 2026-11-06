-- SATRIA: audit keamanan katalog Supabase. HANYA SELECT: tidak mengubah RLS, data atau izin.
-- Jalankan via Supabase SQL Editor oleh administrator berwenang.
-- Hasil "LULUS" pada katalog BUKAN pengganti tes lintas pengguna/OPD/tahun dengan JWT nyata.

-- 1. Status tabel dan RLS: missing/disabled wajib ditindaklanjuti oleh administrator.
with expected(schema_name,table_name) as (
  values
  ('public','satria_memberships'), ('public','satria_state'),
  ('public','satria_opds'), ('public','satria_membership_opds'),
  ('public','satria_membership_years'), ('public','satria_sync_events'),
  ('public','satria_user_creation_rate_limits'), ('public','satria_admin_audit_logs')
)
select e.schema_name||'.'||e.table_name as objek,
  case when c.oid is null then 'TABEL TIDAK DITEMUKAN'
       when not c.relrowsecurity then 'RLS NONAKTIF - PERIKSA'
       else 'RLS AKTIF (kebijakan perlu diuji)' end as status_rls,
  (select count(*) from pg_catalog.pg_policy p where p.polrelid=c.oid) as jumlah_kebijakan,
  case when c.oid is null then null
       else has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') end as anon_memiliki_salah_satu_izin
from expected e
left join pg_catalog.pg_namespace n on n.nspname=e.schema_name
left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=e.table_name and c.relkind in ('r','p')
order by objek;

-- 2. Fungsi RPC yang membatasi snapshot, scope, dan delta.
with expected(sig) as (values
  ('public.satria_get_scoped_state(uuid)'),
  ('public.satria_save_scoped_state(uuid,bigint,jsonb)'),
  ('public.satria_save_state(uuid,bigint,jsonb)'),
  ('public.satria_apply_state_delta(uuid,bigint,jsonb)'),
  ('public.satria_user_can_access_scope(uuid,text,integer)')
)
select sig as fungsi,
       case when to_regprocedure(sig) is null then 'TIDAK DITEMUKAN'
            else 'ADA (otorisasi internal tetap wajib diuji)' end as keberadaan,
       case when to_regprocedure(sig) is null then null
            else has_function_privilege('anon',to_regprocedure(sig),'EXECUTE') end as anon_bisa_execute,
       case when to_regprocedure(sig) is null then null
            else has_function_privilege('authenticated',to_regprocedure(sig),'EXECUTE') end as authenticated_bisa_execute
from expected order by sig;

-- 3. Ringkasan kebijakan untuk tabel penting (tanpa menampilkan data pengguna).
select schemaname,tablename,policyname,cmd,roles
from pg_catalog.pg_policies
where schemaname='public' and tablename in
  ('satria_state','satria_memberships','satria_opds','satria_membership_opds',
   'satria_membership_years','satria_sync_events')
order by tablename,policyname;

-- PENTING: status di atas belum memverifikasi pemeriksaan JWT nyata pada koneksi anon/authenticated.
-- Lakukan matriks akses di STAGING dengan akun terpisah sesuai panduan. Jangan menjalankan
-- INSERT/UPDATE/DELETE/ALTER/DROP pada database produksi hanya untuk uji ini.
