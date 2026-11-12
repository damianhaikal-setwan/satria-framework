# SATRIA NEXT 3.0.59.60 — Kertas Kerja Pengadaan Langsung Jasa Konsultansi Konstruksi

Status: **implementasi pada salinan source dan pengujian lokal selesai**, bukan penerapan pada layanan production/LPSE. Bahan desain: `Ekosistem_Multipaket_JKK_50_Paket.xlsx` dari pengguna.

## Tujuan

SATRIA adalah **pendamping administrasi Pejabat Pengadaan**, bukan pengganti SiRUP, LPSE, SPSE, atau aplikasi pengadaan resmi. Fitur ini membuat kertas kerja, reviu, dokumen evaluasi, dan dokumen klarifikasi/negosiasi dari data Bank RUP serta isian petugas. Proses pengadaan dan unggah dokumen pada sistem resmi tetap dilakukan secara manual.

Tidak ada verifikasi/persetujuan berjenjang maupun keputusan lulus/gagal otomatis.

## Integrasi Bank RUP tanpa mengubah data lama

- Sumber pemilihan: `S.rupBank` — `metodePemilihan` **Pengadaan Langsung** dan `jenisPengadaan` **Jasa Konsultansi** (atau **Jasa Konsultansi Konstruksi** bila tipe eksplisit tersedia).
- **Konsultansi konstruksi harus dipastikan dari dokumen KAK** melalui pilihan Subjenis: Konstruksi, tidak diambil dari perkiraan nama paket.
- Hubungan eksisting memakai `paket.rupBankId` / `paket.rupBankIds` dan **harus tepat satu RUP**; cocokkan OPD, tahun anggaran, dan nomor RUP. Paket tanpa relasi pasti tidak dicocokkan berdasarkan judul.
- Jika satu RUP belum dipakai, pengguna berhak tulis dapat membuat **paket monitoring SPSE** dengan alokasi positif tidak melampaui sisa RUP. Jika sudah dipakai, buka paket lama: sistem mencegah pembuatan paket ganda melalui modul ini.
- Data kertas kerja baru disimpan hanya pada **`paket.kkJkk`** (skema 1). Kolom data paket lain, harga modul lain, penyedia, pemenang, metode Bank RUP, pagu RUP, dan dokumen legacy **tidak ditulis oleh modul**.
- Data `kkJkk` mengikuti mekanisme `SATRIA.tx('paket',...)` untuk persistensi dan sinkronisasi yang sudah ada. Backup JSON SATRIA sudah ikut membawa objek ini; validasi import diperluas untuk mengecek format bila data tersebut ada.
- Viewer dapat membuka/mencetak namun tidak bisa membuat paket atau menyunting. Pemeriksaan OPD/tahun dan cloud scope dilakukan juga sebelum membaca/menulis baris yang disajikan di modul. Tetap gunakan otorisasi server (RLS/RPC) di production.

## Langkah penggunaan

1. **Cadangkan data SATRIA saat ini** melalui menu backup sebelum melakukan pembaruan berkas aplikasi. Jangan melakukan reset/import demo pada data aktif.
2. Pasang berkas rilis secara utuh dan *reload* agar Service Worker memakai versi cache baru `3.0.59.60`.
3. Masuk ke **KK Konsultansi Konstruksi** (atau tautan dari **Ruang Kerja PP** / **Bank RUP**).
4. Pilih **tahun** dan **OPD** yang benar, lalu pilih RUP yang memenuhi filter. Jika RUP sudah punya paket PL/Jasa Konsultansi, buka paket itu. Jika belum, isi **alokasi** dan konfirmasi **Konstruksi berdasarkan KAK**, lalu buat paket monitoring.
5. Isi empat kelompok formulir: **Data & Persiapan**, **Reviu Persiapan**, **Evaluasi Penyedia**, serta **Survei & Harga**. Reviu berjumlah 42 butir di 6 kelompok, ditutup dalam accordion. Bentuk penyedia menentukan format evaluasi.
6. **Simpan** setiap bagian (perubahan juga disimpan ketika berpindah pilihan/isian). Cek kembali selisih nilai HPS rincian vs HPS PPK dan peringatan lainnya.
7. Pada **Dokumen untuk LPSE/SPSE**, klik dokumen yang diperlukan. Dialog cetak browser menyediakan opsi **Simpan sebagai PDF**. Secara baku ada penanda DRAF. Pengguna bisa memilih **Cetak bersih untuk berkas LPSE** bila telah memeriksa data; tidak ada approval. Kolom kosong/peringatan tetap terlihat, jangan diunggah sebelum dilengkapi.
8. Tandatangani dan gunakan dokumen sesuai proses serta persyaratan **LPSE/SPSE** yang berlaku. SATRIA **tidak** melakukan unggah otomatis, tanda tangan palsu, atau pengesahan otomatis.

## Keluaran yang tersedia (9 format)

1. Undangan Reviu Persiapan.
2. Kertas Kerja Reviu (42 butir).
3. Berita Acara Hasil Reviu.
4. Kertas Kerja Survei / Pembandingan Biaya.
5. Undangan Pengadaan Langsung.
6. Kertas Kerja Evaluasi Kualifikasi.
7. Kertas Kerja Evaluasi Dokumen Penawaran.
8. Kertas Kerja HPS, Penawaran & Negosiasi.
9. Berita Acara Klarifikasi/Negosiasi (format draf tambahan).

