# SATRIA NEXT — Patch pemulihan relasi dan urutan (Stage 9)

**Basis:** rilis stabilitas → Patch Scope Cloud → Patch Sampah Cloud Paginasi (sudah di-commit). **Rilis:** patch file berubah/baru saja.

## Temuan sebelum perbaikan

1. Pemulihan Paket/Bank RUP pada mode lokal dan cloud memakai `push`/`upsert` yang menambahkan data ke ujung daftar. Pemulihan rincian `items` dan `penawaran` juga append, sehingga urutan HPS/dokumen dapat berubah.
2. Pemulihan lokal tidak menyimpan status penawaran pemenang sebelumnya. Setelah dihapus, pemulihan tidak menegakkan benturan dengan pemenang baru secara konsisten.
3. Arsip penawaran cloud sebelumnya menyimpan objek lengkap, tetapi tidak memiliki pemeriksaan apakah rincian/HPS paket berubah saat penawaran berada di Sampah.
4. Pemulihan Paket lokal belum memvalidasi seluruh relasi Bank RUP, penyedia, pejabat, OPD/tahun dari core secara mandiri.

## Implementasi

- **Lokal:** catat posisi awal serta ID tetangga, pulihkan di posisi yang paling sesuai; cek OPD/tahun, master, penyedia dan Bank RUP sebelum memodifikasi data; untuk penawaran pemenang catat status, snapshot item/HPS, dan tolak pemulihan bila snapshot berbeda atau sudah ada pemenang baru. Harga penawaran dan semua bidang dokumen tetap dari snapshot asli.
- **Supabase:** migrasi tambahan `20261112030000_satria_recovery_order_integrity.sql` menambah metadata posisi, tetangga, dan menyimpan digest item untuk *arsip penawaran baru*. RPC lama dipertahankan sebagai fungsi internal yang tidak dapat dipanggil langsung oleh browser; wrapper melanjutkan validasi role, RLS, versi, referensi, dan transaksi atomik yang sudah ada.
- **Dokumen:** tidak dibuat ulang atau diedit sebagai efek otomatis pemulihan. Tanggal, identitas, dan bukti yang tersimpan di record tetap asli. Dokumen terbit dari luar aplikasi bukan objek yang dipulihkan otomatis.
- **PWA:** identitas cache berubah agar kode frontend baru tidak tertinggal pada perangkat lama.

## Keterbatasan yang harus diketahui

- Arsip lama yang dibuat **sebelum migrasi** tidak mempunyai metadata posisi/digest HPS. Arsip lama tetap dapat dipulihkan dengan perilaku kompatibel (biasanya ditambahkan ke akhir). Tidak ada metadata historis buatan.
- Perubahan daftar setelah pengarsipan dapat membuat pemulihan hanya *best-effort* memakai tetangga dan indeks; jika item lama dihapus/diurut ulang berkali-kali, urutan total tidak selalu dapat dibuktikan tanpa catatan sejarah yang lengkap. Tidak ada data sumber yang ditimpa untuk memaksakan urutan.
- Perubahan yang hanya menggeser urutan ditulis pada payload di transaksi yang sama, **tanpa perubahan tambahan angka versi** setelah RPC internal. Uji Realtime lintas perangkat harus memeriksa perilaku pembaruan daftar; RPC klien selalu menarik ulang data setelah sukses.
- Snapshot HPS yang digunakan untuk cek cloud disimpan sebagai digest MD5 atas JSONB kanonik, **bukan alat keamanan kriptografis**; pengguna tidak mengendalikan isi hash dan server juga masih menegakkan hak akses/version lock. Ini pembanding konsistensi isi, bukan autentikasi.
- SQL belum dieksekusi pada Supabase staging nyata; pengujian aplikasi saat ini lokal/simulasi dan pemeriksaan kontrak SQL statis. Migrasi **harus diaplikasikan dan diuji pada staging** sebelum produksi.
- File Supabase Storage dan dokumen resmi yang sudah diunduh/ditandatangani tidak tersentuh.

## Urutan pemasangan yang aman

1. Backup database Supabase **staging**, periksa bahwa migrasi Stage 2 + nested trash sudah ada, dan pastikan tidak ada pending delta dari perangkat aktif.
2. Terapkan SQL migrasi Stage 9 melalui mekanisme migrasi yang biasa digunakan proyek; jangan dijalankan pada produksi tanpa uji.
3. Jalankan `supabase/tests/recovery_order_stage9_readonly.sql`. Semua kolom `lulus` harus `true`.
4. Di staging, buat dataset sintetis: Bank RUP A, Paket A/B/C, tiga item HPS, dua penawaran, satu pemenang, serta tanggal/doc settings. Arsip dan pulihkan Paket, Bank RUP, Penawaran, item secara bergantian. Cocokkan urutan, hash record, status pemenang, dan dokumen sebelum/sesudah. Pastikan pemenang baru dan HPS berubah menghasilkan penolakan tanpa perubahan versi/data parsial.
5. Uji akun **Admin/Operator/Viewer** dan cakupan OPD/tahun; tes retry, conflict 409, logout tengah transaksi, cache mobile, dan Realtime dua perangkat.
6. Jika staging lulus, aplikasikan perubahan frontend bersama migrasi ke rilis terjadwal. Untuk rollback, hentikan operasi arsip/pulih cloud, pulihkan migrasi/functions dari backup staging terverifikasi; **jangan** menghapus tabel sampah atau arsip.

## Pengujian otomatis

`python tools/run_quality_gate.py --report /tmp/satria-stage9-qa.json`

`node tools/test_recovery_integrity_stage9.cjs`

Paket patch tidak melakukan commit atau push GitHub, dan tidak menambahkan workflow persetujuan berjenjang.
