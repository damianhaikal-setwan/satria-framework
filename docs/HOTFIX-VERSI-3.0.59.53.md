# SATRIA NEXT 3.0.59.53 — Hotfix Label Versi dan Cache PWA

**Tanggal:** 11 November 2026  
**Jenis:** hotfix dari 3.0.59.52; tanpa migrasi SQL.

## Penyebab

Dalam paket 3.0.59.52, `index.html` sudah berlabel versi baru, namun fungsi `render()` pada `frontend/refactor/js/01-app-core.js` menulis ulang header menjadi `3.0.59.44`. Banner ringkasan juga masih memuat `3.0.59.39`, dan pengubah judul tab browser menulis `3.0.59.39`. Karena itu screenshot setelah commit tidak dapat dipakai sebagai bukti tunggal bahwa deployment gagal.

## Koreksi

- Tambahkan metadata versi rilis `meta[name="satria-release-version"]` sebagai sumber untuk tampilan runtime.
- Header aplikasi, banner Ringkasan Utama dan judul tab mengambil versi dari metadata tersebut.
- Samakan `index.html`, `manifest.json`, hasil audit dokumen, pengujian aset, dan kunci cache `sw.js` menjadi `3.0.59.53`.
- Pertahankan seluruh perubahan PBJ 2026 versi 3.0.59.52, tanpa mengubah kalkulasi atau struktur database.

## Cara pasang

1. Pastikan tidak ada modifikasi lebih baru di GitHub main yang akan tertimpa; bandingkan sebelum mengganti file.
2. Cadangkan commit/main dan data penting.
3. Unggah **isi** folder `satria-framework-main/` ke root repositori, bukan folder pembungkusnya. Jangan hanya mengganti `index.html`: unggah juga JS, SW, manifest, dan file lain yang berubah.
4. Setelah deployment selesai, buka aplikasi di jendela Private/Incognito dan periksa label `3.0.59.53` pada header dan Ringkasan. Periksa juga modul PBJ 2026, login, paket, dan sinkronisasi.
5. Bila versi masih lama, periksa commit deployment, cache PWA/service worker dan tab lama; **jangan hapus IndexedDB/data browser** untuk memperbaiki label versi.

**Batas verifikasi:** Tes statis/lokal bukan pengujian koneksi Supabase produksi atau validasi dokumen resmi.
