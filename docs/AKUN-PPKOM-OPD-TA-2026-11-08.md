# SATRIA — Akun PPKom Bapperida & Disporapar, dibatasi OPD + Tahun Anggaran

**Tanggal:** 8 November 2026  
**Status:** perubahan kode siap diuji dan dideploy; **belum membuat akun di Supabase produksi**.  
**Basis ZIP:** SATRIA lengkap setelah perbaikan Sumber/Bukti Harga per Penyedia dan kontras RUP SATRIA 360.

## 1. Konsep dan dua akun

PPKom adalah **jenis akun khusus dalam pembuatan pengguna SATRIA**. Nama pengguna, email, dan password diisi oleh Admin saat membuat akun; tidak ada kredensial default yang ditanam dalam kode.

| Pengguna yang dibuat Admin | OPD yang dipilih pada katalog Supabase | Tahun anggaran |
| --- | --- | --- |
| PPKom Bapperida | **Bapperida**, dari Data Master yang telah disinkronkan | Tahun yang diizinkan Admin, misalnya 2026 |
| PPKom Disporapar | **Disporapar**, dari Data Master yang telah disinkronkan | Tahun yang diizinkan Admin, misalnya 2026 |

Contoh tahun di atas **bukan penugasan otomatis**. Admin wajib memilih minimal satu TA yang telah ada pada snapshot organisasi saat pembuatan akun, dan dapat mengubah TA nanti. Form PPKom mewajibkan **tepat satu OPD** saat pembuatan; perubahan OPD via antarmuka Admin juga dibatasi menjadi satu pilihan.

### Implementasi yang sengaja mempertahankan keamanan lama

- `satria_memberships.role` **tetap `operator`** untuk PPKom. Ini sengaja dilakukan agar pemeriksaan server yang sudah ada (`satria_get_scoped_state`, `satria_apply_state_delta`, RLS, assignment OPD dan TA) tetap berlaku, tanpa menambahkan role database yang belum didukung RPC.
- Identitas khusus PPKom disimpan di **Supabase Auth `app_metadata.satria_account_type = 'ppkom'`**, hanya ditulis oleh API Admin pada pembuatan user. Ini tidak memberikan izin tambahan. Label **PPKom** terlihat pada daftar pengguna Admin dan identitas login SATRIA.
- `admin-create-user` memverifikasi Admin aktif, nama/email/password, tepat satu OPD, minimal satu tahun, membuat Auth user, membership Operator, lalu assignment OPD/TA. Pembuatan dibatalkan jika assignment gagal, dengan pengecekan rollback.
- `admin-list-users` mengembalikan `account_type` dari Auth metadata bersama penugasan OPD dan TA, tanpa membocorkan password.
- Admin masih dapat mengubah assignment melalui fungsi database Admin yang sudah ada. Secara arsitektur **Admin tetap pemegang kewenangan penuh atas assignment**, sehingga perubahan oleh Admin harus diaudit dan diuji kembali.

**Tidak ada perubahan skema database / migrasi SQL baru** dalam paket ini, dengan syarat migrasi keamanan OPD/TA dan delta sebelumnya sudah terpasang.

## 2. Hak akses PPKom — berdasarkan implementasi saat ini

| Modul / data | Melihat | Mengolah / melakukan |
| --- | --- | --- |
| Ringkasan Utama / SATRIA 360 / Dashboard / Analitik | Ya, paket dan RUP pada OPD + TA penugasan | Meninjau, mencari, mengunduh laporan yang ditampilkan |
| Bank RUP / Input RUP | Ya, RUP pada OPD + TA penugasan | Input manual, impor dan perubahan RUP **yang lolos validasi scope server** |
| Paket Pengadaan e-Purchasing | Ya, paket OPD + TA penugasan | Membuat, menyunting, menghitung HPS dan pembanding, melengkapi penawaran/negosiasi, mencatat hasil proses termasuk penetapan sesuai fungsi aplikasi; bukan pengesahan hukum otomatis |
| Smart Survey / Sumber-Bukti Harga | Ya, informasi paket pada OPD + TA penugasan | Memasukkan bukti harga per item, harga penawaran, dan referensi katalog penyedia sesuai fungsi yang ada |
| Dokumen Pengadaan (DPP, SPPBJ, BA, analisis harga, dll.) | Ya, untuk paket penugasan | Menyusun data sumber, melihat pratinjau, mencetak/ekspor dokumen yang tersedia; pencetakan bukan tanda tangan digital |
| Monitoring SPSE / Kontrak / Tindak Lanjut | Ya, paket pada OPD + TA penugasan | Memperbarui catatan dalam paket penugasan yang diizinkan alur Operator |
| Data Master, identitas organisasi & kode referensi | Katalog OPD/unit/pejabat hanya OPD penugasan; **sejumlah referensi organisasi tetap dibagikan** | UI Data Master/Pengaturan organisasi utama tetap baca saja bagi Operator/PPKom. Beberapa delta unit/pejabat dalam scope mempunyai API server khusus; kontrol ini tidak disamakan dengan hak Admin |
| Pengguna dan Hak Akses | Tidak | Tidak dapat membuat akun, mengubah role atau assignment |
| OPD lain / TA lain | **Paket/RUP/dokumen tidak diterima dari RPC scoped** | Percobaan mengubah paket/RUP di luar scope ditolak oleh pemeriksaan server |
| Impor backup organisasi penuh / hapus atau reset organisasi | Tidak | Tidak boleh; tindakan global hanya melalui Admin |

