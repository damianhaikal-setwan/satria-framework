# SATRIA — Edge Function `admin-create-user`

Function ini membuat akun Auth langsung dan memberi membership SATRIA tanpa mengirim email. Akun yang dibuat ditandai `email_confirm = true` oleh Auth Admin API. Ini hanya menandai akun tersebut sebagai terkonfirmasi; alamat dummy tidak benar-benar diverifikasi. **Tidak perlu mematikan Confirm Email secara global** di pengaturan Auth proyek.

## Prasyarat dan file

Bootstrap dasar SATRIA harus sudah dijalankan agar tabel `satria_memberships` dan helper RLS tersedia. Jalankan `supabase/migrations/20261024_satria_user_creation_security.sql` di SQL Editor sebelum deploy. Migrasi menambah kontrol laju pembuatan akun dan tabel audit.

Salin `supabase/functions/admin-create-user/index.ts` ke repo pada path yang sama. Tambahkan ke `supabase/config.toml`:

```toml
[functions.admin-create-user]
verify_jwt = true
```

Jangan menonaktifkan verifikasi JWT. Function juga memverifikasi sesi ke Auth dan memeriksa membership admin aktif pada organisasi yang diminta.

## Konfigurasi dan deploy

Isi `ALLOWED_ORIGINS` dengan origin persis situs Pages Anda, tanpa path dan tanpa wildcard. Contoh:

```bash
supabase secrets set ALLOWED_ORIGINS="https://NAMA-SITUS.pages.dev,https://domain-anda.go.id"
supabase db push
supabase functions deploy admin-create-user
```

Edge Functions memperoleh URL dan API keys dari environment Supabase. Kode mendukung `SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS` modern dan nama variabel legacy. **Jangan menaruh secret/service-role key di HTML, GitHub, Cloudflare Pages, atau browser.**

Pembuatan role `operator` aktif secara default. Pembuatan admin baru sengaja dinonaktifkan. Jika memang diizinkan oleh kebijakan organisasi, aktifkan secara sadar:

```bash
supabase secrets set ALLOW_ADMIN_CREATION=true
```

Tanpa secret tersebut, permintaan role `admin` ditolak.

## Panggil dari HTML SATRIA

Admin yang sudah login dapat memanggil function dengan `supabase-js`:

```js
const initialPassword = initialPasswordInput.value;
const { data, error } = await supabase.functions.invoke('admin-create-user', {
  body: {
    organization_id: currentOrganizationId,
    email: emailInput.value,
    role: 'operator',
    initial_password: initialPassword,
    display_name: nameInput.value
  }
});
initialPasswordInput.value = ''; // bersihkan field setelah request

if (error) {
  console.error(error); // jangan log body request atau password
} else {
  console.log('Akun dibuat:', data.user.id, 'email terkonfirmasi:', data.email_confirmed);
}
```

Password awal wajib 12–128 karakter. Function tidak pernah mencatat, menyimpan sendiri, atau mengembalikan password tersebut. Sampaikan password awal kepada operator lewat saluran terpisah yang aman; minta mereka menggantinya setelah login. Jangan kirim field `user_id`, `active`, `service_role`, `secret key`, atau field lain yang tidak tercantum.

Pastikan email dummy **berformat valid dan unik untuk setiap akun**. Supabase tetap membutuhkan email unik meskipun konfirmasi dimatikan untuk akun itu. Karena alamat tersebut tidak bisa menerima email, pemulihan password via email juga tidak akan berfungsi. Siapkan proses reset oleh admin atau gunakan email yang dapat diakses operator.

## Batasan keamanan

Function ini hanya mengizinkan admin aktif organisasi target. Role admin/operator masih membaca seluruh JSON snapshot organisasi SATRIA. Function ini **belum** mengisolasi data per OPD atau per tahun. Jangan mengandalkan kode ini untuk pembatasan data lintas OPD; itu membutuhkan schema dan RLS terpisah.

Migrasi menolak akses langsung pengguna ke tabel rate limit. Batasnya lima percobaan per menit per admin dan organisasi. Alamat email yang sudah terdaftar di proyek akan ditolak; menambahkan user lama ke organisasi memerlukan alur terpisah.

## Referensi resmi

- [Supabase Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Edge Function environment variables and secrets](https://supabase.com/docs/guides/functions/secrets)
