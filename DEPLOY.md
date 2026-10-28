# SATRIA Framework 3.0.41 — Deployment dan migrasi cloud

**Repositori ini berisi aplikasi HTML dan migrasi database. Memodifikasi ZIP/GitHub tidak otomatis mengubah Supabase produksi.**

## Urutan aman sebelum deploy

1. Backup database Supabase dan unduh backup JSON SATRIA dari setiap lingkungan yang akan dipindahkan.
2. Di **staging**, jalankan migrasi berurutan sesuai nama file. Untuk database baru, mulailah dengan `supabase/satria-supabase-staging-bootstrap.sql`, lalu migrasi 20261024* dan 20261024052900–20261024053400.
3. Jalankan **migrasi baru** `supabase/migrations/20261028010000_satria_rup_bank_cloud_compat.sql` **setelah** migrasi delta 20261024053400.
4. Verifikasi akses `admin`, `operator` OPD/tahun A, dan `viewer`. Khususnya, Bank RUP harus terbatas menurut OPD dan tahun di RPC `satria_get_scoped_state`.
5. Deploy Edge Functions hanya dari `supabase/functions/{admin-list-users,admin-create-user,admin-update-user}` (salinan direktori legacy telah dibersihkan).
6. Jalankan uji statis `python tools/security_static_check.py` dan `python tools/test_rup_bank_contract.py`. Uji database menggunakan `supabase/tests/rup_bank_cloud_assertions.sql` dan skenario manual di `docs/BANK_RUP_CLOUD_MIGRATION.md`.
7. Setelah staging lolos, deploy ke produksi pada jendela pemeliharaan, terapkan migrasi, unggah `index.html` beserta aset PWA, dan lakukan smoke test.

**Perubahan skema**: Bank RUP tetap disimpan dalam `satria_state.payload.rupBank` (array JSON) demi kompatibilitas; migrasi memperbarui RPC pembacaan berdasarkan OPD/tahun dan penyimpanan delta, serta validasi referensi dan duplikasi. Tidak memigrasikan data ke tabel relasional baru dan tidak otomatis memodifikasi isi snapshot yang sudah ada.

Catatan: buka aplikasi melalui HTTPS yang di-host, bukan `file://`, untuk PWA/servis pekerja yang andal. Pastikan `ALLOWED_ORIGINS` Edge Functions mencakup origin aplikasi. Publishable key di HTML bukan kunci rahasia, tetapi hanya aman bila RLS/RPC server telah diuji.


## SATRIA NEXT 3.0.54 — Private media storage
Baca `docs/SUPABASE_MEDIA_STORAGE_3.0.54.md`. Terapkan migrasi `20261028060000_satria_private_media_storage.sql` sesudah migrasi Bank RUP dan sebelum memakai unggah gambar. **Bucket privat**, gunakan kredensial Auth biasa, jangan memakai service_role di HTML.
