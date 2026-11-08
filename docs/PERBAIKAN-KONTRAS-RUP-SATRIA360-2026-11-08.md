# Perbaikan Kontras Nomor RUP — SATRIA 360 (8 November 2026)

## Masalah

Label `RUP ...` pada kartu **Agenda cepat • tindak lanjut** dan **Daftar paket • 360° view** mewarisi warna hijau muda dari header berlatar gelap. Di tema terang, teks tersebut nyaris tidak terbaca karena latar kartu sangat terang.

## Perubahan

- `frontend/satria-next4.css`: warna `.s4-rowcard .s4-kicker` di tema terang dibuat ungu tua `#4338ca`; pada tema gelap tetap hijau muda `#d9f99d`.
- Selektor **hanya berlaku pada kartu SATRIA 360**. Kicker di hero dan header modul tetap memakai warna semula.
- `sw.js`: nama cache PWA dinaikkan agar stylesheet terbaru bisa diambil saat versi baru dipasang.
- Tidak ada perubahan pada JavaScript bisnis, database, dokumen, atau mekanisme transaksi.

## Pengujian

Jalankan dari akar repositori:

```sh
python tools/test_satria360_rup_contrast_browser_20261108.py
node tools/test_next4_foundation.js
node tools/test_service_worker_cache.cjs
node tools/test_supplier_catalog_source_20261108.js
python tools/security_static_check.py
```

Tes browser menggunakan stylesheet asli `index.html` dengan urutan yang sama; pengujian Chromium memberikan kontras **7,43:1** pada kartu terang (`#f8f7ff`) dan **13,04:1** pada kartu gelap (`#25223f`). Keduanya melampaui ambang WCAG AA **4,5:1** untuk teks normal.

## Penerapan

Untuk pembaruan repository yang telah memakai patch sumber/bukti harga penyedia sebelumnya, cukup unggah file CSS dan `sw.js` dari patch ini. Dokumen dan tes bersifat pendukung. Setelah deployment, muat ulang aplikasi; jika masih tampil dari cache PWA lama, tutup/buka aplikasi lalu muat ulang.
