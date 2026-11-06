# SATRIA — Refactor `index.html` & Maintenance (6 November 2026)

## Ruang lingkup dan prinsip

Berdasarkan paket ZIP SATRIA versi 3.0.59.39 yang memuat revisi terbaru **Dokumen Nomor 15, perbandingan harga tayang antarpenyedia**, dilakukan refactor kode frontend tanpa mengganti aturan perhitungan, schema, isi data, atau hak akses bisnis.

- `index.html`: **1.305.226 byte → 22.542 byte** (berkurang ±98,27%).
- **34** blok JavaScript dipindahkan *apa adanya* menjadi 34 file classic script di `frontend/refactor/js/`.
- **72** blok CSS dipindahkan menjadi **22** file stylesheet berurutan di `frontend/refactor/css/`. Penamaan dan urutan berdasarkan lokasi semula; style ID lama dipertahankan sebagai penanda kompatibilitas.
- Satu blok konfigurasi `satriaEmbeddedSupabaseConfig` tetap inline, diperlukan oleh fitur **Unduh HTML Berkonfigurasi**.
- `<script>` eksternal tetap bersifat **synchronous classic script** pada posisi semula (tanpa `type=module`, `async`, atau `defer`), sehingga global symbol dan dependensi yang telah ada tidak berubah.
- Penambahan diagnostik **baca-saja**: `frontend/refactor/maintenance/diagnostics.js`. Tidak membuat perubahan database atau mengirim error ke pihak luar.
- PWA `sw.js`: seluruh aset baru tercantum dalam cache. Aktivasi SW baru dibatalkan apabila precache gagal; penghapusan cache hanya untuk nama `satria-v...`, bukan milik aplikasi lain; JS/CSS yang hilang tidak digantikan oleh HTML.

## Cara deploy GitHub

1. Cadangkan repositori dan lakukan perubahan pada branch terpisah terlebih dahulu.
2. **Unggah seluruh struktur folder** dari ZIP lengkap, atau dari patch ke root repositori (jaga jalur `frontend/refactor/...`). **Jangan hanya mengunggah `index.html`/`sw.js`** karena 56 berkas baru adalah dependensi wajib.
3. Jalankan GitHub Actions `SATRIA - pemeriksaan statis & regresi` atau uji manual setara sebelum merge.
4. Publikasikan ke staging, hard refresh aplikasi, lalu periksa navigasi, pengaturan, impor/ekspor, penawaran/negosiasi, Dokumen Nomor 15, dan login/sinkronisasi sesuai hak akses uji.
5. Setelah verifikasi staging berhasil, baru deploy ke produksi. Tidak ada SQL/migrasi Supabase baru dalam patch ini.

**Catatan:** unduhan HTML berkonfigurasi mempertahankan referensi ke file frontend. Seperti sebelum refactor (ketika 3 file JS dan 3 CSS sudah eksternal), HTML unduhan tetap membutuhkan folder frontend pendamping agar seluruh aplikasi berfungsi. Ini bukan paket mandiri satu berkas.

## Maintenance dan pemantauan error

SATRIA telah mempunyai `Ctrl + Shift + D` → **SATRIA Debug**. Dalam versi ini, panel tersebut mendapat tombol **⬇ Diagnostik** yang mengunduh `SATRIA-Laporan-Diagnostik.json`. Laporan ini berisi jumlah JS/CSS yang dirujuk, status kesiapan modul, dan ringkasan kegagalan pemuatan aset/error awal. Nama berkas saja dicatat, tanpa query URL, token, isi paket, atau isi password.

Untuk audit melalui konsol developer:

```js
window.SATRIA_MAINTENANCE.inspect()
window.SATRIA_MAINTENANCE.downloadReport()
```

Pencatatan dalam memori sesi browser dibatasi 60 peristiwa. **Tidak** ada perbaikan otomatis terhadap data bisnis, tidak ada unggahan log ke server, dan tidak ada monitoring cloud terpusat. Error perlu ditindaklanjuti developer berdasarkan laporan tersebut dan data uji yang sah.

## Pengujian yang dilakukan

- Uji kesetaraan source terhadap paket asal: **34/34** blok JavaScript identik, **72/72** konten CSS tetap ada.
- Pengujian sintaks setiap file JS: lulus.
- Uji keamanan statis: **27/27** pemeriksaan lulus.
- **10/10** pengujian Node existing lulus setelah harness dipetakan ke file baru dan assertion versi cache yang usang diperbarui.
- Tes diagnostik dan service worker berbasis Node: lulus.
- Chromium browser smoke dengan CDN/cloud eksternal di-*stub*: **34 skrip**, **22 stylesheet**, modul utama dan navigasi termuat tanpa JavaScript `pageerror`; tombol diagnostik berhasil mengunduh JSON.
- Perbandingan screenshot halaman awal pada browser uji: perubahan visual sangat kecil (sebagian kecil piksel berbeda nilai 1/255), tidak ditemukan perubahan susunan layar.

**Batasan verifikasi:** tes browser di atas tidak melakukan login Supabase sungguhan, transaksi langsung, import data produksi, real offline-install SW, atau pemeriksaan PDF untuk seluruh tipe dokumen. Uji staging dengan akun uji dan data bukan produksi tetap wajib sebelum rilis.

## Cara menguji ulang

Jalankan dari root:

```sh
python tools/test_refactor_integrity.py
python tools/security_static_check.py
python tools/test_rup_bank_contract.py
node tools/test_maintenance_diagnostics.cjs
node tools/test_service_worker_cache.cjs
for f in tools/test*.js; do node "$f"; done
# opsional; memerlukan Python playwright + Chromium:
python tools/test_refactor_browser.py
```

## Langkah pengembangan selanjutnya (bukan bagian patch ini)

Isolasi global business logic ke registry/API formal dan pemisahan storage, UI, dan core menjadi ES modules memerlukan kontrak dependensi serta uji integrasi tambahan. Karena tahap ini berorientasi **tanpa regresi**, sumber JS dipisah sesuai blok asli, bukan ditulis ulang ke ES modules dengan risiko mengubah perilaku transaksi atau sinkronisasi. Pemindahan 34 modul adalah landasan untuk pengembangan lanjutan tersebut.
