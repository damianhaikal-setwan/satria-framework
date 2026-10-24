# Assignment OPD pengguna SATRIA

Fitur assignment OPD sudah terintegrasi pada `index.html` dan memakai katalog organisasi dari snapshot Supabase yang dibaca oleh Edge Function. Admin dapat memilih satu atau beberapa OPD ketika membuat Operator, lalu menggunakan tombol **Atur OPD / Ubah OPD** pada kolom **OPD yang dapat diakses** untuk mengubah assignment yang sudah ada.

## Komponen

- `index.html` — form tambah Operator, tabel daftar akun, kolom OPD, modal edit assignment, validasi pilihan, dan refresh setelah penyimpanan.
- `supabase/functions/admin-list-users/index.ts` — memvalidasi admin aktif, menyinkronkan katalog OPD dari `satria_state.payload.opd` ke katalog canonical, lalu mengembalikan daftar OPD dan assignment user.
- `supabase/functions/admin-create-user/index.ts` — mewajibkan `opd_ids` untuk Operator; jika assignment gagal, pembuatan membership/akun dibatalkan sejauh operasi rollback memungkinkan.
- `supabase/functions/admin-update-user/index.ts` — endpoint admin-only untuk mengganti assignment OPD operator aktif.
- `supabase/migrations/20261024052900_satria_opd_assignments_rls.sql` — tabel katalog/assignment serta RLS.
- `supabase/migrations/20261024053000_satria_user_opd_assignment_api.sql` — RPC assignment untuk Edge Functions, memperketat helper akses OPD, dan memperluas audit action.
- `supabase/migrations/20261024053100_satria_catalog_and_assignment_repair.sql` — cache nama/email membership, fallback roster dibatasi RLS, dan RPC assignment aman yang mengikat admin ke `auth.uid()`.

`frontend/opd-assignment-form.js` tetap tersedia sebagai helper reusable lama; `index.html` menggunakan komponen yang tertanam dan katalog yang berasal dari server supaya tidak mengandalkan pilihan OPD browser sebagai sumber otoritatif.

## Urutan penerapan

1. Terapkan SQL bootstrap SATRIA terlebih dahulu.
2. Terapkan migrasi `20261024_satria_user_creation_security.sql`.
3. Terapkan migrasi `20261024052900_satria_opd_assignments_rls.sql`.
4. Terapkan migrasi `20261024053000_satria_user_opd_assignment_api.sql`.
5. Terapkan migrasi `20261024053100_satria_catalog_and_assignment_repair.sql`.
6. Deploy ketiga Edge Function dan pastikan `verify_jwt = true` pada `supabase/config.toml`.

```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
```

Pastikan secrets runtime `SUPABASE_URL`, publishable key, secret/service-role key, dan `ALLOWED_ORIGINS` sudah disetel sesuai project. Secret/service-role key hanya boleh berada di Edge Function, bukan HTML.

## Cara menggunakan

1. Admin login ke Supabase di SATRIA.
2. Tarik snapshot organisasi yang berisi daftar OPD terbaru. Daftar OPD untuk assignment disinkronkan server ketika daftar pengguna dimuat; HTML juga memiliki fallback yang dibatasi RLS untuk menyinkronkan katalog dari snapshot jika Edge Function yang sedang dipakai mengirim format lama.
3. Buka **Pengguna dan Hak Akses → Tambah user operator**.
4. Pilih minimal satu OPD, lalu lengkapi nama, email, dan password awal.
5. Untuk akun yang sudah ada, klik **Atur OPD** atau **Ubah OPD** di kolom OPD. Tombol tersedia pada setiap Operator; perubahan hanya dapat disimpan untuk Operator aktif. Jika katalog kosong, isi Data Master OPD, kirim snapshot ke Supabase, dan muat ulang roster.

Jika katalog OPD kosong, pastikan snapshot cloud sudah dibuat/ditarik dan memuat `payload.opd`, lalu jalankan semua migrasi OPD. Jika daftar pengguna menampilkan respons Edge Function lama, deploy ulang `admin-list-users` dan `admin-create-user` dari paket ini. Data OPD lokal yang belum dikirim ke cloud tidak menjadi sumber kebenaran untuk assignment.

## Batas keamanan yang penting

Assignment disimpan di tabel `satria_membership_opds`, diverifikasi ulang melalui RPC database yang atomic; RPC browser memeriksa admin berdasarkan `auth.uid()` dan mencatat audit dalam transaksi yang sama. Namun, SATRIA saat ini masih menyimpan data bisnis sebagai satu JSON `satria_state.payload` per organisasi. RLS assignment OPD tidak otomatis memisahkan isi snapshot JSON per OPD: anggota yang memiliki akses membaca snapshot organisasi masih dapat menerima payload organisasi penuh. Jadi fitur ini mengelola assignment resmi dan menyediakan helper RLS bagi tabel OPD-scoped, tetapi belum bisa dianggap sebagai isolasi data penuh untuk seluruh paket/dokumen sampai snapshot dimigrasikan ke tabel terstruktur atau dibaca melalui API server yang menerapkan scope OPD.

## Uji minimum setelah deploy

- Operator baru tanpa `opd_ids` harus ditolak.
- Operator baru dengan satu atau beberapa OPD yang ada di katalog berhasil dibuat, dan daftar menunjukkan nama OPD.
- ID OPD palsu, OPD organisasi lain, ID duplikat, dan assignment kosong harus ditolak server.
- Admin dapat mengganti assignment operator aktif; daftar memperbarui kolom OPD setelah penyimpanan.
- Operator, Viewer, admin nonaktif, dan user tanpa sesi tidak dapat menggunakan endpoint list/update.
- Jika OPD dihapus dari snapshot, katalog canonical menonaktifkannya; assignment lama tidak dianggap sebagai akses ke OPD aktif.
- Jika audit insert gagal, UI memberi peringatan meski assignment telah tersimpan. Periksa log Edge Function.
