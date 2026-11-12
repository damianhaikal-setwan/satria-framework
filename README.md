> **Rilis stabilitas terbaru (12 November 2026):** pengaman balapan sesi cloud, audit staging yang mengikat hostname dan cakupan OPD/tahun, serta laporan QA otomatis. Lihat [panduan stabilitas dan kesiapan staging](docs/RILIS-STABILITAS-SESI-DAN-KESIAPAN-STAGING-20261112.md). Kode sudah diuji lokal; **Supabase staging nyata belum tervalidasi**.

> **Kandidat rilis gabungan Rekomendasi 1–5 (12 November 2026):** keamanan cache PWA, pengamatan status sinkronisasi, indeks Bank RUP, validasi delta, build frontend deterministik, serta pengujian CI satu-perintah. **45/45 pemeriksaan lokal dan 4/4 browser smoke lulus; Supabase staging nyata belum diuji.** Lihat [catatan rilis gabungan](docs/RILIS_GABUNGAN_REKOMENDASI_1_5_20261112.md).

> **Tahap 4 modularisasi & UX (11-11-2026):** generator template dokumen, optimasi tampilan, dan CSS modal bersama telah dipisahkan; zoom mobile dan tabel cetak diperbaiki. **33/33 uji Node dan 11/11 uji browser lokal lulus; belum ada bukti pengujian Supabase staging/produksi.** Lihat [laporan Tahap 4](docs/IMPLEMENTASI-TAHAP-4-REFACTOR-OPTIMASI-20261111.md) dan [prioritas pengembangan lanjutan](docs/REKOMENDASI-SETELAH-TAHAP4-20261111.md). Unggah seluruh file frontend beserta `index.html` dan `sw.js` versi Tahap 4; bukan satu skrip saja.

> **Tahap 2 cloud recycle (11-11-2026):** source dan migrasi tersedia untuk uji staging; lihat [panduan Tahap 2](docs/IMPLEMENTASI-TAHAP-2-SAMPAH-CLOUD-20261111.md). Belum ada bukti deployment Supabase.

# Pembaruan SATRIA NEXT 3.0.59.53 — PBJ 2026

**Dokumen rilis aktif:** [docs/RILIS-PBJ-2026-3.0.59.53.md](docs/RILIS-PBJ-2026-3.0.59.53.md).
Panduan rilis/penetapan HPS historis di bawah ini adalah **arsip versi lama**; ikuti panduan baru bila terjadi pertentangan. Kandidat rilis harus diuji staging dan RLS Supabase sebelum produksi.

---

> **Pembaruan 8 November 2026 — Smart Survey tanpa evaluasi ulang spesifikasi:** kolom penilaian kesesuaian berulang dihilangkan. Bukti katalog dan analisis harga tetap berjalan, catatan lama dijaga, dan pemenuhan kebutuhan/KAK tetap keputusan PPK. Tidak memerlukan migrasi database. Baca [panduan Smart Survey](docs/SMART-SURVEY-TANPA-EVALUASI-ULANG-SPESIFIKASI-2026-11-08.md).

> **Pembaruan 8 November 2026 — akun PPKom dibatasi OPD dan TA:** Admin kini dapat membuat jenis akun **PPKom** untuk Bapperida dan Disporapar (satu OPD per akun, tahun anggaran dipilih Admin), memakai otorisasi Operator scoped di server. **Perlu deploy ulang Edge Functions `admin-create-user` dan `admin-list-users`; perubahan GitHub saja tidak cukup.** Tidak membuat akun nyata atau menambahkan migrasi SQL baru. Baca [panduan PPKom](docs/AKUN-PPKOM-OPD-TA-2026-11-08.md).

> **Pembaruan 6 November 2026 — Refactor `index.html` dan maintenance:** file utama telah dipisah menjadi 34 skrip klasik dan 22 stylesheet berurutan; diagnostik baca-saja serta pemeriksaan CI diperkuat. **Semua file di `frontend/refactor/` wajib ikut di-deploy.** Baca [`docs/REFACTOR-INDEX-DAN-MAINTENANCE-2026-11-06.md`](docs/REFACTOR-INDEX-DAN-MAINTENANCE-2026-11-06.md). Refactor ini tidak mengubah aturan negosiasi maupun analisis harga tayang antarpenyedia.

