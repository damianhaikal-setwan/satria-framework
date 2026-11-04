# SATRIA NEXT — Framework Pengadaan

**Versi aplikasi: 3.0.59.22** · Ringkasan Utama HPS dan penetapan · Bank RUP manual dan impor JSON/CSV · Supabase (opsional sesuai konfigurasi instansi)

Repositori ini menyimpan **aplikasi SATRIA NEXT dalam satu `index.html`**, aset PWA, Edge Functions, migrasi SQL, serta dokumentasi dan pengujian. Paket ini meneruskan struktur repo yang telah dirapikan dan menyempurnakan perhitungan sisa pagu RUP menurut HPS maupun penetapan yang lolos validasi; tidak diperlukan migrasi database baru.

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
node tools/test_nego_net_349.js
node tools/test_navigation_survey_winner_350.js
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
