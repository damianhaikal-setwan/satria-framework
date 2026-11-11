# SATRIA NEXT — Patch Keamanan Scope Cloud (12 November 2026)

## Tujuan

Patch kecil ini melanjutkan *PATCH STABILITAS* tanpa mengubah rumus HPS, dokumen, tabel Supabase, atau migrasi lama. Fokusnya melindungi pemuatan data Operator/Viewer dari respons cloud yang tidak sesuai penugasan dan respons Realtime dari sesi sebelumnya.

## Perubahan aplikasi

- **Validasi sebelum penerapan data:** `frontend/satria-cloud-scope.js` memvalidasi role, OPD, tahun, dan koleksi wajib **sebelum** payload masuk ke state aktif. Daftar data yang diizinkan dibangun ulang dari allowlist. Baris Paket/Bank RUP diproyeksikan menurut OPD dan tahun; Unit dan Pejabat menurut OPD. Katalog organisasi tetap dapat dibaca sesuai kebijakan kolaborasi sebelumnya.
- **Respons salah cakupan ditolak:** data dengan role tidak cocok, penugasan kosong/ganda, master OPD hilang, tahun tidak tersedia, atau struktur tidak valid mengunci tampilan cloud; tidak ada pembaruan setengah jalan.
- **Perpindahan sesi:** respons RPC non-admin tidak lagi mengubah `member.scope` sebelum pengaman sesi berhasil. Pembacaan versi Realtime serta callback langganan lama tidak memengaruhi sesi baru.
- **PWA:** aset pengaman baru ditambahkan ke `index.html` dan daftar precache; identitas cache diganti agar pembaruan termuat konsisten.
- **Tes:** kasus bermusuhan sintetis dan tes browser Sampah tiruan sekarang menggunakan kontrak `scope.role` sebenarnya dari RPC.

## Pengujian

- `python tools/run_quality_gate.py --report qa.json`: **48/48 lulus** (Node, pemeriksaan statis, build, dan hash).
- `python tools/test_refactor_browser.py`: lulus.
- `python tools/test_cloud_trash_stage2_browser.py`: lulus (cloud tiruan).
- `python tools/test_stage5_admin_session_browser.py`: lulus (cloud tiruan).
- `python tools/test_procurement_core_stage3_browser.py`: lulus.

Pengujian ini **tidak menggantikan** pengujian keamanan dan transaksi pada PostgreSQL/Supabase staging nyata. RLS, RPC otorisasi lintas akun, konflik versi, dan pemulihan backup asli masih berstatus **STAGING_REQUIRED**.

## Penerapan sebagai satu commit

1. Gunakan commit GitHub setelah *PATCH STABILITAS* sebagai baseline.
2. Ekstrak ZIP patch ke **root repositori**, pertahankan struktur foldernya dan timpa file yang berubah.
3. Jalankan `python tools/run_quality_gate.py` atau periksa GitHub Actions.
4. Deploy ke **staging** dan uji menggunakan akun nyata dengan assignment OPD/tahun. Jangan mulai dari produksi.
5. Pastikan PWA mendapat cache baru; jika perangkat masih menggunakan versi lama, periksa pembaruan service worker.

**Rollback:** batalkan satu commit patch ini; tidak ada perubahan skema database dan tidak ada penghapusan file. Jangan kembali ke runtime lama jika pengujian staging sudah menunjukkan ada persoalan cakupan di basis sebelumnya.

**Prinsip SATRIA:** tanpa approval berjenjang; keamanan peran merupakan pembatasan akses langsung, bukan alur persetujuan pekerjaan.
