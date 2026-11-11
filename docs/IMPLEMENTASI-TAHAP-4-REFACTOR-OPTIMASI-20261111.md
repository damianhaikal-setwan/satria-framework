# SATRIA NEXT 3.0.59.59 — Tahap 4: Refactoring bertahap, optimasi dan UX responsif

Tanggal: 11 November 2026  
Basis: `SATRIA_NEXT_3.0.59.59_TAHAP3_INTI_TERPADU.zip`  
Status: **implementasi selesai dalam salinan kode; pengujian statis, Node dan browser lokal lulus; belum disertifikasi produksi**.

## Tujuan dan batasan

Memisahkan sebagian tanggung jawab dari dua berkas besar, mengurangi CSS salinan, memperbaiki pengelolaan event dan aksesibilitas di perangkat mobile, serta menjaga perilaku Bank RUP → Paket → HPS → Negosiasi → Dokumen dan Sampah Tahap 1–2. **Tidak ada perubahan skema data atau migrasi SQL baru; tidak ada verifikasi/persetujuan berjenjang baru.** Operasi Supabase staging/produksi tidak dilakukan.

## Perubahan source code

1. `frontend/satria-document-templates.js` (baru): menempatkan fungsi pembentuk template dokumen yang sebelumnya berada di `frontend/refactor/js/01-app-core.js`. `DOCS` dan fungsi template tetap berada di global classic-script yang kompatibel dengan aplikasi lama. Controller dan template kini terpisah; **belum** menjadi modul ES mandiri atau paket yang dapat dimuat secara asinkron.
2. `frontend/satria-view-performance.js` (baru): memisahkan virtualisasi paket, lazy-image, pratinjau Dokumen, dan `vDokOptimized` dari `frontend/refactor/js/05-cloud-sync.js`. Pemuatan ditempatkan **setelah** kode cloud, sehingga urutan runtime tidak berubah secara tidak sengaja.
3. `frontend/satria-shared-modal-ui.css` (baru): aturan CSS besar yang diulang pada tiga modal akun dijadikan **satu stylesheet**. CSS unik per modal tetap berada pada modal masing-masing. Pengurangan duplikasi sumber sekitar **38 KB** (dua salinan CSS 19.153 byte), sebelum kompresi.
4. `frontend/satria-stage4-ux.css` (baru): fokus keyboard yang jelas, touch-action `manipulation` tanpa membatasi pinch zoom, penyesuaian tombol dan baris Sampah pada lebar ponsel, serta pengurangan animasi bagi pengguna yang meminta *reduced motion*.
5. Performa & ketahanan: listener scroll daftar paket tidak ditambahkan berulang ketika komponen yang sama dirender kembali (`WeakSet`). Teks kepala tabel virtual yang dibangun dari `textContent` kini melalui `esc()` sebelum dimasukkan ke HTML. Tautan ID Paket dalam tampilan daftar di-escape.
6. Pratinjau dokumen panjang: tabel asli tetap berada di dokumen sebagai tabel semantik yang disembunyikan secara **visual**, sedangkan virtual preview diberi `aria-hidden`. Mode cetak menyembunyikan versi virtual dan menampilkan **seluruh** tabel asli. Keterangan yang sebelumnya mengklaim penghematan `80% DOM` diganti sebab jumlah DOM asli memang masih ada.
7. Keterjangkauan mobile: perilaku legacy yang memanggil `preventDefault()` terhadap tap ganda dan mengubah meta viewport ke `maximum-scale=1` dihapus. Pengguna tetap dapat melakukan pinch zoom.
8. Pertahanan tampilan gambar: atribut `src` tanda tangan dan stempel pada helper cetak `sig` memakai sanitasi `satriaSafeMediaSrc`, bukan string sumber tanpa filter.
9. `index.html` dan `sw.js` diperbarui untuk pemuatan script/style baru dan identitas cache Tahap 4. Pemetaan 34 script historis dan 24 CSS historis tetap dipertahankan supaya kontrak yang sudah ada tidak rusak.
10. Adapter test HTML lama pada `tools/legacy_index_source.py` dan `.cjs` memperluas inlining file baru; dua tes unit disesuaikan membaca fungsi yang kini berpindah file. Logika kalkulasi, pajak, data, dan generator tidak diubah untuk meloloskan tes.

## Ukuran kode — terukur, bukan perkiraan kecepatan

| Komponen | Tahap 3 | Tahap 4 | Perubahan |
|---|---:|---:|---:|
| `01-app-core.js` | 439.301 B | 358.864 B | -80.437 B (-18,3%) |
| `05-cloud-sync.js` | 205.071 B | 120.803 B | -84.268 B (-41,1%) |
| Empat file modul/CSS baru | 0 B | 128.295 B | +128.295 B |
| **Gabungan enam berkas terkait** | **644.372 B** | **607.962 B** | **-36.410 B (-5,7%)** |

