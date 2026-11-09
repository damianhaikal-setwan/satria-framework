# SATRIA NEXT 3.0.59.50 — Modernisasi Laporan & Analisis (Gen Z)

Tanggal: 9 November 2026
Dasar: proyek SATRIA NEXT 3.0.59.49 dari ZIP lengkap audit laporan.

## Tujuan

Mempercepat pembacaan laporan pengadaan melalui dashboard yang visual, responsif, dan tetap akurat. Tampilan yang disederhanakan **tidak** mengubah transaksi, rumus HPS/penetapan, maupun pembatasan akses server.

## Bagian baru

1. **Header visual** dengan ringkasan konteks dan filter Tahun Anggaran.
2. **4 KPI:** HPS e-Purchasing, nilai penetapan e-Purchasing yang lolos validasi, total paket sesuai filter, dan jumlah paket dengan temuan kelengkapan.
3. **Grafik donut** komposisi jumlah paket: E-P ditetapkan, E-P menunggu, dan SPSE.
4. **Grafik batang horizontal** peringkat maksimal 7 rekening teratas; ukuran dapat diganti antara HPS E-P, penetapan E-P, dan pagu paket tercatat. Klik rekening untuk memfilter tabel detail di bawah.
5. **Grafik garis** tren tahunan HPS E-P dan penetapan E-P, hingga 8 tahun terbaru dalam cakupan.
6. **Grafik batang temuan audit** paling sering: maksimal 6 jenis dengan jumlah lebih dari nol. Klik kategori untuk memfilter panel audit.
7. **Tabel prioritas rekening** dengan jumlah paket, HPS, penetapan dan aksi Fokus. Rekap lengkap, tabel rinci, panel audit dan ekspor CSV lama tetap utuh.

## Konsistensi data

- Sumber visual adalah `satriaLaporanRekeningRows()` dan `satriaLaporanAuditRows()` yang sudah dipakai pada versi 3.0.59.49. Tidak ada kalkulasi paralel atas data mentah yang dapat menyimpang dari laporan.
- Semua bagian mengikuti filter OPD di header, penugasan server (`activeCloudScope()`), TA, rekening dan pencarian yang sama. Filter Tahun pada dashboard menyelaraskan filter TA laporan rekening. Pemilihan metrik hanya mengubah **grafik peringkat**, bukan nilai transaksi.
- Rangkaian kartu, grafik dan tabel visual **tidak** memaksa perubahan pada penetapan historis. Hanya pemenang yang valid pada saat laporan dibuka yang dihitung sebagai penetapan.
- Pagu yang ditampilkan per rekening adalah **jumlah pagu paket tercatat**; bukan pagu DPA, sisa anggaran, atau realisasi kas.
- Pembayaran SPSE terverifikasi tetap dibedakan dari penetapan e-Purchasing. Paket SPSE hanya masuk hitungan jalur SPSE.
- Paket arsip tetap dihitung dalam cakupan akun, sama seperti versi sebelumnya. Paket tanpa rekening akan ditampilkan sebagai kategori tersendiri, tidak diatribusikan ke rekening mana pun.
- Grafik/kartu dan ekspor bersifat **baca saja**, tidak menyimpan/memutasi paket, HPS, negosiasi, rekening, penetapan maupun pembayaran.
- Ringkasan Bank RUP pada bagian terbawah tetap mencakup semua TA yang diizinkan dalam OPD header dan **tidak** mengikuti filter tahun/rekening visual. Keterbatasan ini tercantum jelas pada tampilan.

## Penggunaan

1. Buka **Laporan dan Analisis**.
2. Gunakan filter **Tahun Anggaran** pada header visual.
3. Pilih **Ukuran** pada grafik peringkat rekening untuk berganti antara HPS, Penetapan, dan Pagu paket.
4. Klik batang rekening atau tombol **Fokus** pada tabel prioritas untuk memfilter rincian paket di bawah.
5. Klik salah satu jenis temuan audit untuk melihat paket yang perlu diperiksa.
6. Gunakan filter rekening/pencarian dan ekspor CSV pada modul laporan rinci sebagaimana sebelumnya.

## Desain dan kompatibilitas

- Tidak menggunakan API baru atau library chart eksternal. Grafik batang dibuat dengan CSS, donut memakai `conic-gradient`, tren tahunan memakai SVG inline semantik.
- Warna Gen Z ungu, turquoise dan amber digunakan dengan kontras teks sesuai tema terang/gelap dan label yang terbaca tanpa hanya mengandalkan warna.
- Grafik interaktif menggunakan `button` dan `select` semantik; kontrol keyboard didukung dan nama kategori tetap tersedia dalam teks.
- Pada ponsel kartu dan grafik berubah menjadi satu kolom; tabel prioritas dan tabel laporan lengkap tetap bisa digeser horizontal.
- Grafik disembunyikan ketika mencetak agar alur cetak dokumen resmi SATRIA tidak terpengaruh.

## Batasan

- UI tidak dapat menampilkan transaksi yang belum dimuat atau di luar kewenangan OPD/TA.
- Laporan tetap bukan saldo DPA/SIPD atau laporan realisasi keuangan resmi. Perlu verifikasi dengan sumber eksternal sebelum digunakan untuk pengesahan.
- Pengujian dilakukan dengan data simulasi dan kode lokal; hasil visual data nyata perlu diperiksa setelah deployment.

## Pengujian

```bash
python tools/test_laporan_visual_genz_20261109.py
node tools/test_laporan_rekening_20261109.cjs
python tools/test_laporan_rekening_browser_20261109.py
node tools/test_audit_laporan_20261109.cjs
python tools/test_audit_laporan_browser_20261109.py
node tools/test_service_worker_cache.cjs
python tools/security_static_check.py
```

Uji browser mencakup tema terang/gelap, desktop/ponsel, interaksi filter, angka yang sesuai dengan dataset, dan cakupan akun PPKom Bapperida tanpa data Disporapar/tahun lain. Uji regresi PPN, Smart Survey, RUP, PPKom dan form HPS juga telah dijalankan pada paket pengujian.

## Instalasi

1. Upload ZIP lengkap atau salin isi ZIP patch dengan struktur `satria-framework-main/` yang sama ke GitHub.
2. Deploy Cloudflare Pages.
3. Refresh halaman untuk mendapatkan service worker/cache `satria-v3.0.59.50-genz-laporan-20261109`.
4. Periksa 2–3 paket nyata dan rekonsiliasi angka HPS/penetapan terhadap data sumber.

Tidak diperlukan migrasi SQL, perubahan RLS, maupun deployment Edge Function Supabase baru untuk penambahan antarmuka visual ini.
