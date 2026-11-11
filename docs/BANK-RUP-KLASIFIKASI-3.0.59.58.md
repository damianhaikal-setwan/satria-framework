# SATRIA NEXT 3.0.59.58 — Bank RUP & klasifikasi paket

## Tujuan

Menjaga agar informasi **jenis pengadaan** dan **metode pengadaan** dari SiRUP tidak diisi berdasarkan dugaan. Ini penting untuk menentukan alur dokumen E-Purchasing vs Pengadaan Langsung. Aplikasi tidak mengubah data produksi secara otomatis atau membuat approval baru.

## Perubahan

- Kartu Bank RUP menampilkan **Jenis** dan **Metode** secara terpisah, dengan penanda **Perlu verifikasi** jika kosong/asing. Pencarian juga mencakup jenis.
- Terdapat formulir **Periksa / koreksi jenis & metode RUP** pada setiap kartu. Perubahan ditulis **hanya saat tombol Simpan klasifikasi** diklik dan mengikuti kontrol hak akses serta transaksi SATRIA.
- Saat impor JSON berbentuk `data: [{id, paket, pagu, satuanKerja, pemilihan, ...}]`, `aaData` tujuh kolom, atau format internal, kolom yang tidak tersedia **tetap kosong**. `jenisBelanja` tidak otomatis dijadikan `jenisPengadaan` karena maknanya belum terkonfirmasi.
- Pratinjau impor memperlihatkan jenis/metode dan jumlah baris tanpa klasifikasi. Impor ulang tidak menghapus klasifikasi yang telah ada jika sumber tidak mengirim kedua kolom.
- RUP manual tidak lagi menetapkan `Barang` dan `E-Purchasing` secara diam-diam. Saat membuat paket E-Purchasing maupun catatan SPSE dari Bank RUP, kategori yang kosong tetap kosong sehingga harus diperiksa operator.
- Data Paket menampilkan pilihan **Perlu verifikasi sumber**. Modul dokumen tidak menganggap kategori konstruksi/konsultansi memiliki template final Barang/Jasa Lainnya. Hasil cetak yang memerlukan metode tidak lagi menampilkan tebakan E-Purchasing.
- Paket lama, nilai pagu, HPS, penetapan, data autentikasi, data master, dan referensi RUP **tidak dimigrasi/ditimpa massal**.

## Penggunaan

1. Buka **Input RUP** → **Bank RUP**.
2. Cari kode RUP yang ingin diperiksa. Lihat label **Jenis** dan **Metode**.
3. Bila perlu, buka **Periksa / koreksi jenis & metode RUP**.
4. Bandingkan dengan jenis/metode pada sumber SiRUP resmi, pilih, dan klik **Simpan klasifikasi Bank RUP**.
5. Jika RUP sudah dipakai sejumlah paket, periksa juga masing-masing **Data Paket**; sistem tidak mengubah klasifikasi historis paket secara otomatis.
6. Saat impor JSON, jalankan **Periksa data** sebelum menyimpan. Baris tanpa jenis/metode tetap dapat diimpor sebagai **Perlu verifikasi**.

## Batasan dan keselamatan

- Versi ini belum bisa diverifikasi terhadap contoh JSON terbaru pengguna, karena berkas JSON belum tersedia sebagai lampiran dalam sesi build. Format impor diuji terhadap *fixture sintetis* `data` dan `aaData` yang sudah dikenali dari source. Pemetaan alias tambahan harus dibuktikan pada contoh sebenarnya, bukan diasumsikan.
- Informasi **Perlu verifikasi** bukan prosedur approval; Pejabat Pengadaan tetap bertanggung jawab menggunakan sumber resmi dan wewenangnya.
- Klasifikasi lama yang sebelumnya terisi otomatis mungkin tidak bisa dibedakan dari yang dipilih sengaja. Karena itu aplikasi memberikan pengingat pada data impor lama, tanpa menulis ulang nilainya.
- Tidak ada tabel, SQL, login, plugin, atau database tambahan. Perubahan tersimpan pada objek Bank RUP yang memang disinkronkan SATRIA.
- Jalankan uji staging dengan data SiRUP nyata (tanpa token/kredensial), akun Admin/Operator/Viewer, dan satu paket per metode sebelum memperbarui produksi.
