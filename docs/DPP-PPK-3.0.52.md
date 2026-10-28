# SATRIA NEXT 3.0.52 — DPP / PPK / Tanda Tangan / Cap

Dibangun di atas SATRIA NEXT 3.0.51. Bagian lain dari aplikasi tidak dirancang untuk diubah.

## Perbaikan
1. Bagian akhir DPP menampilkan tempat penandatanganan dari Pengaturan Sistem → OPD → Tempat Pelaksanaan. Jika kosong/tidak sah, gunakan kota Pemda yang valid; jangan gunakan placeholder “Kota Contoh”.
2. Menu Dokumen Pengadaan → DPP memiliki pilihan PPK penandatangan dari Data Master → PPK/KPA, hanya PPK pada OPD paket terkait.
3. Pilihan PPK DPP disimpan pada paket (`dppPpkId`) dan tidak mengubah PPK paket untuk dokumen lainnya.
4. Tanda tangan dan cap yang diunggah di Data Master ditampilkan di atas nama PPK pada DPP. Jika belum ada gambar, ruang tanda tangan dibiarkan kosong agar dapat ditandatangani manual.
5. Pemeriksaan DPP menandai identitas PPK, gambar yang belum tersedia, dan tempat yang belum dikonfigurasi.

## Pengujian
- 22 skrip inline lolos sintaks JavaScript.
- 9 uji perilaku terisolasi lulus: tempat, fallback, OPD, pergantian penandatangan, gambar, dan data yang tidak tersedia.
- Browser end-to-end / cetak PDF pada Safari dan data nyata masih perlu diverifikasi.

## Penggunaan
1. **Pengaturan Sistem**: isi tempat pada OPD terkait (misalnya Putussibau).
2. **Data Master → PPK/KPA**: tambahkan PPK pada OPD tersebut; gunakan Edit untuk upload gambar TTD dan Cap masing-masing (maks 300 KB per gambar).
3. **Dokumen Pengadaan**: pilih paket, lalu pilih **8. DPP**.
4. Pilih PPK penandatangan pada panel khusus DPP. Pilihan tersimpan otomatis secara lokal dan masuk alur sinkronisasi paket.
5. Periksa tampilan nama, NIP, gambar TTD/Cap dan tempat sebelum **Cetak / Simpan PDF**.

Backup data JSON sebelum memperbarui; perubahan skema tabel SQL Supabase tidak diperlukan karena atribut tambahan disimpan sebagai field JSON paket. Jika server membatasi atribut, validasi kembali data hasil sinkronisasi.
