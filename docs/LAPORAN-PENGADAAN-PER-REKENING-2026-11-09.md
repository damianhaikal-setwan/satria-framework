# SATRIA NEXT 3.0.59.44 — Laporan Pengadaan per Rekening Anggaran

Tanggal: 9 November 2026

## Tujuan

Menampilkan pengadaan berdasarkan **kode rekening anggaran** di **Laporan dan Analisis** tanpa mengubah transaksi dan perhitungan historis.

## Cara pakai

1. Buka **Laporan dan Analisis → Pengadaan Berdasarkan Kode Rekening**.
2. Pilih OPD di header SATRIA (misalnya Bapperida atau Disporapar).
3. Pilih **Tahun Anggaran**, lalu **Rekening Anggaran**. Secara bawaan menampilkan seluruh tahun/rekening dalam cakupan akun.
4. Lihat rekap per **TA × OPD × kode rekening**, lalu daftar paket yang menyusun angka tersebut.
5. Gunakan **Cari** untuk mencari nama paket, RUP, atau kode rekening. **Reset** mengembalikan semua filter laporan rekening.
6. Pilih **Ekspor Rekap CSV** atau **Ekspor Paket CSV**. Jika daftar paket melebihi 300 baris, hanya tampilan yang dipersingkat; CSV tetap mengikutsertakan semua baris terfilter.
7. Tombol **Buka** pada paket membawa ke halaman paket atau monitoring SPSE, tetap mengikuti scope OPD/tahun akun.

## Sumber data dan arti angka

- Rekening diambil dari **Paket Pengadaan → Data Paket → Rekening Anggaran** (`paket.akunId`), lalu dipadankan dengan **Data Master → Akun Anggaran** (`akun.id`). Tidak menebak rekening dari teks RUP, program, atau metadata global.
- Terdapat dua kelompok peringatan: **belum ditautkan** (`akunId` kosong) dan **rekening tidak ditemukan** (akun yang dirujuk sudah tidak ada di Data Master). Paket-paket tersebut tetap masuk laporan sebagai kelompok terpisah, bukan digabung ke rekening lain.
- **Jumlah paket** = jumlah paket dalam cakupan, termasuk arsip.
- **Pagu paket tercatat** = penjumlahan `paket.pagu` per rekening. **BUKAN** pagu DPA/rekening unik, saldo, ataupun anggaran RUP unik. Bila satu RUP digunakan untuk beberapa paket, pagu paket dapat terhitung beberapa kali sebagai nilai paket, bukan sebagai anggaran sumber.
- **HPS E-Purchasing** = total HPS yang dihitung dari rincian `volume × HPS/unit`, hanya untuk jalur E-Purchasing.
- **Penetapan E-Purchasing** = nilai pemenang yang **valid menurut gate penetapan**; tanpa pemenang valid dilaporkan 0 pada rekap (tidak otomatis dianggap pembayaran).
- **Kontrak SPSE** = nilai kontrak pencatatan SPSE yang memiliki **nomor kontrak**.
- **Pembayaran SPSE terverifikasi** = pembayaran SPSE dengan status `Terverifikasi`, bukan pembayaran E-Purchasing.
- Angka HPS, penetapan, kontrak, dan pembayaran merupakan indikator berbeda. **Jangan dijumlahkan menjadi realisasi anggaran**.

## Keamanan dan ruang lingkup

- Modul ini **baca-saja**: tidak menulis ke `paket`, `akun`, `rupBank`, penawaran, negosiasi, HPS, atau Supabase.
- Pembacaan paket mematuhi OPD yang dipilih di header dan `activeCloudScope()` (assignment OPD dan tahun). CSV menggunakan data **yang sama** dengan yang terlihat. Server Supabase tetap merupakan pengendali otorisasi utama.
- Akun PPKom hanya memperoleh data tahun/OPD yang telah diberikan; modul ini tidak memperluas hak akses.
- Memakai data aplikasi yang sudah dimuat, tanpa SQL migration maupun Edge Function baru.
- Kode HTML yang berasal dari master/nama paket di-escape; CSV memakai fungsi mitigasi injeksi formula yang sudah tersedia.

## Perubahan teknis

- `frontend/refactor/js/01-app-core.js`: pembacaan, pengelompokan, filter, pencarian, kartu indikator, detail, CSV, navigasi paket.
- `frontend/refactor/css/24-laporan-rekening.css`: desain responsif dengan token tema terang/gelap.
- `index.html`: memuat CSS baru, memperbarui label versi.
- `sw.js`: cache PWA baru serta precache CSS.
- Tes regresi: `tools/test_laporan_rekening_20261109.cjs` dan `tools/test_laporan_rekening_browser_20261109.py`.

## Pengujian sebelum produksi

```bash
node tools/test_laporan_rekening_20261109.cjs
python tools/test_laporan_rekening_browser_20261109.py
python tools/security_static_check.py
node tools/test_nego_ppn_rounding_inaproc_20261108.cjs
python tools/test_hps_batch_draft_browser_20261109.py
```

Setelah deploy GitHub/Cloudflare Pages, uji satu rekening yang benar-benar terhubung ke paket SATRIA, cocokkan total HPS/penetapan terhadap dokumen, dan uji akun PPKom pada OPD/tahun yang ditugaskan. Tidak ada pengubahan data historis otomatis.
