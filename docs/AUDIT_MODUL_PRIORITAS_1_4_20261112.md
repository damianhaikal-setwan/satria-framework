# SATRIA NEXT — Audit 19 Menu + Sampah, Paket Prioritas 1–4

**Basis GitHub terkonfirmasi:** Patch Keamanan Scope Cloud + Patch Sampah Cloud Paginasi. SQL Stage 9 telah dieksekusi manual di Supabase dan 11/11 validasi struktur dilaporkan PASS, **tetapi source code Stage 9 belum di-commit**. Karena itu paket patch ini **sengaja memuat perubahan source Stage 9** juga.

## Prinsip dan batas pengujian

- Tidak menghapus modul aktif, tidak mengganti rumus HPS/PPN/negosiasi, tidak mengubah skema data, tidak menambahkan verifikasi atau persetujuan berjenjang.
- Pengujian browser menggunakan data sintetis, CDN/staging ditirukan, dan identitas Admin/Viewer QA lokal. Ini **bukan** bukti pelaksanaan RLS PostgreSQL atau transaksi Supabase nyata.
- Analisis integritas baru **baca-saja**, hanya menerima himpunan Paket dan RUP yang sebelumnya telah difilter menurut OPD/tahun/role. Tidak mengirim data ke server.
- Tabel ini menilai cakupan pembaruan dan smoke test, **bukan sertifikat seluruh tombol/form/print/pembayaran berfungsi sempurna**.

## Matriks 19 modul awal

| No. | Menu | Dasar yang telah ada | Tambahan paket ini | Masih belum terbukti / perlu QA mendalam |
|---|---|---|---|---|
| 1 | Ringkasan Utama | KPI RUP/HPS, penetapan, monitoring | Jumlah temuan kualitas tampil melalui widget Monitoring | KPI saat data cloud besar/konflik dan perangkat lemah |
| 2 | Paket Pengadaan | Data paket, HPS, penawaran, Sampah lokal/cloud | Deteksi ID paket/item duplikat dan referensi tidak konsisten; Stage 9 order recovery source ikut | Uji arsip/pulih transaksi cloud nyata dan dokumen pascapulih |
| 3 | Ruang Kerja PP | Workspace, ekosistem pengadaan | Manfaat tidak langsung dari temuan Paket/HPS bersama | Uji semua tahap, ekspor dan perpindahan metode end-to-end |
| 4 | Kalkulator Nego | Kalkulasi bersama, aturan rounding | Tidak mengganti rumus | Uji lebih banyak data nyata/edge cases pajak |
| 5 | Input RUP/Bank RUP | Impor, klasifikasi, pemeriksaan relasi | Audit beda OPD/tahun pada referensi RUP yang terlihat | Impor besar, konflik lintas-perangkat, data SiRUP nyata |
| 6 | Monitoring SPSE | Jadwal, kontrak, pembayaran, sumber | Temuan kualitas kontrak terhubung melalui pemeriksaan bersama | Validasi atas sumber SPSE resmi dan banyak tahapan |
| 7 | Pusat Monitoring | Peringatan tenggat | Peringatan integritas lintas Paket, RUP, HPS dan penawaran | Pengingat bukan background scheduler; tidak memvalidasi SPSE live |
| 8 | Keuangan & Kontrak | Pagu RUP, penetapan EP, kontrak & bayar SPSE dipisahkan | Panel ringkasan anomali data | Rekonsiliasi buku besar/pembayaran e-Purchasing belum tersedia |
| 9 | Kualitas Data | Temuan RUP, alokasi, kontrak, SPSE | 8 kelas anomali inti baru dari modul murni; ekspor CSV yang sudah ada mencakup temuan baru | Audit formal backend immutable dan validasi bukti |
| 10 | Executive Briefing 4.1 | Visual indikator & agenda | Menggunakan jumlah temuan Kualitas Data yang diperluas | Uji seluruh print/PDF dan dasar data lintas tahun |
| 11 | SATRIA 360° | View tiap Paket, timeline, tindakan | Peringatan integritas prioritas tinggi pada detail Paket | Validasi seluruh timeline/dokumen dari contoh nyata |
| 12 | Dokumen Pengadaan | Generator & 15 jenis dokumen terdaftar | Pelaporan temuan kualitas HPS sebelum proses cetak (melalui Kualitas Data/360) | Pengujian keluaran semua template, render cetak dan metadata |
| 13 | Laporan dan Analisis | Laporan data/rekening/visual & ekspor | Bisa dibandingkan dengan temuan dari Kualitas Data, tanpa mengubah rumus | Rekonsiliasi seluruh output CSV/PDF ke transaksi Supabase |
| 14 | Data Master | Data OPD, penyedia, pejabat | Deteksi referensi penyedia hilang dari penawaran | Validasi CRUD seluruh master dan perpindahan hak akses |
| 15 | Pengaturan Sistem | Konfigurasi, backup, media | Tautan navigasi aktif lebih jelas | Backup–restore produksi dan isolasi organisasi |
| 16 | Perawatan SATRIA | Diagnostik status sistem | Smoke test desktop/mobile dijalankan | Data lapangan dan kesehatan Supabase live |
| 17 | Pengguna dan Hak Akses | Admin/Operator/Viewer, RLS kontrak | Uji Viewer lokal tidak melihat menu edit | RLS dengan JWT Admin/Operator/Viewer sungguhan |
| 18 | Panduan Penggunaan | Panduan awal | Tautan skip-navigation berlaku lintas menu | Bantuan kontekstual lebih lengkap untuk tiap fitur |
| 19 | Asisten SATRIA | Jawaban dari data yang difilter menurut scope | Jawaban Kualitas Data memakai temuan integritas yang diperluas | Akurasi jawaban/batas data pada akun nyata |

