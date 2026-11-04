# SATRIA NEXT 3.0.59.23 — Evaluasi Total HPS untuk Negosiasi Historis

## Masalah pada versi 3.0.59.22

Fungsi `satriaOfferGate()` menolak penetapan apabila **satu harga akhir nego/unit melebihi harga HPS satuan**, walaupun total harga negosiasi seluruh item dan ongkir masih di bawah total HPS serta pagu paket. `evalPw()` juga menganggap statusnya gugur, dan `kandidat()` menyingkirkan penawar tersebut. Nilai nego tetap dapat dicatat; yang diblokir adalah penetapan pada aplikasi SATRIA.

## Perilaku baru (3.0.59.23)

Mode default **tetap ketat**. Jika terdapat item dengan harga negosiasi melebihi HPS satuan, kartu penyedia di **Paket Pengadaan → Penawaran & Negosiasi** menampilkan pilihan **review evaluasi total HPS untuk pencatatan kasus historis**.

Review hanya dapat dicatat bila:

1. HPS item dan volume semua item valid; harga tayang dan hasil negosiasi seluruh item lengkap;
2. **Total akhir (harga nego/unit × volume setiap item + ongkir satu kali) ≤ total HPS paket**;
3. Total akhir juga **≤ pagu paket**;
4. Setiap harga nego/unit **≤ harga tayang/unit**;
5. Operator mengisi **alasan/kronologi**, **referensi bukti** dan persetujuan untuk mencatat fakta yang telah diperiksa, kemudian mengonfirmasi peringatan.

Alasan dan referensi bukti disimpan bersama waktu, pengguna aplikasi, nilai yang ditinjau dan rincian item yang melebihi HPS, melalui transaksi SATRIA dan log sinkronisasi. Peninjauan baru atau pencabutan review mempertahankan catatan sebelumnya pada `hpsTotalReviewHistory`. Bila harga tayang, harga nego, HPS rincian, volume, pagu, ongkir, tanggal negosiasi, sumber, atau tanggal harga berubah, review lama **tidak lagi berlaku**, dan harus diperiksa serta dicatat ulang.

Saat review tercatat, sistem dapat mengizinkan **pencatatan penetapan manual dalam SATRIA** setelah syarat data lain dipenuhi, kemudian menampilkan nilai penetapan pada Bank RUP dan Ringkasan Utama. Tindakan di aplikasi **bukan** penetapan resmi INAPROC, pengesahan prosedur yang telah berlangsung, tanda tangan pejabat, atau pembenaran harga tidak wajar.

## Cara menggunakan untuk data yang sudah terjadi

1. Buat backup JSON dan cocokkan paket/RUP, HPS, rincian barang, harga tayang, harga nego final, PPN dan ongkir terhadap bukti transaksi asli. **Jangan ubah HPS historis atau tanggal resmi untuk sekadar membuka tombol penetapan.**
2. Pada kartu penyedia yang ditandai harga item di atas HPS, baca total HPS, total negosiasi + ongkir, dan pagu paket.
3. Pilih bagian **Isi review kasus historis untuk evaluasi total HPS**, tulis alasan/kronologi dan nomor/rujukan dokumen yang benar, lalu centang pernyataan pemeriksaan.
4. Klik **Simpan review & gunakan evaluasi total**. Setelah data syarat lainnya lengkap, tombol **Tetapkan pemenang** dapat dipakai untuk **mencatat** keputusan yang didukung dokumen sebenarnya.
5. Jika bukti/kewajaran atau kewenangan belum jelas, **jangan menekan penetapan**; minta peninjauan PPK/Pejabat Pengadaan/UKPBJ/APIP sesuai prosedur instansi. Dokumen dan keputusan resmi mengikuti proses pengadaan, bukan sebaliknya.

## Rujukan dan batasan

- Perpres 46/2025 (Pasal 26): HPS dipakai untuk menilai kewajaran harga penawaran maupun kewajaran harga satuan dan sebagai batas penawaran yang sah; ketentuan yang berlaku tergantung proses dan jenis pengadaan. Rujukan: https://jdih.lkpp.go.id/regulation/konsolidasi/konsolidasi-nomor-46-tahun-2025
- Pusat Bantuan INAPROC, "Negosiasi": panduan aplikasi menyebut pemeriksaan **total harga negosiasi baru ≤ total HPS**. Rujukan: https://bantuan.inaproc.id/hc/id-id/articles/8167550065167-Negosiasi
- Kepatuhan riil harus dinilai dari regulasi dan pedoman yang berlaku **pada saat proses historis berlangsung**, metode pemilihan, dokumen pengadaan, bukti kewajaran dan persetujuan pejabat berwenang. SATRIA tidak menetapkan interpretasi hukum final.

## Pemeriksaan teknis

Jalankan `node tools/test_hps_total_historical_review.js` dan seluruh pengujian di `README.md`. Tidak ada perubahan SQL/Edge Functions maupun migrasi database dalam versi ini; atribut review baru tersimpan sebagai data penawaran tambahan di payload aplikasi. Status sinkronisasi Supabase produksi dan autentikasi harus diuji di lingkungan pengguna.