## SATRIA NEXT 3.0.59.39 — Analisis kewajaran mengikuti contoh PDF Pejabat Pengadaan

Dokumen ke-15 kini mengikuti susunan I–VII sesuai contoh PDF pengguna, **A4 potret**, menampilkan sumber harga dari setiap penyedia, analisis per barang dengan bahasa manusia, rekap selisih HPS/negosiasi, dan lampiran foto produk yang memang tersimpan. Nama penyedia/akun/program/angka dihitung dari paket terpilih—tidak disalin dari contoh. Tetap baca-saja, tanpa persetujuan berjenjang atau migrasi Supabase. Baca `docs/PANDUAN-UPDATE-3.0.59.39.md`.

## SATRIA NEXT 3.0.59.38 — Kertas kerja perbandingan harga produk & lampiran foto

Perubahan inti pada dokumen ke-15 adalah **analisis harga tiap produk**: HPS satuan, harga tayang, hasil negosiasi, calon referensi lain, selisih nominal/persentase, alasan perbandingan dan indikator sementara. Struktur laporan mengikuti kertas kerja praktis: kebutuhan, metode, tabel, pertimbangan per produk, rekap, kesimpulan, lampiran bukti.

Kertas kerja analisis harga versi 3.0.59.38 menampilkan perbandingan pemenang dengan semua harga penyedia lain dan lampiran foto yang benar-benar tersimpan. Tautan toko e-Katalog bukan bukti harga produk. Untuk rincian update lihat `docs/PANDUAN-UPDATE-3.0.59.38.md`.

Tidak mengubah skema Supabase, data transaksi, atau keputusan pemenang. Jalankan pengujian lokal dan uji cloud dengan akun Anda setelah deployment.

## SATRIA NEXT 3.0.59.35 — Hotfix Dokumen Analisis Harga

Perbaikan untuk error **“Dokumen atau paket tidak ditemukan”** saat mencetak laporan analisis harga ke-15.
Semua 15 jenis dokumen kini masuk pemeriksaan/ekspor JSON, dan laporan analisis bisa dicetak sebagai draf tanpa dialog tambahan.
Tidak ada migrasi Supabase atau perubahan transaksi. Lihat [`docs/HOTFIX-DOKUMEN-ANALISIS-HARGA-3.0.59.35.md`](docs/HOTFIX-DOKUMEN-ANALISIS-HARGA-3.0.59.35.md).

---

## SATRIA NEXT 3.0.59.33 — Smart Analisis Kewajaran Harga

Fitur baru: analisis otomatis per paket pada **Paket Pengadaan → Penawaran & Negosiasi** dan dokumen ke-15 **Analisis Kewajaran Harga & Referensi Harga** pada **Dokumen Pengadaan**. Semua data dibaca dari penawaran dan Smart Survey; tidak ada proses approval atau input harga baru. Panduan lengkap: `docs/SMART-ANALISIS-KEWAJARAN-HARGA-3.0.59.33.md`.

Pembaruan GitHub dari versi 3.0.59.32: ganti `index.html`, `sw.js`, `manifest.json`, `frontend/satria-next4.js`; tambahkan `frontend/satria-price-analysis.js` dan `frontend/satria-price-analysis.css`. Pertahankan seluruh file lain. Tidak ada migrasi Supabase.

## SATRIA NEXT 3.0.59.32 — Operator Studio, untuk satu Pejabat Pengadaan

Penyegaran navigasi/tampilan Paket Pengadaan, Input & Bank RUP, Kalkulator Nego, dan Dokumen Pengadaan. Ringkasan kerja visual, KPI sesuai data yang terlihat, shortcut langsung ke formulir asli, dan tiga tab pekerjaan paket. Tidak ada proses persetujuan berjenjang, field wajib baru, atau perubahan penyimpanan transaksi. Tetap gunakan login, hak akses, dan pemeriksaan bukti seperti sebelumnya.

