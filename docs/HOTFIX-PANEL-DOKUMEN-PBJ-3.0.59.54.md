# SATRIA NEXT 3.0.59.54 — Perbaikan Panel Dokumen Pengadaan PBJ 2026

**Tanggal:** 11 November 2026  
**Basis:** SATRIA NEXT 3.0.59.53  
**Tipe:** Hotfix frontend/UI, bukan perubahan database atau aturan bisnis.

## Masalah yang terbukti

Panel "Paket Dokumen Pendukung Sistem Resmi" sudah ditambahkan pada renderer lawas `frontend/refactor/js/01-app-core.js` (`vDok()`), namun halaman Dokumen Pengadaan sebenarnya memakai `vDokOptimized()` dari `frontend/refactor/js/05-cloud-sync.js`, yang menimpa `window.vDok`. Renderer aktif tersebut tidak memanggil panel. Tes 3.0.59.53 hanya menguji modul panel terisolasi, sehingga integrasi nyata tidak diuji.

## Perbaikan terarah

1. `frontend/refactor/js/05-cloud-sync.js`: memanggil `SATRIA_PBJ_WORKSPACE.panel(p)` dari **paket yang benar-benar dipilih** di renderer aktif; posisinya tepat setelah "Pilih paket kerja" sebelum Analisis Kewajaran Harga. Tidak mengganti template cetak, alur dokumen, ataupun render lainnya.
2. `index.html`: memuat `pbj2026-workspace.js` setelah `pbj2026-policy.js` di awal, sebelum renderer utama, supaya panel tersedia bahkan pada muat ulang `#dok`. Identitas rilis menjadi 3.0.59.54.
3. `frontend/satria-operator-studio.js`: ringkasan "Jenis dokumen" menjadi **15** sesuai daftar template, bukan 14.
4. `sw.js` dan `manifest.json`: kenaikan cache/identitas 3.0.59.54 agar pembaruan aset disegarkan pada deployment.
5. `tools/test_pbj2026_document_integration_305954.py`: **tes integrasi baru** yang menjalankan halaman Dokumen Pengadaan sesungguhnya di Chromium offline, memastikan panel muncul hanya satu kali, mengikuti pemilihan RUP, DPP/HRS sesuai konteks, tidak menawarkan draf SPSE pada E-Purchasing, tetap ada pratinjau, dan tidak ada kesalahan JavaScript.
6. Empat tes versi yang telah ada diperbarui hanya untuk label versi baru; persyaratan fungsionalnya tidak dilonggarkan.

## Status pengujian

**46/46 PASS** di salinan ZIP, terdiri dari 45 pengujian regresi yang telah ada dan 1 tes integrasi baru. Mencakup sintaks/aset, PWA, transaksi & hitung HPS/pagu, dokumen DPP/analisa dan cetak, akses baca-saja, Bank RUP, serta navigasi paket. Lihat laporan `SATRIA_NEXT_3.0.59.54_TEST_RESULTS.json` yang disertakan terpisah.

## Pemasangan ke GitHub

Jika `main` saat ini identik dengan SATRIA 3.0.59.53, gunakan **ZIP PATCH** dan unggah **isi ZIP** ke root repository (bukan ZIP-nya, bukan subfolder pembungkus). Biarkan path `index.html`, `sw.js`, `frontend/...`, `tools/...`, `docs/...` sesuai aslinya. Jika ragu terhadap perbedaan repo, gunakan ZIP **lengkap** hanya setelah membandingkan `main` dan membuat backup commit.

**Commit disarankan:** `fix: tampilkan panel dokumen PBJ 2026 di studio aktif (3.0.59.54)`.

Setelah deployment: buka secara incognito, pastikan label `3.0.59.54`, kunjungi Dokumen Pengadaan, gulir setelah "Pilih paket kerja", lihat panel "Paket Dokumen Pendukung Sistem Resmi", lalu ganti RUP dan pastikan panel mengikuti pilihan. Buka pratinjau dan cetak dokumen simulasi. Jangan menghapus IndexedDB/cookies atau mengimpor ulang backup sebagai cara memaksa refresh.

**SQL baru: tidak ada.** Database Supabase, RLS, Edge Function, dan konten paket tidak diubah. Tidak ada deployment atau database produksi yang disentuh oleh paket ini.

## Batasan yang tetap berlaku

- HRS belum dibuat sebagai generator dokumen final karena identitas/formatnya belum dikonfirmasi.
- Dokumen pilihan SPSE masih **draf**; SATRIA bukan pengganti sistem resmi pemerintah.
- Hasil pengujian lokal bukan bukti bahwa cloud produksi dan sesi tiap akun sudah lolos uji; cek login, scope OPD/tahun, sinkronisasi dan cetak pada situs aktif sesudah deploy.
- Perbaikan ini **tidak** menambah persetujuan berjenjang.