Angka merupakan byte sumber mentah, **bukan** pengukuran waktu muat/performa jaringan. Pemecahan menambah dua permintaan skrip dan dua stylesheet, yang telah masuk cache PWA. Performa perangkat nyata masih memerlukan benchmark cold-load, memori, dan interaction latency.

## Pengujian dan cakupan

- **33/33 skrip pengujian Node lulus** termasuk satu kontrak modularisasi Tahap 4 baru, perhitungan HPS, PPN e-Katalog, Bank RUP, Sampah lokal/cloud, audit dokumen, dan Service Worker.
- **11/11 skrip browser lokal lulus** dengan Chromium: pemuatan berkas terpisah, Bank RUP, HPS dan dokumen, kebijakan data, Analisis Harga, Sampah lokal, Sampah cloud **tiruan**, dan pengujian Tahap 4.
- Pada QA Tahap 4: 14+ template dokumen tersedia; navigasi `#sampah` bekerja; listener `scroll` baru untuk viewport yang sama hanya dipasang satu kali; untuk dokumen sintetis 30 baris, versi visual dan tabel semantik ada, versi visual tersembunyi saat cetak sedangkan tabel asli tetap tampil; lebar layar 390 px lulus.
- `tools/test_refactor_integrity.py`, `tools/test_rup_bank_contract.py`, dan `tools/test_service_worker_cache.cjs` lulus. Script lama yang berbasis *virtual single-file HTML* perlu memuat file baru melalui adaptor kompatibilitas.

**Pengujian browser ini menggunakan CDN dan transport Supabase tiruan, data sintetis, serta inspeksi DOM/CSS.** Tidak ada uji transaksi PostgreSQL atau RLS nyata, tidak ada pengukuran web-vitals kuantitatif di ponsel fisik, dan tidak ada pernyataan bahwa dokumen pengadaan memenuhi semua kewajiban hukum.

## Risiko dan pekerjaan yang belum diselesaikan

1. Validasi Supabase nyata (RLS, RPC arsip/pulih atomik, isolasi OPD/tahun, rollback transaksi, perubahan bersamaan, dan lintas perangkat) **tetap wajib** sebelum produksi; migrasi Tahap 2 tidak dijalankan dalam pekerjaan ini.
2. `01-app-core.js` **masih ~359 KB** dan berisi banyak state/event/HTML template; `05-cloud-sync.js` **masih ~121 KB** dan masih mengurus Auth, akun, penugasan OPD/tahun, snapshot dan sinkronisasi. Refactor Tahap 4 **belum** pemisahan komprehensif semua controller/domain/storage.
3. Penanganan Sampah cloud untuk data bersarang, media, dan sebagian submodul masih memiliki pembatasan Tahap 2. Jangan membuka kembali `delete` langsung sebelum kontrak arsip server tersedia.
4. Belum dilakukan audit semua titik `innerHTML`, URL ekspor dan media, dependency eksternal PWA offline, serta audit performa DOM pada ribuan baris. Lakukan analisis keamanan menyeluruh di tahap berikutnya.
5. Kontrak format output dihormati; perubahan template cetak tidak diuji secara visual untuk **semua** jenis printer/browser. Gunakan *golden PDF/XLSX* dan pemeriksaan manusia pada data staging untuk verifikasi akhir.

## Prosedur pemasangan dan rollback

1. Cadangkan rilis Tahap 3, unduh backup IndexedDB, dan backup database Supabase (terpisah). Jangan mengganti file cloud saja.
2. Unggah **seluruh** isi ZIP Tahap 4 termasuk empat berkas baru, `index.html`, dan `sw.js`. Jangan menghilangkan file migrasi Tahap 2 yang sudah ada.
3. Terapkan perubahan frontend di staging terlebih dahulu, lakukan *hard refresh* dan pastikan cache PWA beridentitas `modular-stage4`; uji menu, cetak dokumen panjang, Sampah, dan pengaturan.
4. Jalankan pengujian database nyata dan uji multi-perangkat seperti dijelaskan Tahap 2. **Jangan menganggap lulus QA browser berarti RLS produksi sudah aman.**
5. Jika terjadi regresi, kembalikan semua aset frontend dan `sw.js` Tahap 3 secara utuh lalu refresh cache; **jangan rollback database Supabase** tanpa rencana dan backup yang telah diuji.

## Rekomendasi lanjutan

Lihat `docs/REKOMENDASI-SETELAH-TAHAP4-20261111.md`. Prioritas terdekat adalah *production readiness gate* dengan pengujian Supabase staging (kelanjutan kewajiban Tahap 2), kemudian pemisahan Auth/administrasi akun/sync dari modul cloud dan penyelesaian Sampah cloud untuk data bersarang. Pertahankan workflow operasional satu langkah, tanpa persetujuan berjenjang.
