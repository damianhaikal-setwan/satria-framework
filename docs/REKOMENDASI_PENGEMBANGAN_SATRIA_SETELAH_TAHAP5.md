# Rekomendasi SATRIA setelah Tahap 5

Status basis: Tahap 5B (modularisasi cloud) lulus pengujian lokal; Tahap 5A (validasi Supabase asli) **belum selesai** karena staging tidak diakses.

## P0 — Selesaikan Tahap 5A di Supabase staging nyata

1. Cadangkan dan pisahkan lingkungan staging dari produksi. Terapkan migrasi Tahap 2 jika belum ada, **setelah** tinjauan DBA.
2. Jalankan `supabase/validation/STAGE5_READONLY_SECURITY_GATE.sql` dan `tools/stage5_staging_http_audit.mjs` menggunakan akun Admin/Operator/Viewer staging.
3. Tambahkan fixture lintas OPD/tahun/organisasi; lakukan uji RPC arsip/pulih atomik, tab bersamaan, versi usang, data bentrok, dan logout lintas akun.
4. Uji restore backup database/media dan rollback frontend. Dokumentasikan bukti PASS/FAIL per skenario, tidak cukup mengandalkan tombol yang tersembunyi di UI.

**Kriteria selesai:** semua pengujian server dengan JWT nyata lulus dan recovery terbukti, tanpa celah hak akses atau kehilangan data.

## P1 — Tahap 5C: Sampah cloud yang lengkap

- Tambah kontrak arsip/pulih atomik untuk penawaran bersarang, lampiran dan media, serta modul lain yang memiliki tombol Hapus.
- Buat pemeriksaan dependensi dan lokasi file storage yang benar; tandai alasan item tidak bisa dipulihkan tanpa memulihkan sebagian secara diam-diam.
- Lakukan retensi sesuai kebijakan instansi; jangan otomatis hapus permanen sebelum strategi backup disahkan.
- Tidak ada persetujuan berjenjang. Pemulihan langsung oleh akun yang berwenang.

## P1/P2 — Tahap 6: Domain aplikasi dan transaksi terkendali

- Pisahkan `01-app-core.js` menjadi controller Bank RUP, Paket, HPS/Negosiasi, Dokumen, Master, Laporan dan Pengaturan.
- Pisahkan sisa `05-cloud-sync.js` (auth/session, data fetch, delta/realtime, recycle) dengan antarmuka yang eksplisit dan tes kontrak.
- Pertahankan satu sumber rumus `satria-procurement-core.js` dan transaksi optimistic version agar pekerjaan lama tidak berubah tanpa disadari.
- Tambahkan golden tests atas keluaran seluruh template dokumen, PDF/XLSX, nilai PPN bruto, dan paket multi-RUP.

## P2 — Tahap 7: UX Gen Z berdasarkan pengukuran

- Uji perangkat 360–430px, Android kelas menengah, keyboard/screen reader dan cetak dokumen panjang.
- Ukur cold-load, input latency, daftar 500/5.000 paket, memori, offline dan sinkronisasi; tetapkan angka baseline sebelum optimasi.
- Tambahkan indikator konflik yang dapat ditindaklanjuti, pencarian terpadu dan komponen visual konsisten.

## P3 — Tahap 8: Perawatan dan integrasi resmi

- Pusat perawatan untuk pemeriksaan database lokal, status cloud, backup/restore, dan laporan kesalahan tanpa informasi rahasia.
- Integrasi SIRUP/SPSE hanya melalui antarmuka resmi yang tersedia dan sesuai izin, tanpa mengasumsikan API tersedia.

**Aturan tetap:** fitur lama tidak dibuang sebelum lulus regresi; data dapat dipulihkan; kode bersih, mudah dirawat; tidak ada verifikasi atau persetujuan berjenjang.
