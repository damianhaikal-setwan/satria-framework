# SATRIA 3.0.59.47 — Perapian judul lampiran foto barang

## Perubahan

- Judul lampiran menjadi **LAMPIRAN FOTO BARANG** dengan teks ringkas dan rata kiri.
- Jumlah foto yang benar-benar tersedia ditampilkan di kanan judul, misalnya **15 foto produk**.
- Paragraf panjang di bawah judul dihapus, termasuk kalimat **“Periksa kembali kesesuaian foto dengan produk pada sumber aslinya.”**
- Garis pemisah tipis ditambahkan untuk membedakan judul dari daftar foto.
- Layout foto tetap dua kolom untuk cetak A4; tiap foto dan keterangannya tidak dipecah antarlaman.
- Tidak mengubah data penawaran, HPS, penetapan, foto, atau urutan penyedia.

## Verifikasi

- `python tools/test_analisa_layout_photo_20261109.py`: judul, jumlah foto, tanpa kalimat lama, PDF A4 tanpa pemotongan, dan integritas data.
- `node tools/test_service_worker_cache.cjs`: pembaruan aset CSS/JS PWA.
- `python tools/security_static_check.py`: pemeriksaan keamanan proyek.

## Penerapan

Upload ZIP lengkap atau terapkan ZIP patch pada repo SATRIA yang sesuai, lanjutkan deployment Cloudflare Pages. Situs produksi tidak diubah oleh berkas ini. Versi frontend: **3.0.59.47**. Tidak ada migrasi Supabase.
