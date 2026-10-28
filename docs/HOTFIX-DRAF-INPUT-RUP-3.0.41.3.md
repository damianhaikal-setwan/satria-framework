# SATRIA 3.0.41.3 — Perbaikan Draf Input RUP Manual

## Masalah
Saat pengisian Input RUP Manual, field dapat kehilangan teks yang sudah diketik setelah halaman/komponen dirender ulang (misalnya akibat pembaruan aplikasi saat pengguna berpindah field). Formulir sebelumnya membaca sebagian besar nilai dari HTML tanpa state draf.

## Perbaikan
- Menggunakan `S.ui.rupManualDraft` untuk menyimpan seluruh sepuluh field secara lokal di dalam state UI aplikasi segera ketika pengguna mengetik/memilih opsi.
- Mengambil salinan dari semua field sebelum `render()` mengganti isi `#main`.
- Mengisi ulang input, textarea, dan opsi dropdown dari draf setelah render.
- Mempertahankan draf saat berpindah tab menu di aplikasi; draf tidak dikirim ke Bank RUP/Supabase sebelum menekan Simpan.
- Menambahkan tombol **Bersihkan draf** dengan konfirmasi.
- Mengosongkan draf otomatis hanya setelah penyimpanan RUP Manual dinyatakan berhasil. Saat validasi gagal, draf tetap utuh.
- Memperbarui versi frontend dan nama cache PWA menjadi 3.0.41.3.

## Batasan
- Draf hanya bertahan selama sesi halaman aplikasi masih aktif. Jangan refresh/tutup browser sebelum menyimpan RUP bila ingin mempertahankan draf.
- Perbaikan ini tidak mengubah database, hak akses, alur impor SiRUP, atau dokumen cetak.
- Tes fungsi draf lulus dalam pemeriksaan terisolasi. Uji antarmuka penuh di Safari tetap perlu dilakukan.

## Uji di SATRIA
1. Buka Input RUP Manual, isi kode, nama paket dua baris, pagu dan sumber referensi.
2. Tekan Tab / pilih OPD atau metode; pastikan teks yang sudah ditulis tidak hilang.
3. Pindah ke menu lain lalu kembali ke Input RUP; draf harus tetap muncul.
4. Coba simpan dengan field wajib kosong; isian tidak boleh hilang saat validasi gagal.
5. Lengkapi kolom lalu simpan; RUP harus masuk Bank RUP dan formulir bersih.
