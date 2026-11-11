-- SATRIA Prioritas 1–4: verifikasi struktur database baca-saja (STAGING).
-- Tidak memakai ::regclass yang error saat tabel belum ada. Tidak melakukan INSERT/UPDATE/DELETE.
-- Hasil FAIL adalah petunjuk diagnostik; PASS tidak membuktikan transaksi/RLS end-to-end.
WITH pemeriksaan AS (
  SELECT 'sampah_utama' AS nama,
    to_regclass('public.satria_trash_entries') IS NOT NULL AS lulus
  UNION ALL SELECT 'sampah_bersarang',
    to_regclass('public.satria_nested_trash_entries') IS NOT NULL
  UNION ALL SELECT 'rls_sampah_utama',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.satria_trash_entries')),false)
  UNION ALL SELECT 'rls_sampah_bersarang',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.satria_nested_trash_entries')),false)
  UNION ALL SELECT 'posisi_arsip_utama',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='satria_trash_entries' AND column_name='original_position')
  UNION ALL SELECT 'posisi_arsip_bersarang',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='satria_nested_trash_entries' AND column_name='original_position')
  UNION ALL SELECT 'rpc_arsip_paket',
    to_regprocedure('public.satria_archive_record(uuid,bigint,text,text)') IS NOT NULL
  UNION ALL SELECT 'rpc_pulih_paket',
    to_regprocedure('public.satria_restore_record(uuid,bigint,uuid)') IS NOT NULL
  UNION ALL SELECT 'rpc_arsip_bersarang',
    to_regprocedure('public.satria_archive_nested(uuid,bigint,text,text,text)') IS NOT NULL
  UNION ALL SELECT 'rpc_pulih_bersarang',
    to_regprocedure('public.satria_restore_nested(uuid,bigint,uuid)') IS NOT NULL
  UNION ALL SELECT 'rpc_urut_pemulihan',
    to_regprocedure('public.satria_recover_original_order(jsonb,text,integer,text,text)') IS NOT NULL
  UNION ALL SELECT 'fungsi_legacy_arsip_tidak_terbuka',
    CASE WHEN to_regprocedure('public.satria_archive_record_preorder(uuid,bigint,text,text)') IS NULL THEN false
      ELSE NOT has_function_privilege('authenticated',to_regprocedure('public.satria_archive_record_preorder(uuid,bigint,text,text)'),'EXECUTE') END
  UNION ALL SELECT 'fungsi_legacy_pulih_tidak_terbuka',
    CASE WHEN to_regprocedure('public.satria_restore_record_preorder(uuid,bigint,uuid)') IS NULL THEN false
      ELSE NOT has_function_privilege('authenticated',to_regprocedure('public.satria_restore_record_preorder(uuid,bigint,uuid)'),'EXECUTE') END
  UNION ALL SELECT 'fungsi_legacy_nested_arsip_tidak_terbuka',
    CASE WHEN to_regprocedure('public.satria_archive_nested_preorder(uuid,bigint,text,text,text)') IS NULL THEN false
      ELSE NOT has_function_privilege('authenticated',to_regprocedure('public.satria_archive_nested_preorder(uuid,bigint,text,text,text)'),'EXECUTE') END
  UNION ALL SELECT 'fungsi_legacy_nested_pulih_tidak_terbuka',
    CASE WHEN to_regprocedure('public.satria_restore_nested_preorder(uuid,bigint,uuid)') IS NULL THEN false
      ELSE NOT has_function_privilege('authenticated',to_regprocedure('public.satria_restore_nested_preorder(uuid,bigint,uuid)'),'EXECUTE') END
)
SELECT nama, CASE WHEN lulus THEN 'PASS' ELSE 'FAIL' END AS status FROM pemeriksaan ORDER BY nama;