File baru `frontend/satria-operator-studio.css` dan `frontend/satria-operator-studio.js`. Jika repo sudah versi 3.0.59.31, update hanya `index.html`, `sw.js`, `manifest.json`, serta **tambahkan dua file baru**. Baca `docs/OPERATOR-STUDIO-3.0.59.32.md`.

## SATRIA NEXT 3.0.59.31 — Fondasi Design System & SATRIA 360°

Rilis baca-saja pada basis 3.0.59.30: identitas visual lintas modul, pencarian cepat Ctrl+K, tampilan SATRIA 360° per paket, pemeriksaan ringkas, agenda tindak lanjut dan ekspor CSV. **Tidak mengubah kode transaksi, migrasi Supabase atau mesin dokumen.**

Wajib unggah **lima file** termasuk `frontend/satria-next4.css` dan `frontend/satria-next4.js`. Lihat `docs/UPLOAD-SATRIA-3.0.59.31.md` serta `docs/SATRIA-NEXT-3.0.59.31-FONDASI-360.md`.

## SATRIA NEXT 3.0.59.30 — Executive Briefing 4.1 Visual (chart visible)

Hotfix: fungsi chart sekarang terhubung ke route `#brief` yang benar. Tambahan donut, funnel, radar, tren, bar, bubble, stack dan grafis per paket. Mode SPSE sekarang memiliki chart monitoring. Chart animasi visual, data tidak diubah.

## SATRIA NEXT 3.0.59.29 — Hotfix Executive Briefing Visual Stable

Perbaikan ini memperbaiki error render pada Executive Briefing, membersihkan patch visual sebelumnya, dan menambahkan chart visual yang bergerak/beranimasi secara aman. Perubahan tetap baca-saja dan tidak mengubah transaksi, Supabase, penetapan, atau negosiasi.

# SATRIA NEXT — Framework Pengadaan

> **Perapian repo P0–P3 (11 November 2026):** hanya berkas tidak terpakai, duplikat Supabase, dan catatan historis yang sudah ada di riwayat Git yang dieliminasi. Kode runtime, migrasi, dan seluruh alat uji aktif tidak diubah. Untuk deploy frontend statis gunakan paket khusus *frontend-runtime*; untuk mengembangkan source tetap gunakan repositori lengkap ini.


**Versi aplikasi: 3.0.59.59** · Ringkasan Utama HPS dan penetapan · Bank RUP manual dan impor JSON/CSV · Supabase (opsional sesuai konfigurasi instansi)

Versi ini menambahkan **Executive Briefing 3.0** (e-Purchasing, SPSE, gabungan), briefing per paket, cetak A4/PDF, daftar risiko, analisis penetapan dan penyedia, ringkasan per OPD, serta CSV. Lihat [panduan fitur](docs/EXECUTIVE-BRIEFING-3.0.59.27.md).

Repositori ini menyimpan **aplikasi SATRIA NEXT dengan `index.html` sebagai entry point dan skrip/style modular**, aset PWA, Edge Functions, migrasi SQL, serta dokumentasi dan pengujian. Paket ini meneruskan struktur repo yang telah dirapikan dan menyempurnakan perhitungan sisa pagu RUP menurut HPS maupun penetapan yang lolos validasi; tidak diperlukan migrasi database baru.

Lihat [panduan evaluasi total HPS historis 3.0.59.23](docs/EVALUASI-TOTAL-HPS-HISTORIS-3.0.59.23.md).

## Mulai cepat

- Untuk melihat aplikasi, buka **`index.html`** melalui server HTTP/HTTPS. Di GitHub Pages, letakkan `index.html` pada **root repositori**; jangan menyimpan seluruh aplikasi di dalam subfolder tambahan.
- Jika memperbarui repositori lama, baca [panduan pembaruan GitHub](docs/GITHUB-UPLOAD.md) **sebelum menimpa berkas**. Mengunggah ZIP ke antarmuka GitHub tidak akan otomatis mengekstraknya maupun menghapus berkas lama.
- Untuk instalasi Supabase dan prosedur uji, baca [DEPLOY.md](DEPLOY.md). **Commit di GitHub tidak otomatis menjalankan SQL atau mengganti data di Supabase.**
- Detail perbaikan Bank RUP: [hotfix 3.0.59.21](docs/HOTFIX-BANK-RUP-MANUAL-JSON-3.0.59.21.md).
- Penyempurnaan Ringkasan Utama dan penetapan RUP: [versi 3.0.59.22](docs/RINGKASAN-UTAMA-RUP-PENETAPAN-3.0.59.22.md).

