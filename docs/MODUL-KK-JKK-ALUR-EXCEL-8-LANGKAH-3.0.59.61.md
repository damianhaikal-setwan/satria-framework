# SATRIA NEXT 3.0.59.61 — Revisi Kertas Kerja Konsultansi Konstruksi

**Sumber:** `Ekosistem_Multipaket_JKK_50_Paket.xlsx`. **Status:** source dan build lokal selesai diuji; belum dipasang ke server production dan belum diuji terhadap Supabase production/LPSE.

## Tujuan

Menjadi alat bantu penyiapan dokumen Pejabat Pengadaan dengan alur pengisian Excel yang dikenal, namun mengurangi input berulang. Tidak menggantikan SiRUP, LPSE/SPSE, proses pemilihan, tanda tangan, atau keputusan pejabat. Tidak ada persetujuan/verifikasi berjenjang.

## Alur delapan langkah

| Langkah | Sumber Excel | Isian penting | Pemakaian ulang data |
|---|---|---|---|
| **1. Pilih Paket Bank RUP** | `MASTER_PAKET` / `DATA_PAKET` | ID RUP, nama paket, pagu, OPD, tahun, metode/jenis dan sumber dana dibaca dari SATRIA | Relasi `rupBankId` (bukan pencocokan nama), validasi OPD/tahun, hanya PL & Jasa Konsultansi |
| **2. Identitas & Administrasi** | `MASTER_PAKET`, `INPUT_META` | Subjenis konstruksi dari KAK, jenis layanan, bentuk penyedia, surat permintaan, KAK/HPS, nomor undangan/BA, waktu, tempat, **jam reviu**, sepuluh jadwal tahapan upload/pembukaan/evaluasi/klarifikasi/kontrak | Data paket tidak diketik ulang |
| **3. Reviu Persiapan Pengadaan** | `INPUT_REVIU` | 42 butir/6 kelompok, **bukti, status, temuan, tindakan, PIC, target**, keputusan dan catatan PP | Kriteria workbook tetap utuh |
| **4. Evaluasi Kualifikasi** | `INPUT_KUALIFIKASI`, kolom KUA `INPUT_META` | Delapan kriteria **perorangan**; status, bukti, catatan; metadata penawaran dan evaluator; kesimpulan PP | Nama penyedia dapat diambil dari master |
| **5. Evaluasi Dokumen Penawaran** | `INPUT_PENAWARAN`, kolom PEN `INPUT_META` | Dua belas kriteria **perorangan**; bukti/hasil/catatan; nomor, tanggal, catatan, evaluator, kesimpulan PP | Nama penyedia dan identitas paket tetap sama |
| **6. Survei Harga** | `INPUT_SURVEI` | Item, kualifikasi, harga standar, harga kontrak sejenis, harga penawaran calon, harga manual, keterangan | Terikat pada ID rincian biaya; nilai terpilih = manual bila diisi, selain itu MIN referensi tersedia. Nilai 0 tidak diperlakukan sebagai kosong |
| **7. HPS & Negosiasi** | `INPUT_HARGA`, `HPS dan Nego` | Rincian personel/nonpersonel, volume, satuan, harga HPS, penawaran, negosiasi, tarif/dasar pajak, HPS PPK, kesimpulan PP | Perhitungan otomatis; penyalinan harga survei ke tarif HPS **atas tindakan eksplisit** pengguna |
| **8. Hasil Kertas Kerja** | Delapan sheet cetak plus satu tambahan BA negosiasi | Pratinjau dokumen; cetak/simpan PDF satu per satu | Output menggabungkan data RUP dan isian langkah 2–7 |

Semua langkah dapat diakses langsung, tanpa *approval gate*. Bagian reviu dikelompokkan dalam accordion agar tidak menampilkan 42 butir sekaligus.

## Kompatibilitas data lama

