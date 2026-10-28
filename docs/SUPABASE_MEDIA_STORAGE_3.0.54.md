# SATRIA NEXT 3.0.54 — Foto dan tanda tangan di Supabase Storage privat

## Tujuan
Foto Smart Survey, TTD, cap/stempel pejabat, logo pemerintah daerah, dan gambar kop OPD tidak lagi disimpan sebagai Base64 **baru** di JSON bisnis. SATRIA menyimpan referensi `satria-media://<organization>/<path>`; ketika dibuka pada perangkat lain, gambar diunduh dari bucket privat memakai sesi login Supabase.

## Urutan penerapan — staging, lalu produksi
1. **Backup** snapshot Supabase, backup JSON SATRIA, dan jika perlu salinan berkas gambar lama. Pastikan akun Admin aktif. Jangan menghapus Base64 lama sebelum migrasi berhasil.
2. Terapkan seluruh migrasi sebelumnya hingga `20261028010000_satria_rup_bank_cloud_compat.sql`.
3. Jalankan `supabase/migrations/20261028060000_satria_private_media_storage.sql` via pipeline migrasi/Supabase SQL Editor (satu kali, staging dahulu).
4. Di Dashboard Supabase → Storage verifikasi bucket **satria-media**, **Private**, hanya PNG/JPEG/WEBP/GIF, maksimal 1 MB.
5. Deploy `index.html` versi 3.0.54 melalui GitHub Pages/Cloudflare Pages/hosting HTTPS (hindari file:// untuk pemakaian multi-perangkat).
6. Login ke Supabase menggunakan akun Admin, klik **Tarik dari Supabase**, unggah satu foto Smart Survey, lalu **Simpan referensi harga tayang**. Pastikan status **Tersinkron** (jangan berhenti pada “Cloud terhubung”).
7. Pada perangkat lain, login ke organisasi/OPD/tahun yang sesuai, tarik data, pastikan foto dan gambar tanda tangan yang menjadi kewenangan pengguna muncul.
8. Di modal Supabase pilih **Migrasikan gambar lama ke Supabase** untuk mengunggah Base64 terdahulu dan URL eksternal yang diizinkan CORS. Jika suatu URL eksternal gagal, unggah file asli secara manual. Klik **Sinkronkan perubahan**; jangan berpindah perangkat sebelum status Tersinkron.
9. Cetak DPP/RFI/Survei Harga. Bila aplikasi sedang mengambil gambar privat, tunggu selesai lalu klik cetak ulang. Pastikan gambar terlihat pada hasil Save PDF.

## Hak akses media
- Admin organisasi: dapat membaca/mengunggah foto, logo, TTD, cap dan kop seluruh OPD dalam organisasinya.
- Operator: membaca media OPD yang ditugaskan dan hanya mengunggah **foto produk** pada OPD dan tahun yang ditugaskan.
- Viewer: membaca media sesuai OPD/tahun, tidak dapat unggah.
- Bucket **tidak publik**; media diunduh melalui Authorization JWT dan RLS. Referensi disimpan, bukan URL publik atau signed URL jangka panjang.

## Catatan migrasi dan penghapusan
- **HTML saja tidak cukup**: tanpa migrasi SQL Storage, unggah akan gagal dengan pesan yang jelas; aplikasi tidak menulis gambar Base64 baru ke data bisnis.
- Gambar lama yang belum dimigrasikan tetap berada di snapshot sampai migrasi berhasil. URL katalog yang terhalang CORS tidak dihapus otomatis.
- Menghapus foto dari satu Smart Survey menghapus **referensinya**. Object Storage lama dipertahankan sementara agar dokumen/backup terdahulu tidak kehilangan bukti. Penghapusan fisik permanen sebaiknya dikerjakan melalui prosedur admin-retensi setelah verifikasi bahwa tidak ada referensi atau arsip yang membutuhkannya.
- Backup JSON **sesudah migrasi** hanya menyimpan referensi gambar. Jika ingin backup media penuh, ekspor bucket `satria-media` melalui prosedur backup Supabase Storage terpisah.
- Pengujian lintas pengguna dan backup/restore Storage harus lulus di staging sebelum digunakan untuk dokumen resmi.
