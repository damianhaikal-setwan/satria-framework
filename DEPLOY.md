# Deployment SATRIA NEXT 3.0.59.21

## 1. Backup dan verifikasi sumber

1. Simpan backup JSON SATRIA yang terbaru dan backup Supabase sebelum melakukan pembaruan.
2. Cocokkan berkas `index.html`, `manifest.json`, `sw.js`, serta ikon di root. Gunakan **seluruh isi arsip**, bukan mengunggah arsip ZIP sebagai satu file.
3. Perbaikan Bank RUP 3.0.59.21 hanya mengubah alur tampilan dan interaksi klien. Membagikan ZIP atau commit GitHub **tidak mengubah isi database cloud**.

## 2. Uji aplikasi (staging dahulu)

- Aktifkan situs melalui HTTPS; untuk PWA jangan bergantung pada `file://`.
- Hapus cache/perbarui service worker bila versi lama tetap muncul.
- Pada Bank RUP, impor JSON lalu simpan RUP manual. Keduanya harus tampil sesuai **hak akses OPD dan tahun** akun.
- Periksa filter Bank RUP, tombol **Tampilkan semua RUP**, status sinkronisasi cloud, serta hasil **reload** dan login ulang.
- Pastikan Viewer tidak dapat mengubah data; Operator tidak melihat OPD/tahun yang tidak ditugaskan.

## 3. Supabase (hanya jika memakai Supabase)

Untuk lingkungan baru, rencanakan bootstrap `supabase/satria-supabase-staging-bootstrap.sql` dan migrasi di `supabase/migrations/` **berdasarkan urutan dan dependensi**. Jangan menjalankan ulang migrasi tanpa memeriksa riwayat migrasi lingkungan yang aktif.

Migrasi dan dokumen utama:

- `20261024052900` s.d. `20261024053400`: assignment OPD/tahun, akses scoped, master bersama, dan sinkronisasi delta.
- `20261028010000_satria_rup_bank_cloud_compat.sql`: kompatibilitas Bank RUP dan RPC scoped; terapkan **setelah migrasi delta**.
- `20261028060000_satria_private_media_storage.sql`: penyimpanan media privat; terapkan **sesudah kompatibilitas Bank RUP**.
- `supabase/manual/SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql`: SQL cloud draft Smart Survey PRO, **manual**, bukan migrasi yang otomatis dijalankan; lihat keterangan di file.

**Penting:** Ada juga migrasi `20261024_satria_user_creation_security.sql` yang dapat memiliki dependensi sendiri. Untuk instalasi lama, cocokkan terhadap daftar migrasi yang sudah diterapkan, jangan menganggap semua berkas belum pernah dijalankan. Detail lanjutan: `docs/SECURITY_SCOPE_HARDENING.md`, `docs/BANK_RUP_CLOUD_MIGRATION.md`, `docs/SUPABASE_MEDIA_STORAGE_3.0.54.md`.

Edge Functions resmi berada hanya di `supabase/functions/`:

```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
```

Konfigurasi akses ada di `supabase/config.toml`. `ALLOWED_ORIGINS` harus mencakup origin aplikasi dan `verify_jwt` harus tetap aktif. Jangan menaruh kunci rahasia di HTML. Penerapan SQL, fungsi, dan validasi izin memerlukan akses admin yang sesuai ke proyek Supabase.

## 4. Pemeriksaan sebelum produksi

Jalankan semua pengujian pada `README.md`. Untuk database, jalankan assertion yang sesuai (`supabase/tests/`) pada staging sesuai hak akses dan instruksi SQL. Verifikasi backup sebelum melakukan perubahan produksi.

Rencana deploy yang aman: **backup → staging → tes RUP + akses + dokumen → deploy GitHub/hosting → cek cache → cek Supabase → produksi**.
