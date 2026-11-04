# Verifikasi snapshot dasar 3.0.59.21 terhadap ZIP GitHub terbaru — 5 November 2026

> **Catatan versi 3.0.59.22:** Laporan SHA-256 ini adalah dokumentasi historis **sebelum** pembaruan Ringkasan Utama. Berkas `index.html`, `sw.js`, dan `manifest.json` kini **sengaja berbeda** untuk mendukung HPS/penetapan/sisa RUP. Kode Supabase dan migrasi tetap tidak diubah. Lihat [catatan fitur 3.0.59.22](RINGKASAN-UTAMA-RUP-PENETAPAN-3.0.59.22.md).

**Sumber pembanding:** `satria-framework-main.zip` yang diberikan pengguna sebagai unduhan terbaru dari repositori produksi. Verifikasi ini membandingkan isi arsip secara byte-per-byte (SHA-256), bukan audit koneksi langsung terhadap branch GitHub, hosting produksi, atau database Supabase.

## Hasil singkat

- ZIP produksi memiliki **64 berkas**. Berkas tersebut sama persis dengan 64 berkas yang bersesuaian di paket hotfix Bank RUP 3.0.59.21; paket hotfix hanya menambahkan dokumentasi dan pengujian Bank RUP.
- Versi Repo Rapi sebelumnya memiliki **70 berkas** sebelum penambahan laporan verifikasi ini.
- Di antara nama yang sama antara ZIP produksi dan Repo Rapi, **49 berkas identik** dan **4 sengaja berbeda** (dua dokumentasi diperbarui dan dua skrip tes diperbaiki).
- **11 path lama** dari ZIP produksi tidak ada pada paket rapi: file penting yang dipindahkan tetap tersedia dalam folder baru; salinan legacy yang tidak aman tidak dipakai lagi.
- **17 path baru** ada pada paket rapi sebelumnya untuk dokumentasi, CI, pengamanan, dan pengujian. Laporan ini ditambahkan sebagai satu berkas baru.
- **Seluruh file aplikasi/PWA, 9 migrasi Supabase, dan 3 Edge Function aktif identik SHA-256** dengan ZIP produksi.

## File produksi yang tetap identik (contoh hash SHA-256)

| File | SHA-256 |
| --- | --- |
| `index.html` | `e86476285e57a7386c426188a183f58f87042402d1a87c0948c95265d0dd7e0a` |
| `manifest.json` | `312cc56cc66aebcc2932d3876ed0c8c0421aa638a0f10cedd31eeefb90597e4b` |
| `sw.js` | `a30896b6424da67b97fa4b00c3809064c7ea61407cfc23023a3d6566c69cd007` |
| `icon-192.png` | `6e9c7a41ab9993457a5220778bb9f89e2ce019427d8921430f47d675fde27bd7` |
| `icon-512.png` | `544daedeb0c67770bb512042401b428fa4d85dede12cdad5de5e9421352ce139` |
| `supabase/config.toml` | `7cce0fc7eaf84dda3ef4a6e59645584120a1e185baeae6e1ee9a3965d5aed84a` |
| `supabase/migrations/20261024052900_satria_opd_assignments_rls.sql` | `63d8166333d33f59f4e27670216db6ee66b24c412ed1fd5e9ec232e270557a9c` |
| `supabase/migrations/20261024053000_satria_user_opd_assignment_api.sql` | `2a7e9f3b2c029f6d46b7961977459983cbee9ed63f0b1b6fadbbcbf80ec93eed` |
| `supabase/migrations/20261024053100_satria_catalog_and_assignment_repair.sql` | `c7eed3d96714c51ae6b371304473f4bda51b30b9b3a85f122916f11a9393c209` |
| `supabase/migrations/20261024053200_satria_scoped_access_and_years.sql` | `c5501c2c22686acc80786fb43b254e71c29e88193ce39a57e2f5796921239efd` |
| `supabase/migrations/20261024053300_satria_shared_master_collaboration.sql` | `69f9f4c98a1cc5dcd3e8d312ae9e162ddd6cbac8bb11be9aeb30a78c5d57a71a` |
| `supabase/migrations/20261024053400_satria_autosync_delta_realtime.sql` | `d4b5af9d8ea3b7c74d5c2f2b82cdd5ff9bf2185dc16684b221c2e73995bada58` |
| `supabase/migrations/20261024_satria_user_creation_security.sql` | `3944165b7706e6d5e6bed4e480619dc593cc582f83ded09218b609b989926453` |
| `supabase/migrations/20261028010000_satria_rup_bank_cloud_compat.sql` | `e042cb6b1257583e69d7f23d24036183b6fe4587a2c8084c3ba7f7dedddfe0de` |
| `supabase/migrations/20261028060000_satria_private_media_storage.sql` | `ec3a8dc7dd1c55a1db61fa7ce7b85dc65f4cb501bbc003d46f11af3ac769aa9a` |
| `supabase/functions/admin-create-user/index.ts` | `8331f4446a087418aa5532d2451ca9e316dfc031afb865e0dcdf0e3f1d934fa9` |
| `supabase/functions/admin-list-users/index.ts` | `81991a6e2e53f32ae26d8d3060b2055661340e58e34b2c2b77230c7b8b950117` |
| `supabase/functions/admin-update-user/index.ts` | `32863d68c3b5b86cf7c890407f59f3493f67f51a02d7935431bce89e369e34b9` |

