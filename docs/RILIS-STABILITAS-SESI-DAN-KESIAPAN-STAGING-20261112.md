# SATRIA NEXT — Rilis Stabilitas Sesi & Kesiapan Staging (12 November 2026)

**Basis:** ZIP rilis gabungan Optimasi Rekomendasi 1–5 yang telah dikomit pengguna (276 file).  
**Jenis rilis:** hardening klien cloud, audit staging, dan laporan kualitas GitHub.  
**Tidak ada migrasi schema baru, perubahan rumus PBJ, proses persetujuan berjenjang, atau penghapusan fitur.**

## Mengapa perubahan diperlukan

Sebelumnya, `pull()` dan `saveDeltaChanges()` dapat menerima hasil permintaan asynchronous yang berasal dari sesi lama. Dalam kondisi logout/pergantian akun saat permintaan masih berjalan, hasil tersebut berisiko menyentuh status sinkronisasi atau memori sesi baru. Kode juga memperbolehkan dua `pull()` bersamaan, yang berisiko membuat respons lebih lambat mengganti data yang lebih baru.

## Perubahan runtime

- `frontend/refactor/js/05-cloud-sync.js`: menambahkan epoch sesi dan epoch tarik. Hasil tarik, kirim delta, dan operasi Sampah diperiksa terhadap klien, akun, organisasi dan epoch yang memulai permintaan. Hasil terlambat dari sesi lama diabaikan; dua tarik bersamaan hanya mengizinkan yang terbaru mengubah snapshot.
- Tarik manual ditolak ketika kirim delta masih berlangsung agar perubahan yang sedang ditransaksikan tidak terganti; pengguna tidak perlu melalui persetujuan apa pun.
- Saat logout, aplikasi menginvalidasi permintaan lama dan menunggu persistensi scoped IndexedDB yang sedang berlangsung sebelum menghapus cache akun. Hal ini memperkecil risiko cache sesi lama muncul kembali sesudah logout.
- `sw.js`: nama cache PWA diganti untuk memastikan perubahan runtime diunduh sebagai satu versi.

## Pengujian dan fasilitas staging

- `tools/test_cloud_session_race.cjs`: tes sintetis menggunakan fungsi sumber yang sesungguhnya dengan respons yang sengaja ditunda; menguji logout/pergantian akun, tarik bersamaan, tarik saat delta berjalan, respons delta lama, dan pemeriksaan Sampah.
- `tools/stage5_staging_http_audit.mjs`: wajib memasukkan **SATRIA_STAGING_HOSTNAME** yang sama persis dengan hostname URL staging HTTPS; memeriksa scope `opd`, `unit`, `pejabat`, `paket`, `rupBank`, dan metadata Sampah untuk Operator/Viewer. Skrip ini baca-saja.
- `tools/release_readiness.py`: meringkas hasil QA lokal dan daftar bukti staging yang belum tersedia. **Tidak pernah secara otomatis meluluskan produksi**, termasuk jika diberi lampiran bukti yang belum divalidasi keasliannya.
- `.github/workflows/satria-quality.yml`: mengunggah laporan QA dan readiness dalam artefak GitHub Actions pada setiap commit, tanpa tahap approval berjenjang.

## Cara pengujian

```bash
python tools/run_quality_gate.py --report /tmp/satria-quality.json
python tools/release_readiness.py --quality-report /tmp/satria-quality.json --out /tmp/satria-readiness.json
```

Untuk pengujian API staging baca-saja, atur variabel lingkungan sesuai header `tools/stage5_staging_http_audit.mjs`, termasuk hostname staging dan JWT akun uji, kemudian jalankan:

```bash
node tools/stage5_staging_http_audit.mjs
```

Jangan masukkan token ke Git, screenshot, log, atau issue. Jalankan hanya pada **Supabase staging**, bukan produksi. Uji positif arsip–pulih atomik dan backup–restore membutuhkan fixture serta environment staging terpisah.

## Pengujian yang diselesaikan pada paket ini

- 47/47 pemeriksaan quality gate Node/Python (lokal)
- 4/4 skenario browser terpilih lulus (CDN/Supabase ditiru)
- 97/97 aset frontend terverifikasi build

Hasil ini **tidak** membuktikan RLS maupun transaksi PostgreSQL asli. Status kesiapan tetap `STAGING_REQUIRED`. Bagian yang wajib diselesaikan sebelum produksi: migrasi dan RLS nyata, uji hak akses lintas organisasi/OPD/tahun, arsip–pulih pada dua perangkat, uji konflik versi, dan uji backup–restore.

## Rencana perubahan tunggal GitHub

Ekstrak ZIP repo di atas repo rilis 1–5. Periksa diff, jalankan quality gate, lalu commit sebagai satu perubahan terencana. **Tidak perlu mengganti tabel Supabase atau menjalankan migrasi baru untuk rilis ini.** Rollback: kembalikan commit rilis 1–5 dan muat ulang PWA; basis data tidak berubah oleh paket ini.
