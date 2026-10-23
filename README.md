# SATRIA — daftar pengguna admin (`admin-list-users`)

Paket ini menambahkan daftar anggota Supabase Auth pada halaman **Pengguna dan Hak Akses**. Cocokkan dengan bootstrap SATRIA yang menyediakan `public.satria_memberships(organization_id, user_id, role, active, created_at)` dan nilai role `admin`, `operator`, `viewer`.

## File

- `supabase/functions/admin-list-users/index.ts` — Edge Function. Letakkan di path yang sama pada repo Supabase.
- `frontend/admin-list-users.js` — kode frontend mandiri untuk ditempel di dalam Supabase bridge IIFE, sesudah modal tambah user dan sebelum penutup bridge `})();`.
- `SATRIA-Framework-3.0-Admin-Users.html` — salinan HTML tugas sebelumnya dengan panel daftar dan JavaScript sudah terintegrasi.
- `supabase/config.toml` — setelan lokal agar gateway tetap memvalidasi JWT.

## Keamanan

Gateway memvalidasi JWT (`verify_jwt = true`), kemudian fungsi memvalidasi token lagi terhadap Auth. Sebelum membaca data, fungsi memeriksa bahwa pemanggil memiliki membership `admin` **aktif** pada `organization_id` yang dikirim. Role, status aktif, dan organisasi tidak dipercaya dari frontend. Service/secret key hanya digunakan di Edge Function; tidak pernah ditanam di HTML.

Query pertama mengambil hanya membership organisasi tersebut; data Auth yang dikembalikan hanya untuk user ID di hasil tersebut. Respons tidak mengembalikan `user_metadata` secara keseluruhan, hanya nama tampilan, email, role, status membership, serta tanggal. Respons diberi `no-store`. CORS memakai allowlist origin persis dan bukan pengganti otorisasi.

Daftar mencakup semua membership organisasi, termasuk yang nonaktif, sehingga admin dapat melihat statusnya. Data diurutkan berdasarkan waktu membership terbaru dan dipaginasi 50 baris/halaman. Frontend menyembunyikan panel dari non-admin demi UX, tetapi pemeriksaan server tetap menjadi kontrol keamanan yang menentukan.

## Deploy

1. Salin folder `supabase/functions/admin-list-users` ke proyek Supabase.
2. Gabungkan bagian dari `supabase/config.toml` dengan `config.toml` proyek (jangan menimpa konfigurasi fungsi lain).
3. Isi allowlist dengan origin Pages/aplikasi yang benar, tanpa path atau wildcard. Runtime Supabase menyediakan URL dan key secara otomatis.

```bash
supabase secrets set ALLOWED_ORIGINS="https://nama-situs.pages.dev,https://domain-anda.go.id"
supabase functions deploy admin-list-users
```

Pastikan Supabase project telah menjalankan bootstrap SATRIA dan tabel membership memiliki kolom `created_at`. Fungsi tidak memerlukan migrasi tambahan.

## Frontend

HTML terintegrasi sudah memanggil function menggunakan sesi admin aktif:

```js
const { data, error } = await client.functions.invoke('admin-list-users', {
  body: { organization_id: orgId, page: 1, page_size: 50 }
});
```

Untuk penerapan pada HTML lain, tambahkan juga wadah dengan ID yang digunakan di `vUser()` (`satriaCloudUserListCard`, `satriaAdminUsersRows`, tombol pagination/status). Kode JavaScript harus berada **di dalam** bridge IIFE yang memiliki closure `client`, `member`, dan `orgId`; memasangnya sebagai file script eksternal di luar closure tidak akan memiliki akses ke sesi tersebut. Setelah pembuatan user sukses, dispatch event `window.dispatchEvent(new CustomEvent('satria:user-created'))` agar daftar dimuat ulang.

## Pengujian setelah deploy

- Admin aktif pada organisasi yang dikirim harus menerima `200` berisi anggota organisasi itu saja.
- Operator, viewer, admin nonaktif, user tanpa sesi, dan admin dari organisasi lain harus ditolak (`401` atau `403`).
- Uji halaman berikutnya saat jumlah membership melebihi 50.
- Periksa Network browser: request membawa sesi terautentikasi; tidak ada service/secret key; response memiliki `Cache-Control: no-store`.
