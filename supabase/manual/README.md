# SQL manual untuk SATRIA NEXT

Direktori ini memuat skrip SQL yang **tidak** masuk alur timestamp di `supabase/migrations/`.

- `SATRIA-3_0_59-WAJIB-Migrasi-Draft-Cloud.sql` mendukung draft Smart Survey PRO. Header skrip mensyaratkan migrasi scope OPD/tahun `20261024053200` terlebih dahulu. Terapkan dan uji pada **staging**, cek ulang apakah skrip sudah pernah dijalankan pada lingkungan lama.

Memindahkan file ke direktori ini **tidak** menerapkan perubahan pada Supabase. Jangan mengeksekusi secara membabi buta atau pada database produksi tanpa backup dan pemeriksaan riwayat migrasi.