## Struktur repositori

| Lokasi | Fungsi |
| --- | --- |
| `index.html` | Entry point dan struktur HTML; memuat CSS/JS modular berurutan |
| `frontend/refactor/` | Kode hasil refactor index, stylesheet, dan diagnostik |
| `manifest.json`, `sw.js`, `icon-*.png` | PWA, cache, ikon |
| `_headers`, `_redirects` | Aturan untuk hosting yang mendukung format ini; tidak otomatis berlaku di GitHub Pages |
| `supabase/functions/` | **Satu-satunya lokasi resmi** Edge Functions aktif |
| `supabase/migrations/` | Migrasi skema dengan urutan timestamp |
| `supabase/manual/` | SQL tambahan yang perlu diterapkan secara terencana/manual |
| `supabase/tests/` | Validasi database yang membutuhkan lingkungan Supabase sesuai panduan |
| `frontend/` | Kode pendamping dan dokumentasi integrasi frontend |
| `tools/`, `tests/` | Uji statis/regresi lokal (tanpa `node_modules`) |
| `docs/` | Petunjuk, riwayat pengembangan, dan aset dokumentasi |

## Pemeriksaan lokal

Dari folder root, jalankan perintah berikut dengan Node.js dan Python 3:

```bash
node tools/test_rup_bank_visibility.js
node tools/test_rup_award_dashboard.js
node tools/test_executive_briefing_327.js
node tools/test_nego_net_349.js
node tools/test_hps_total_historical_review.js
node tools/test_navigation_survey_winner_350.js
node tools/test_offer_provider_correction.js
node tools/test_seller_catalog_identity_326.js
node tests/test_dpp_352.js
python tools/test_rup_bank_contract.py
python tools/security_static_check.py
```

Skrip ini menguji kode **secara lokal**; tidak membuktikan sinkronisasi aktual, izin produksi, atau status penerapan migrasi Supabase. Uji login, impor JSON, input manual, sinkronisasi, dan refresh harus dilakukan di staging/produksi secara terpisah.

## Panduan penting

- [Deploy dan migrasi Supabase](DEPLOY.md)
- [Pembaruan GitHub tanpa kehilangan riwayat](docs/GITHUB-UPLOAD.md)
- [Daftar dokumentasi](docs/README.md)
- [Rincian perubahan perapian repo](docs/REPO-CLEANUP.md)
- [Verifikasi snapshot dasar 3.0.59.21 terhadap ZIP GitHub](docs/VERIFIKASI-ZIP-GITHUB-TERBARU-2026-11-05.md)

**Keamanan:** Jangan unggah `.env`, kunci `service_role` / `sb_secret_`, dump database berisi data nyata, atau backup data RUP berisi informasi internal. Akses operator/viewer tetap bergantung pada pemeriksaan RLS/RPC di Supabase.

**Hotfix 3.0.59.24:** input review historis kini mempertahankan teks, referensi bukti, dan checkbox saat pindah kolom atau render ulang. Lihat [catatan hotfix](docs/HOTFIX-FORM-REVIEW-HPS-3.0.59.24.md).


### Koreksi penyedia penawaran — v3.0.59.25
Jika operator salah memilih identitas penyedia dan data penawaran/negosiasi yang tersimpan memang milik penyedia lain, gunakan **Paket Pengadaan → Penawaran & Negosiasi → Koreksi identitas penyedia** pada kartu penawaran. Pilih penyedia yang benar dari Data Master, isi kronologi dan bukti, serta konfirmasi. Harga dan tanggal yang sudah ada dipertahankan **hanya jika seluruhnya memang milik penyedia yang benar**. Penetapan terdahulu dicabut untuk evaluasi ulang dan review HPS historis perlu diisi ulang bila diperlukan. Riwayat koreksi disimpan di data penawaran. Dokumen lama wajib direviu dan transaksi resmi tidak otomatis berubah.

