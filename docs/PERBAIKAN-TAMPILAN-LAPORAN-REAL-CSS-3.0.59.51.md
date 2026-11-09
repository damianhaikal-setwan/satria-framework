# SATRIA NEXT 3.0.59.51 — Perbaikan keseragaman Laporan dan Analisis

Tanggal 9 November 2026. Basis: ZIP lengkap SATRIA 3.0.59.50.

## Mengapa pratinjau sebelumnya bisa berbeda?

Pratinjau versi 3.0.59.50 dijalankan dalam fixture Chromium yang menampilkan grafik dengan CSS terbatas dan data simulasi. Ini **tidak menggambarkan keseluruhan halaman** yang masih menampilkan modul rekening, audit, dan RUP berurutan. Pemeriksaan dengan SELURUH stylesheet SATRIA juga memperlihatkan konflik gaya global pada teks judul header berwarna terang. Dua hal tersebut membuat klaim keseragaman pratinjau sebelumnya tidak cukup didukung.

## Perbaikan 3.0.59.51

- Satu navigasi tab di atas laporan: **Dashboard**, **Rekening anggaran**, **Kualitas data**, **Bank RUP & SPSE**. Hanya bagian yang dipilih yang ditampilkan. Semua tabel, filter, rincian, dan tombol CSV lama tetap tersedia di tab masing-masing.
- Diagram rekening dan audit membuka tab rincian yang sesuai secara otomatis. Tampilan tidak lagi menumpuk semua tabel panjang di bawah dashboard pada halaman awal.
- Tampilan seluruh bagian laporan diselaraskan: navigasi, jarak, kartu KPI, filter, tabel, border, kontras teks, tema terang/gelap, dan ponsel.
- Konflik aturan CSS global yang membuat judul hero menjadi gelap sudah ditangani dengan selector khusus halaman laporan.
- Petunjuk filter/pemilihan tab diperbaiki agar tidak menyebut tabel yang tersembunyi sebagai "di bawah".
- Cache PWA dan label versi diganti menjadi 3.0.59.51.

## Batas perubahan

Perubahan **hanya** HTML hasil render Laporan, navigasi tampilan, CSS, judul versi, dan cache PWA. Tidak mengubah data paket, HPS, pagu, RUP, hasil negosiasi, penetapan, transaksi, database, RLS, atau Edge Function. Scope OPD/tahun PPKom tetap dilindungi oleh mekanisme server SATRIA.

## Pengujian

```bash
python tools/test_laporan_integrated_real_css_20261109.py
node tools/test_laporan_rekening_20261109.cjs
node tools/test_audit_laporan_20261109.cjs
python tools/test_laporan_visual_genz_20261109.py
node tools/test_service_worker_cache.cjs
python tools/security_static_check.py
```

Pengujian visual **bukan screenshot situs produksi**. Data simulasi lokal digunakan, tetapi HTML berasal dari fungsi `vLap()` yang sungguh dipakai aplikasi dan styling mengambil seluruh stylesheet yang direferensikan `index.html` dalam urutan yang sama. Hasil uji mencakup desktop, gelap/ponsel, empat tab, drill-down rekening/audit, dan scope simulasi PPKom. Masih perlu pemeriksaan setelah deploy pada data produksi.

## Penerapan dan verifikasi

1. Upload **isi folder proyek** dari ZIP lengkap, atau salin file patch dengan struktur path identik, ke root repository GitHub.
2. Pastikan Cloudflare Pages deploy berhasil dan header SATRIA menampilkan `NEXT · 3.0.59.51`.
3. Refresh halaman; apabila masih menampilkan versi 3.0.59.50, periksa deployment GitHub/Cloudflare dan cache service worker browser.
4. Masuk menu **Laporan dan Analisis**; pada bagian awal harus terlihat empat tab dan kartu dashboard. Tekan Rekening Anggaran untuk melihat tabel yang sebelumnya bertumpuk di bawah.
5. Bandingkan angka beberapa paket nyata dan uji akses PPKom. Jangan menggunakan hasil simulasi sebagai angka laporan resmi.
