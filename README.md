# SATRIA — Pengguna, Hak Akses, dan Assignment OPD

Repo ini menyediakan modul pengguna Supabase Auth dan assignment OPD untuk aplikasi SATRIA Framework 3.0.

## Fitur

- Daftar membership/Auth yang hanya dapat dibaca oleh admin aktif pada organisasi terkait; paginasi 50 akun/halaman.
- Saat membuat Operator, admin wajib memilih minimal satu OPD dari katalog server.
- Kolom **OPD yang dapat diakses** menampilkan assignment setiap Operator.
- Tombol **Atur OPD / Ubah OPD** mengubah assignment akun operator aktif.
- Server memvalidasi organisasi, role admin, status target, dan keberadaan setiap OPD. Penggantian assignment dilakukan secara atomic melalui PostgreSQL RPC.
- Audit action dicatat ke `satria_admin_audit_logs`; secret/service-role key tidak pernah ditanam di HTML.

## Komponen utama

- `index.html` — UI terintegrasi untuk form tambah Operator, daftar akun, dan edit assignment.
- `supabase/functions/admin-list-users/index.ts`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-user/index.ts`
- `supabase/migrations/20261024052900_satria_opd_assignments_rls.sql`
- `supabase/migrations/20261024053000_satria_user_opd_assignment_api.sql`
- `supabase/migrations/20261024053100_satria_catalog_and_assignment_repair.sql`
- `supabase/migrations/20261024_satria_user_creation_security.sql`
- `supabase/satria-supabase-staging-bootstrap.sql`

## Urutan setup/deploy

1. Terapkan `supabase/satria-supabase-staging-bootstrap.sql` pada database baru (atau pastikan skema yang sesuai sudah ada).
2. Terapkan `supabase/migrations/20261024_satria_user_creation_security.sql`.
3. Terapkan `supabase/migrations/20261024052900_satria_opd_assignments_rls.sql`.
4. Terapkan `supabase/migrations/20261024053000_satria_user_opd_assignment_api.sql`.
5. Terapkan `supabase/migrations/20261024053100_satria_catalog_and_assignment_repair.sql`.
6. Gabungkan konfigurasi `supabase/config.toml` dengan konfigurasi project yang sudah ada; jangan menimpa fungsi lain.
7. Set `ALLOWED_ORIGINS` ke origin aplikasi yang tepat. Pastikan Supabase runtime menyediakan `SUPABASE_URL`, publishable key, dan secret/service-role key.
8. Deploy Edge Function:

```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
```

Semua fungsi memakai `verify_jwt = true` dan tetap memeriksa token serta membership admin aktif di dalam fungsi. Jangan menaruh secret/service-role key dalam `index.html`.

## Cara kerja katalog OPD

`admin-list-users` membaca `satria_state.payload.opd` dari snapshot cloud dan menyinkronkan master tersebut ke `satria_opds`. OPD harus sudah terkirim ke snapshot cloud sebelum dapat dipilih sebagai assignment. Katalog browser saja tidak dianggap otoritatif oleh backend.

Lihat `frontend/OPD-Frontend-Integration.md` untuk alur penggunaan, pengujian, dan batas keamanan saat ini.

## Batas keamanan penting

SATRIA masih menyimpan data bisnis sebagai satu snapshot JSON organisasi. Assignment OPD tersimpan dengan benar dan tersedia bagi kebijakan RLS pada tabel terstruktur, tetapi belum otomatis menyaring isi `satria_state.payload` per OPD. Isolasi data penuh membutuhkan migrasi data bisnis ke tabel terstruktur atau API server yang menerapkan scope OPD sebelum mengirim respons. Jangan menganggap assignment ini sebagai pengamanan penuh terhadap pembacaan payload JSON organisasi.

## Persistensi konfigurasi koneksi

- Buka menu **☁ Supabase** dan isi Project URL, publishable/anon key, serta Organization UUID satu kali.
- Klik **Simpan konfigurasi** untuk menyimpan tiga nilai tersebut di `localStorage` browser. Login berikutnya pada browser/profil yang sama akan mengisi otomatis konfigurasi.
- Klik **Masuk ke SATRIA** untuk login. Sesi Supabase Auth tetap menggunakan `persistSession` dan token refresh otomatis.
- Kata sandi tidak pernah disimpan oleh fitur konfigurasi.
- Jika menggunakan browser/profil lain atau browser mengisolasi penyimpanan untuk file lokal (`file://`), klik **Unduh HTML dengan konfigurasi** lalu gunakan file hasilnya. File tersebut menanam URL, anon/publishable key, dan Organization UUID, tetapi tidak menanam kata sandi. Jangan pernah memasukkan `service_role` atau `sb_secret_`.
- Jika konfigurasi tersimpan di browser dan juga tertanam di HTML, konfigurasi browser menjadi prioritas sehingga perubahan dapat disimpan tanpa mengunduh ulang file.

