# Cara memperbarui GitHub dengan paket repo rapi

**Jangan hapus repositori GitHub atau folder `.git`**. Cara paling bersih adalah melakukan commit yang mengubah, memindahkan, dan menghapus berkas lama, supaya riwayat repository tetap utuh.

## Disarankan: Git (menyinkronkan struktur lama)

1. Cadangkan data SATRIA/Supabase dan pastikan perubahan pekerjaan Git lokal telah disimpan.
2. Clone repositori yang benar atau buka clone yang sudah tersedia, lalu buat branch cadangan sebelum mengganti berkas. Contoh perintah dari folder repo:

   ```bash
   git switch -c backup-sebelum-rapikan
   git push -u origin backup-sebelum-rapikan
   git switch -
   git switch -c rapikan-repo-satria
   ```

   **Catatan:** branch backup hanya merekam *commit yang ada*, bukan data yang belum di-commit.
3. Ekstrak ZIP `SATRIA-Repo-Rapi-3.0.59.21.zip` ke folder sementara. **Salin seluruh isi hasil ekstraksi ke root clone GitHub** (bukan menaruhnya di subfolder). Jangan menyalin ke dalam `.git`.
4. **Hapus berkas dan folder lama** yang tidak ada dalam paket baru (lihat [daftar di bawah](REPO-CLEANUP.md)). Jangan hapus file lain yang mungkin dibuat setelah paket sumber ini diambil tanpa memeriksa fungsinya.
5. Periksa `git status` dan `git diff`; jalankan semua perintah tes di `README.md` sebelum commit.
6. Simpan perubahan:

   ```bash
   git add -A
   git commit -m "chore: rapikan repo SATRIA 3.0.59.21 tanpa mengubah app"
   git push -u origin rapikan-repo-satria
   ```

   Review diff di GitHub, lalu merge ke branch deployment (misalnya `main`) setelah Anda yakin file lain tidak ikut terhapus.

## Alternatif: unggah melalui situs GitHub

1. Ekstrak ZIP di komputer; **jangan unggah ZIP sebagai satu file**. Upload file/folder hasil ekstraksi dengan `Add file → Upload files` di **root repo**, lalu commit.
2. GitHub web **tidak menghapus file lama secara otomatis**. Untuk repo benar-benar rapi, hapus salinan legacy dan file root yang dipindahkan sesuai [daftar perubahan](REPO-CLEANUP.md), lalu commit penghapusan/pemindahan tersebut.
3. Pastikan `index.html` langsung terlihat di root repo dan tampilan aplikasi tetap berfungsi sesudah deploy.

**Perhatian:** paket ini dibuat dari ZIP hotfix 3.0.59.21 yang sudah diuji pengguna, bukan hasil sinkronisasi langsung seluruh riwayat commit GitHub. Bila ada perubahan baru pada repo online, **bandingkan dan gabungkan** sebelum menggantinya. Jangan menjalankan SQL produksi atau reset database hanya untuk merapikan repo.
