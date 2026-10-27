# Audit kompatibilitas SATRIA 3.0.41 — Bank RUP dan database Supabase

## Temuan

`index.html` di arsip awal sudah identik dengan HTML SATRIA 3.0.41. Namun daftar delta klien **tidak** memuat `rupBank`; RPC `satria_apply_state_delta` menolak collection itu; RPC scoped read tidak mengembalikan `rupBank`. Akibatnya Bank RUP dapat tampak berhasil tersimpan lokal tetapi tidak masuk cloud, dan Operator/Viewer tidak mendapatkan daftar RUP setelah menarik data.

## Yang diperbaiki

- `rupBank` kini masuk `ARRAY_DELTAS` bersama `paket` dan master lainnya.
- Delta disusun berdasar ketergantungan OPD, tahun, Bank RUP, dan paket untuk mengurangi kegagalan pada batch besar.
- RPC `satria_apply_state_delta`: mendukung upsert/delete Bank RUP, memvalidasi kode/nama/OPD/tahun/pagu, duplikasi kode per OPD/tahun, perubahan ID/referensi, larangan penghapusan RUP yang dipakai paket, dan assignment Operator.
- RPC `satria_get_scoped_state`: mengembalikan `rupBank` hanya untuk OPD/tahun yang diizinkan akun Operator/Viewer. Admin tetap memakai `satria_state` penuh dengan RLS admin.
- Penghapusan OPD atau tahun yang masih digunakan Bank RUP ditolak server.
- Paket yang diperbarui dengan `rupBankId` wajib menunjuk RUP yang cocok berdasarkan kode, OPD, tahun.
- Logout dan pergantian akun membersihkan Bank RUP dari tampilan lokal sebelum data sesuai hak akses ditarik ulang.

## Cakupan dan batasan

- Migrasi **tidak** dijalankan pada proyek Supabase secara langsung karena tidak ada koneksi/otorisasi dan tidak tersedia lingkungan PostgreSQL terkonfigurasi pada sesi audit ini.
- Snapshot JSON merupakan model transisional; untuk volume sangat besar direkomendasikan migrasi bertahap ke tabel bisnis relasional dengan RLS per record, tanpa mengganti semua API pada rilis ini.
- Validasi angka pajak/negosiasi tetap menggunakan logika aplikasi, bukan database. Foto produk dapat meningkatkan ukuran JSON; pertimbangkan object storage untuk kebutuhan besar.
- Jika telah ada snapshot lama dengan paket `rupBankId` yang tidak ditemukan karena RUP dihapus sebelumnya, perbaiki relasinya dari backup sebelum memperbarui paket tersebut. Migrasi tidak menghapus atau mengubah data lama secara otomatis.

## Matriks staging sebelum produksi

| Skenario | Hasil yang diharapkan |
| --- | --- |
| Admin impor 2 RUP pada OPD A, TA 2026 | Keduanya muncul setelah refresh/login ulang |
| Operator OPD A + TA 2026 mengimpor RUP | Berhasil; `rupBank` tersimpan melalui delta RPC |
| Operator OPD A + TA 2026 menulis RUP OPD B | Ditolak `42501` |
| Viewer mencoba mengubah RUP | Ditolak `42501` |
| Operator melihat Bank RUP | Hanya RUP OPD/tahun yang di-assign |
| RUP dengan kode sama pada OPD & tahun sama | Ditolak `23505` |
| Hapus tahun/OPD yang dirujuk RUP | Ditolak `23503` |
| Hapus Bank RUP yang dirujuk paket | Ditolak `23503` |
| Paket dari Bank RUP diproses sampai cetak | Nama, kode, OPD, tahun, HPS, dan 14 template tetap konsisten |
| 120 RUP diimpor (lebih dari 50 per batch) | Tersimpan seluruhnya; versi bertambah untuk setiap batch |
| Dua Operator mengubah versi yang sama | Salah satu ditolak konflik versi, bukan overwrite diam-diam |
| Admin melakukan backup/restore database | State dan link Bank RUP–paket pulih |

## Setelah migrasi

1. Upload aplikasi GitHub `index.html` dari paket ini.
2. Tidak perlu melakukan deploy ulang Edge Function hanya untuk Bank RUP, kecuali fungsi yang aktif masih lebih lama dari repo; versi fungsi dalam `supabase/functions` merupakan sumber yang benar.
3. Jalankan `supabase/tests/rup_bank_cloud_assertions.sql` dari SQL Editor untuk pemeriksaan struktur dan temuan data historis.
4. Gunakan akun staging berbeda untuk menguji RLS dan RPC secara nyata.
5. Jangan menganggap file ZIP ini sudah mengubah repository GitHub remote atau Supabase aktif: keduanya perlu dipublikasikan/dimigrasikan secara eksplisit.