**Penting:** tidak semua dokumen wajib diunggah untuk semua paket/tahap. Bentuk/isi/ketentuan dokumen harus diperiksa terhadap dokumen pemilihan, aturan terkini, dan kebutuhan tahapan LPSE. **Generator Dokumen Pemilihan lengkap khusus konstruksi** belum dicakup oleh rilis ini.

## Penyederhanaan dari Excel

- Excel 50 slot paket diganti penyimpanan per-ID paket SATRIA, tanpa batas 50 slot.
- 42 butir reviu dan 8 + 12 kriteria evaluasi **perorangan** menjadi daftar collapsible, tanpa mengubah catatan pegawai menjadi status lulus otomatis.
- Evaluasi **Badan Usaha** mempunyai kerangka awal tersendiri. Karena workbook hanya memiliki evaluasi perorangan, kriteria badan usaha harus disesuaikan dengan Dokumen Pemilihan sebelum dokumen digunakan.
- Rincian biaya dinamis hingga 100 baris; jumlah HPS subtotal, komponen pajak berdasarkan **tarif yang diisi pengguna** (tidak dipaksakan tarif tertentu), harga penawaran, dan hasil negosiasi dihitung terpisah.
- Menampilkan selisih HPS PPK, masalah anggaran, dan harga; **tidak** otomatis memutuskan “negosiasi tidak perlu” atau “penyedia lulus”.
- Tanda tangan, jabatan, dan identitas dalam cetak diambil dari data SATRIA; data kosong tampil sebagai placeholder yang wajib ditinjau.

## Struktur kode

- `frontend/satria-jkk-schema.js` — daftar reviu/evaluasi.
- `frontend/satria-jkk-core.js` — domain model, syarat RUP/OPD/tahun, validasi, dan perhitungan.
- `frontend/satria-jkk-docs.js` — 9 format HTML A4 cetak → PDF.
- `frontend/satria-jkk-workspace.js` — navigasi, isian, kontrol akses dan transaksi.
- `frontend/satria-jkk-workspace.css` — desain responsive namespaced.
- `frontend/refactor/js/01-app-core.js` — penambahan rute, tautan Bank RUP dan validasi import, **tanpa migrasi mengubah record lama**.
- `frontend/satria-pp-ecosystem.js` — tautan dari Ruang Kerja PP.
- `frontend/satria-controller-access.js` — menu tersedia untuk Operator dan Viewer; Viewer tetap baca-saja.
- `index.html`, `sw.js`, `manifest.json` — loader, cache-busting, versi.

## Pengujian lokal yang sudah dilakukan

- `node tools/test_jkk_konsultansi_konstruksi.cjs` — penyaringan metode/jenis, relasi RUP, batas OPD/tahun, 42/8/12 kriteria, formula dan validasi, 9 keluaran, sanitasi HTML, mode cetak bersih.
- `python tools/test_jkk_konsultansi_konstruksi_browser.py` — browser 390 px dan 1280 px: filter RUP, pembuatan paket, tidak mengubah `rupBank`, simpan 4 bagian, hitung HPS, cegah duplikasi, Viewer read-only.
- `python tools/test_19_menu_smoke_browser.py` — 21 menu, desktop dan mobile, tidak ada runtime JS error atau file asset hilang.
- Regresi: `tools/test_satria_pp_ecosystem_305956.cjs`, `tools/test_backup_sync_and_restore.cjs`, `tools/test_operational_integrity.cjs`, `tools/test_release_version_consistency_305953.cjs`, `tools/test_pbj2026_policy.cjs`, `tools/test_cloud_scope_fail_closed.cjs`.
- `python tools/security_static_check.py` — 27/27 pemeriksaan statis lulus.
- `python tools/build_frontend.py --output <folder>` — berhasil membangun 104 file frontend.

### Batasan pengujian

- Browser menggunakan **data sintetik pada memori lokal**. Tidak menggunakan kredensial/otorisasi akun production atau database Supabase nyata. Keberhasilan sinkronisasi cloud multi-user dan kompatibilitas LPSE wajib diuji pada **staging** dengan backup.
- Belum ada API unggah LPSE atau output PDF langsung dari backend; PDF melalui fasilitas cetak browser.
- Belum ada bukti bahwa sembilan format HTML sesuai untuk **semua** kebutuhan dokumen resmi pada setiap paket/instansi. Petugas tetap harus mengecek KAK, HPS PPK, Dokumen Pemilihan, dan ketentuan terbaru.

## Checklist aman sebelum rilis production

- [ ] Unduh dan verifikasi backup data production SATRIA.
- [ ] Deploy ke **staging** terlebih dahulu, jalankan pengujian dengan paket RUP PL/Jasa Konsultansi, paket metode lain, dan akun dari OPD berbeda.
- [ ] Uji akses Operator/Viewer serta sinkronisasi Supabase untuk `paket.kkJkk`; uji export lalu restore backup dengan data JKK.
- [ ] Tinjau keluaran cetak (nomor surat, kop, paraf/tanda tangan, istilah, peraturan, lampiran) bersama pengguna berwenang.
- [ ] Baru setelah valid, deploy ke hosting production **tanpa reset data**; refresh cache Service Worker.
