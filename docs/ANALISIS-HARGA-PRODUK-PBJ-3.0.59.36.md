# SATRIA NEXT 3.0.59.36 — Analisis Harga Produk dan Kertas Kerja PBJ

## Tujuan

Menjawab kebutuhan satu Pejabat Pengadaan dan permintaan data BPK **per paket**: SATRIA membaca HPS, rincian barang, penawaran, negosiasi, ongkir, dan referensi Smart Survey yang sudah tercatat. Tidak menambah form maupun approval berjenjang.

## Isi laporan A4 lanskap

I. Latar Belakang, Tujuan dan Identitas Paket.
II. Daftar Kebutuhan dan HPS Per Barang.
III. Metode Referensi, Dasar Perbandingan dan Rujukan PBJ.
IV. Tabel Analisis Beda Harga Per Item.
V. Analisis dan Pertimbangan Kewajaran Setiap Produk.
VI. Rekapitulasi Negosiasi dan Efisiensi Nominal.
VII. Kesimpulan dan Catatan Pejabat Pengadaan.
VIII–X. Lampiran matriks, URL sumber dan temuan.

## Metode perhitungan

- Harga acuan satuan HPS = `item.hs`; qty = `item.vol`. Total HPS = Σ(HPS satuan × qty).
- Harga tayang diambil dari penawaran per item. Harga negosiasi hanya dianggap final untuk penyedia penetapan valid dan saat semua item/ongkir lengkap.
- Selisih HPS satuan = `HPS satuan - harga negosiasi (atau harga tayang jika belum ada penetapan)`; persen dibagi HPS satuan. Angka plus artinya harga lebih rendah.
- Harga pembanding lain = penawaran harga tayang produk lain yang metadata bukti dasarnya lengkap serta **tidak menunjukkan konflik model/ukuran eksplisit**, masih kandidat untuk diverifikasi manual.
- Selisih pembanding = `harga kandidat - harga dasar analisis`, dibagi harga kandidat. Statistik terbatas pada calon referensi dan bukan putusan kewajaran.
- Efisiensi nominal paket = `total HPS - total nego pemenang valid termasuk ongkir`, dibagi HPS. Nilai negosiasi yang belum lengkap tidak dihitung sebagai nilai final.
- Tidak menghitung PPN kedua kali dari harga bruto; ongkir item tidak diasumsikan terbagi rata.

## Prinsip bukti untuk auditor

SATRIA hanya dapat memeriksa kelengkapan metadata. Pemakaian tanggal sumber, kesetaraan unit/merk/model, lokasi, pajak, ongkir, ketersediaan barang, layanan garansi dan kondisi pasar membutuhkan pemeriksaan bukti asli. URL tidak sama dengan snapshot katalog historis. Jangan membuat bukti/tanggal mundur untuk paket historis.

SATRIA tidak memaksakan tiga referensi atau menyatakan semua harga lebih rendah dari HPS otomatis wajar. Jika hanya satu penawaran, uraikan keterbatasan bukti, tanpa mengarang penawaran tambahan.

## Sumber peraturan dan kehati-hatian temporal

- Perpres 16 Tahun 2018 sebagaimana diubah Perpres 12/2021 dan **Perpres 46/2025**: https://peraturan.bpk.go.id/Details/318647/perpres-no-46-tahun-2025
- Peraturan LKPP **2/2026** tentang Katalog Elektronik, efektif **1 September 2026** dan mencabut PerLKPP 9/2021: https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026
- Untuk fase survei/negosiasi tercatat **2 Juni 2026** pada contoh RUP 67122699, jangan memaksakan peraturan September 2026 secara surut. Perlu meneliti tanggal pelaksanaan dan ketentuan transisinya dari dokumen resmi.
- Panduan historis pelaksanaan negosiasi dan klarifikasi: Keputusan Kepala LKPP 177/2024, sumber JDIH LKPP. Lakukan pemeriksaan apakah panduan masih berlaku pada tanggal transaksi.

Catatan: bagian peraturan adalah *rujukan awal* untuk telaah, bukan nasihat hukum atau pengganti pertimbangan Pejabat Pengadaan.

## Uji yang dilakukan dan batasannya

- `node tools/test_price_product_comparison_336.js` menguji 7 rincian, 2 penyedia, identitas harga per item, `No. 10` vs `No. 24/6`, tanpa mutasi data.
- `python tools/test_price_product_browser_336.py` membuka dashboard, dokumen ke-15, mencetak PDF simulasi 6 halaman dan memeriksa konsistensi nominal.
- Uji regresi lama memastikan penetapan, Bank RUP, DPP, keamanan statis tidak berubah.
- Browser dilakukan offline dengan data simulasi; sinkronisasi cloud Supabase produksi dan penerimaan lampiran oleh pemeriksa BPK belum diuji.
