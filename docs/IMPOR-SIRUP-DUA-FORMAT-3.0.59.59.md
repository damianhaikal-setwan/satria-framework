# SATRIA NEXT 3.0.59.59 — Impor dua format JSON SiRUP

## Dasar pengembangan

Pengujian terhadap dua contoh JSON SiRUP yang diterima 11 November 2026:

- `data`: 43 objek dengan `id`, `paket`, `pagu`, `metode`, `jenisPengadaan`, `satuanKerja`, `sumberDana`, `lokasi`, `pemilihan`, dan ID referensi lainnya.
- `aaData`: 43 array tujuh kolom, dengan urutan `[kode RUP, nama paket, pagu, metode, sumber dana, kode RUP, bulan pemilihan]`.
- Kedua berkas berisi **43 kode RUP yang sama**. Nama paket, pagu, metode, sumber dana, dan bulan pemilihan cocok pada 43 pasang RUP. Jangan menjumlahkannya menjadi 86 RUP.
- Pada berkas ini, kode metode 8 = Pengadaan Langsung, 9 = E-Purchasing, 16 = Dikecualikan. Jenis pengadaan pada berkas lengkap mencakup Barang, Jasa Lainnya, Pekerjaan Konstruksi, dan Jasa Konsultansi. Kode tersebut merupakan observasi pada berkas contoh, bukan dasar untuk menebak label bila sumber lain tidak mengirimkannya.

## Perbaikan yang diterapkan

1. `Dikecualikan` dikenali sebagai metode SiRUP valid dalam Bank RUP dan Data Paket. Ini **bukan** E-Purchasing maupun Pengadaan Langsung, sehingga tidak diberi generator khusus kedua metode tersebut.
2. Layar impor menjelaskan perbedaan format `data` lengkap vs `aaData` ringkas. Peringatan muncul pada pratinjau.
3. `aaData` tidak menyediakan `jenisPengadaan` atau `satuanKerja`. SATRIA tidak menebaknya dari judul atau nilai pagu. OPD tujuan harus dipilih dan diverifikasi oleh operator.
4. Impor `data` lengkap membaca `jenisPengadaan` dan `metode` eksplisit. Impor file lengkap setelah file ringkas menggunakan opsi **Perbarui RUP yang sudah ada** hanya menambahkan klasifikasi yang memang ada di sumber. Paket pengadaan lama tidak diubah otomatis.
5. Kolom `lokasi` pada contoh lengkap menunjuk wilayah administratif; tidak lagi otomatis dianggap alamat pengiriman. Tulis alamat rinci pada Data Paket ketika benar-benar diketahui.
6. `pemilihan` adalah bulan rencana pemilihan, **bukan bukti tanggal mulai proses resmi** untuk ketentuan transisi PBJ 2026. Sesuaikan tahun anggaran dan tanggal proses terhadap dokumen resmi.
7. Tidak ada SQL, tabel, akun, atau approval tambahan. Bank RUP, paket lama, HPS, nilai penetapan, dan pengendalian pagu dipertahankan.

## Prosedur aman saat impor

1. Cadangkan data dan verifikasi akun, OPD tujuan, serta tahun anggaran.
2. Di menu **Input RUP → Bank RUP**, gunakan JSON **`data` lengkap** sebagai pilihan utama.
3. Klik **Periksa data** dan tinjau 43 baris serta klasifikasi, pagu, OPD, dan tahun.
4. Jika RUP sudah ada dari impor `aaData`, pilih **Perbarui RUP yang sudah ada**. Periksa perubahan sebelum menyimpan; jangan mengimpor berulang sebagai paket terpisah.
5. Jika sumber hanya `aaData`, klasifikasi jenis tetap **Perlu verifikasi**. Jangan memilih generator dokumen final hingga jenis pengadaan tersedia dari sumber resmi.
6. Untuk Jasa Konsultansi, jenis umum dari SiRUP belum menjelaskan secara pasti konstruksi/nonkonstruksi atau bentuk penyedia perorangan/badan usaha. Pemilihan template khusus tetap perlu diverifikasi di Data Paket.
7. Periksa ulang paket yang sudah dibuat dari RUP sebelum pembaruan. SATRIA sengaja tidak menimpa isi paket lama ketika Bank RUP diperbarui.

## Batas uji

Pengujian dilakukan dengan contoh JSON asli melalui kode parser lokal dan uji browser dengan data simulasi. Belum diuji dengan Supabase produksi/akses pengguna nyata dan belum dilakukan deploy. Hasil lokal tidak menggantikan penilaian aturan resmi atau pemeriksaan kewenangan Pejabat Pengadaan.