## Troubleshooting login: `Invalid login credentials`

This message is returned by Supabase Auth when the email/password pair cannot be authenticated. It is not caused by the Organization UUID. Check the following:

1. In Supabase Dashboard, open **Authentication → Users** for the project configured in `index.html` and verify the intended email (for example, `admin@satria.go.id`) exists. An HTML file or organization UUID does not create an Auth account.
2. If the account exists but the password is unknown, use **Lupa kata sandi?** in the SATRIA Supabase panel. Supabase email delivery must be configured, and the live SATRIA page URL must be allowed under **Authentication → URL Configuration → Redirect URLs**. Open the email link in the same application deployment and save a new password.
3. If no Auth user exists, create it in Supabase Dashboard → Authentication → Users first, then bootstrap an active `admin` row in `public.satria_memberships` tied to the existing organization UUID and the new Auth user's UUID. Do not insert or fabricate a fake Auth user ID.
4. If sign-in succeeds but SATRIA reports that membership is inactive/missing, that is a separate authorization/setup issue; repair the membership, not the password.

The client has a friendly diagnostic for `Invalid login credentials`, a password-reset request, and a recovery form for setting the new password. A successful browser-side reset still depends on the Auth user existing and Supabase email/redirect configuration being correct. No password or Supabase secret/service-role key is embedded in the HTML.

## Perbaikan formulir pengguna dan assignment OPD (24 Oktober 2026)

- Password awal dan konfirmasi ditempatkan langsung setelah email, sebelum pemilihan role/katalog OPD agar tidak tersembunyi jauh di bawah pada layar ponsel. Kedua field memiliki tombol Tampilkan/Sembunyikan.
- Roster pengguna Supabase dipisah dari kartu pembuatan akun supaya visibilitas daftar/aksi OPD tidak bergantung pada kartu form tambah akun.
- Tombol Atur OPD tetap tampil untuk Operator aktif walau katalog kosong; dialog memberi instruksi mengisi master OPD, mengirim snapshot, dan menjalankan migrasi.
- UI assignment tetap membutuhkan Edge Functions dan migrasi terbaru pada project Supabase; file HTML saja tidak dapat mengubah assignment server.


## Perbaikan katalog OPD dan respons Edge Function (24 Oktober 2026)

Jika antarmuka menampilkan `Respons Edge Function tidak valid`, fungsi `admin-list-users` yang aktif belum memakai kontrak respons terbaru. HTML baru tetap mencoba jalur fallback yang dibatasi RLS: membaca membership dan assignment dari tabel organisasi, serta menyinkronkan katalog OPD dari `satria_state.payload.opd` menjadi `satria_opds`. Jalur ini hanya menampilkan data apabila sesi admin aktif dan policy database mengizinkan akses.

Urutan pemulihan yang diperlukan: (1) pastikan snapshot cloud organisasi memuat array `opd` yang benar; (2) jalankan migrasi `20261024053100_satria_catalog_and_assignment_repair.sql`; (3) deploy ulang `admin-list-users` dan `admin-create-user` dari paket ini. Tombol simpan assignment menggunakan RPC baru `satria_admin_assign_my_membership_opds` yang memverifikasi `auth.uid()` sebagai admin aktif, menyimpan perubahan secara atomic, dan menulis audit dalam transaksi yang sama. Jangan memberi izin eksekusi ke fungsi lama yang menerima actor ID arbitrer untuk role `authenticated`.
