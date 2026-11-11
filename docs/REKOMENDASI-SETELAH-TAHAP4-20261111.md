# SATRIA NEXT — rekomendasi setelah Tahap 4

Rekomendasi ini adalah **rencana pengembangan**, belum merupakan fitur yang terpasang. Prinsipnya: manusia dapat bekerja cepat; data aman; modul mudah dirawat, diuji dan diganti; tanpa verifikasi atau persetujuan berjenjang.

## P0 — Tahap 5A: Uji kelayakan staging Supabase (wajib sebelum produksi)

- Jalankan SQL migrasi dan assertion Tahap 2 pada **staging yang terpisah**, bukan produksi; tinjau privilege migrasi dan fungsi RPC oleh administrator database.
- Uji otorisasi *langsung melalui API* untuk Admin, Operator (cakupan OPD/tahun), Viewer, termasuk akun dari organisasi berbeda. Jangan hanya mengandalkan tombol yang tersembunyi.
- Uji arsip → hilang dari data aktif → tampil di Sampah → pulih pada dua browser/perangkat; ulangi dengan tab lain yang memodifikasi record bersamaan. Konfirmasi penolakan hak akses, konflik versi, transaksi gagal, dan pemulihan backup.
- Dokumen dan layar data yang sudah terhapus harus tidak muncul dari stale IndexedDB/cache; masuk/keluar akun tidak boleh membocorkan snapshot organisasi sebelumnya.
- **Kriteria selesai:** semua tes RLS/RPC dan uji restore lulus di staging; tersedia backup sebelum perubahan, pencatatan error yang tidak membocorkan token, dan prosedur rollback yang telah dicoba.

## P1 — Tahap 5B: Memecah layanan cloud & mengunci kontrak data

- Pindahkan *delta engine* murni dan logika versi/konflik ke modul yang bisa diuji tanpa browser; pisahkan auth/session, akses/membership, daftar pengguna, penugasan OPD/tahun, transaksi Sampah, dan koneksi realtime dari `05-cloud-sync.js`.
- Tetapkan antarmuka yang eksplisit dan terbatas antar modul; jangan mengekspos key/token atau menaruh state Supabase sensitif pada global yang tidak perlu.
- Pastikan satu penulis data aktif dan satu tempat koordinasi perubahan sehingga listener dan timer sinkronisasi tidak berlipat.
- **Kriteria selesai:** pengujian kontrak cloud tetap lulus, tidak ada `delete` langsung, logging aman, dan perilaku logout/konflik tidak berubah.

## P1 — Tahap 5C: Perluas Sampah cloud untuk data bersarang

- Buat kontrak atomik untuk penawaran di dalam paket, lampiran/media, dan penghapusan pada ekstensi yang masih diblokir.
- Tambahkan validasi dependensi (induk, relasi, scope dan versi) saat pemulihan dan pelaporan kesalahan yang dapat ditindaklanjuti; jangan melakukan pemulihan parsial diam-diam.
- Terapkan retensi sesuai kebijakan instansi; hindari hapus permanen otomatis sampai backup/retensi disepakati. Jangan membuat approval berjenjang.
- **Kriteria selesai:** semua menu hapus yang aktif mengarah ke Sampah server dan pulih tanpa merusak keterkaitan paket.

## P2 — Tahap 6: Pecah modul inti berbasis domain dan perkuat pengujian emas

- Memisahkan controller UI dari data Bank RUP, Paket, HPS, Negosiasi, Dokumen, Laporan, Data Master. `satria-procurement-core.js` tetap sumber rumus bersama; referensi data tetap dari satu *source of truth*.
- Tambahkan tes regresi *golden* lintas versi untuk PPN/bruto, angka HPS, daftar penawaran, 15 template dokumen, PDF/XLSX, konsolidasi multi-RUP, dan pencetakan tabel panjang.
- Lakukan pembersihan fungsi/utilitas tak terpakai **sesudah** coverage membuktikan aman; jangan hapus kode karena terlihat mirip namun memiliki aturan berbeda.
- **Kriteria selesai:** fitur lama setara, fungsi tanpa efek samping dapat diuji mandiri, dan kegagalan regresi dapat ditelusuri sampai modul.

## P2 — Tahap 7: Performa dan UX Gen Z berbasis metrik

- Audit perangkat Android kelas menengah, layar 360–430px dan desktop; ukur *cold-start*, ukuran unduhan, interaksi daftar 500/5.000 paket, input pencarian, memori, Core Web Vitals.
- Rancang desain token tunggal (warna, tipografi, jarak, komponen, kontras dan state) sehingga tema Gen Z konsisten; sediakan pencarian cepat yang nyata, status sinkronisasi yang mudah dibaca, dan tampilan kosong yang informatif.
- Audit fokus keyboard, pembaca layar, ukuran target sentuh, *reduced motion*, zoom 200%, dan hasil cetak. Simpan dependency penting Dexie/Supabase untuk strategi offline bila persyaratan distribusi dan lisensinya memungkinkan.
- **Kriteria selesai:** baseline dan hasil perbaikan kinerja terukur, tidak sekadar klaim optimasi; audit aksesibilitas lulus.

## P3 — Tahap 8: Integrasi operasional, bantuan dan perawatan

- Lanjutkan pemeriksaan konsistensi RUP/Paket dan pemanfaatan data SPSE/SIRUP **hanya** melalui mekanisme integrasi resmi yang didukung; jangan mengasumsikan API atau hak akses tersedia.
- Kembangkan pusat perawatan: indikator kesehatan IndexedDB, cloud sync, backup, konflik dan self-diagnostic, dengan petunjuk tindakan satu klik bila aman.
- Perkuat panduan kontekstual per menu; hindari langkah admin tambahan yang memperlambat petugas. Semua perubahan penting dapat diurungkan atau dipulihkan, bukan dikunci oleh approval berjenjang.

## Urutan paling aman

**Tahap 5A staging/RLS** → **5B modularisasi cloud** → **5C Sampah bersarang** → **6 pemisahan domain & golden tests** → **7 pengukuran kinerja + UX** → **8 integrasi & perawatan**.

Keamanan akses server, backup, dan keberhasilan rollback adalah **prasyarat**, bukan fitur tambahan yang boleh dilewati. Tahap 4 tetap dapat dipakai sebagai basis kode untuk pengujian, tetapi belum membuktikan kesiapan produksi.
