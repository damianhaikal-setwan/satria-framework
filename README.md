## SATRIA NEXT 3.0.59.36 — Analisis harga produk + rujukan PBJ

Perubahan inti pada dokumen ke-15 adalah **analisis harga tiap produk**: HPS satuan, harga tayang, hasil negosiasi, calon referensi lain, selisih nominal/persentase, alasan perbandingan dan indikator sementara. Struktur laporan mengikuti kertas kerja praktis: kebutuhan, metode, tabel, pertimbangan per produk, rekap, kesimpulan, lampiran bukti.

Peraturan LKPP 2/2026 diberlakukan 1 September 2026 (menggantikan 9/2021), sehingga laporan menandai tanggal fase pengadaan yang tercatat dan **tidak berlaku surut**. Tidak ada kewajiban universal tiga referensi, tidak ada tarif PPN 11% yang ditambahkan otomatis, dan tidak ada penetapan harga wajar otomatis. Lihat `docs/ANALISIS-HARGA-PRODUK-PBJ-3.0.59.36.md`.

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

**Versi aplikasi: 3.0.59.36** · Ringkasan Utama HPS dan penetapan · Bank RUP manual dan impor JSON/CSV · Supabase (opsional sesuai konfigurasi instansi)

Versi ini menambahkan **Executive Briefing 3.0** (e-Purchasing, SPSE, gabungan), briefing per paket, cetak A4/PDF, daftar risiko, analisis penetapan dan penyedia, ringkasan per OPD, serta CSV. Lihat [panduan fitur](docs/EXECUTIVE-BRIEFING-3.0.59.27.md).

Repositori ini menyimpan **aplikasi SATRIA NEXT dalam satu `index.html`**, aset PWA, Edge Functions, migrasi SQL, serta dokumentasi dan pengujian. Paket ini meneruskan struktur repo yang telah dirapikan dan menyempurnakan perhitungan sisa pagu RUP menurut HPS maupun penetapan yang lolos validasi; tidak diperlukan migrasi database baru.

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
| `index.html` | Aplikasi SATRIA NEXT (frontend terintegrasi) |
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
