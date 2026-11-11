# Catatan perapian repositori SATRIA NEXT 3.0.59.21

**Dasar:** paket `SATRIA-NEXT-3.0.59.21-Hotfix-Bank-RUP.zip` yang sudah berfungsi, serta verifikasi terhadap `satria-framework-main.zip` terbaru dari pengguna (5 November 2026). Perapian **tidak mengubah** `index.html`, `sw.js`, `manifest.json`, ikon, RLS/RPC SQL, atau versi Edge Function aktif. Skrip uji lama diperbarui agar sesuai struktur sekarang.

## Yang dihilangkan karena duplikat/kedaluwarsa

- `supabase/admin-create-user/`, `supabase/admin-list-users/`, `supabase/admin-update-user/`: salinan legacy. **Gunakan `supabase/functions/admin-*/` saja**; dua dari tiga salinan lama memiliki perbedaan penting pada assignment tahun.
- `supabase/SATRIA-3_0_41-Migrasi-Bank-RUP.sql`: duplikat byte-identik dari `supabase/migrations/20261028010000_satria_rup_bank_cloud_compat.sql`; bukan migrasi kedua.
- `supabase/config-snippet.toml`: konfigurasi sudah tersedia di `supabase/config.toml`.

## Yang dipindahkan (kontennya dipertahankan)

- `FIX_ERROR.md`, `LAPORAN-PERBAIKAN-GITHUB-DATABASE.md`, `PANDUAN-DEPLOY-GITHUB-3.0.54.md`, `SATRIA-3_0_59_2-Catatan-Tata-Letak-TTD-DPP.md` → `docs/history/`.
- `SATRIA-3592-DPP-Uji-Cetak-Halaman.png` → `docs/assets/`.
- `README.md` lama → `docs/history/README-legacy-sebelum-dirapikan.md`, `DEPLOY.md` lama → `docs/history/DEPLOY-legacy-3.0.41.md`. Keduanya diganti versi ringkas dan relevan dengan rilis sekarang.
- `supabase/SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql` → `supabase/manual/` supaya jelas bahwa ini SQL manual; **tidak dijalankan saat commit ke GitHub**.

## Yang ditambahkan/diperbaiki

- `.gitignore`, `.nojekyll` untuk repo statis dan mencegah backup/kunci lokal tanpa sengaja ikut commit.
- `docs/README.md`, `docs/GITHUB-UPLOAD.md`, `docs/REPO-CLEANUP.md`, petunjuk Supabase manual.
- `tools/test_navigation_survey_winner_350.js`: menyesuaikan label Smart Survey saat ini dan event stub `CustomEvent` pada pengujian Node.
- `tests/test_dpp_352.js`: membaca `index.html` lokal, bukan path absolut file historis, serta menyediakan stub sumber kota Pemda yang dipakai versi DPP sekarang.
- `.github/workflows/checks.yml`: validasi otomatis keenam skrip regresi/statis pada pull request atau push GitHub.

## Di luar cakupan

Tidak menghapus/memindahkan data pengguna di Supabase, tidak menerapkan migrasi, tidak memindahkan server, tidak melakukan force-push atau menghapus history Git. Pengujian cloud produksi dan login pengguna tetap harus dilakukan setelah deploy.

## Verifikasi terhadap unduhan terbaru GitHub

Lihat [laporan perbandingan SHA-256](VERIFIKASI-ZIP-GITHUB-TERBARU-2026-11-05.md). File kode dan migrasi produksi terbaru tidak diubah; hanya penataan repo, dokumentasi, dan skrip uji yang disesuaikan.

> Perhatian: catatan perapian ini mengacu pada basis 3.0.59.21. Pembaruan tampilan dan kalkulasi versi 3.0.59.22 dijelaskan pada [catatan Ringkasan Utama](RINGKASAN-UTAMA-RUP-PENETAPAN-3.0.59.22.md).

## Perapian lanjutan P0–P3 (11 November 2026)

File `docs/history/` yang tidak dijalankan aplikasi dihapus dari snapshot terbaru karena tersedia melalui riwayat Git. Salinan Edge Function legacy, konfigurasi snippet, dua berkas SQL duplikat, dua helper frontend tanpa rujukan runtime, dan panduan unggah 3.0.59.36 juga dihapus. Lihat laporan audit efisiensi yang menyertai paket ZIP untuk daftar lengkap dan pemulihan jika diperlukan. Seluruh modul runtime, migrasi aktif, dan test dipertahankan.
