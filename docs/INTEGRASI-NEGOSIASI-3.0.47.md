# SATRIA NEXT 3.0.47 — Integrasi Kalkulator dan Harga Nego

## Perubahan

- Menu Kalkulator Nego dan panel Paket Pengadaan → Penawaran dan Negosiasi menggunakan **satu sumber data**: `paket.penawaran[penyedia].nego[idRincian]`.
- Ketika hasil negosiasi disimpan, **harga hasil kesepakatan per unit termasuk PPN** masuk langsung ke input `Harga nego` untuk rincian barang dan penyedia yang tepat.
- Nilai sebelum pajak dan komponen PPN tetap berada di `negoDetails[idRincian]` untuk kebutuhan penelusuran.
- Menyimpan satu barang tidak mengubah barang lain maupun penawaran penyedia lainnya.
- Tabel menawarkan tombol **Kalkulator Nego** per penyedia; setelah simpan muncul **Lihat Harga per Rincian Barang** untuk membuka paket/panel/penyedia yang benar.
- Harga yang masih berasal dari Kalkulator ditandai **Dari Kalkulator**. Apabila pengguna mengubah kolom harga nego secara manual, rincian pajak hasil kalkulator lama dibatalkan, agar tidak mengklaim rincian yang sudah tidak cocok.
- Tidak mengubah 14 template dokumen, mekanisme A4/Arial, maupun skema Supabase.

## Langkah pengujian

1. Cadangkan data SATRIA terlebih dahulu.
2. Pilih paket berisi minimal dua rincian HPS dan dua penyedia pada Paket Pengadaan.
3. Di kartu penyedia A pilih **Kalkulator Nego**.
4. Masukkan harga negosiasi sebelum pajak untuk satu barang dan klik **Simpan negosiasi barang ini**. Konfirmasi penyimpanan.
5. Klik **Lihat Harga per Rincian Barang**. Pastikan kolom `Harga nego` pada barang tersebut berisi harga satuan **termasuk pajak**, dan baris lain masih sama seperti sebelumnya.
6. Ulangi untuk penyedia B. Pastikan harga penyedia A tidak berubah.
7. Ubah harga pada tabel secara manual dan periksa apakah tanda **Dari Kalkulator** hilang bila nilai tidak lagi cocok.
8. Buka ulang aplikasi untuk memastikan data tersimpan pada penyimpanan lokal/cloud yang Anda gunakan; periksa status sinkronisasi sebelum menutup aplikasi.

**Catatan:** kalkulator menghasilkan dan menyimpan nominal penawaran. Nilai tersebut tetap memerlukan kesepakatan penyedia dan verifikasi tarif serta dasar pajak berdasarkan transaksi sebenarnya. Status hasil kalkulator bukan bukti bahwa penyedia telah menyetujui negosiasi.

## Pengujian oleh pembuat patch

- Seluruh 19 skrip inline lolos pemeriksaan sintaks JavaScript.
- Lulus pengujian terisolasi mapping per penyedia dan ID rincian barang, penyimpanan parsial, komponen pajak, validasi HPS, batch invalid tanpa perubahan sebagian, serta penghapusan metadata kalkulator yang tidak cocok setelah edit manual.
- Interaksi Safari/Chrome pada perangkat pengguna dan Supabase produksi **belum diverifikasi**.