### Koreksi nama penyedia tayang — v3.0.59.26

Jika identitas penyedia penawaran dikoreksi, kolom **Nama penyedia tayang (verifikasi manual)** pada Smart Survey tetap mempertahankan data katalog yang tersimpan. Untuk rincian yang masih berbeda dengan penyedia penawaran, tersedia tombol **Koreksi nama penyedia tayang (nama saja)** dengan konfirmasi dan rujukan bukti. Perubahan ini hanya menyentuh `catalogRefs[itemId].seller`, menyimpan riwayat di `surveyHistory[itemId]`, dan tidak memodifikasi harga, HPS, hasil negosiasi, pemenang, tautan, atau barang lain. Jika tautan katalog jelas masih milik penyedia lama, koreksi nama ditahan sampai referensinya diperbarui.


## Cara mencatat harga beberapa penyedia

Pada setiap penyedia di Penawaran & Negosiasi, simpan produk yang ditawarkan pada setiap rincian barang. Pilihan lama **Referensi Utama** berarti **produk aktif untuk penyedia tersebut**, bukan penyedia pemenang atau referensi utama seluruh paket. Gunakan **Produk alternatif tambahan** hanya untuk variasi produk tambahan, bukan untuk mengganti penawaran Penyedia 2/3. Penyedia terpilih tetap ditentukan di bagian Penetapan. Laporan harga menampilkan seluruh penawaran dan menjelaskan bila produk belum dapat dibandingkan.

### SATRIA NEXT 3.0.59.55 — Generator HPS dan kertas kerja PP

Tersedia generator **Rincian HPS** pada Dokumen Pengadaan untuk mengunduh Excel `.xlsx` atau mencetak PDF A4 landscape berdasarkan rincian paket. Pemilihan pajak sudah termasuk/sebelum pajak bersifat eksplisit; keluaran adalah DRAF dan tidak mengubah HPS maupun nilai penetapan. Pada SPSE terdapat **Kertas Kerja PP** dan pengaturan catatan transisi yang opsional dan telah diperbaiki agar dropdown tidak reset. Untuk E-Purchasing, dropdown transisi Perlem 3/2026 tidak ditampilkan. Tidak ada migrasi SQL. Detail dan pengujian: [`docs/PENGEMBANGAN-HPS-PPKERJA-TRANSISI-3.0.59.55.md`](docs/PENGEMBANGAN-HPS-PPKERJA-TRANSISI-3.0.59.55.md).

### SATRIA NEXT 3.0.59.56 — Ekosistem Ruang Kerja Pejabat Pengadaan

Menu **Ruang Kerja PP** baru menyatukan paket e-Purchasing dan Pengadaan Langsung SPSE sesuai filter OPD/tahun/hak akses. Dari paket yang dipilih, SATRIA membaca tahapan, menautkan generator dokumen relevan, dan menyimpan catatan kerja serta referensi bukti opsional dengan data paket yang sudah ada. Tidak ada alur persetujuan berjenjang baru ataupun database kedua. Draf dokumen bukan pengganti SPSE/INAPROC. Lihat [panduan pengembangan 3.0.59.56](docs/EKOSISTEM-PEJABAT-PENGADAAN-3.0.59.56.md) dan pastikan uji Supabase staging sebelum produksi.


## Pengembangan 3.0.59.57 — Dokumen Pemilihan SPSE

- Perubahan source: generator Dokumen Pemilihan Pengadaan Langsung Barang/Jasa Lainnya berbasis data paket, kriteria, instruksi, jadwal, formulir dan rancangan SPK dari PPK.
- Gunakan menu Dokumen Pengadaan → Paket Dokumen Pendukung Sistem Resmi → Penyusun Dokumen Pemilihan.
- Simpan isian melalui transaksi SATRIA; perubahan HPS atau paket mewajibkan pemeriksaan dan penyimpanan ulang sebelum cetak lengkap.
- Kategori konstruksi/konsultansi, paket hanya pencatatan, dan Tender tidak diizinkan memakai cetak lengkap ini.
- Tidak ada migrasi SQL baru; jangan hapus IndexedDB. Backup dan uji Supabase staging sebelum deployment ke main.
- Dokumen cetak tetap harus diperiksa, ditetapkan/ditandatangani sesuai kewenangan dan ketentuan SPSE; SATRIA tidak mengunggah berkas otomatis.
- Rincian dan batasan: `docs/GENERATOR-DOKUMEN-PEMILIHAN-SPSE-3.0.59.57.md`.

