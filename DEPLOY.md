> **Pembaruan saat ini:** dari 3.0.59.37 ganti 5 file: `index.html`, `sw.js`, `manifest.json`, `frontend/satria-price-analysis.js`, `frontend/satria-price-analysis.css`. Tidak ada migrasi Supabase. Rincian: `docs/PANDUAN-UPDATE-3.0.59.38.md`.

## SATRIA NEXT 3.0.59.38 — Kertas Kerja Analisis Harga (pembaruan dari 3.0.59.37)

Pembaruan dari versi yang terakhir dibagikan ke pengguna (3.0.59.34): ekstrak ZIP UPDATE-336 dan **ganti semua file sesuai struktur folder**. Jangan menghapus file lain dalam repo, dan jangan upload ZIP sebagai satu berkas GitHub tanpa mengekstraknya. Pembaruan termasuk penyempurnaan tampilan bukti 3.0.59.35 yang belum dibagikan terpisah.

Yang berubah: `index.html`, `sw.js`, `manifest.json`, `frontend/satria-price-analysis.js`, `frontend/satria-price-analysis.css`, beberapa tes, dokumen panduan. Tidak ada migrasi SQL. Backup / commit sebelumnya, deploy staging, `Cmd+Shift+R`, lalu uji RUP 67122699 Penawaran → Analisis → Dokumen ke-15 → Cetak.

Laporan menganalisis **harga produk per item**, bukan hanya kepatuhan metadata. Tanggal sumber dan spesifikasi wajib diteliti; laporan dibentuk ulang pada saat dibuka dan bukan bukti historis analisis sebelum transaksi. Rujukan hukum hanya penanda tanggal untuk ditelaah, bukan penetapan penerapan hukum otomatis.

---

## SATRIA NEXT 3.0.59.35 — Hotfix Dokumen Analisis Harga

Perbaikan untuk error **“Dokumen atau paket tidak ditemukan”** saat mencetak laporan analisis harga ke-15.
Semua 15 jenis dokumen kini masuk pemeriksaan/ekspor JSON, dan laporan analisis bisa dicetak sebagai draf tanpa dialog tambahan.
Tidak ada migrasi Supabase atau perubahan transaksi. Lihat [`docs/HOTFIX-DOKUMEN-ANALISIS-HARGA-3.0.59.35.md`](docs/HOTFIX-DOKUMEN-ANALISIS-HARGA-3.0.59.35.md).

---

## SATRIA NEXT 3.0.59.33 — Smart Analisis Kewajaran Harga

Fitur baru: analisis otomatis per paket pada **Paket Pengadaan → Penawaran & Negosiasi** dan dokumen ke-15 **Analisis Kewajaran Harga & Referensi Harga** pada **Dokumen Pengadaan**. Semua data dibaca dari penawaran dan Smart Survey; tidak ada proses approval atau input harga baru. Panduan lengkap: `docs/SMART-ANALISIS-KEWAJARAN-HARGA-3.0.59.33.md`.

Pembaruan GitHub dari versi 3.0.59.32: ganti `index.html`, `sw.js`, `manifest.json`, `frontend/satria-next4.js`; tambahkan `frontend/satria-price-analysis.js` dan `frontend/satria-price-analysis.css`. Pertahankan seluruh file lain. Tidak ada migrasi Supabase.

# Pembaruan SATRIA NEXT 3.0.59.33 — Analisis Harga dan Dokumen BPK

**Dari versi 3.0.59.32:** ganti `index.html`, `sw.js`, `manifest.json` dan tambahkan `frontend/satria-price-analysis.css` serta `frontend/satria-price-analysis.js` dengan path tepat. File analisis harus tersedia lewat HTTPS di path tersebut; bila hanya tiga file root diganti, tombol analisis dapat tampil tetapi halamannya tidak akan terbuka.

Tidak ada migrasi Supabase dan tidak ada modifikasi data transaksi. Backup data dahulu, deploy di branch uji, lalu periksa paket satu penyedia dan beberapa penyedia pada menu **Penawaran & Negosiasi → Analisis harga & bukti**. Setelah itu buka **Dokumen Pengadaan → Analisis Kewajaran Harga & Bukti**, cek identitas instansi dan pejabat, kelengkapan referensi, pratinjau, dan cetak A4 landscape. Muat ulang halaman, ulangi uji, dan pastikan status sinkronisasi Supabase tetap normal.

Catatan pemeriksaan: hasil perhitungan bukan keputusan kewajaran harga final. Dokumen yang disusun sesudah transaksi harus memakai tanggal penyusunan sebenarnya; jangan membuat seolah referensi atau pemeriksaan dilakukan sebelum transaksi. Tautan URL bukan bukti harga historis yang tidak berubah; lampirkan arsip/screenshot asli bila tersedia.

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

# Deployment SATRIA NEXT 3.0.59.27

## Executive Briefing 3.0

Perubahan versi ini ada pada `index.html`, `sw.js`, dan `manifest.json` untuk fungsi aplikasi. Tidak perlu mengubah SQL, Edge Functions, atau data transaksi. Tambahan dokumentasi dan pengujian ada dalam ZIP repo lengkap. Sesudah deploy, uji mode e-Purchasing, SPSE, gabungan, briefing RUP per paket, ekspor CSV, cetak A4/PDF, dan pembatasan data sesuai OPD/tahun. Lihat `docs/EXECUTIVE-BRIEFING-3.0.59.27.md`.

