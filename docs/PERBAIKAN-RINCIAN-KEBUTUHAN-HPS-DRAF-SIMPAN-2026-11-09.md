# SATRIA — Rincian Kebutuhan dan HPS: Isi Dulu, Simpan Sekali

**Tanggal:** 9 November 2026  
**Versi cache:** `3.0.59.43`

## Masalah

Pada tampilan desktop, tabel Rincian Kebutuhan/HPS sebelumnya memakai virtual scroll yang mengganti markup input sewaktu digeser. Bila `change` belum terjadi saat baris dibongkar, isian volume dapat hilang saat baris muncul kembali. Selain itu, input volume bertipe `number` dapat menerima perubahan nilai melalui roda mouse ketika fokus. Perubahan sebelumnya langsung memperbarui data paket per kolom.

## Perbaikan

- Desktop dan ponsel memakai daftar isian stabil, tanpa virtual scroll. Tabel desktop bergulir secara biasa; ponsel memakai kartu per barang.
- **Semua isian disimpan sebagai draf di memori sesi**. Mengubah kolom, menambah, dan menghapus barang tidak mengubah data paket/penawaran.
- Klik **Simpan Semua Rincian** untuk memvalidasi seluruh baris dan menyimpan satu kali lewat transaksi yang sama. Data cloud baru menerima perubahan setelah tombol tersebut ditekan (sesuai alur sinkronisasi SATRIA).
- **Batalkan Perubahan** mengembalikan draf ke rincian terakhir yang tersimpan.
- Volume memakai input teks dengan papan ketik numerik, bukan `number`. Roda mouse tidak dapat lagi menambah/mengurangi jumlah.
- Format Indonesia diterima: `4.849` = 4.849 unit (ribuan), `1,5` = 1,5 unit (pecahan). Harga contoh `150.000` = Rp150.000.
- Total HPS sementara ditampilkan tersendiri; **HPS tersimpan** tidak bergeser sampai Simpan.
- Validasi sebelum simpan: nama dan satuan diisi, volume dan harga positif, harga/total aman secara numerik, serta batas alokasi Bank RUP yang sebelumnya ada tetap berlaku.
- Jika rincian diubah oleh sumber lain ketika pengguna sedang mengisi draf, Simpan menolak data yang sudah basi.
- Jika paket memiliki penawaran/negosiasi, sebelum Simpan aplikasi meminta konfirmasi tambahan. Penghapusan barang dengan harga/negosiasi terkait juga meminta konfirmasi khusus.
- Draf dipisahkan per paket dan identitas akun. Draf tetap ada ketika berpindah tab di sesi yang sama, tetapi tidak disimpan ke Supabase/IndexedDB sebelum tombol Simpan. Saat browser dimuat ulang/ditutup, draf yang belum disimpan hilang (browser akan memperingatkan).
- Tidak ada perubahan algoritma perhitungan HPS, harga negosiasi, pajak atau data paket lainnya.

## Cara memakai

1. Buka **Paket Pengadaan → paket → Rincian Kebutuhan dan HPS**.
2. Klik **+ Tambah Barang** jika perlu, lalu masukkan nama, volume, satuan dan harga satuan. Navigasi antar-kolom memakai **Tab**.
3. Periksa **Total sementara (belum tersimpan)**; scroll tidak mengubah volume.
4. Klik **Simpan Semua Rincian** untuk menerapkan; jika tersedia penawaran/negosiasi lama, tinjau konfirmasi sebelum menyimpan.
5. Periksa HPS, penawaran, dan dokumen setelah penyimpanan.

## Perlindungan nilai historis

Paket lain tidak berubah ketika satu paket diisi dan disimpan. Nilai HPS/penawaran/negosiasi yang sudah tersimpan tetap ada selama draf belum disimpan. Setelah penyimpanan, HPS serta perhitungan turunan pada **paket yang sama** dapat berubah jika volume/HPS satuan berubah. Jangan menyimpan ulang rincian paket yang sudah selesai tanpa memeriksa angka dan dokumen hasil sebelumnya.

## Pengujian

Jalankan `python tools/test_hps_batch_draft_browser_20261109.py` (memerlukan Python Playwright + Chromium). Uji mencakup 15 item, scroll, roda mouse, penyimpanan eksplisit, pembatalan, validasi salah, perlindungan negosiasi lama, isolasi paket lain, dan layout ponsel. Pengujian regresi lama: `node tools/test_nego_ppn_rounding_inaproc_20261108.cjs`, `node tools/test_smart_survey_no_reassessment_20261108.js`, `node tools/test_supplier_catalog_source_20261108.js`, `node tools/test_ppkom_creation_20261108.cjs`, `node tools/test_service_worker_cache.cjs`.

## Penerapan

Unggah berkas ZIP lengkap atau salin patch ke repository GitHub, lalu deploy Cloudflare Pages. Versi cache PWA telah dinaikkan untuk memuat JS dan CSS baru. **Tidak perlu migrasi SQL maupun perubahan Edge Functions** untuk fitur ini. Backup JSON/Supabase sebelum deployment produksi disarankan.
