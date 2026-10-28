# SATRIA NEXT 3.0.59.2 — Perapian Tanda Tangan dan Cap PPK DPP

## Berdasarkan hasil cetak dan contoh pengguna
- **Masalah**: tanda tangan tampil sangat lebar di sebelah kiri, stempel terdorong ke kanan, keduanya tidak tertata di atas nama PPK.
- **Target**: contoh menunjukkan **cap di kiri** dan **tanda tangan di kanan** dengan tumpang tindih ringan; kedua gambar di atas nama/NIP pejabat.

## Perbaikan dalam aplikasi
1. Khusus generator **Dokumen Persiapan Pengadaan (DPP)**, cap sekarang digambar lebih dulu di sisi kiri dan TTD di sisi kanan. Keduanya berada di **wadah posisi relatif berukuran 73 mm × 22 mm**, sehingga file dengan ukuran piksel berbeda tetap mengikuti batas cetak yang sama.
2. Ukuran tampilan cap dibatasi menjadi **24 mm × 22 mm**; gambar TTD **55 mm × 20 mm**. Posisi TTD mulai 18 mm dari kiri untuk menciptakan tumpang tindih tanpa melampaui lebar wadah.
3. Gambar memakai `object-fit: contain` serta `mix-blend-mode: multiply`, yang membantu mempertahankan garis TTD ketika sumber gambar berlatar putih menumpuk di atas stempel.
4. Jika hanya salah satu gambar tersedia, gambar tunggal ditempatkan rapi. Jika keduanya kosong, ruang tanda tangan tetap disediakan.
5. Nama, NIP, OPD, tempat, tanggal, dan dropdown pemilihan PPK tetap mengikuti data yang sudah disimpan. **Tidak ada TTD atau cap buatan.**
6. Gambar tetap berasal dari **Data Master** / Supabase Storage privat versi sebelumnya; tidak ada perubahan schema atau kebijakan akses.
7. Aturan CSS scoped ke `data-document-type="dpp"` supaya **BAHP, Reviu DPP, dan dokumen lain tidak terpengaruh**.

## Pengujian
- **22** skrip inline HTML lulus `node --check`.
- Unit test DPP 3.0.59.2 lulus: urutan cap/TTD, tata letak, PPK sesuai OPD, pemilihan PPK lain, kondisi gambar tidak lengkap.
- Uji Chromium PDF terisolasi: **A4 100%**, cap di kiri dan TTD kanan, tidak keluar dari bidang 73 × 22 mm, nama/NIP tidak tertabrak.
- Pengujian regresi: Smart Survey PRO 3.0.59, navigasi/penetapan pemenang, dan kalkulasi harga Smart Survey 3.0.55 lulus.
- **Belum diuji** melalui Safari dan Supabase Production menggunakan file TTD/stempel asli yang ada dalam akun pengguna.

## Cara deploy
1. Backup JSON SATRIA.
2. Extract ZIP GitHub 3.0.59.2 dan salin seluruh isinya ke root repo GitHub Pages (bukan folder pembungkus).
3. Commit perubahan, tunggu deploy Pages selesai, lalu lakukan hard refresh agar Service Worker baru aktif.
4. Buka **Dokumen Pengadaan → DPP**, pilih PPK di dropdown, kemudian pratinjau dan **Cetak / Simpan PDF** pada skala **100%** A4.
5. Periksa kecocokan hasil cetak dengan contoh: cap kiri, TTD kanan, semuanya di atas nama.

**SQL baru: tidak ada.** Tidak perlu menjalankan ulang migrasi Storage atau draft cloud yang sebelumnya sudah dipasang. SQL lama di folder repo hanya untuk pemasangan baru.
