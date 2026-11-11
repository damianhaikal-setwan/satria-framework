# SATRIA NEXT 3.0.59.57 — Generator Dokumen Pemilihan SPSE

## Cakupan saat ini

Generator terintegrasi ke **Dokumen Pengadaan > Paket Dokumen Pendukung Sistem Resmi**. Menu Dokumen Pengadaan kini menampilkan pilihan paket E-Purchasing dan SPSE dalam satu dropdown; untuk paket SPSE, panel berbeda dibuka tanpa menampilkan 15 template lama E-Purchasing.  dengan tautan dari **Ruang Kerja PP**. Khusus paket yang sudah diidentifikasi sebagai **Pengadaan Langsung di jalur SPSE**. Cetak lengkap pada rilis ini khusus **Barang/Jasa Lainnya yang menggunakan SPK di atas Rp50 juta sampai Rp200 juta** dalam kondisi umum; bukan Tender, Seleksi, konstruksi, konsultansi atau pengecualian Papua. Kategori lain dapat tetap memakai alat draf lama tetapi **tidak diberi status berkas lengkap**.

Acuan: Peraturan LKPP Nomor 3 Tahun 2026, Lampiran I bagian 5.3.2. Untuk Pengadaan Langsung menggunakan SPK, bagian dokumen setidaknya mencakup:
1. Undangan Pengadaan Langsung.
2. Instruksi kepada peserta.
3. Lembar data pemilihan.
4. Spesifikasi teknis/KAK.
5. Daftar kuantitas dan harga/keluaran-biaya.
6. Formulir dokumen penawaran.
7. Formulir isian kualifikasi.
8. Rancangan SPK.

Sumber resmi: https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026
Surat edaran transisi: https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026

## Apa yang dilakukan SATRIA

- Menarik data paket, kode RUP, tahun, jenis pengadaan, pagu, rincian volume, HPS satuan dan HPS total dari paket.
- Operator/Pejabat Pengadaan mengisi data undangan, alamat, tanggal, persyaratan kualifikasi, metode/kriteria evaluasi, instruksi, dan bukti penetapan HPS serta rancangan SPK dari PPK. **Tidak mengarang isi rancangan kontrak**.
- Menyimpan `ppDokumenPemilihan` dalam objek paket melalui `SATRIA.tx('paket',...)`; tidak membuat tabel database atau alur approval baru.
- Menampilkan pemeriksaan kelengkapan, cetak DRAF kapan pun, dan cetak tanpa label DRAF setelah kelengkapan, sumber paket tidak berubah, isian sudah disimpan, dan pejabat menyatakan pemeriksaan manual.
- Print-to-PDF A4 potret di browser; tidak ada koneksi API SPSE dan tidak ada tanda tangan/penetapan elektronik dari SATRIA.
- Menolak cetak lengkap untuk Tender, pencatatan ≤Rp50 juta, kategori yang belum tercakup, HPS tidak lengkap atau melebihi pagu, serta isian yang belum lengkap.
- Validasi struktur `ppDokumenPemilihan` saat backup impor dan hapus isian tersebut saat paket disalin ke tahun berikutnya agar isian penyedia/dokumen tidak ikut terbawa.

## Alur penggunaan

1. Di paket SPSE, pilih metode **Pengadaan Langsung** yang sesuai data sistem resmi.
2. Pada panel regulasi, catat tanggal mulai dan dasar regulasi yang benar jika diperlukan; untuk cetak lengkap berbasis Perlem 3/2026 keduanya perlu dipastikan.
3. Buka menu Dokumen Pengadaan, pilih paket dan perluas **Isi Dokumen Pemilihan**.
4. Isi semua kolom wajib. Masukkan isi rancangan SPK yang memang ditetapkan oleh PPK serta referensi HPS dan KAK.
5. Tekan **Simpan isian dokumen**, lalu **Periksa kelengkapan**. Pengisian dapat dilakukan bertahap; tidak ada langkah persetujuan berjenjang baru.
6. Cetak draf untuk diperiksa. Setelah semua cocok, centang pernyataan pemeriksaan dan pilih **Cetak berkas lengkap untuk pemeriksaan akhir & unggah SPSE**.
7. Gunakan hasil cetak hanya setelah pemeriksaan terakhir, penetapan/tanda tangan yang dipersyaratkan, dan kecocokan dengan format/panduan SPSE resmi. Unduh PDF dari dialog cetak browser; unggah manual di SPSE.

## Batasan penting

**Lulus kelengkapan isian bukan bukti kepatuhan hukum otomatis.** SATRIA tidak dapat memverifikasi isi klausul yang diketik, keabsahan HPS atau tanda tangan PPK, status SPSE, persyaratan penyedia, dan kebijakan instansi secara otomatis. Belum ada bukti uji Supabase/hosting produksi. Rilis **kandidat**, bukan sertifikasi dokumen final.

Tidak menggantikan standar dokumen pemilihan versi terbaru yang diberikan sistem/instansi. Kewajiban tanda tangan, penetapan dan pengecualian khusus tetap tunduk kepada peraturan serta pejabat berwenang. Sumber acuan dan contoh sintetik disediakan untuk uji tata letak, **bukan** untuk digunakan dalam pengadaan nyata.

## Pemeriksaan aman sebelum deploy

- Backup commit `main` dan data lokal yang belum tersinkron.
- Bandingkan `main` produksi dengan basis ZIP 3.0.59.56.
- Uji satu paket SPSE simulasi melalui akun Editor dan Viewer dengan pembatasan OPD/tahun.
- Buka PDF di A4; pastikan 8 bagian, tabel item, informasi PPK, nomor, tanda tangan, tidak ada isi simulasi/placeholder dari data nyata.
- Uji apakah mengubah HPS/pagu setelah menyimpan menyebabkan cetak lengkap ditahan sampai save ulang.
- Pastikan sinkronisasi Supabase dan backup/impor berfungsi di staging.
