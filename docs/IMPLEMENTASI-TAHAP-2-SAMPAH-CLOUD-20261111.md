# SATRIA NEXT 3.0.59.59 — Implementasi Tahap 2: Sampah Supabase

Tanggal: 11 November 2026  
Basis: ZIP hasil Tahap 1 (`SATRIA_NEXT_3.0.59.59_TAHAP1_KEAMANAN_SAMPAH.zip`).  
Status: **source code, migrasi SQL, dan pengujian lokal siap ditinjau untuk staging. Belum diterapkan/diuji pada Supabase sungguhan. Belum dinyatakan siap produksi.**

## Ringkasan perubahan

1. **Tabel cloud `public.satria_trash_entries`** berisi snapshot record yang diarsipkan, OPD, tahun anggaran, aktor, waktu, dan waktu pemulihan. Metadata `retain_until` disediakan untuk kebijakan retensi 365 hari, **tidak ada penghapusan otomatis**. Tidak ada tombol hapus permanen.
2. **RLS baca sesuai peran:** Admin organisasi dapat melihat semua entri. Operator/Viewer hanya dapat melihat entri Paket dan Bank RUP pada kombinasi OPD serta tahun yang ditugaskan. Master di Sampah hanya dapat dibaca Admin. Browser hanya diberi `SELECT`, tidak dapat langsung `INSERT/UPDATE/DELETE` tabel Sampah.
3. **RPC transaksi atomik:** `satria_archive_record(organization,version,collection,id)` dan `satria_restore_record(organization,version,trash_id)`. Keduanya memakai keanggotaan aktif, role, scope, pemeriksaan versi, penguncian baris, dan operasi perubahan snapshot dari mesin delta lama yang sudah tervalidasi. Kegagalan akan rollback seluruh transaksi SQL.
4. **Jalur `DELETE` lama ditutup:** RPC delta publik tetap mengizinkan upsert dan settings, tetapi menolak perintah `delete`. Mesin delta lama dinamai ulang internal dan tidak dapat dieksekusi oleh role browser. Trigger `satria_state_enforce_cloud_archive` juga menolak penghilangan record dari snapshot (termasuk lewat Admin full-state overwrite) kecuali ada arsip record yang cocok **dalam transaksi yang sama**.
5. **Pemulihan aman:** menolak ID yang sudah aktif; menguji keberadaan referensi dokumen/penyedia/master melalui validator delta; melindungi tautan Paket–Bank RUP dan dependensi arsip. Tahun anggaran yang masih diperlukan arsip tidak boleh dikeluarkan dari daftar tahun aktif.
6. **UI Sampah terintegrasi:** tautan menu lama dipertahankan. Dalam mode cloud, daftar diambil dari server dengan maksimal 250 entri terbaru, label nama tanpa mengunduh seluruh payload, tombol Pulihkan, dan Segarkan. Hapus/Pulihkan dilakukan tanpa mutasi optimistis lokal; aplikasi menarik snapshot cloud setelah transaksi sukses. Daftar Sampah juga disegarkan saat versi cloud berubah lewat realtime.
7. **Batasan lokal tetap:** IndexedDB Tahap 1 dan backup JSON lokal masih terpisah dari Sampah cloud. Sinkronisasi `S.sampah` ke snapshot organisasi tetap dilarang. Tidak ada alur verifikasi/persetujuan berjenjang.

## Berkas utama

| Berkas | Fungsi |
|---|---|
| `supabase/migrations/20261111170000_satria_cloud_recycle_atomic.sql` | Migrasi tabel, RLS, trigger, wrapper delta, RPC atomik. |
| `supabase/tests/cloud_recycle_stage2_assertions.sql` | Pemeriksaan katalog SQL **read-only**, dijalankan setelah migrasi pada staging. |
| `frontend/refactor/js/05-cloud-sync.js` | Klien `SATRIA_CLOUD_TRASH` dan sinkronisasi tampilan. |
| `frontend/refactor/js/01-app-core.js` | Menu Sampah mode cloud, hapus/pulih async; tindakan lama tanpa server contract tetap diblokir. |
| `sw.js` | Cache PWA ditingkatkan agar browser tidak terus memakai JS Tahap 1. |
| `tools/test_cloud_trash_stage2.cjs` | Pengujian kontrak statis pada migrasi, kode, dan pembatasan akses. |
| `tools/test_cloud_trash_stage2_browser.py` | Uji browser dengan **Supabase tiruan** (bukan bukti RLS PostgreSQL). |

## Prosedur staging sebelum aktivasi