**Batasan penting:** PPKom ini **mengakses semua paket pada OPD dan tahun yang ditugaskan**, **belum dibatasi lagi menurut ID pejabat PPK pada masing-masing paket**. Jika diperlukan penugasan per individu/paket, itu merupakan pengembangan berikutnya dengan pemeriksaan server tambahan.

**Katalog bersama:** RPC snapshot yang sudah ada tetap menyertakan referensi bersama seperti `pemda`, `meta`, `penomoran`, `akun`, `kode` serta daftar `penyedia`, meskipun paket/RUP/OPD/pejabat/unit diproyeksikan menurut scope. Karena itu pembatasan ini **bukan isolasi absolut seluruh field JSON organisasi**. Jangan memasukkan data rahasia OPD lain dalam master referensi bersama tanpa merancang migrasi/proyeksi khusus. Ekspor pengguna memakai data scoped dan referensi bersama yang memang diterima.

## 3. Langkah menerapkan pembaruan (wajib)

1. Cadangkan proyek saat ini, ekspor backup SATRIA lewat akun Admin dan buat backup database Supabase.
2. Publikasikan file frontend yang berubah ke GitHub / Cloudflare Pages: `frontend/refactor/js/01-app-core.js`, `frontend/refactor/js/05-cloud-sync.js`, `sw.js`. Untuk instalasi baru dapat gunakan ZIP proyek lengkap.
3. **Deploy ulang kedua Supabase Edge Functions** ke proyek Supabase yang benar (tidak cukup hanya mengunggah ZIP ke GitHub):
   ```bash
   supabase functions deploy admin-create-user
   supabase functions deploy admin-list-users
   ```
   Kedua foldernya ada di `supabase/functions/`. Konfigurasi secret fungsi dan origin harus tetap sesuai instalasi sekarang. `admin-update-user` tidak diubah.
4. Pastikan fungsi `satria_get_scoped_state`, `satria_apply_state_delta`, dan tabel `satria_membership_opds`, `satria_membership_years` telah aktif. Jika belum, **periksa urutan migrasi yang ada** dan terapkan sesuai panduan `docs/SECURITY_SCOPE_HARDENING.md`; jangan menjalankan ulang SQL produksi secara membabi buta.
5. Login **Admin Supabase** → **Pengguna dan Hak Akses** → **Tambah akun Operator / PPKom** → pilih **PPKom**, isi identitas login unik dan password awal aman → centang hanya **Bapperida** → pilih tahun anggaran → buat akun.
6. Ulangi untuk **PPKom Disporapar**, memilih hanya **Disporapar** dan TA yang benar. Nama organisasi/ID OPD harus sudah ada di katalog hasil sinkronisasi Data Master.
7. Pada daftar pengguna, periksa label **PPKom**, OPD dan TA. Setelah akun masuk pertama kali, periksa berkas atau paket dari OPD/tahun lain **tidak muncul**. Coba aksi melampaui scope dengan data uji staging; server harus menolak. Jangan menguji manipulasi data di produksi.

Tidak ada akun atau password nyata yang dibuat pada tahap pembuatan ZIP. **Admin perlu membuat kedua akun melalui aplikasi yang sudah dideploy.**

## 4. Tes regresi lokal

Dari akar proyek:

```bash
node tools/test_ppkom_creation_20261108.cjs
python tools/test_ppkom_form_browser_20261108.py
node tools/test_next4_foundation.js
node tools/test_supplier_catalog_source_20261108.js
python tools/test_satria360_rup_contrast_browser_20261108.py
python tools/security_static_check.py
```

Tes Node memakai simulasi API Supabase (tanpa menghubungi server); tes Chromium menguji formulir, pilihan satu OPD, dan filter paket/RUP. **Uji integrasi pada Supabase staging dengan minimal dua akun sebenarnya tetap wajib sebelum penerapan produksi.**

## 5. Perawatan

- Tidak mengubah struktur penawaran, dokumen, sumber harga, CSS SATRIA 360, maupun data paket.
- Tambahan pemilahan jenis akun memakai satu field metadata Auth, tanpa tabel/role database baru.
- Penghapusan/nonaktif user, pergantian OPD dan tahun tetap mengikuti sistem Admin dan RLS yang sudah ada.
- Cache PWA diperbarui pada `sw.js` agar perubahan tampilan akun dimuat setelah deploy.
