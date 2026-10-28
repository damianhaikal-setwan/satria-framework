# SATRIA NEXT 3.0.49 — Harga Nego Sebelum PPN per Unit

## Koreksi kebutuhan pengguna
Di **Paket Pengadaan → Penawaran & Negosiasi → Harga per Rincian Barang**, kolom **Harga Nego SEBELUM PPN/unit** kini menampilkan angka tawaran dasar yang disimpan dari **Kalkulator Nego**, bukan harga akhir sudah termasuk PPN.

### Contoh
| Komponen | Nilai |
|---|---:|
| Harga tayang termasuk PPN | Rp1.276.500 |
| Harga tawaran sebelum PPN | **Rp900.901** |
| PPN simulasi yang tersimpan | Rp99.099 |
| Harga akhir per unit | Rp1.000.000 |

## Catatan kompatibilitas
- Demi kompatibilitas dengan perhitungan HPS/pagu dan 14 dokumen yang sudah digunakan, **kolom internal `penawaran.nego[itemId]` tetap menyimpan harga bruto (termasuk pajak)**; nilai dasar pajak disimpan di `penawaran.negoDetails[itemId].beforeTax`, sedangkan pajak tersimpan di `.tax`. Ini adalah keputusan teknis untuk tidak merusak total yang sudah berjalan, bukan berarti tabel tetap menunjukkan bruto.
- Tabel saat ini menampilkan **harga sebelum PPN, PPN, dan harga akhir** sebagai tiga kolom berbeda. Harga dasar diubah melalui Kalkulator Nego, tidak dengan mengetik ulang di kolom read-only; hal ini menghindari nilai pajak tidak cocok setelah pengeditan manual.
- Data negosiasi lama yang belum memiliki rincian pajak **tetap utuh** dan ditandai **perlu verifikasi**; aplikasi tidak menganggap nilai bruto lama sebagai nilai sebelum pajak.
- Rekaman Smart Survey lama yang memiliki `negotiatedBase` dan `negotiatedTax` konsisten dengan bruto tetap dapat dibaca. Rekaman Smart Survey baru juga menyimpan `negoDetails` eksplisit.
- Tidak ada migrasi database Supabase dan tidak ada perubahan format cetak 14 dokumen.

## Pengujian
- Pemeriksaan sintaks 19 skrip inline: lulus.
- Simulasi harga tawaran sebelum PPN Rp900.901 dan PPN Rp99.099: kolom Harga Nego menunjukkan Rp900.901, harga akhir Rp1.000.000.
- Perhitungan total tetap menggunakan bruto; penyedia dan item lain tidak berubah.
- Rekaman tanpa rincian pajak tidak dipalsukan sebagai harga sebelum PPN.
- Perlu uji end-to-end pada Safari/Chromium dan Supabase aktif dengan data nyata sebelum dinyatakan siap produksi.

## Alur uji pengguna
1. Backup JSON.
2. Buka **Kalkulator Nego**, pilih paket/penyedia/barang, isi harga kesepakatan sebelum PPN, dan Simpan.
3. Klik **Lihat Harga per Rincian Barang**.
4. Bandingkan **Harga Nego SEBELUM PPN**, **PPN**, **Harga Akhir** dan total penawaran.
5. Pastikan total & dokumen tetap memakai harga akhir yang benar.
