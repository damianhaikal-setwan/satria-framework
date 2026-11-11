# SATRIA NEXT 3.0.59.56 — Ruang Kerja Pejabat Pengadaan Terpadu

## Tujuan dan batas

Modul **Ruang Kerja PP** menyatukan administrasi paket yang **memang dikerjakan Pejabat Pengadaan sesuai kewenangannya**, dengan rute utama **E-Purchasing** dan **Pengadaan Langsung**. Tidak membuat sistem resmi baru: proses pemilihan, penetapan, kontrak dan pengunggahan yang diwajibkan tetap dilakukan pada sistem pemerintah sesuai ketentuan. Tidak ada *reviewer*, approval berjenjang, MySQL, Express, login kedua atau API otomatis menuju SPSE/INAPROC.

Sumber aturan:
- Katalog elektronik/E-Purchasing: [Peraturan LKPP 2/2026](https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026).
- Pengadaan melalui penyedia dan Pengadaan Langsung: [Peraturan LKPP 3/2026](https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026).
- Kondisi transisi: [SE Kepala LKPP 3/2026](https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026).

Modul memberikan **petunjuk administratif**, bukan keputusan legal otomatis. Pengadaan Langsung dibedakan dari metode Tender/Seleksi; apabila metode tidak dikenali, generator dokumen PP untuk SPSE tidak ditawarkan. Ketentuan batas, kewenangan, dan dokumen final tetap disesuaikan dengan paket dan sumber resmi.

## Apa yang baru

1. **Menu navigasi baru: Ruang Kerja PP.** Menampilkan paket e-Purchasing dan monitoring SPSE dalam filter tahun/OPD serta *assignment* Supabase yang sama, tanpa menduplikasi Bank RUP.
2. **Lima kelompok alur yang dibaca otomatis dari paket:** identitas & RUP; rincian kebutuhan/HPS; proses sesuai metode; dokumen; serta catatan & referensi bukti. Label `data tercatat` **bukan** pengesahan, persetujuan atau indikator kepatuhan penuh.
3. **Kartu dokumen sesuai metode:** E-Purchasing menuju 15 template dan generator HPS yang sudah ada; Pengadaan Langsung SPSE menawarkan draf Dokumen Pemilihan, BA Reviu DPP, dan Analisa Pasar. Tender/Seleksi/jenis lain tidak mendapat draf PP secara otomatis.
4. **Catatan kerja dan referensi bukti per paket:** menambahkan judul, uraian, nomor/lokasi berkas, URL HTTPS opsional, dan tanggal. Referensi disimpan pada properti opsional `paket.ppEkosistem`, menggunakan mekanisme transaksi, backup, serta sinkronisasi SATRIA yang sudah tersedia. Bukan penyimpanan fisik lampiran.
5. **Unduh JSON kertas kerja dan cetak draf PDF melalui browser** untuk arsip internal, tanpa mengubah harga maupun pagu paket.
6. **Tautan langsung** dari panel `Paket Dokumen Pendukung Sistem Resmi` menuju Ruang Kerja PP paket yang sama; tampilannya juga dapat dibuka lewat menu utama.

## Penggunaan

1. Masuk ke **Ruang Kerja PP**, pilih tahun dan OPD sesuai penugasan.
2. Pilih paket. Sistem membaca `metodePemilihan`/`spseMonitoring.method`, bukan mengganti metode RUP diam-diam.
3. Baca kelima langkah. Indikator hijau hanya menunjukkan ada data yang dapat diperiksa, **tidak** berarti dokumen sah atau proses sudah dilakukan pada sistem resmi.
4. Untuk e-Purchasing gunakan tautan `Buka 15 template & generator HPS`; untuk Pengadaan Langsung SPSE buka monitoring dan tiga draf bahan kerja.
5. Catat tindak lanjut dan bukti dengan referensi yang dapat dilacak. Jangan memasukkan kata sandi, token, atau data rahasia dalam catatan/URL.
6. Unduh JSON untuk arsip atau cetak ringkasan draf untuk pemeriksaan pejabat sebelum dipakai pada proses resmi.

## Hak akses, persistensi dan keamanan

- Viewer hanya dapat membaca dan mengekspor berkas yang ada dalam lingkup aksesnya; tidak mempunyai tombol tambah catatan/bukti.
- Operator/Admin dapat menulis jika paket berada pada OPD/tahun yang diizinkan. Pemilihan ID paket dari luar scope tidak memperbolehkan perubahan.
- Data baru berada di **objek paket yang sama**, tidak membuat tabel SQL, RLS atau Edge Function baru. `SATRIA.tx` digunakan untuk validasi/rollback dan sinkronisasi yang sudah berjalan.
- Hanya metadata/tautan yang ditambahkan. Tidak ada upload otomatis, tidak ada sumber harga yang dibuat-buat, dan tidak ada akses langsung ke akun pemerintah.
- Metadata catatan berisi waktu dan identitas akun yang sedang digunakan. Ini **bukan** catatan audit yang tidak dapat diubah (immutable ledger). Bila dibutuhkan audit hukum yang formal, diperlukan rancangan server dan pembatasan tambahan.
- Keluaran cetak bertanda **DRAF**, bukan dokumen resmi atau pengesahan. Nilai HPS/pagu dan pemenang tidak dimodifikasi oleh modul ini.

## Hal yang belum dicakup

- HRS belum digenerasikan karena jenis dan format resmi yang dimaksud pengguna belum dikonfirmasi.
- Template SPSE dari rilis 3.0.59.55 adalah draf yang masih memerlukan isian substantif dan pemeriksaan manual.
- Tidak ada upload berkas fisik ke storage, sinkronisasi dua arah dengan SPSE/Katalog, tanda tangan digital atau approval workflow.
- Tidak ada validasi langsung terhadap data akun/data produksi. Periksa paket contoh dengan akun Supabase staging dan perhatikan status sinkronisasi sebelum deploy `main`.

## Smoke test deployment

1. Backup source `main` dan snapshot database sebelum deploy.
2. Pastikan versi `3.0.59.56` di header dan menu **Ruang Kerja PP** terlihat; muat ulang cache PWA secara aman bila perlu (**jangan hapus IndexedDB**).
3. Buka satu E-Purchasing, periksa pagu/HPS, buka Dokumen Pengadaan, ekspor HPS Excel/PDF.
4. Buka satu Pengadaan Langsung SPSE, pastikan tiga draf muncul; buka Tender untuk memastikan draf PP tidak ditawarkan.
5. Dengan akun Operator dalam scope, tambah satu catatan dan referensi bukti *dummy*; muat ulang/pull cloud dan pastikan tersimpan. Dengan Viewer pastikan tidak dapat mengubah. Cek satu akun lintas OPD/tahun.
6. Periksa dokumen, Bank RUP, penetapan, backup/restore, dan sinkronisasi. Bila ada masalah, rollback commit lewat Git; jangan reset database atau IndexedDB.

Tidak ada SQL baru untuk rilis ini. Ini **kandidat rilis yang lulus pengujian lokal**, bukan sertifikasi kepatuhan hukum atau uji produksi Supabase.