## Pengembangan 3.0.59.58 — Klasifikasi Bank RUP tanpa asumsi
- Jenis & metode pengadaan pada Bank RUP tampil jelas, bisa dikoreksi per RUP dengan tombol Simpan.
- Impor SiRUP yang tidak memuat kolom klasifikasi tidak lagi menciptakan label Barang/E-Purchasing.
- Paket lama tidak diubah otomatis; klasifikasi yang belum diketahui harus diperiksa terhadap sumber resmi.
- Catatan teknis: [`docs/BANK-RUP-KLASIFIKASI-3.0.59.58.md`](docs/BANK-RUP-KLASIFIKASI-3.0.59.58.md).


## Pembaruan 3.0.59.59 — dua format JSON SiRUP

Lihat [panduan impor `data` dan `aaData`](docs/IMPOR-SIRUP-DUA-FORMAT-3.0.59.59.md). Gunakan `data` lengkap untuk klasifikasi jenis/metode; `aaData` hanya daftar ringkas dan tidak boleh mengisi jenis secara otomatis. Metode `Dikecualikan` dipertahankan terpisah.

## Modul baru — SATRIA NEXT 3.0.59.60: Kertas Kerja Jasa Konsultansi Konstruksi

Modul **KK Konsultansi Konstruksi** terintegrasi dengan Bank RUP untuk metode **Pengadaan Langsung** dan jenis **Jasa Konsultansi**, dengan konfirmasi subjenis **Konstruksi** berdasarkan KAK. Data tambahan bersifat non-destruktif (`paket.kkJkk`), 9 format cetak/PDF browser, reviu 42 kriteria, serta evaluasi Perorangan dan kerangka Badan Usaha. Tidak ada approval berjenjang atau unggah langsung ke LPSE.

Dokumentasi, batasan, pengujian, dan langkah deploy aman: [MODUL-KK-JASA-KONSULTANSI-KONSTRUKSI-3.0.59.60](docs/MODUL-KK-JASA-KONSULTANSI-KONSTRUKSI-3.0.59.60.md).


## Pembaruan 3.0.59.61 — Alur Excel delapan langkah JKK

Kertas Kerja **Pengadaan Langsung — Jasa Konsultansi Konstruksi** kini memakai delapan langkah sesuai workbook: **(1) Pilih Bank RUP, (2) Identitas & Administrasi / INPUT_META, (3) Reviu 42 butir / INPUT_REVIU, (4) Evaluasi Kualifikasi, (5) Evaluasi Penawaran, (6) Survei Harga, (7) HPS dan Negosiasi, (8) Hasil Kertas Kerja**.

Kelengkapan yang ditambahkan: jadwal unggah/pembukaan/evaluasi/klarifikasi/kontrak, PIC dan target reviu, metadata kualifikasi/penawaran yang dipisah, dan survei harga per rincian dengan referensi standar/kontrak/penawaran serta pilihan harga manual. Harga survei **hanya disalin ke tarif HPS setelah pengguna menekan tombol pilihan**. Format dokumen reviu, survei dan undangan menampilkan detail tambahan tersebut. Data lama di `paket.kkJkk` dipertahankan; tidak ada perubahan skema database atau data Bank RUP.

Baca [Panduan alur 8 langkah dan deployment aman](docs/MODUL-KK-JKK-ALUR-EXCEL-8-LANGKAH-3.0.59.61.md). **Jangan deploy ke produksi sebelum cadangan dan uji sinkronisasi staging**. SATRIA tidak menggantikan LPSE/SPSE dan tidak mengunggah dokumen otomatis.
