# SATRIA 3.0.59.46 — Perbaikan pratinjau Analisis Harga dan lampiran foto

## Masalah yang diperbaiki

1. Pratinjau **Dokumen Analisis Kewajaran Harga e-Purchasing** menempatkan kop, judul, dan identitas paket tidak pada urutan wajar. Kop atau teks rincian dapat melampaui area cetak, disertai jarak putih yang besar.
2. Lampiran foto produk memaksa **halaman baru per 6 foto** dan mencegah pemecahan seluruh bagian lampiran. Sisa ruang halaman tidak termanfaatkan ketika jumlah foto banyak.

## Penyebab

- Template menggunakan elemen HTML `<header>` untuk sampul dokumen, padahal stylesheet aplikasi memiliki aturan global `header` untuk bilah navigasi (sticky, flex/grid, tinggi tetap, jarak, efek latar). Aturan navigasi ikut diterapkan pada sampul dokumen.
- Lampiran dibagi ke grup tetap enam gambar (`chunks`) dengan `break-before:page` dan `break-inside:avoid` untuk keseluruhan halaman, bukan untuk setiap foto.

## Perbaikan

- Sampul laporan memakai `<div class="spha-example-cover">`, sehingga terpisah dari aturan `header` navigasi aplikasi.
- Batas lebar kop foto disesuaikan dengan lebar kertas A4 dan identitas paket diberi grid kolom tetap, pembungkusan teks panjang dan margin ringkas.
- Foto bukti asli tetap dibaca dari **catalogRefs.imageUrl** melalui mekanisme sebelumnya; tidak ada foto yang dibuat atau diubah.
- Semua kartu foto disusun **mengalir** dalam satu lampiran (dua kolom ketika dicetak), dengan pergantian halaman otomatis serta `break-inside:avoid` pada tiap kartu foto dan keterangannya. Lampiran tetap dimulai pada halaman baru agar terpisah dari tanda tangan.
- Foto ditampilkan utuh (`object-fit: contain`), bukan dipotong, dan nama barang, penyedia, nama produk katalog, serta harga tayang tetap menyertai setiap foto.
- Typo judul `METODE REFRENSI` diperbaiki menjadi `METODE REFERENSI`.
- Nama cache service worker dinaikkan agar pembaruan CSS/JS terambil setelah deployment.

## Pengujian lokal (data sintetis, bukan paket asli)

- `python tools/test_analisa_layout_photo_20261109.py` — kop/identitas/judul A4, 15 foto, pemecahan halaman otomatis, PDF tanpa elemen terpotong, data paket tidak berubah.
- Skenario 15 foto menjadi **8 + 7** pada dua halaman lampiran, dibandingkan pembagian tetap 6 + 6 + 3 sebelumnya (ukuran/banyak foto asli dan panjang keterangannya dapat mengubah susunan halaman secara alami).
- `python tools/test_price_pdf_reference_2026.py` — Analisis Harga A4, penawaran, belum ada penetapan, dan hasil dengan pemenang.
- `node tools/test_price_product_comparison_336.js`
- `node tools/test_price_analysis_evidence_335.js`
- `node tools/test_smart_survey_no_reassessment_20261108.js`
- `node tools/test_nego_ppn_rounding_inaproc_20261108.cjs`
- `python tools/security_static_check.py` — 27/27.

## Penerapan

1. Gunakan **ZIP lengkap** untuk mengganti proyek (atau **ZIP patch** untuk mengubah file terkait saja).
2. Upload ke GitHub lalu tunggu deployment Cloudflare Pages selesai.
3. Jika perangkat masih menampilkan versi lama, muat ulang tab/refresh PWA untuk mengambil cache terbaru.
4. Buka **Paket → Dokumen Pengadaan → Analisis Kewajaran Harga → Pratinjau**, lalu periksa kop OPD Anda, tabel identitas panjang, dan lampiran foto. Cetak PDF A4 dan tinjau beberapa halaman.
5. Data katalog, keterangan dan keaslian foto tetap harus diverifikasi terhadap bukti sumber masing-masing.

**Batas perubahan:** frontend `satria-price-analysis.js`, `satria-price-analysis.css`, versi `index.html`, nama cache `sw.js`, dokumentasi, dan tes. Tidak ada migrasi database, Edge Function, perubahan HPS, penawaran, negosiasi, atau penetapan historis.
