# SATRIA NEXT — Patch Sampah Cloud: Akses Arsip Lama

Tanggal: 12 November 2026  
Basis: commit **Patch Keamanan Scope Cloud**, setelah rilis Stabilitas Sesi.

## Tujuan dan perubahan nyata

Menu Sampah Cloud sebelumnya hanya menampilkan maksimum 250 arsip terbaru (gabungan tabel arsip utama dan arsip bersarang). Arsip lebih lama masih ada di server, tetapi tidak dapat dipilih dari antarmuka.

Patch ini memperbaiki masalah tersebut:

1. **Muat arsip lebih lama** tersedia di bagian atas dan bawah daftar saat server masih memiliki halaman yang belum dibaca.
2. Tabel `satria_trash_entries` dan `satria_nested_trash_entries` memiliki posisi halaman terpisah. Setiap permintaan mengambil paling banyak **50 arsip per tabel**. Hasil keduanya digabungkan dalam urutan waktu pengarsipan dan ID.
3. Tidak ada batas total 250 arsip di antarmuka. Arsip lama baru dimuat saat diperlukan, bukan semuanya sekaligus.
4. Jika pembacaan arsip bersarang gagal atau migrasinya belum tersedia, **arsip utama tetap bisa dibaca** dan pengguna mendapat peringatan. Jika halaman berikutnya gagal, halaman yang sudah berhasil dimuat tidak hilang; pengguna dapat mencoba lagi.
5. Data yang datang dari sesi lama setelah logout/pergantian akun **tidak diterapkan**. Urutan dan ID ganda ditangani di daftar pengguna agar hasil halaman tidak ditampilkan dua kali.
6. Tidak ada penghapusan permanen, perubahan migrasi SQL, akses file Supabase Storage, ataupun workflow persetujuan berjenjang.

## Pengujian

- Pemeriksaan otomatis Node, keamanan statis, loader dan hash frontend: **49/49 lulus**.
- Skenario Node khusus: **600 arsip sintetis** dari dua tabel, percobaan ulang setelah gagal membaca, fallback tabel bersarang, pemuatan bersamaan, dan respons yang datang setelah logout.
- Enam skenario browser lokal lulus: arsip/pulih cloud tiruan, arsip bersarang dan status pemenang, pemuatan arsip lama pada mobile (klik awal + pemanggilan API halaman berikutnya), loader modul, isolasi Admin/Viewer, serta kalkulasi/dokumen HPS.
- Ini adalah **pengujian lokal dan server tiruan**. RLS PostgreSQL nyata, transaksi database dan pemulihan backup pada Supabase staging **belum diuji**.

## Batasan dan keamanan

- Paginasi memakai offset dengan pengurutan `deleted_at` dan `id`. Bila akun lain mengarsipkan data saat halaman selanjutnya dimuat, batas antarhalaman dapat bergeser. Gunakan **Segarkan Sampah cloud** untuk memulai ulang dari daftar terbaru. Tidak ada pemulihan atau perubahan data otomatis.
- Pemuatan arsip mengikuti kebijakan **RLS server yang ada**; filter klien bukan pengganti RLS.
- Jika daftar bersarang gagal dimuat, pesan peringatan ditampilkan. Operator tetap dibatasi kewenangannya, Viewer tidak boleh menghapus/memulihkan.
- Semakin banyak arsip yang dimuat, semakin panjang daftar yang dirender pada perangkat. Gunakan pemuatan bertahap sesuai kebutuhan.

## Panduan satu commit GitHub

1. Pastikan branch mengandung **Patch Keamanan Scope Cloud** sebelumnya.
2. Ekstrak ZIP patch ini ke **root repositori**. Timpa hanya file yang ada dalam patch.
3. Jalankan `python tools/run_quality_gate.py` (Node.js dan Python diperlukan).
4. Untuk uji UI sintetis (Playwright/Chromium tersedia): `python tools/test_cloud_trash_pagination_browser.py`.
5. Untuk validasi sebelum produksi, uji pada Supabase **staging nyata** dengan akun Admin, Operator, Viewer, arsip lebih dari 250 per tabel, serta pemulihan arsip lama dan hak akses lintas OPD/tahun.
6. Commit patch ini sekali setelah hasil sesuai.

**Rollback:** revert satu commit patch. Tidak ada migrasi atau perubahan skema database pada patch ini. Daftar lama kembali memakai batas tampil sebelumnya, namun arsip di database tidak dihapus.
