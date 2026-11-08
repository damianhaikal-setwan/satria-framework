# SATRIA — Perbaikan Pembulatan PPN Negosiasi (8 November 2026)

## Masalah dan angka acuan

Pada aplikasi lama, **Kalkulator Nego** membulatkan PPN per satuan sebelum volume dikalikan. Contoh dari tampilan INAPROC:

| Uraian | Nilai |
|---|---:|
| Harga kesepakatan sebelum PPN per unit | Rp449 |
| Volume | 4.849 unit |
| Tarif simulasi PPN efektif | 11% |
| Total dasar pajak | Rp2.177.201 |
| PPN atas total dasar pajak, dibulatkan | Rp239.492 |
| **Total negosiasi termasuk PPN** | **Rp2.416.693** |

Kode lama: `449 + round(449 * 11%) = 498` per unit, sehingga `498 * 4.849 = Rp2.414.802` — selisih **Rp1.891**.

Kode baru: PPN per unit **Rp49,39**, bruto per unit **Rp498,39**; volume dikalikan dengan **angka pecahan**, kemudian total dibulatkan satu kali ke rupiah: `round(498,39 * 4.849) = Rp2.416.693`.

## Bagian yang diperbaiki

1. **Kalkulator Negosiasi Harga**: perhitungan PPN bertarif otomatis menggunakan presisi dua desimal pada tingkat unit. Input Rp449 dan perlakuan efektif 11% tetap seperti sebelumnya. Pengguna **tidak perlu mencari opsi baru**.
2. **Pratinjau dan saran harga**: nominal pajak dan harga bruto per unit menampilkan pecahan sen bila ada; simulasi total menggunakan volume × bruto tepat sebelum pembulatan.
3. **Penyimpanan**: `penawaran.nego[itemId]` tetap nominal bruto seperti sebelumnya tetapi dapat memuat hingga dua desimal, misalnya `498.39`. Detail netto/PPN tersimpan dalam `negoDetails[itemId]`. Data lama berangka bulat tidak diubah atau dimigrasi.
4. **Penawaran dan dokumen**: komponen bruto/PPN per unit dan subtotal tampil konsisten, rekap harga menggunakan pembulatan di total transaksi; terbilang dokumen Kertas Kerja Nego disesuaikan dengan total rupiah yang ditampilkan.
5. **PWA**: versi cache dinaikkan agar browser mengambil JavaScript terbaru setelah deployment.

## Batas cakupan

- Perbaikan ini **mengikuti pola perhitungan yang ditunjukkan pada contoh tangkapan layar**. Transaksi INAPROC lainnya mungkin menggunakan tarif pajak, dasar pengenaan pajak, pembulatan, diskon, ataupun ongkir yang berbeda; cocokkan lagi dengan bukti transaksi resmi.
- Perhitungan baru **tidak otomatis mengubah harga negosiasi yang telanjur disimpan**. Untuk item yang sebelumnya tersimpan Rp498/unit, buka Kalkulator Nego, masukkan ulang Rp449 sebelum PPN, lalu simpan item itu setelah verifikasi dengan e-Katalog.
- Modul tetap membatasi hak pengguna sesuai izin asli. Tidak ada penambahan data tabel SQL, Edge Function, atau perubahan role.
- Harga, total, dan status penetapan tetap memerlukan verifikasi pengguna; ini simulasi yang tidak mengubah transaksi di INAPROC.

## Uji dan pemasangan

Jalankan dari direktori root proyek:

```sh
node tools/test_nego_ppn_rounding_inaproc_20261108.cjs
node tools/test_nego_net_349.js
node tools/test_navigation_survey_winner_350.js
node tools/test_service_worker_cache.cjs
python tools/test_refactor_integrity.py
```

Unggah ZIP lengkap ke GitHub atau timpa hanya file pada patch; deploy ulang Cloudflare Pages. Jika aplikasi sudah dibuka sebelum deployment, tutup/buka ulang atau refresh halaman untuk mendapatkan cache PWA baru. Tidak perlu deploy ulang Supabase untuk perubahan ini.
