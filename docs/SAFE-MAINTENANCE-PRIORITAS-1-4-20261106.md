# SATRIA — Perbaikan Prioritas 1–4: keselamatan data, keamanan, pemulihan, diagnostik

Tanggal paket: 6 November 2026. Basis: `SATRIA-Lengkap-Perawatan-SATRIA-2026-11-06.zip` (versi 3.0.59.39). Hasil perubahan: versi tampilan/cache 3.0.59.40. **Tidak menjalankan migrasi SQL, perubahan data, atau deploy produksi.**

## Ringkasan apa yang benar-benar diterapkan

| Prioritas | Implementasi dan bukti | Batas pengujian |
|---|---|---|
| P1 — Integritas backup/sinkronisasi | Ekspor JSON tidak lagi mengatur `S.dirty=false`. File sementara Blob ditutup kembali. Status tertunda tetap dipakai auto-retry online dan peringatan saat logout/refresh. Tes mencakup backup saat status kotor dan bersih. | Kode diuji dalam VM lokal. Offline→online dan konflik *pada Supabase nyata* tidak dijalankan. Ketahanan perubahan tertunda setelah restart pada mode cloud juga belum dibuktikan. |
| P2 — Keamanan Supabase | Audit katalog SQL **SELECT saja** di `supabase/SATRIA-READONLY-SECURITY-CHECK-20261106.sql`. Memeriksa RLS tabel penting, kebijakan dan izin anon/RPC. Tambahan tes memastikan skrip tidak memiliki DDL/DML. | Tidak mengakses Supabase produksi, sehingga status RLS/RPC yang benar-benar terpasang **belum terverifikasi**. Harus dijalankan dan ditafsirkan admin. |
| P3 — Pemulihan data | Drill impor lokal berbasis handler asli: backup valid, rusak, dibatalkan; validasi relasi paket/OPD/penyedia, tahun, angka, dan admin. Saat valid, impor tetap berstatus perlu sinkronisasi. | Dataset sintetis, **bukan** restore cloud, media storage, atau prosedur DR terjadwal. Tidak ada data pengguna nyata dipakai. |
| P4 — Diagnostik | Kartu **Sinkronisasi cloud** pada Perawatan SATRIA menampilkan login, baseline cloud, perubahan tertunda, offline, konflik dan retry; laporan JSON memuat metadata ini tanpa nama paket, URL, token, email, atau UUID. Tampilan HP/desktop diuji. | Metadata dari klien aktif; status “Terhubung” **bukan** verifikasi kesehatan Supabase, RLS, ataupun cadangan cloud. Log hanya sesi aktif. |

## Urutan pemeriksaan sebelum merge ke `main`

1. **Backup GitHub `main`** (branch/commit sebelum perubahan). Pastikan data penting memiliki cadangan melalui mekanisme resmi Supabase, bukan hanya JSON lokal.
2. Terapkan patch sesuai struktur folder; jangan kosongkan repositori dan jangan jalankan SQL migrasi. Versi `sw.js` berubah agar aset baru dimuat bersama-sama.
3. Jalankan GitHub Actions yang ada. Tambahan tes: `node tools/test_backup_sync_and_restore.cjs`, `node tools/test_sync_health_reporting.cjs`, `python tools/test_readonly_security_audit.py`. Untuk browser lokal: `python tools/test_care_center_browser.py`.
4. **Uji staging** menggunakan akun dan dataset *uji*, bukan akun utama produksi: ubah 1 record saat online → simpan; putus jaringan → ubah 1 record → unduh backup → pastikan indikator masih menyebut pending → pulihkan jaringan → pastikan perubahan tersinkron hanya satu kali. Uji konflik dari dua sesi tanpa overwrite otomatis. Jika uji gagal, jangan deploy.
5. Uji impor di **staging/salinan**: unduh backup, batalkan impor, tes berkas tidak valid, impor data sintetis, tinjau seluruh relasi item/penawaran/RUP, ekspor ulang, bandingkan nilai. Jangan pernah melakukan restore langsung ke organisasi produksi hanya untuk pengujian.
6. Buka Supabase SQL Editor oleh Admin dan jalankan **hanya** berkas `SATRIA-READONLY-SECURITY-CHECK-20261106.sql`; tinjau tabel *RLS NONAKTIF/TIDAK DITEMUKAN*, izin anon yang tak semestinya, dan fungsi RPC yang tidak ditemukan. Tidak ada perubahan otomatis dari skrip tersebut.
7. Pada **staging** uji dengan **akun terpisah** Admin, Operator (OPD A + Tahun A), dan Viewer. Pastikan Operator tidak melihat/mengubah OPD/tahun lain, Viewer tidak dapat menulis, dan anon tidak dapat membaca snapshot. Jangan menaruh service_role key di browser. Pengujian lintas-peran harus terjadi di server, bukan hanya pada UI.
8. Pantau 24 jam pertama setelah deploy. Jika ada error, rollback commit frontend dan jalankan review data cloud; jangan reset database otomatis atau memaksa restore saat terjadi konflik.

## Perilaku yang sengaja tidak dibuat otomatis

- Tidak menghapus cache data pengguna, me-reset organisasi, melakukan restore cloud, mengubah hak akses, atau menjalankan SQL migrasi.
- Tidak memperbaiki konflik versi dengan menimpa perubahan pengguna.
- Tidak mengubah HPS, harga tayang, negosiasi, status kewajaran, pemenang, atau template dokumen.
- Tidak mengirim log ke layanan pihak ketiga; laporan memuat ringkasan metadata nonrahasia saat ini saja.

## Hasil uji lokal pada paket ini

- Struktur 34 JS + 22 CSS, daftar cache PWA dan sintaks: lulus.
- Security assertions statis: 27/27 lulus (kode, **bukan server**).
- Regresi modul inti dan Bank RUP: lulus.
- Tes P1/P3: backup dirty/clean, valid/invalid/cancel restore: lulus.
- Tes P2: SQL hanya operasi baca: lulus.
- Tes P4: pending/offline/conflict, nonmutasi, pembatasan isi: lulus.
- Browser Chromium: halaman perawatan, unduh laporan, pembatasan Admin/Operator dan tampilan mobile: lulus.
- Uji DB cloud/RLS produksi, media recovery, multiakun dan offline lintas restart: **belum dilakukan**.

## Panduan rollback

Gunakan commit cadangan `main` untuk kembali ke file frontend sebelumnya. `sw.js` versi lama harus kembali bersamaan dengan `index.html` dan asset modul dari versi tersebut. Setelah rollback, buka ulang aplikasi dan cek sinkronisasi. Jika pengguna memiliki perubahan yang belum tersinkron, **unduh backup terlebih dahulu**; rollback antarmuka tidak otomatis memulihkan snapshot cloud. Tidak ada migrasi DB dari paket ini yang perlu di-rollback.
