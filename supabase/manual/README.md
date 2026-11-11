# SQL manual untuk SATRIA NEXT

Direktori ini memuat skrip SQL yang **tidak** masuk alur timestamp di `supabase/migrations/`.

- `SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql` mendukung draft Smart Survey PRO. Header skrip mensyaratkan migrasi scope OPD/tahun `20261024053200` terlebih dahulu. Terapkan dan uji pada **staging**, cek ulang apakah skrip sudah pernah dijalankan pada lingkungan lama.

Memindahkan file ke direktori ini **tidak** menerapkan perubahan pada Supabase. Jangan mengeksekusi secara membabi buta atau pada database produksi tanpa backup dan pemeriksaan riwayat migrasi.


## SATRIA NEXT Tahap 2 — Sampah cloud (11 November 2026)

Gunakan migrasi versioned `../migrations/20261111170000_satria_cloud_recycle_atomic.sql` setelah seluruh migrasi sebelumnya; jalankan assertion `../tests/cloud_recycle_stage2_assertions.sql` pada **staging**. Prosedur dan batas uji: `../../docs/IMPLEMENTASI-TAHAP-2-SAMPAH-CLOUD-20261111.md`. Jangan jalankan SQL hasil modifikasi atau buat entri Sampah manual lewat tabel.
