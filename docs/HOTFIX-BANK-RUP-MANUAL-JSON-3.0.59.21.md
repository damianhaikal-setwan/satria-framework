# SATRIA NEXT 3.0.59.21 — Perbaikan Bank RUP Manual & Impor JSON

## Penyebab yang terverifikasi dari kode

1. Sesudah simpan manual, `S.ui.rupSearch=rup` mengisi pencarian otomatis dengan kode RUP baru. RUP lain, termasuk yang diimpor lewat JSON, tetap berada di `S.rupBank` tetapi tersembunyi dari tampilan.
2. Daftar bank `satriaBankRows()` sebelumnya ikut memfilter `S.ui.opd` pada header, sehingga ketika OPD manual berbeda dengan OPD data JSON, entri JSON tidak tampak.
3. Heading `Daftar RUP yang telah diimpor (N)` menghitung semua entri tanpa menjelaskan bahwa daftar di bawahnya sudah terfilter. Hal ini menyebabkan data terlihat seolah hilang.
4. `rupmanualsave` sebelumnya tidak termasuk whitelist `WRITE` yang melindungi aksi tulis Viewer pada UI.

## Perbaikan

- Bank RUP membaca semua RUP yang **diizinkan bagi akun** (`satriaBankAccessibleRows`) tanpa membatasi berdasarkan filter OPD/tahun header.
- Tersedia filter Bank RUP tersendiri untuk OPD, tahun, pencarian teks, serta tombol **Tampilkan semua RUP**.
- Simpan RUP manual dan impor JSON sama-sama mengembalikan tampilan Bank RUP ke seluruh data yang diizinkan, tanpa menghapus atau mengganti entri RUP lainnya.
- Heading menunjukkan total, jumlah yang terlihat, serta pembagian asal `Input manual`, `Impor JSON/CSV`, dan `Data lama/backup`.
- Setiap kartu RUP menunjukkan sumber data (`asal`) dan status verifikasi apabila tersedia.
- Aksi tulis `rupmanualsave` ditambahkan ke pemeriksaan `WRITE` agar Viewer tidak menulis lewat jalur tersebut. Proteksi Supabase RLS tetap wajib.
- Cache PWA diperbarui agar versi lama tidak terus ditampilkan setelah deploy.

## Cara validasi

1. **Sebelum deploy**, unduh Backup JSON dari SATRIA produksi dan simpan salinan backup Supabase.
2. Deploy ZIP ke staging. Jika digunakan sebagai PWA, muat ulang dan pastikan label **NEXT · 3.0.59.21** pada header.
3. Login sebagai Admin/Operator yang telah diberi OPD/tahun. Klik **Tarik dari Supabase** untuk mengambil snapshot cloud yang sudah ada.
4. Menu **Input RUP** → impor sebuah JSON yang valid → **Periksa data** → **Impor ke Bank RUP**. Pastikan kartu JSON muncul.
5. Tambah RUP berbeda pada **Input RUP Manual**, tekan **Simpan ke Bank RUP**. Pastikan kartu RUP JSON **dan** manual muncul bersamaan. Sumber di tiap kartu harus jelas.
6. Pilih OPD lain pada header; daftar Bank RUP tidak otomatis menyembunyikan RUP yang ada pada OPD sebelumnya. Gunakan filter OPD khusus Bank RUP bila ingin mempersempit.
7. Masukkan pencarian kode → cek jumlah terfilter → tekan **Tampilkan semua RUP** → semua entri yang diizinkan terlihat lagi.
8. Periksa status **Tersinkron** dari Supabase. Segarkan halaman/masuk ulang; pastikan keduanya tetap tersedia. Jika data hilang setelah tarik ulang, periksa RPC `satria_get_scoped_state`, `satria_apply_state_delta`, assignment, dan migrasi cloud sebagaimana dijelaskan `docs/BANK_RUP_CLOUD_MIGRATION.md`.
9. Uji akun Viewer: tidak boleh membuat atau mengimpor RUP. Operator tetap hanya melihat data sesuai assignment OPD dan tahun di server.

## Uji otomatis statis

```bash
node tools/test_rup_bank_visibility.js
python tools/test_rup_bank_contract.py
python tools/security_static_check.py
```

## Batasan

Perbaikan ZIP ini menyasar tampilan dan interaksi klien pada file asli pengguna; **tidak mengubah data RUP yang sudah ada, tidak mengubah SQL, dan tidak otomatis mengunggah ke GitHub maupun Supabase**. Browser/Supabase aktif pengguna belum dapat diuji tanpa autentikasi dan koneksi ke lingkungannya. Tindakan simpan lokal belum sama dengan konfirmasi tersimpan di cloud: pastikan status sinkronisasi selesai, lalu uji refresh.
