# SATRIA NEXT 3.0.59.59 — Tahap 3: Logika Inti Pengadaan Terpadu

Tanggal: 11 November 2026  
Basis: `SATRIA_NEXT_3.0.59.59_TAHAP2_SAMPAH_SUPABASE.zip`  
Status: **implementasi kode dan pengujian lokal selesai; belum diuji dengan Supabase staging/produksi sebenarnya.**

## Tujuan dan batasan

Menyatukan sumber perhitungan dan data baca dari Bank RUP → Paket Pengadaan → HPS → Negosiasi → Dokumen, **tanpa mengubah model penyimpanan, hasil yang telah tercatat, penetapan, atau hak akses**. Tidak menambah verifikasi atau persetujuan berjenjang. Tahap ini mengurangi duplikasi rumus pada lintasan inti; **tidak berarti seluruh kode SATRIA telah dipecah atau semua modul ekstensi telah dimigrasikan**.

## Implementasi yang benar-benar dilakukan

1. **Mesin domain bersama dan murni** `frontend/satria-procurement-core.js` (modul UMD tanpa dependensi, dapat dipakai langsung oleh browser dan Node). Fungsi: `hpsItem`, `hpsTotal`, `rupLinks`, `rupKey`, `rupLinkStatus`, `offerGoodsRaw`, `offerGoodsTotal`, `offerWithShipping`, `documentHps`, `packageSnapshot`.
2. **Paket Pengadaan:** fungsi HPS utama, total harga tayang/negosiasi dan normalisasi referensi Bank RUP menggunakan modul bersama. Tindakan tulis, pemilihan pemenang dan sinkronisasi tetap melalui mekanisme Tahap 2; sumber `p.items`, `p.penawaran`, `p.rupBankId`, `p.rupBankIds` tetap sama.
3. **Ruang Kerja PP:** total HPS kini mengambil sumber yang sama dengan Paket. Bagian status hubungan Bank RUP menunjukkan jumlah tautan ditemukan; tautan rusak, beda OPD/tahun atau kode utama tak cocok ditampilkan sebagai *peringatan*, bukan gate/approval.
4. **Generator HPS dan Excel/PDF:** angka baris dan pajak dihitung lewat `documentHps`. Validasi, pengaturan draf, ekspor dan hak ubah tetap di modul semula. Konflik tautan Bank RUP ditampilkan sebagai peringatan jika Bank RUP lokal sudah dimuat. Angka HPS yang disimpan **tidak** diubah saat memilih mode pajak dokumen.
5. **Analisis Harga:** total HPS dan harga tayang/negosiasi beserta ongkir menggunakan modul bersama dengan pembulatan 2 desimal untuk analisis bukti; logika pembandingan produk, catatan, bukti, dan kesimpulan tetap terpisah.
6. **Dokumen pendukung PBJ/SPSE:** tabel rincian dan total HPS memakai perhitungan bersama. Teks draf, keputusan metode dan batas akses tidak berubah.
7. **PWA:** cache diberi identitas Tahap 3, file baru masuk precache. `legacy_index_source` dan pengujian berbasis VM dimutakhirkan agar modul bersama ikut dimuat pada pengujian offline.

## Peta sumber data bersama

| Urutan | Sumber utama | Pengguna data | Ketentuan |
|---|---|---|---|
| 1 Bank RUP | `S.rupBank` (id, kode, OPD, TA) | Paket dan Ruang Kerja PP | `rupBankId` utama + `rupBankIds` konsolidasi; referensi tak sah hanya diperingatkan |
| 2 Paket | `S.paket[]` (`p.id`, `p.pagu`, `p.items`) | Dashboard, HPS, PP, dokumen | Identitas paket tetap `p.id`; nominal pagu tidak berubah otomatis |
| 3 HPS | `p.items[].vol` × `p.items[].hs` | Paket, PP, Analisis Harga, Generator, dokumen | HPS tampilan = jumlah tanpa pembulatan per item; dokumen HPS membulatkan nilai tiap baris sesuai aturan sebelumnya |
| 4 Penawaran/Negosiasi | `p.penawaran[]`, `harga`/`nego` per ID item, `ongkir` | Paket dan Analisis Harga | Negosiasi parsial tidak dianggap final oleh gate lama; pembulatan total penawaran di rupiah setelah penjumlahan; analisis dapat memakai 2 desimal |
| 5 Dokumen | Snapshot p, hasil kalkulasi murni | HPS Excel/PDF, draft SPSE, Ruang Kerja PP | Sifatnya DRAF, tidak mengubah HPS asli atau penetapan; tarif pajak tidak diasumsikan |

## Kontrak kompatibilitas yang wajib dipertahankan