- Rekaman lama **tetap dipakai**. Tidak dilakukan reset, migrasi massal, atau tulis ulang Bank RUP pada startup.
- Metadata baru berada dalam `paket.kkJkk` dengan schema **1** yang kompatibel: `jadwal`, `survei`, `jamReviu`, `kua...`, `pen...`, `targetPerbaikan`, dan tambahan `pic`/`target` dalam butir reviu. Nilai `reviu`, `kualifikasi`, `penawaran`, `biaya`, `hpsPPK`, dan identitas lama dipertahankan.
- Struktur biaya dinamis dapat melampaui lima rincian Excel, maksimum 100 untuk pengendalian ukuran data.
- Survei disimpan berdasarkan ID rincian (`survei[biaya.id]`), sehingga sumber item tidak bergeser seperti formula offset Excel.
- Data kategori Badan Usaha **bukan salinan evaluasi perorangan**: daftar kerangka perlu disesuaikan dengan Dokumen Pemilihan yang dipakai pada paket nyata.
- Sistem menampilkan peringatan jika rincian HPS tidak cocok dengan HPS yang ditetapkan PPK, lebih dari pagu, atau nilai lain tidak masuk akal. Tidak mengotomasi status lulus/gagal atau putusan negosiasi.

## Dokumen untuk LPSE/SPSE

Tersedia sembilan dokumen melalui **Pratinjau** dan **Cetak / PDF**: Undangan Reviu, KK Reviu (42 butir termasuk PIC/target), BA Reviu, Survei Harga (seluruh sumber dan hasil pembanding), Undangan PL (dengan jadwal), Evaluasi Kualifikasi, Evaluasi Penawaran, KK HPS/Penawaran/Negosiasi, dan BA Klarifikasi/Negosiasi (draf tambahan).

**Penting:** tombol Cetak/PDF memakai dialog cetak browser, bukan file PDF yang otomatis dibuat/diunggah. Dokumen harus diperiksa dan ditandatangani sesuai kewenangan serta kebutuhan tahap LPSE. Tidak semua dokumen wajib diunggah. Opsi cetak bersih hanya menghilangkan label DRAF; isian kosong dan peringatan tetap dicetak.

## Keamanan dan pemeriksaan yang dilakukan

- Seleksi RUP memakai `Jasa Konsultansi` (atau eksplisit Jasa Konsultansi Konstruksi) dan `Pengadaan Langsung`, dengan konfirmasi **Konstruksi dari KAK** oleh pengguna.
- Relasi paket harus **tepat satu ID Bank RUP**, serta OPD dan tahun yang sama; tidak memalsukan sinkronisasi langsung ke SiRUP.
- Paket baca-saja tidak dapat diubah. Penambahan data melalui transaksi `SATRIA.tx('paket',...)` yang sudah ada.
- Browser diuji pada viewport 390 px dan 1280 px: langkah 1–8, penyimpanan metadata dan 42/8/12, survey MIN → HPS, tarif/pajak, keluaran sembilan format, Viewer, dan tidak ada error JavaScript.
- Pengujian hanya memakai data sintetik lokal; belum ada pengujian jaringan dengan kredensial, RLS, akun lintas OPD, cadangan production, atau kompatibilitas penerimaan berkas LPSE.

## Deploy aman

1. **Cadangkan seluruh data yang berjalan** dari fitur backup SATRIA dan pastikan salinan cadangan dapat dibaca. Simpan versi sebelumnya untuk rollback.
2. Gunakan file **source** untuk pengembangan atau ZIP **build web** untuk hosting. Uji dahulu di **staging**, jangan mengganti data production.
3. Uji paket RUP cocok/tidak cocok, RUP yang telah terpakai, paket lama yang sudah memiliki `kkJkk`, data OPD/tahun, dan akun Viewer/Operator.
4. Uji cetak 9 format memakai data nyata yang telah disamarkan, penomoran surat, catatan dan persyaratan yang benar, termasuk dokumen Badan Usaha.
5. Uji simpan/sinkron dua perangkat pada Supabase staging; baru setelah lulus deploy file statis ke production **tanpa menghapus database/storage**. Versi cache service worker naik menjadi `3.0.59.61`.
6. Jika terjadi masalah, kembalikan file web dari rilis sebelumnya; data tidak dimigrasikan sehingga rollback file dapat dilakukan tanpa restore database. Jangan timpa data aktif dengan contoh.

## Perintah pengujian lokal

```bash
node tools/test_jkk_konsultansi_konstruksi.cjs
python tools/test_jkk_konsultansi_konstruksi_browser.py
python tools/test_19_menu_smoke_browser.py
python tools/security_static_check.py
python tools/build_frontend.py --output /tmp/satria-jkk-dist
```

**Catatan:** antarmuka dan formula mengikuti struktur sumber Excel sejauh tepat, bukan otomatis menyatakan Excel sebagai standar hukum atau mengesahkan hasil pengadaan.