1. Pastikan seluruh migrasi sebelumnya terpasang sampai `20261028060000_satria_private_media_storage.sql` dan tidak ada migrasi custom yang mengubah kontrak delta. **Cadangkan database staging** dan salinan aplikasi Tahap 1; backup file JSON sendiri tidak memuat Sampah cloud.
2. Di Supabase staging, jalankan migrasi `20261111170000_satria_cloud_recycle_atomic.sql` **satu kali** melalui mekanisme migrasi yang mencatat versi. Periksa tidak ada error; seluruh DDL berada dalam satu transaksi SQL. PostgREST diberi notifikasi reload schema.
3. Jalankan `supabase/tests/cloud_recycle_stage2_assertions.sql` di SQL Editor dan pastikan menghasilkan NOTICE `PASS Stage2 catalog checks`.
4. Dengan **akun staging** Admin, Operator (minimal dua OPD/tahun berbeda), dan Viewer, uji panggilan REST/RPC yang berjalan sebagai JWT pengguna sesungguhnya, bukan hanya SQL Editor role postgres:
   - Admin: arsipkan lalu pulihkan Paket; ID dan detail harus identik, metadata aktor/tanggal tersimpan, versi meningkat dua kali.
   - Operator: Paket/RUP dalam OPD+tahun terdaftar boleh diarsip dan dipulihkan; di luar scope **ditolak 42501**. Penghapusan master oleh Operator **ditolak**.
   - Viewer: boleh membaca Sampah sesuai OPD+tahun tetapi operasi arsip/pulih **ditolak 42501**.
   - Panggilan delta lama dengan `op='delete'` **ditolak**; update snapshot yang membuang paket tanpa entri Sampah pada transaksi yang sama **ditolak**.
   - Upsert Paket/Bank RUP yang valid dan sinkronisasi biasa tetap lulus.
   - Coba dua akun mengubah versi yang sama: klien dengan versi usang harus ditolak `40001`; tidak ada overwrite.
   - Coba restore dengan ID yang sudah digunakan, RUP/master hilang, OPD/tahun tidak aktif: restore harus gagal dan entri Sampah tetap utuh.
   - Cek cross-device: pada browser A arsipkan Paket; browser B masuk akun yang berwenang dan segarkan Sampah; pulihkan dari B; browser A menarik data terbaru.
5. Uji PWA cache baru, offline→online, reload, login ulang dan perpindahan akun. Uji backup database dan simulasi pemulihannya pada staging sebelum deployment produksi.

## Hal yang sengaja belum dibuka

- Hapus/pulihkan `users` lokal, `penawaran` (baris bersarang), `tahun`, `media/kop/logo`, `snapshot reset`, hapus beberapa item/produk Smart Survey dan submodul SPSE **belum memiliki RPC Sampah cloud**. Aksi delete pada UI inti yang disebut sudah dijaga agar tetap ditolak saat cloud aktif. Namun perubahan data bersarang melalui modul lain masih harus diaudit, karena trigger saat ini melindungi hilangnya **record tingkat koleksi**, bukan semua field/nested records yang dihapus lewat upsert.
- Belum ada pagination >250 entri, ekspor khusus Sampah cloud, mekanisme purge terjadwal, atau prosedur forensik data yang dihapus sebelum migrasi. Tidak ada klaim dapat memulihkan data yang sudah dihapus sebelumnya.
- Belum ada pengujian SQL nyata karena tidak ada koneksi Supabase staging/produksi pada pekerjaan ini. Menjalankan uji browser dengan server tiruan **tidak** membuktikan RLS, transaksi atau performa PostgreSQL.
- Pada mode cloud, data Sampah tidak ikut backup JSON lokal. Pertahankan backup database Supabase terpisah; jangan mengandalkan satu salinan.

## Pemulihan / rollback

- Bila migrasi gagal, transaksi SQL rollback otomatis. **Jangan deploy frontend Tahap 2 sebelum migrasi lulus staging.** Frontend Tahap 2 tanpa migrasi menolak arsip/pulih karena RPC/tabel tidak tersedia; data aktif tidak dihapus.
- Bila setelah migrasi frontend bermasalah, kembalikan frontend Tahap 1; fungsi hapus cloud menjadi tertutup. **Jangan membuka kembali RPC delta DELETE lama** hanya untuk menyesuaikan UI.
- Bila perlu rollback database, gunakan snapshot/cadangan staging yang telah diverifikasi dan prosedur restorasi resmi. Jangan menghapus tabel Sampah secara manual dalam keadaan data aktif sudah terarsip di sana.
- Tahap 3 tetap fokus pada konsistensi Bank RUP–Paket–HPS–Negosiasi–Dokumen serta cakupan arsip terhadap record bersarang.

**Prinsip SATRIA:** cepat membantu manusia, data aman, operasi dapat dibatalkan, maintenance sederhana, tanpa approval workflow berjenjang. Hak akses role bukan proses persetujuan.