**Tambahan di luar 19 menu:** `Sampah & Pemulihan` (modul ke-20 dalam kode) mempunyai arsip lokal, cloud, nested, paginasi, serta patch urutan Stage 9. SQL Stage 9 berhasil dipasang manual sesuai laporan pengguna, tetapi **uji pemulihan transaksi nyata belum dilakukan**. `Analisis Harga` tersedia sebagai rute internal; rumusnya tidak diubah dalam patch ini.

## Prioritas 1 — Validasi modul inti

- Mesin pemeriksaan baru `frontend/satria-operational-integrity.js` mendeteksi: ID Paket ganda/kosong; ID rincian HPS ganda/kosong; volume/harga HPS invalid; referensi RUP beda OPD/tahun; ID penawaran ganda; penyedia tidak ditemukan; harga atau negosiasi yang merujuk item tidak ada; nilai penawaran invalid; pemenang tanpa penawaran.
- Unit test `tools/test_operational_integrity.cjs`: data valid/invalid, tidak mengubah source, tidak mengakses data di luar scope yang diberikan.
- SQL `supabase/tests/priority1_staging_security_readonly.sql` bersifat baca-saja, menggunakan `to_regclass`/`to_regprocedure` agar objek yang belum tersedia dilaporkan `FAIL` alih-alih error 42P01.
- **Belum dilakukan:** pengujian PostgreSQL/Supabase nyata dengan data uji, JWT berbagai peran, konflik lintas perangkat, dan restore backup.

## Prioritas 2 — Penyempurnaan modul operasional

- Sumber temuan kualitas bersama ditampilkan di Pusat Monitoring, Keuangan & Kontrak, Ringkasan Utama, Executive Briefing, Asisten, Kualitas Data, dan SATRIA 360°. Modul ini tidak membuat dashboard palsu atau angka pembayaran otomatis.
- Modul Monitoring SPSE, Laporan, dan layanan lainnya sudah ada sebelumnya. Pengembangan ini **tidak mengklaim telah menulis ulang seluruh fiturnya**; status yang belum terbukti tetap dicatat dalam matriks.

## Prioritas 3 — Audit 19 menu

- `tools/test_19_menu_smoke_browser.py` membuka 20 route Admin (19 menu awal + Sampah) pada 390 px dan 1.280 px; memastikan markup tidak kosong, tidak ada error JavaScript/404 pada aset simulasi, dan menu edit tidak terlihat untuk Viewer lokal.
- Pemeriksaan ini adalah **smoke test render/navigasi**; tidak menekan semua tombol, menguji semua form, atau membuat transaksi cloud.

## Prioritas 4 — UX Gen Z yang mudah dipakai

- Tautan keyboard **Lewati navigasi, langsung ke konten**; `tabindex=-1` pada `main` agar fokus berfungsi.
- Menu aktif memiliki `aria-current="page"`, navigasi mempunyai nama yang dibaca screen reader.
- Kartu peringatan operasional responsif pada ponsel, tersedia tautan satu langkah ke Kualitas Data, mendukung `prefers-reduced-motion` dan fokus terlihat.

## Rencana QA staging nyata (wajib sebelum produksi)

1. Backup staging, pastikan data uji bukan paket pengadaan aktif. Verifikasi migrasi 2, 6, 9 tidak dijalankan ulang; SQL Stage 9 yang sudah dieksekusi manual mungkin belum tercatat pada riwayat CLI (`schema_migrations`). Rekonsiliasi metadata migrasi sebelum deploy CLI berikutnya, tanpa membuat ulang atau menghapus fungsi.
2. Jalankan SQL pemeriksaan read-only baru dan simpan hasil CSV. `PASS` membuktikan keberadaan/privilege dasar, **bukan** RLS end-to-end.
3. Dengan JWT Admin/Operator/Viewer sungguhan, uji akses OPD dan tahun yang sah/tidak sah pada RPC dan query tabel; hasil terlarang harus ditolak server.
4. Arsip–pulih Paket, rincian HPS dan Penawaran dari dua perangkat, termasuk pemenang, dokumen, dan urutan beberapa penghapusan bersebelahan.
5. Coba konflik versi, kehilangan jaringan, logout ketika permintaan berlangsung, serta item yang sudah diganti. Tidak boleh ada perubahan parsial atau kebocoran scope.
6. Restore backup staging pada lingkungan terpisah dan bandingkan snapshot/relasi, bukan hanya tombol "Berhasil".
7. Jalankan QA cetak untuk 15 jenis dokumen, keamanan nama/URL/media, dan uji aksesibilitas dengan keyboard pada ponsel dan desktop.

## Penerapan GitHub dalam satu commit

Paket ZIP patch yang menyertai laporan ini berbasis **commit Patch Sampah Cloud Paginasi** terakhir yang telah dikonfirmasi; file Stage 9 yang belum di-commit sudah digabung. Ini **bukan** snapshot seluruh repositori. Tempel isi ZIP dari root repositori, jangan hapus file di luar manifest. **Migrasi SQL Stage 9 yang sudah berhasil di Supabase jangan dijalankan ulang**. Jalankan `python tools/run_quality_gate.py` dari root dan smoke browser bila Chromium tersedia. Tidak ada approval berjenjang.