- `hpsTotal`: `sum(max(vol,0) * max(hs,0))` tanpa `Math.round` per item, sama dengan kalkulasi Paket lama.
- `offerGoodsTotal`: harga negosiasi per item hanya digunakan jika tersedia; jika belum, tetap membaca harga tayang (perilaku kalkulasi legacy). Jumlah barang dibulatkan **setelah** agregasi, bukan per item; ongkir masih ditambahkan terpisah pada gate paket utama.
- `offerWithShipping(...,precision=2)`: pembulatan menjadi dua desimal dipakai Analisis Harga yang mensyaratkan kelengkapan harga dan validitas ongkir sebelum menampilkan total.
- `documentHps`: pembulatan nilai dasar **per baris**, pajak included/excluded dipertahankan. Tarif kosong tetap **tidak ditebak**. Mode excluded tidak menulis balik ke data HPS paket.
- Data RUP konsolidasi multi-kode **tidak** dialokasikan ulang otomatis. Penetapan, pagu, HPS dan pembayaran adalah angka berlainan; aplikasi tidak menyebut selisih HPS–nego sebagai kas nyata.

## Pemeriksaan dan pengujian yang benar-benar dijalankan

- Node: **32/32 skrip** (`tools/test*.cjs`, `tools/test*.js`, `tests/test*.js`) setelah harness VM lama diadaptasi untuk memuat modul domain bersama. Termasuk pengujian HPS/PPN INAPROC 449 × 4.849, multi-RUP, Bank RUP, Sampah Tahap 2, dan semua pengujian regresi yang terdaftar.
- Pengujian domain baru: **1.527 asersi**, termasuk **500 iterasi perbandingan acak** untuk memastikan perhitungan HPS, harga tayang dan negosiasi cocok dengan rumus sebelumnya, serta memastikan data sumber tidak dimutasi.
- Browser Chromium dengan Supabase/CDN disimulasikan: **8/8 skrip** lulus (loader modular, HPS/PP, klasifikasi RUP, PBJ/SPSE, ekosistem PP, analisis harga, Sampah Tahap 2, integrasi Tahap 3). Uji baru membandingkan HPS Paket/PP/Analisis Harga, angka pajak/dokumen, status Bank RUP, dan memastikan input sintetis tidak berubah.
- `tools/test_refactor_integrity.py`: lulus, 34 JS lama dan 24 CSS hasil refactor tetap utuh; file domain baru di luar daftar refactor historis dan telah masuk PWA precache.

**Catatan hasil:** sebagian pengujian lawas awalnya gagal karena lingkungan VM atau uji halaman mandiri belum memasukkan skrip domain baru. Harness pengujian diperbaiki **tanpa fallback rumus duplikat di kode produksi**; semua lulus saat dijalankan ulang.

## Belum selesai / risiko tersisa

1. Migrasi SQL Tahap 2, keamanan RLS nyata, restore multi-perangkat dan transaksi atomik Supabase **belum teruji pada database staging nyata**; jangan menyatakan produksi siap hanya dari hasil mock browser.
2. Mesin negosiasi per-barang (pajak net/bruto, Smart Survey, status penetapan) dan sejumlah pemrosesan dokumen ekstensi masih mempunyai aturan sendiri; sengaja tidak dibongkar agar angka historis tidak rusak. Tahap 4 dapat memindahkannya secara incremental setelah golden tests disiapkan.
3. File `01-app-core.js` dan `05-cloud-sync.js` masih besar; Tahap 3 **belum** melakukan pemecahan arsitektur menyeluruh atau optimasi bundle. Tidak semua nested record memiliki kontrak Sampah cloud.
4. Lakukan uji login/role asli dan ekspor PDF/XLSX pada browser, perangkat serta skenario data organisasi riil di staging sebelum deploy publik. Uji cetak simulasi bukan sertifikasi kebenaran dokumen pengadaan.

## Prosedur pemasangan aman

1. Cadangkan ZIP Tahap 2, backup data lokal dan backup database Supabase secara terpisah.
2. Untuk mode lokal, salin frontend Tahap 3 lengkap (termasuk `satria-procurement-core.js`), `index.html` dan `sw.js`; jangan mengunggah hanya file JavaScript baru.
3. Untuk mode cloud, **migrasi Tahap 2 wajib telah lulus staging** sebelum menggunakan frontend Tahap 3. Tahap 3 sendiri tidak membuat migrasi SQL baru.
4. Lakukan hard refresh PWA, pastikan `SATRIA_PROCUREMENT_CORE` tersedia, lalu jalankan pengujian RUP → Paket → HPS → Negosiasi → Dokumen pada data sintetis dahulu.
5. Jika terjadi regresi, deploy ulang frontend Tahap 2 beserta `sw.js` Tahap 2. Jangan mengembalikan akses delete langsung di cloud atau menghapus Sampah cloud. Jangan rollback database tanpa cadangan yang telah diuji.

## Tahap 4 yang direkomendasikan

Pecah `01-app-core.js` dan `05-cloud-sync.js` secara bertahap (domain/proses/storage/UI), tetapkan antarmuka data yang dapat diuji, kurangi listener dan CSS berulang, perkuat log dan pemulihan data bersarang, serta optimasi aksesibilitas/responsivitas Gen Z. Semua perubahan harus dibuktikan melalui golden tests dan tetap tanpa approval berjenjang.
