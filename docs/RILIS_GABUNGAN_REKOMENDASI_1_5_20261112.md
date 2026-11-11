# SATRIA NEXT — Satu Rilis Peningkatan Rekomendasi 1–5

**Basis:** `SATRIA_NEXT_P0P3_REPO_EFISIEN.zip` (268 file), sudah dijadikan baseline oleh pengguna. **Status:** kandidat staging; tidak ada commit, push, akses database, ataupun migrasi yang dijalankan oleh pembuatan paket ini.

## Ringkasan tindakan

| Agenda | Perubahan yang benar-benar ada | Bukti dan batas |
|---|---|---|
| 1 — Stabilitas/keamanan cloud | Validasi delta kini menolak baseline dengan baris tanpa ID/ID duplikat dan perubahan jenis/koleksi di luar kontrak; indikator PWA mengambil status read-only `SATRIA_SYNC_HEALTH` tanpa membungkus fungsi sinkronisasi atau menyembunyikan error | Tes delta dan indikator lulus. **RLS, transaksi arsip/pulih dan backup pada Supabase nyata belum diuji.** Tidak mengubah SQL/migrasi aktif. |
| 2 — Efisiensi/duplikasi | Gaya `.satria-sync-indicator` dipindah dari injeksi JavaScript ke `frontend/satria-combined-ux.css`; tidak ada penggabungan membabi buta modul besar | Tes struktur dan browser lulus; CSS file sudah dimuat oleh aplikasi. |
| 3 — Modularitas inti | Modul pure `satria-procurement-core.js` memiliki `createBankIndex` dan `packageSnapshots` untuk pemrosesan banyak RUP/paket dalam sekali indeks; logika HPS/PPN/negosiasi tidak berubah | Perbandingan snapshot lama-baru dan 1.527 regresi numerik lulus. Fungsi bulk disediakan untuk layar analitik berikutnya; **tidak semua controller sudah beralih**. |
| 4 — Performa/PWA | Cache PWA dibatasi ke aset resmi, tidak menyimpan respons URL ber-query, bukan cache umum seluruh GET satu origin; skrip build deployment deterministik byte-identical; baseline 500/5.000 paket | Empat browser smoke test lulus. Benchmark sintetis bukan angka produksi; tidak ada klaim kenaikan kecepatan universal. |
| 5 — Otomatisasi kualitas | `.github/workflows/satria-quality.yml`, `tools/run_quality_gate.py`, tes baru keamanan cache/delta/indikator, dan `tools/build_frontend.py` | **45/45** pemeriksaan lokal berhasil; CI GitHub baru berjalan setelah di-commit. Tidak ada approval gate berjenjang. |

## Bukti uji lokal (pada paket saat dibuat)

- `python tools/run_quality_gate.py --report /tmp/satria-quality-report.json` → **45/45** (39 tes Node, 4 pemeriksaan Python, build, hash output).
- Pengujian browser berhasil: `test_refactor_browser.py`, `test_procurement_core_stage3_browser.py`, `test_stage4_modular_ui_browser.py`, `test_cloud_trash_stage2_browser.py` (**4/4**, endpoint cloud memakai tiruan).
- Build: **97 file aset frontend** disalin byte-identik dari source plus satu `satria-build-manifest.json`. Tidak ada transpile, minifikasi atau perubahan semantik.
- Angka browser sintetis (Chromium headless, CDN disimulasikan) pada mobile 390 px: 500 paket **38,5 ms**, 5.000 paket **346,4 ms**; desktop 1280 px: 500 paket **6,2 ms**, 5.000 paket **29 ms**. Perbandingan baseline lama: 35,3 / 397,7 / 7,8 / 27,6 ms; campuran naik-turun sesuai variasi lingkungan. **Jangan gunakan angka ini sebagai SLA atau bukti produksi.**

## Batas keamanan dan kesiapan produksi

