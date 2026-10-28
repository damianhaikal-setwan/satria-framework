# SATRIA NEXT • Brand & Interface 3.0.46

## Arah identitas
Identitas utama tetap SATRIA. Edisi visual NEXT menyatukan navigasi, dashboard, paket, RUP, kalkulator, data master, laporan, pengaturan, bantuan, dan Document Studio menggunakan violet elektrik, lime, navy, dan cyan. Tidak ada perubahan pada struktur data atau aturan perhitungan.

## Desain
- Brand wordmark: **SATRIA NEXT**; simbol **S** dengan warna lime di atas navy.
- Palet: Navy `#1b1736`, Violet `#6756f8`, Lime `#ddfa71`, Cyan `#80e5ff`, Background `#f4f2fb`.
- Font antarmuka: Plus Jakarta Sans untuk heading dan Inter untuk informasi/aksi; angka menggunakan tabular numerals.
- Interaksi: fokus keyboard jelas, kontrol mobile mudah disentuh, menu mobile tetap dengan tombol buka/tutup, serta `prefers-reduced-motion`.
- Dokumen resmi: tidak di-rebrand. 14 template, Arial, A4, layout BAHP/Reviu DPP, dan mesin cetak dipertahankan.

## Catatan teknis
CSS rebrand ditambahkan paling akhir sebagai `#satria-next-brand-346`, dibatasi `@media screen`. Ini menyatukan lapisan CSS dari versi terdahulu tanpa mengubah generator dokumen atau model data. PWA cache diperbarui dan berkas ikon disesuaikan.

## Pemeriksaan
- 19 skrip inline lulus `node --check`.
- Pratinjau HTML statis melalui Chromium pada 1440px dan 390px, tanpa pelebaran horizontal.
- Pengujian fungsi lengkap, sinkronisasi produksi, dan cetak PDF dengan data operasional tetap perlu dilakukan sebelum rilis penuh.
