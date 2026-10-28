# SATRIA NEXT 3.0.53 — Perbaikan DPP dan Foto Smart Survey

## Perubahan
1. Pada lampiran DPP, judul kini persis **LAMPIRAN REFERENSI FOTO PRODUK**. Lampiran Survei Harga dan RFI tetap memakai judulnya masing-masing.
2. Penataan cetak DPP khusus A4, Arial dan skala CSS 100% tanpa transform/zoom-to-fit. Isi DPP dibuat lebih ringkas (9,7 pt) agar tanda tangan tidak terpisah dari penutup jika cukup ruang. Format 13 dokumen lain tidak diubah.
3. Smart Survey memiliki tombol **Hapus foto produk** per barang dan per penyedia. Tindakan dikonfirmasi lalu hanya mengosongkan `catalogRefs[itemId].imageUrl`. Nama produk, harga tayang, pajak, hasil nego dan dokumen lain tetap memakai data semula. Tindakan tersinkron menggunakan alur penyimpanan yang sudah ada.
4. Jika sumber gambar eksternal gagal dimuat, lampiran menampilkan keterangan kegagalan, bukan gambar contoh buatan.

## Pengujian
- Sintaks 20 JavaScript inline: lulus.
- Penghapusan foto melalui UI Chromium terisolasi: lulus; data harga/negosiasi terjaga; penyimpanan ulang tidak memunculkan gambar yang dihapus.
- DPP uji menggunakan struktur data setara PDF referensi: 3 halaman pada Chromium A4 skala=1: isi DPP dua halaman dengan tanda tangan bersama Penutup, lampiran satu halaman. Ini bukan jaminan hasil identik di seluruh printer atau browser.
- Seluruh penyimpanan Supabase dan backend tidak diubah.

## Saat Save PDF
- Ukuran kertas **A4**, skala **100%**, margin mengikuti CSS, opsi **headers/footers browser** tidak aktif, background graphics aktif jika diperlukan.
- Safari/Chrome mengendalikan pengaturan skala pada dialog cetak. Halaman HTML tidak dapat memaksa opsi skala browser, tetapi CSS tetap menetapkan ukuran fisik A4.
- Jika gambar berasal dari URL luar dan tidak tampil ketika PDF dicetak, unggah foto PNG/JPG/WEBP langsung ke Smart Survey.
