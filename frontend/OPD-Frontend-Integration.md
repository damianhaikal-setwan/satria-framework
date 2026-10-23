# Pilihan OPD di form user SATRIA (frontend)

Helper frontend reusable ada di [`opd-assignment-form.js`](./opd-assignment-form.js). Ia membuat checkbox multi-pilih dari pilihan pada `#selOpd`, lalu mengekspos `SATRIA_OPD_FORM.mount()`, `.selectedIds()`, dan `.validate()`.

## Form tambah user

Muat helper di dalam bridge Supabase yang sama dengan modal user, setelah `#satriaCreateUserForm` dibuat. Karena modal yang ada dibuat dinamis, helper akan memasang fieldset ketika tombol `#satriaOpenCreateUser` diklik. Pada handler submit di modal, setelah validasi nama/email/password, tambahkan:

```js
if (!window.SATRIA_OPD_FORM?.validate(form)) {
  setMessage('Pilih minimal satu OPD untuk user ini.', 'error');
  return;
}
const opdIds = window.SATRIA_OPD_FORM.selectedIds(form);
```

Tambahkan `opd_ids` ke body request pembuatan user:

```js
const { data, error } = await client.functions.invoke('admin-create-user', {
  body: {
    organization_id: orgId,
    email,
    role,
    initial_password: initialPassword,
    display_name: displayName,
    opd_ids: opdIds,
  },
});
```

## Form edit user

Saat dialog edit dibuka, panggil `mount()` dengan assignment yang sudah disimpan untuk user itu. Assignment terpilih harus diambil dari endpoint/server, bukan disimpulkan dari role atau input yang bisa dimanipulasi:

```js
function openEditUserForm(editForm, user) {
  // user.opd_ids harus datang dari respons endpoint admin yang sudah memeriksa
  // admin aktif dan membatasi user pada organisasi aktif.
  window.SATRIA_OPD_FORM.mount(editForm, user.opd_ids || []);
}
```

Pada submit form edit:

```js
if (!window.SATRIA_OPD_FORM?.validate(editForm)) {
  showEditError('Pilih minimal satu OPD untuk user ini.');
  return;
}

const { data, error } = await client.functions.invoke('admin-update-user', {
  body: {
    organization_id: orgId,
    user_id: userId,
    opd_ids: window.SATRIA_OPD_FORM.selectedIds(editForm),
  },
});
```

## Wajib sebelum diaktifkan

Kode ini hanya menyediakan UI. `admin-create-user` yang ada saat ini membatasi field request dan **akan menolak** `opd_ids`; belum ada modal edit atau endpoint `admin-update-user`. Jangan kirim field tersebut ke versi Edge Function sekarang. Backend perlu lebih dahulu menyediakan tabel assignment, menyimpan/menukar assignment secara atomik, memeriksa setiap OPD memang milik organisasi target, dan hanya mengizinkan admin aktif. Untuk keamanan data, RLS atau Edge Function yang membaca/menulis data aplikasi juga harus menerapkan assignment tersebut.

Saat ini pilihan diambil dari dropdown `#selOpd` SATRIA (data snapshot frontend). Itu hanya sumber tampilan, bukan daftar otoritatif untuk hak akses. Setelah tabel OPD/assignment tersedia, lebih baik muat opsi dari endpoint admin yang memvalidasi organisasi, dan server tetap memvalidasi ulang seluruh `opd_ids` pada setiap simpan/perubahan akses.
