# SATRIA NEXT 3.0.50 — Navigasi Kalkulator, Smart Survey, dan Penetapan Penyedia

Dibangun dari SATRIA NEXT 3.0.49 dengan menjaga data paket, kalkulasi netto/bruto, 14 template dokumen, serta CSS cetak A4/Arial.

## Perubahan

1. **Navigasi dua arah:** dari Penawaran & Negosiasi ke Kalkulator Nego (sudah tersedia) dan dari Kalkulator Nego kembali ke panel Penawaran & Negosiasi (tombol di atas dan bawah). Paket/penyedia yang dipilih tetap aktif, dan usulan yang belum disimpan memunculkan konfirmasi.
2. **Smart Survey hanya untuk survei:** bidang negosiasi sebelum pajak, pajak hasil negosiasi, pilihan pajak simulasi negosiasi, dan tombol Hitung Negosiasi dihapus dari Smart Survey. Sekarang Smart Survey menyimpan nama produk, URL, foto, spesifikasi, penyedia, harga tayang, dan komponen pajak tayang. Simpan Smart Survey **tidak menimpa atau menghapus** `penawaran.nego`, `penawaran.negoDetails`, maupun rincian negosiasi yang sebelumnya tercatat pada referensi katalog.
3. **Penetapan penyedia:** tombol **Tetapkan pemenang** ditonjolkan pada kartu masing-masing penyedia, status terpilih muncul setelah penetapan valid. Sistem meminta konfirmasi sebelum penetapan atau perubahan pemenang. Tombol nonaktif bila persyaratan belum terpenuhi. Semua penetapan tetap menggunakan validasi `satriaOfferGate`.
4. **Validasi tambahan:** hasil negosiasi dibandingkan dengan HPS dan pagu; jika harga akhir unit melebihi harga tayang terbaru, penetapan ditahan. Perubahan harga tayang di Smart Survey tidak otomatis mengganti hasil kesepakatan lama.

## Prinsip perhitungan

- Kolom **Harga Nego** dalam tabel Penawaran & Negosiasi = **usulan SEBELUM PPN/unit** dari Kalkulator Nego.
- Total hasil negosiasi dan dokumen menggunakan harga akhir/unit **termasuk PPN** yang tersimpan pada `penawaran.nego`.
- Smart Survey tidak lagi menghitung atau menyimpan hasil kesepakatan.
- Penetapan penyedia adalah tindakan manual pengguna berwenang, bukan rekomendasi otomatis sistem.

## Pengujian

- Sintaks seluruh 19 skrip JavaScript inline lulus `node --check`.
- Pengujian kontrak: harga survei baru tidak menimpa hasil nego yang sudah ada; gate menolak hasil nego melebihi harga tayang/pagu; tombol penetapan dan navigasi tampil pada HTML generator.
- Pratinjau terisolasi diuji pada lebar 390 dan 1440 px; tidak ditemukan pelebaran horizontal halaman.
- **Belum teruji:** siklus penuh menggunakan Supabase produksi, pengujian nyata iPhone Safari, dan pemulihan backup saat database aktif.

## Cara uji

1. Backup JSON SATRIA sebelum memperbarui aplikasi.
2. Masuk ke Paket Pengadaan → Penawaran & Negosiasi → Kalkulator Nego penyedia terkait.
3. Simpan hasil negosiasi satu barang. Kembali menggunakan **Lihat Harga per Rincian Barang**. Harga Nego harus sama dengan usulan **sebelum PPN**; PPN dan harga akhir tetap terpisah.
4. Buka Smart Survey, edit nama/harga tayang, lalu simpan. Pastikan harga nego barang tersebut tidak berubah.
5. Lengkapi persyaratan penetapan, klik **Tetapkan pemenang**, konfirmasi, periksa badge **Penyedia ditetapkan**. Jika belum lengkap, tombol nonaktif dan pesan kebutuhan perbaikan tampil.

Penetapan di aplikasi tidak menggantikan keputusan serta verifikasi bukti oleh pejabat berwenang.
