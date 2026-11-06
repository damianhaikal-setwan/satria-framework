# SATRIA — Perawatan SATRIA (6 November 2026)

## Tujuan dan batasan

Menambahkan **menu Perawatan SATRIA** di navigasi utama untuk komputer dan HP. Menu ini menyatukan akses pemeriksaan konfigurasi, temuan kualitas data, ringkasan error, dan backup yang **sudah ada** tanpa mengubah aturan bisnis, struktur database, atau data produksi. Tidak ada perbaikan otomatis; pemeriksaan hanya membaca data pada sesi aktif.

Basis kode: `SATRIA-Gabungan-Main-Terbaru-Refactor-Maintenance-2026-11-06.zip` yang sebelumnya disesuaikan dengan `satria-framework-main (4).zip` dari pengguna.

## Cara menggunakan

1. Buka aplikasi SATRIA, login sebagaimana biasa.
2. Pilih **Perawatan SATRIA** dari menu utama (pada HP buka menu navigasi).
3. Tekan **Periksa Ulang** untuk memperbarui hitungan lokal.
4. Gunakan **Buka Kualitas Data** untuk rincian temuan per paket sesuai hak akses.
5. Admin dapat membuka **Pengaturan Sistem** untuk melengkapi identitas OPD/nomor dokumen dan meninjau peringatan konfigurasi.
6. **Unduh Diagnostik** berisi status pemuatan aset dan kategori error; **Unduh Ringkasan** berisi hitungan agregat. Kedua laporan tidak menyalin isi paket, URL, token, atau kata sandi.
7. Hanya Admin yang mendapat tombol **Backup Data JSON**, **Pengaturan & Pemulihan**, serta **Buka SATRIA Debug**. Backup memakai fungsi aplikasi lama, dan file backup lengkap bisa berisi informasi organisasi/pribadi—simpan di lokasi aman.

## Hak akses

- Admin lokal, atau Admin dengan otorisasi cloud sesuai kondisi sesi: pemeriksaan konfigurasi serta akses backup dan panel debug.
- Operator/Viewer: pemeriksaan kualitas data sesuai scope tahun/OPD dan diagnostik yang tidak memuat data bisnis. Tidak ada tombol backup penuh atau debug.
- Pusat ini bukan pengganti pembatasan server Supabase/RLS. Indikator koneksi cloud tetap diperiksa di header.

## Perubahan kode

- `index.html`: memuat CSS/JS baru.
- `frontend/refactor/js/01-app-core.js`: rute `#care`, menu navigasi, dan penggunaan ulang helper pemeriksaan **yang sama** dari Pengaturan Sistem, tanpa mengubah rumusnya.
- `frontend/refactor/maintenance/care-center.js` (baru): render pusat perawatan, aksi baca-saja, diagnostik agregat, otorisasi UI.
- `frontend/refactor/maintenance/care-center.css` (baru): layout responsif desktop/HP, tidak memengaruhi cetak dokumen.
- `frontend/refactor/js/22-satria-genz-shell-341.js`: judul halaman untuk rute `#care`.
- `frontend/satria-next4.js`: melewati banner navigasi generik pada halaman Perawatan agar judul tidak ganda, tanpa mengubah halaman lain.
- `sw.js`: cache version diganti, aset baru dimasukkan dalam precache atomik.
- Tes regresi dan GitHub Actions: menyesuaikan versi cache, menambahkan uji Perawatan SATRIA.

## Makna status

- **Tidak ada error terdeteksi** hanya berarti pemeriksaan lokal saat ini tidak menemukan kejadian yang dicatat; bukan jaminan bebas error.
- **Penyimpanan lokal tidak gagal tercatat** bukan bukti cloud sinkron, karena sinkronisasi harus diverifikasi terpisah.
- **Kualitas data** dihitung dari modul `SATRIA_OPS_V2` dengan filter dan hak akses aktif.
- **Referensi dan kelengkapan konfigurasi** adalah dua kelompok pemeriksaan yang saling berkaitan dan bisa tumpang tindih, tidak boleh dijumlahkan sebagai jumlah kejadian unik.
- Diagnostik error berlaku selama tab aplikasi aktif; tidak ada pelaporan server real-time atau pemulihan otomatis.

## Validasi dan deploy

Pemeriksaan statis, pengujian regresi JavaScript, dan simulasi Chromium berjalan tanpa koneksi Supabase nyata. Belum diuji pada akun cloud produksi pengguna, perangkat HP asli, ataupun cache PWA terpasang saat deploy. Lakukan backup branch `main`, terapkan **isi ZIP patch ke root repository** sesuai folder masing-masing tanpa menghapus file lama, commit/deploy, kemudian tes login, `#care`, status cloud, backup dan dokumen. Jika integrasi gagal, rollback ke commit sebelumnya.
