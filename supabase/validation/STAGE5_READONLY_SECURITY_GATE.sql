-- SATRIA NEXT Tahap 5A — gate metadata Supabase STAGING. Read-only.
-- Prasyarat: migrasi sampai 20261111170000 sudah diterapkan di database STAGING.
-- Jangan menganggap PASS sebagai bukti pengujian JWT / multi-perangkat atau backup restore.
-- Jalankan oleh admin database di SQL Editor staging. Tidak menampilkan data bisnis.
BEGIN;
SET TRANSACTION READ ONLY;
DO $stage5_gate$
DECLARE
  v_missing text;
  v_recycle oid;
  v_state oid;
BEGIN
  IF to_regrole('authenticated') IS NULL OR to_regrole('anon') IS NULL THEN
    RAISE EXCEPTION 'SATRIA Gate: role anon/authenticated Supabase tidak tersedia';
  END IF;
  SELECT string_agg(name, ', ') INTO v_missing
  FROM (VALUES
    ('public.satria_state'),('public.satria_trash_entries'),
    ('public.satria_memberships'),('public.satria_membership_opds'),
    ('public.satria_membership_years')
  ) x(name) WHERE to_regclass(name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'SATRIA Gate: tabel hilang: %', v_missing;
  END IF;
  v_recycle := 'public.satria_trash_entries'::regclass;
  v_state := 'public.satria_state'::regclass;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                 WHERE c.oid=v_recycle AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'SATRIA Gate: RLS Sampah cloud tidak aktif';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                 WHERE c.oid=v_state AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'SATRIA Gate: RLS snapshot tidak aktif';
  END IF;
  IF has_table_privilege('anon',v_recycle,'SELECT') OR
     has_table_privilege('anon',v_recycle,'INSERT') OR
     has_table_privilege('anon',v_recycle,'UPDATE') OR
     has_table_privilege('anon',v_recycle,'DELETE') THEN
    RAISE EXCEPTION 'SATRIA Gate: anon memiliki izin tabel Sampah';
  END IF;
  IF has_table_privilege('authenticated',v_recycle,'INSERT') OR
     has_table_privilege('authenticated',v_recycle,'UPDATE') OR
     has_table_privilege('authenticated',v_recycle,'DELETE') THEN
    RAISE EXCEPTION 'SATRIA Gate: anggota browser memiliki izin ubah Sampah langsung';
  END IF;
  IF NOT has_table_privilege('authenticated',v_recycle,'SELECT') THEN
    RAISE EXCEPTION 'SATRIA Gate: UI Sampah tidak dapat membaca metadata';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies p
             WHERE p.schemaname='public' AND p.tablename='satria_trash_entries'
               AND p.cmd NOT IN ('SELECT')) THEN
    RAISE EXCEPTION 'SATRIA Gate: kebijakan Sampah berisi izin mutasi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies p
                 WHERE p.schemaname='public' AND p.tablename='satria_trash_entries'
                   AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles)) THEN
    RAISE EXCEPTION 'SATRIA Gate: kebijakan baca Sampah tidak ditemukan';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
             WHERE t.tgrelid=v_state AND NOT t.tgisinternal
               AND t.tgname='satria_state_enforce_cloud_archive' AND t.tgenabled IN ('O','A')) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'SATRIA Gate: trigger anti-hapus snapshot belum aktif';
  END IF;
  IF to_regprocedure('public.satria_archive_record(uuid,bigint,text,text)') IS NULL OR
     to_regprocedure('public.satria_restore_record(uuid,bigint,uuid)') IS NULL OR
     to_regprocedure('public.satria_apply_state_delta_internal(uuid,bigint,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'SATRIA Gate: RPC Sampah / delta internal hilang';
  END IF;
  IF has_function_privilege('anon', 'public.satria_archive_record(uuid,bigint,text,text)', 'EXECUTE') OR
     has_function_privilege('anon', 'public.satria_restore_record(uuid,bigint,uuid)', 'EXECUTE') OR
     has_function_privilege('authenticated', 'public.satria_apply_state_delta_internal(uuid,bigint,jsonb)', 'EXECUTE') OR
     has_function_privilege('anon', 'public.satria_apply_state_delta_internal(uuid,bigint,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SATRIA Gate: privilege RPC tidak aman';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.satria_archive_record(uuid,bigint,text,text)', 'EXECUTE') OR
     NOT has_function_privilege('authenticated', 'public.satria_restore_record(uuid,bigint,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SATRIA Gate: RPC arsip/pulih tidak dapat diakses klien terautentikasi';
  END IF;
  IF has_table_privilege('authenticated',v_state,'DELETE') OR has_table_privilege('anon',v_state,'DELETE') THEN
    RAISE EXCEPTION 'SATRIA Gate: peran browser dapat menghapus snapshot langsung';
  END IF;
  RAISE NOTICE 'SATRIA 5A: pemeriksaan metadata RLS, privilege, trigger, dan RPC LULUS. Pengujian JWT nyata dan backup/restore masih WAJIB.';
END
$stage5_gate$;
ROLLBACK;
