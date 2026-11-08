# Perbaikan SUMBER/BUKTI HARGA — Link e-Katalog Penyedia

Tanggal: 8 November 2026. Perubahan terbatas pada sumber URL penawaran dan tempat yang menampilkan sumber tersebut; tanpa migrasi database.

## Penyebab

Smart Survey sebelumnya menulis `w.sumberHarga = link` setiap kali produk disimpan. `link` adalah tautan **produk**, bukan tautan **toko penyedia**. Akibatnya kolom **Sumber/bukti harga** dapat berisi URL produk pertama/terakhir yang disimpan, bahkan saat link penyedia telah diisi pada Data Master.

## Aturan setelah perbaikan

- **Toko penyedia:** `S.penyedia[].link` pada **Data Master → Penyedia → Link katalog/toko** menjadi rujukan untuk **Sumber/bukti harga** pada penawaran terkait.
- **Produk:** `w.catalogRefs[itemId].link` menyimpan URL produk **masing-masing item**, dan tidak boleh menimpa link toko.
- **Data lama:** tampilan sumber membaca link Data Master terlebih dahulu. Jika link Data Master kosong tetapi `w.sumberHarga` persis sama dengan salah satu URL produk di `catalogRefs`, sumber dianggap **belum tersedia** (bukan dibuat-buat). Referensi manual nonproduk lama tetap dipertahankan.
- Bila link Data Master tersedia, kolom sumber pada penawaran/kalkulator dibuat **hanya-baca** dan diarahkan untuk diperbarui melalui Data Master. Tersedia tautan **Buka toko e-Katalog penyedia**.
- Saat menambahkan penawaran penyedia, kolom sumber diisi dari link toko Data Master, jika tersedia. Saat menyimpan Smart Survey, hanya link toko penyedia yang boleh mengisi sumber; URL produk tetap tersimpan secara terpisah.
- Dokumen survei, daftar link penyedia pada dokumen IDKB, analisis harga, indikator kelengkapan, dan validasi penawaran memakai sumber penyedia yang benar.

## Penting

Perubahan ini **tidak** mengubah data produksi yang telah tersimpan dan **tidak** menganggap sebuah link otomatis sebagai bukti keaslian harga. Untuk penyedia yang link tokonya kosong, lengkapi **Data Master → Penyedia**. Bukti produk dan tangkapan layar harus tetap diverifikasi sesuai kebutuhan dokumen.

## Pengujian lokal

```bash
node tools/test_supplier_catalog_source_20261108.js
python tools/test_supplier_catalog_source_browser_20261108.py
node tools/test_navigation_survey_winner_350.js
python tools/test_refactor_integrity.py
node tools/test_service_worker_cache.cjs
```

Pengujian tidak menyambung ke cloud/Supabase produksi. `sw.js` memakai nama cache baru supaya file JS yang telah diperbarui diambil setelah deploy.