## 1. Backup dan verifikasi sumber

1. Simpan backup JSON SATRIA yang terbaru dan backup Supabase sebelum melakukan pembaruan.
2. Cocokkan berkas `index.html`, `manifest.json`, `sw.js`, serta ikon di root. Gunakan **seluruh isi arsip**, bukan mengunggah arsip ZIP sebagai satu file.
3. Perbaikan Bank RUP 3.0.59.22 memperbaiki tampilan dan kalkulasi lokal RUP/HPS/penetapan. Membagikan ZIP atau commit GitHub **tidak mengubah isi database cloud**.

## 2. Uji aplikasi (staging dahulu)

- Untuk paket historis yang satuannya melebihi HPS namun totalnya tidak melebihi HPS dan pagu, uji **review evaluasi total HPS** dengan kronologi dan nomor bukti. Pastikan nilai di atas harga tayang atau di atas total HPS/pagu tetap diblokir. Review tidak menggantikan pemeriksaan pejabat maupun persetujuan resmi.
- Periksa bahwa revisi rincian atau harga menonaktifkan review lama sampai diperbarui dengan bukti.


- Aktifkan situs melalui HTTPS; untuk PWA jangan bergantung pada `file://`.
- Hapus cache/perbarui service worker bila versi lama tetap muncul.
- Pada Bank RUP, impor JSON lalu simpan RUP manual. Keduanya harus tampil sesuai **hak akses OPD dan tahun** akun.
- Periksa filter Bank RUP, tombol **Tampilkan semua RUP**, status sinkronisasi cloud, serta hasil **reload** dan login ulang.
- Uji RUP yang memiliki HPS lengkap dan pemenang valid: sisa setelah penetapan harus menggantikan HPS paket yang bersangkutan, bukan menguranginya dua kali.
- Uji paket konsolidasi multi-RUP: penetapan tidak boleh otomatis dialokasikan ke masing-masing RUP tanpa dasar pembagian yang jelas.
- Pastikan Viewer tidak dapat mengubah data; Operator tidak melihat OPD/tahun yang tidak ditugaskan.

## 3. Supabase (hanya jika memakai Supabase)

Untuk lingkungan baru, rencanakan bootstrap `supabase/satria-supabase-staging-bootstrap.sql` dan migrasi di `supabase/migrations/` **berdasarkan urutan dan dependensi**. Jangan menjalankan ulang migrasi tanpa memeriksa riwayat migrasi lingkungan yang aktif.

Migrasi dan dokumen utama:

- `20261024052900` s.d. `20261024053400`: assignment OPD/tahun, akses scoped, master bersama, dan sinkronisasi delta.
- `20261028010000_satria_rup_bank_cloud_compat.sql`: kompatibilitas Bank RUP dan RPC scoped; terapkan **setelah migrasi delta**.
- `20261028060000_satria_private_media_storage.sql`: penyimpanan media privat; terapkan **sesudah kompatibilitas Bank RUP**.
- `supabase/manual/SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql`: SQL cloud draft Smart Survey PRO, **manual**, bukan migrasi yang otomatis dijalankan; lihat keterangan di file.

**Penting:** Ada juga migrasi `20261024_satria_user_creation_security.sql` yang dapat memiliki dependensi sendiri. Untuk instalasi lama, cocokkan terhadap daftar migrasi yang sudah diterapkan, jangan menganggap semua berkas belum pernah dijalankan. Detail lanjutan: `docs/SECURITY_SCOPE_HARDENING.md`, `docs/BANK_RUP_CLOUD_MIGRATION.md`, `docs/SUPABASE_MEDIA_STORAGE_3.0.54.md`.

Edge Functions resmi berada hanya di `supabase/functions/`:

```bash
supabase functions deploy admin-list-users
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
```

Konfigurasi akses ada di `supabase/config.toml`. `ALLOWED_ORIGINS` harus mencakup origin aplikasi dan `verify_jwt` harus tetap aktif. Jangan menaruh kunci rahasia di HTML. Penerapan SQL, fungsi, dan validasi izin memerlukan akses admin yang sesuai ke proyek Supabase.

## 4. Pemeriksaan sebelum produksi

Jalankan semua pengujian pada `README.md`. Untuk database, jalankan assertion yang sesuai (`supabase/tests/`) pada staging sesuai hak akses dan instruksi SQL. Verifikasi backup sebelum melakukan perubahan produksi.

Rencana deploy yang aman: **backup → staging → tes RUP + akses + dokumen → deploy GitHub/hosting → cek cache → cek Supabase → produksi**.

## Hotfix form Review Total HPS Historis

Untuk GitHub yang telah menggunakan 3.0.59.23, unggah dan timpa hanya `index.html`, `sw.js`, serta `manifest.json` dari paket update 3 file. Hapus cache PWA bila masih menampilkan versi lama; jangan hapus data aplikasi atau reset database. Tidak ada migrasi Supabase tambahan.

Uji di Penawaran & Negosiasi: isi alasan dan bukti, centang pemeriksaan, Simpan review, lalu pastikan status review tercatat. Review hanyalah catatan historis, bukan legalisasi pengadaan.

## Tambahan 3.0.59.26 — koreksi nama tayang

Tidak ada migrasi Supabase. Ganti `index.html`, `sw.js`, dan `manifest.json`; file lainnya tetap. Periksa referensi katalog dan simpan bukti asli sebelum koreksi.
