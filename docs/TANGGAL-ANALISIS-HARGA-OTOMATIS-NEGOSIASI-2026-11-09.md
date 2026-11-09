# SATRIA NEXT 3.0.59.48 — Tanggal Cetak Analisis Harga Mengikuti Negosiasi

## Kebutuhan

Tanggal pada bagian tempat/tanda tangan **Analisis Kewajaran Harga E-Purchasing** sebelumnya diambil dari jam browser saat dicetak. Ini membuat tanggal pratinjau/cetak tidak selalu sama dengan tanggal negosiasi yang telah dilakukan.

## Perubahan

- Bagian tanggal tanda tangan dokumen **Analisis Harga** sekarang membaca **`p.tglNego`**, yakni **Tanggal negosiasi** yang sudah tersimpan pada paket aktif.
- Tanggal ditampilkan dalam format bahasa Indonesia, tanpa bergeser hari akibat penafsiran zona waktu.
- Jika tanggal negosiasi masih kosong atau tidak valid, dokumen menampilkan **"Tanggal negosiasi belum diisi"**; tanggal hari ini **tidak** dipakai sebagai pengganti.
- Halaman **Dokumen Pengadaan → Analisis Kewajaran Harga & Bukti** menampilkan keterangan asal tanggal. Pemeriksaan kelengkapan mengarahkan pengguna ke **Data Paket → Tanggal negosiasi** jika belum terisi.
- Tidak menambah kolom/database baru; tidak memodifikasi tanggal negosiasi, HPS, pagu, penawaran, penetapan, maupun data historis. PDF lama yang sudah diunduh tidak berubah. **Jika dokumen lama dicetak ulang, tanggal yang tampil mengikuti tanggal negosiasi tersimpan saat itu.**
- Perubahan hanya untuk tanggal **Analisis Harga**; tanggal pada dokumen lain tetap mengikuti sumbernya masing-masing.

## Cara mengatur

1. Buka **Paket Pengadaan**, pilih paket yang dimaksud.
2. Di tab **Data Paket**, isi **Tanggal negosiasi** sesuai tanggal pelaksanaan sebenarnya dan simpan. Alternatifnya, catat tanggal di **Kalkulator Nego** ketika menyimpan hasil negosiasi.
3. Buka **Dokumen Pengadaan → 15 Analisis Kewajaran Harga & Bukti**.
4. Periksa petunjuk **Tanggal dokumen Analisis Harga** pada halaman dan tanggal di bagian tanda tangan pratinjau.
5. Klik **Cetak / Simpan PDF** jika sudah sesuai.

Jika tanggal penandatanganan dokumen berbeda dari tanggal negosiasi, cocokkan kronologinya dengan berkas pengadaan sebelum diterbitkan. Jangan mengganti tanggal riwayat negosiasi hanya untuk mengubah tanggal di dokumen.

## Pengujian

- `python tools/test_analisa_tanggal_nego_20261109.py` — Chromium dan PDF: tanggal tersimpan benar, penggantian tanggal terbaca, tanggal kosong/tidak valid ditandai, data paket tidak diubah.
- `python tools/test_analisa_layout_photo_20261109.py` — tampilan A4 dan 15 foto barang tetap benar.
- `node tools/test_price_analysis_evidence_335.js` — analisis harga read-only.
- `node tools/test_price_product_comparison_336.js` — komparasi harga tetap konsisten.
- `node tools/test_service_worker_cache.cjs` — cache PWA versi baru.
- `python tools/security_static_check.py` — 27 pemeriksaan keamanan.

## Penerapan

Unggah ZIP lengkap atau patch pada repositori yang sesuai, lalu deploy Cloudflare Pages. Versi baru: **3.0.59.48**. Tidak diperlukan migrasi Supabase atau deploy ulang Edge Functions. Belum diterapkan langsung ke situs produksi oleh patch ini.
