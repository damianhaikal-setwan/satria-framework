-- SATRIA Stage 9 — SQL VALIDASI STAGING BACA-SAJA.
-- Jalankan setelah migrasi 20261112030000_satria_recovery_order_integrity.sql.
-- Output checks TRUE/PASS diperlukan untuk fungsi dan hak akses. Tidak mengubah data.
select 'posisi_sampah_paket' as pemeriksaan,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='satria_trash_entries' and column_name='original_position') as lulus
union all
select 'posisi_sampah_bersarang',exists(select 1 from information_schema.columns where table_schema='public' and table_name='satria_nested_trash_entries' and column_name='original_position')
union all
select 'rpc_restore_paket',to_regprocedure('public.satria_restore_record(uuid,bigint,uuid)') is not null
union all
select 'rpc_restore_bersarang',to_regprocedure('public.satria_restore_nested(uuid,bigint,uuid)') is not null
union all
select 'fungsi_urut',to_regprocedure('public.satria_recover_original_order(jsonb,text,integer,text,text)') is not null
union all
select 'rls_sampah_utama',(select relrowsecurity from pg_class where oid='public.satria_trash_entries'::regclass)
union all
select 'rls_sampah_bersarang',(select relrowsecurity from pg_class where oid='public.satria_nested_trash_entries'::regclass)
union all
select 'arsip_legacy_tidak_terpapar',not has_function_privilege('authenticated','public.satria_archive_record_preorder(uuid,bigint,text,text)','EXECUTE')
union all
select 'pulih_legacy_tidak_terpapar',not has_function_privilege('authenticated','public.satria_restore_record_preorder(uuid,bigint,uuid)','EXECUTE')
union all
select 'arsip_nested_legacy_tidak_terpapar',not has_function_privilege('authenticated','public.satria_archive_nested_preorder(uuid,bigint,text,text,text)','EXECUTE')
union all
select 'pulih_nested_legacy_tidak_terpapar',not has_function_privilege('authenticated','public.satria_restore_nested_preorder(uuid,bigint,uuid)','EXECUTE');
-- Uji fungsi murni pada baris contoh, tanpa mutasi tabel bisnis.
with example as (
 select public.satria_recover_original_order(
  '[{"id":"a"},{"id":"c"},{"id":"b"}]'::jsonb,'b',1,'a','c') as result
)
select 'sisip_sebelum_saudara' as pemeriksaan,
 result='[{"id":"a"},{"id":"b"},{"id":"c"}]'::jsonb as lulus from example;
-- Lanjutkan dengan pengujian transaksi sebenar-benarnya pada organisasi staging
-- dan akun admin/operator/viewer terpisah; hasil read-only tidak cukup untuk produksi.