**Gate P0 masih terbuka.** Belum ada koneksi Supabase staging melalui akun Admin, Operator, dan Viewer; SQL RLS dan RPC tidak dieksekusi terhadap PostgreSQL. File uji staging sudah ada dari rilis P0–P3:

1. Siapkan *staging terisolasi*, akun tiga peran, organisasi/OPD/tahun uji, dan backup database plus Storage; uji pemulihan backup di lingkungan salinan.
2. Jalankan migrasi yang belum terpasang **hanya pada staging setelah ditinjau** dan catat versinya. Jangan mengulang migrasi Tahap 2 secara sembarangan.
3. Eksekusi read-only `supabase/validation/STAGE5_READONLY_SECURITY_GATE.sql` dan `STAGE6_NESTED_READONLY_GATE.sql` di SQL Editor staging. Simpan hasil tanpa data pribadi atau JWT.
4. Gunakan `node tools/stage5_staging_http_audit.mjs` dan `node tools/stage6_staging_negative_probes.mjs` dengan environment `SATRIA_STAGING_CONFIRMED=YES_STAGING_ONLY` dan nama host staging yang cocok. Skrip ini tidak dapat membuktikan jalur arsip/pulih **sukses**.
5. Buat data sintetis khusus staging lalu uji RLS positif/negatif, versi konflik, arsip/pulih penawaran dan media, scope lintas OPD/tahun/organisasi, pergantian akun, serta rollback.
6. Hanya setelah semua lulus, pertimbangkan deployment produksi. Jangan memasukkan JWT, service_role, password, maupun output SQL berisi identitas ke GitHub.

**Perhatian:** PWA akan memerlukan cache versi baru. Browser yang sebelumnya memasang SW akan mengambil aset cache baru saat online; uji setelah hard reload, kondisi offline, dan cache yang belum terisi. Tautan aplikasi dengan parameter query dan endpoint di luar allowlist akan diteruskan ke jaringan, bukan dilayani oleh cache lokal.

## Cara menerapkan dalam satu commit

`ZIP` berisi folder `satria-framework-main/`; **salin isinya ke root clone GitHub**, jangan commit ZIP atau meletakkan folder tambahan. Tinjau diffs sebelum commit:

```bash
git switch -c feat/satria-opt5-gabungan
# ekstrak ZIP, salin isi satria-framework-main/ ke root clone
python tools/run_quality_gate.py --report /tmp/satria-quality-report.json
python tools/build_frontend.py --output /tmp/satria-frontend-deploy
git diff --check
git status --short
git add -A
git commit -m "refactor(satria): stabilitas sinkronisasi, core, PWA dan quality gate"
git push -u origin feat/satria-opt5-gabungan
```

Jika branch utama membutuhkan satu commit saja, gunakan squash merge setelah uji. Commit Github **tidak** otomatis menjalankan migrasi Supabase. Tidak ada verifikasi atau persetujuan berjenjang baru dalam fitur SATRIA; workflow hanya menjalankan test otomatis.

## Rollback

- Simpan tag/commit basis 268 file dan backup data staging sebelum uji. Jika browser bermasalah, kembalikan source ke commit basis dan kosongkan/hapus cache aplikasi *sesuai kebutuhan pengguna*, bukan data IndexedDB.
- Tidak ada migrasi SQL baru pada rilis ini, sehingga rollback kode tidak men-drop tabel Sampah, data, atau media.
- Bila kegagalan berasal dari RLS/migrasi yang sudah pernah diterapkan pada tahap sebelumnya, jangan langsung rollback dengan `DROP TABLE`. Restore hanya melalui prosedur backup database yang sudah diuji.

## Yang sengaja belum dikerjakan

- Tidak ada klaim login/arsip/pulih berhasil pada Supabase staging nyata.
- Tidak ada pembongkaran controller lain yang berisiko merusak berkas besar.
- Tidak ada minifikasi otomatis pada sumber, sehingga JS/CSS tetap mudah ditelusuri dan dirawat.
- Tidak ada approval workflow; pembatasan role yang ada tetap hanya untuk keamanan data.
