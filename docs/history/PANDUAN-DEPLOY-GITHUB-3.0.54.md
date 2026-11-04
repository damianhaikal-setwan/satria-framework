# SATRIA NEXT 3.0.54 — Panduan deploy ke GitHub Pages

Arsip ini sudah ditata agar file **index.html langsung berada di root repositori** setelah diekstrak.

## Deploy / pembaruan GitHub

1. **Backup** kode repositori GitHub sebelumnya dan data SATRIA (JSON), bila diperlukan.
2. Ekstrak ZIP di komputer. Unggah **isi hasil ekstrak** ke root repositori GitHub Anda, bukan file ZIP dan bukan folder pembungkus lain. Perbarui file yang sudah ada dengan versi 3.0.54.
3. Pastikan di root ada `index.html`, `manifest.json`, `sw.js`, `_headers`, `_redirects`, folder `supabase/`, `docs/`, dan ikon.
4. Di GitHub: Settings → Pages → pilih **Deploy from a branch**, branch yang dipakai, folder **/(root)** bila memang memakai GitHub Pages berbasis branch; tunggu status deploy lalu buka URL Pages Anda. Bila sudah memakai workflow Actions, pertahankan pengaturan workflow yang ada.
5. Refresh keras browser (atau tutup/buka PWA) untuk memperbarui cache Service Worker versi 3.0.54.
6. Login SATRIA melalui akun Supabase lalu uji unggah foto produk, melihat foto dari perangkat lain, dan tanda tangan/cap pada DPP.

## Status Supabase

Berdasarkan audit SQL yang pengguna kirim sebelumnya, bucket `satria-media` privat, fungsi media guard, dan policy upload/baca sudah terdeteksi **OK**. **Jangan jalankan ulang seluruh migrasi Supabase hanya karena mengunggah ZIP ke GitHub.** Mengunggah file `supabase/migrations/*.sql` ke GitHub **tidak otomatis menerapkan SQL** ke project Supabase.

Kebijakan Storage perlu diuji dengan akun nyata (Admin/Operator/Viewer) dan foto lintas perangkat; hasil audit SQL bukan bukti uji operasional.

## Konten paket

- `index.html` : aplikasi SATRIA NEXT 3.0.54 lengkap (foto produk, TTD, cap, kop OPD ke Supabase Storage).
- `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`: aset web app/PWA.
- `supabase/` : fungsi dan file migrasi SQL (termasuk Storage privat).
- `docs/`, `tools/`, `tests/`, `README.md`, `DEPLOY.md`: dokumentasi dan uji proyek.

> Perhatian: deploy GitHub Pages memperbarui frontend saja; konfigurasi storage cloud dan sinkronisasi data harus sesuai project Supabase yang Anda pakai.