## Berkas dengan nama sama tetapi kontennya diperbarui

- `README.md` — diganti pengantar singkat dan penunjuk dokumentasi aktif.
- `DEPLOY.md` — panduan deploy dibuat spesifik terhadap versi sekarang.
- `tests/test_dpp_352.js` — diubah agar memakai `index.html` root saat ini, bukan path historis.
- `tools/test_navigation_survey_winner_350.js` — diselaraskan dengan kode label survei dan stub Node saat ini.

## Path yang tidak lagi berada di lokasi lamanya

- `FIX_ERROR.md` → `docs/history/FIX_ERROR.md`
- `LAPORAN-PERBAIKAN-GITHUB-DATABASE.md` → `docs/history/LAPORAN-PERBAIKAN-GITHUB-DATABASE.md`
- `PANDUAN-DEPLOY-GITHUB-3.0.54.md` → `docs/history/PANDUAN-DEPLOY-GITHUB-3.0.54.md`
- `SATRIA-3592-DPP-Uji-Cetak-Halaman.png` → `docs/assets/SATRIA-3592-DPP-Uji-Cetak-Halaman.png`
- `SATRIA-3_0_59_2-Catatan-Tata-Letak-TTD-DPP.md` → `docs/history/SATRIA-3_0_59_2-Catatan-Tata-Letak-TTD-DPP.md`
- `supabase/SATRIA-3_0_41-Migrasi-Bank-RUP.sql` — Dihilangkan sebagai salinan legacy/duplikat; lihat `docs/REPO-CLEANUP.md`
- `supabase/SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql` → `supabase/manual/SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql`
- `supabase/admin-create-user/index.ts` — Dihilangkan sebagai salinan legacy/duplikat; lihat `docs/REPO-CLEANUP.md`
- `supabase/admin-list-users/index.ts` — Dihilangkan sebagai salinan legacy/duplikat; lihat `docs/REPO-CLEANUP.md`
- `supabase/admin-update-user/index.ts` — Dihilangkan sebagai salinan legacy/duplikat; lihat `docs/REPO-CLEANUP.md`
- `supabase/config-snippet.toml` — Dihilangkan sebagai salinan legacy/duplikat; lihat `docs/REPO-CLEANUP.md`

## Tambahan paket rapi

Paket juga memuat `.github/workflows/checks.yml`, `.gitignore`, `.nojekyll`, `docs/GITHUB-UPLOAD.md`, `docs/REPO-CLEANUP.md`, beberapa salinan dokumentasi historis, dan skrip validasi Bank RUP. Daftar lengkap bisa dibandingkan dengan isi ZIP GitHub terbaru.

## Pengujian paket

Enam rangkaian uji lokal yang dijalankan saat pengemasan:
```text
node tools/test_rup_bank_visibility.js          PASS
node tools/test_nego_net_349.js                 PASS
node tools/test_navigation_survey_winner_350.js PASS
node tests/test_dpp_352.js                      PASS (9/9)
python tools/test_rup_bank_contract.py          PASS
python tools/security_static_check.py          PASS (27/27)
```

## Yang tidak dibuktikan oleh laporan ini

- Belum memeriksa commit HEAD GitHub secara langsung; yang diuji adalah **arsip terbaru yang diberikan**.
- Belum memeriksa keberhasilan deploy, service worker/cache pada browser produksi, atau akses pengguna.
- Belum melakukan perubahan atau validasi langsung terhadap database dan Edge Function yang benar-benar berjalan di Supabase.

## Penting saat update repo

**Gunakan branch/perubahan bertahap, bukan hapus repository.** Unggah konten ZIP ke root, tetapi hapus juga path legacy pada daftar di atas; fitur unggah file lewat situs GitHub tidak otomatis menghapus berkas lama. Verifikasi fungsi Bank RUP (manual + JSON), sinkronisasi setelah reload, dan hak akses setelah deploy. Lihat `docs/GITHUB-UPLOAD.md`.
