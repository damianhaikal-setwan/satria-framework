# Laporan Perbaikan SATRIA — GitHub + Supabase

**Basis:** `satria-framework-main.zip` dari pengguna, dibandingkan dengan SATRIA Framework 3.0.41.

## Temuan paling penting

- File `index.html` di ZIP **sudah sama persis** dengan HTML 3.0.41. Tidak perlu mengganti generator dokumen yang berhasil.
- Jembatan database belum mendukung koleksi `rupBank` di daftar delta dan scoped RPC. Data RUP bisa ada di browser lokal tetapi tidak ikut terkirim ke cloud.
- RPC scoped untuk non-admin tidak mengembalikan daftar RUP menurut OPD dan tahun. Jika operator mengakses Bank RUP, proyeksi cloud tidak lengkap.
- Penghapusan OPD/tahun belum memeriksa RUP yang masih disimpan di Bank RUP pada lapisan server.
- Panduan deployment lama tidak mencantumkan migrasi 53300/53400 dan kini dilengkapi migrasi 20261028010000.
- Ada direktori salinan lama Edge Functions di luar `supabase/functions/`, berisiko membuat deployment memilih versi yang usang.

## Perubahan yang diselesaikan

- `index.html`: tambah `rupBank` dalam delta cloud, sortir dependensi, pembersihan scope saat logout, perlindungan penghapusan Bank RUP terhubung paket, filter Bank RUP setelah login Operator.
- `supabase/migrations/20261028010000_satria_rup_bank_cloud_compat.sql`: ganti definisi RPC `satria_get_scoped_state` dan `satria_apply_state_delta` secara aditif, dengan validasi OPD, tahun, duplikasi, referensi paket, dan hak akses. Tidak menghapus data atau membuat record palsu.
- `supabase/tests/rup_bank_cloud_assertions.sql`: pemeriksaan struktur dan data historis read-only.
- `tools/test_rup_bank_contract.py`: uji kontrak kode dan fungsi JavaScript delta tanpa jaringan.
- `tools/security_static_check.py`: sesuaikan dengan mekanisme delta terbaru (bukan scoped-save lama).
- `README.md`, `DEPLOY.md`, dan `docs/`: cara deploy/staging dan matriks uji negatif diperjelas.
- `sw.js`, `manifest.json`: perbarui identitas cache/aset PWA untuk SATRIA 3.0.41.
- Hapus metadata `__MACOSX`, `.DS_Store`, dan tiga direktori duplikat Edge Functions nonkanonis dari paket rilis.

## Pengujian pada sesi ini

- `node --check`: **19 skrip JavaScript inline lolos**.
- `python tools/security_static_check.py`: **27/27 lulus**.
- `python tools/test_rup_bank_contract.py`: **seluruh pemeriksaan dan uji delta JavaScript lulus**.
- Pemeriksaan keberadaan renderer/14 jenis dokumen dan diff HTML menunjukkan generator dokumen **tidak dimodifikasi**.

## Belum dilakukan dan tidak boleh dianggap selesai

- Migrasi SQL **belum diterapkan** ke Supabase milik pengguna.
- SQL tidak diuji pada database PostgreSQL hidup di sesi ini; perlu staging, backup, dan pemeriksaan log.
- Pembatasan RLS/RPC multiakun dan sinkronisasi 120+ RUP belum diuji end-to-end di staging.
- Tidak ada perubahan yang langsung didorong ke GitHub remote. ZIP yang disediakan adalah repositori hasil modifikasi untuk pengguna unggah/commit.

**Urutan:** backup → staging → migrasi 20261028010000 setelah 53400 → validasi peran/OPD/tahun → deploy repositori → smoke test → produksi.
