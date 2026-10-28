# SATRIA 3.0.44 — Kalkulator Negosiasi e-Katalog

## Perubahan
- Mengganti algoritma pembagian otomatis pagu menjadi input negosiasi **sebelum pajak per barang**.
- Menyediakan harga tayang termasuk pajak, referensi dasar pajak (terverifikasi jika sesuai Smart Survey, jika tidak ditandai estimasi), PPN efektif 11% / PPN 12% penuh / 0% / nominal manual, harga nego final per unit dan subtotal per volume.
- Mendukung simpan satu item atau seluruh baris yang diubah, tanpa menghapus negosiasi item lain.
- Menggunakan `w.nego[itemId]` untuk harga termasuk pajak agar 14 dokumen tetap memakai struktur lama; rincian dicatat dalam `w.negoDetails[itemId]`, dan referensi katalog yang ada diperbarui bila tersedia.
- Menjaga sinkronisasi melalui mekanisme data paket dan validasi sumber/tanggal pada form.
- Mempertahankan desain Gen Z dan standar dokumen resmi A4 / Arial.

## Cara menggunakan
1. Buka menu Kalkulator Nego, pilih paket dan penyedia.
2. Pastikan setiap harga tayang per unit sudah sesuai e-Katalog, atau koreksi angka jika diperlukan.
3. Masukkan **harga kesepakatan sebelum pajak** per barang (contoh Rp1.100.000).
4. Pilih jenis simulasi PPN yang benar dan periksa harga hasil negosiasi termasuk pajak.
5. Klik **Simpan negosiasi barang ini** atau **Simpan semua perubahan**.
6. Periksa Penawaran & Negosiasi dan keluaran dokumen.

## Contoh perhitungan layar e-Katalog pengguna
- Harga produk Rp1.150.000; PPN Rp126.500; harga tayang Rp1.276.500.
- Nego sebelum pajak Rp1.100.000 dengan tarif efektif 11% -> PPN Rp121.000 dan harga per unit termasuk pajak Rp1.221.000.

**Penting:** PPN golongan 12% tidak selalu berarti dikalikan 12% dari harga produk. Gunakan nilai efektif atau nominal sesuai data transaksi. Ini kalkulator simulasi, bukan penetapan kewajiban perpajakan.

## Pemeriksaan
- Seluruh skrip inline lulus sintaks Node.js.
- Uji logika perhitungan, mode pajak, pencegahan harga nego melebihi tayang dan simpan parsial lulus.
- Uji rendering dan penyimpanan interaksi terisolasi pada Chromium 1440px dan 390px lulus, tanpa horizontal overflow.
- Pengujian browser lengkap pada file sumber masih terhalang kebijakan akses localhost/file; uji data nyata dan Supabase belum dilakukan.

## Risiko dan kompatibilitas
- Tidak mengubah tabel database, 14 renderer dokumen, atau aturan cetak.
- `negoDetails` adalah kolom data JSON tambahan pada objek penawaran. Belum diperlukan perubahan SQL khusus.
- Nilai nego yang sudah tersimpan tetap utuh hingga pengguna menyimpan hasil baru.
- Backup data JSON sebelum membuka versi baru, khususnya bila cloud realtime aktif.
