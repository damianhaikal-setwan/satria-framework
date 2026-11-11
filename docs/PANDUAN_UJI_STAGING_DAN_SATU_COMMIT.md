# SATRIA P0–P3 — PANDUAN SATU COMMIT & PENGUJIAN STAGING

> Paket ini adalah **kandidat staging** dari source code Tahap 5. Jangan jalankan SQL langsung di produksi. Jangan simpan API key/JWT dalam commit.

## Penerapan sebagai satu commit GitHub (secara manual)

1. Buat branch baru pada clone GitHub SATRIA yang sudah ada. **Jangan membuat repo baru** dan jangan mengganti file `.env`/konfigurasi rahasia.
2. Salin **isi** direktori `satria-framework-main/` dalam ZIP ke root clone. Sebaiknya gunakan `rsync -av` **tanpa** `--delete` untuk menjaga berkas yang tidak ada dalam ZIP. Tinjau semua perubahannya dengan `git diff --check`, `git status --short`, dan `git diff --stat`.
3. Jalankan `node tools/test_stage6_combined_contract.cjs`, `node tools/test_stage6_local_item_recovery.cjs`, `python tools/test_refactor_integrity.py`, serta skrip regresi lain.
4. Setelah review, lakukan tepat **satu commit** untuk seluruh perubahan P0–P3:

```bash
git switch -c feature/satria-p0-p3-gabungan
# salin isi ZIP ke root clone SATRIA, lalu tinjau hasilnya
git diff --check
git status --short
git add -A
git commit -m "feat(satria): gabungkan keamanan cloud, Sampah, modularisasi dan perawatan P0-P3"
git push -u origin feature/satria-p0-p3-gabungan
```

Perintah di atas hanya **panduan**; pengunggahan/commit ke GitHub **belum dilakukan** dalam sesi ini. Pilih merge/penerapan produksi setelah staging memenuhi syarat.

## Urutan database staging

**Sebelum memulai:** siapkan backup database serta Storage terpisah dan lakukan restore uji pada staging. Jangan mengirim kredensial asli ke laporan.

- Jika Tahap 2 belum pernah diterapkan, tinjau lalu jalankan `supabase/migrations/20261111170000_satria_cloud_recycle_atomic.sql` **sesudah** migrasi dependensinya. Jangan jalankan migrasi Stage 2 dua kali secara sembarangan karena ada `ALTER FUNCTION ... RENAME` yang hanya valid pada jalur penerapan awal.
- Jalankan migrasi aditif `supabase/migrations/20261111190000_satria_nested_recycle.sql` pada staging **hanya setelah** memastikan Stage 2 aktif dan memeriksa ulang kompatibilitas struktur state, peran, scope, RPC internal.
- Jalankan gate baca-saja `supabase/validation/STAGE5_READONLY_SECURITY_GATE.sql` dan `supabase/validation/STAGE6_NESTED_READONLY_GATE.sql`.
- Untuk uji penolakan JWT, baca komentar `tools/stage6_staging_negative_probes.mjs`, atur environment **staging saja**, lalu jalankan `node tools/stage6_staging_negative_probes.mjs`. Semua request memakai expected_version `-1`, sehingga dirancang gagal dan tidak menulis data. Tidak cukup untuk membuktikan transaksi sukses.
- Untuk uji positif, siapkan fixture organisasi, OPD, tahun, paket, rincian dan penawaran **khusus staging**, lalu uji RPC arsip/pulih menggunakan JWT nyata; verifikasi langsung state aktif & tabel Sampah, konflik bersamaan dan pembatasan RLS.

## Kriteria gate sebelum produksi

| Gate | Lulus jika | Saat ZIP dibuat |
|---|---|---|
| Migrasi | DDL berhasil tanpa error pada PostgreSQL staging | **Belum diperiksa** |
| RLS | Admin/Operator/Viewer berbeda organisasi/OPD/tahun memiliki akses tepat di server | **Belum diperiksa** |
| Arsip/pulih | Transaksi atomik + snapshot + data dependensi, winner ID, versi dan penolakan konflik terbukti | **Hanya simulasi**, belum staging |
| Backup | Restore database dan media berhasil pada lingkungan salinan | **Belum diperiksa** |
| Regresi kode | 36/36 Node + 4 uji browser terpilih + integritas aset | **Lulus lokal** |
| UX/Performa | Uji perangkat nyata dan ambang performa ditentukan | **Baseline sintetis saja** |

## Rollback tanpa kehilangan data

- Bila staging gagal setelah migrasi, **jangan** langsung menjatuhkan tabel Sampah. Pastikan ada arsip aktif yang belum dipulihkan dan simpan backup utuh sebelum perubahan database.
- Kembalikan frontend via commit lama jika diperlukan; data dalam `satria_nested_trash_entries` tetap disimpan. **Frontend lama tidak dapat memulihkan arsip baru**, sehingga pemulihan harus memakai versi Stage 6 atau prosedur DB terkontrol.
- Jika DDL gagal di tengah migrasi, transaksi SQL `begin`/`commit` mencegah penerapan parsial pada banyak operasi; verifikasi kondisi aktual database, karena dependensi produksi dapat berbeda.
- Catat setiap tindakan rollback dan hasil pemulihan. Jangan pernah meminta pengguna menyetujui langkah berjenjang untuk mengelola pekerjaannya; pembatasan peran tetap menjadi kontrol keamanan.
