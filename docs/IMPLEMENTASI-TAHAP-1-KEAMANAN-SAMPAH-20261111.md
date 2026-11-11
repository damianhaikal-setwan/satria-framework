# SATRIA NEXT 3.0.59.59 — Implementasi Tahap 1

**Tanggal:** 11 November 2026  
**Sumber:** `SATRIA_NEXT_3.0.59.59_main.zip`  
**Status:** Tahap 1 telah diterapkan pada salinan source code dan lulus pengujian lokal. Belum dinyatakan layak produksi cloud.  
**Prinsip:** Tidak menambah proses persetujuan/verifikasi berjenjang; mengutamakan pemulihan data, fitur yang sudah ada, arsitektur dapat dirawat, dan antarmuka responsif.

## 1. Perubahan yang telah dikerjakan

1. **Keamanan gambar kop dan logo** — jalur `img src` di `01-app-core.js` melewati penjaga media terpusat `SATRIA_CORE_GUARDS.imageSrc()` dan escaping atribut HTML. Hanya data PNG/JPEG/GIF/WebP/BMP base64 atau URL HTTPS valid yang diizinkan. Upload kop/logo diperketat menurut MIME dan ukuran. Vektor HTML-attribute injection yang teruji pada audit awal tidak lagi berhasil pada skenario browser yang sama.
2. **Keamanan ekspor CSV** — satu fungsi `csvCell` menangani pemisahan nilai, escaping tanda petik, dan penetralan sel yang dimulai formula spreadsheet (`=`, `+`, `-`, `@`, termasuk whitespace di awal). Dipakai bersama pada jalur CSV utama yang ditelusuri.
3. **Rute Pengaturan Sistem** — tautan internal salah `#settings` menjadi `#set`, disertai kompatibilitas tautan lama.
4. **Menu ke-20: Sampah & Pemulihan** — menambah menu pada navigasi tanpa mengubah urutan 19 menu sebelumnya. Penghapusan data inti lokal dipindahkan menjadi arsip reversibel (`S.sampah`), mencatat ID, jenis, tanggal, dan nama operator. Tombol **Pulihkan** mengembalikan ke daftar aktif dengan pemeriksaan ID dan referensi dasar.
5. **Cakupan pemulihan lokal** — Paket, Bank RUP, Pejabat, Penyedia, OPD, Unit, Akun Anggaran, Kode, Pengguna, penawaran, kop/logo, tahun anggaran, serta snapshot saat reset. Aksi hapus dari beberapa submodul lain seperti addendum/pembayaran SPSE dan bukti/produk Smart Survey **belum** dimigrasikan ke Sampah pada tahap ini.
6. **Penyimpanan dan backup** — metadata Sampah ikut disimpan pada payload IndexedDB dan ikut terunduh melalui backup JSON. Import backup lama tanpa `sampah` tetap didukung, sedangkan backup baru dengan `sampah` melewati pemeriksaan bentuk dasar dan ID arsip. Hapus/pulihkan ditolak jika engine persisten IndexedDB tidak aktif.
7. **Hak akses** — Viewer hanya dapat melihat menu Sampah, bukan memulihkan. Aturan data aktif dan pencegahan penghapusan Admin terakhir tetap dipertahankan. Tidak ada approval workflow tambahan.
8. **Perlindungan cloud** — karena kontrak RPC/Delta Supabase yang ada belum memiliki entitas Sampah dengan RLS yang tepat, penghapusan destruktif utama dan pemulihan lewat UI diblokir sementara **saat konfigurasi cloud aktif**. Arsip lokal tidak dikirim dalam snapshot cloud; daftar Sampah lokal tidak ditampilkan ketika masuk mode cloud. Ini tindakan fail-closed untuk mencegah ilusi pemulihan yang sebenarnya tidak disimpan server.
9. **Fondasi logika bersama** — modul baru `00-core-guards.js` memisahkan sanitasi media, CSV, arsip, dan pemulihan dari file inti besar. Dimasukkan sebelum `01-app-core.js` pada HTML dan cache PWA. Ini awal pengurangan duplikasi, **belum** pemecahan penuh seluruh kalkulator HPS/negosiasi atau modul `01-app-core.js`/`05-cloud-sync.js`.

## 2. Berkas diubah/ditambahkan

**Diubah (9):**
- `index.html`
- `sw.js`
- `frontend/refactor/js/01-app-core.js`
- `frontend/refactor/js/05-cloud-sync.js`
- `tools/legacy_index_source.cjs`
- `tools/legacy_index_source.py`
- `tools/test_next4_foundation.js`
- `tools/test_operator_studio_332.js`
- `tools/test_release_version_consistency_305953.cjs`

**Ditambahkan (3 kode/tes + dokumen ini):**
- `frontend/refactor/js/00-core-guards.js`
- `tools/test_core_guards_stage1.cjs`
- `tools/test_recycle_stage1_browser.py`
- `docs/IMPLEMENTASI-TAHAP-1-KEAMANAN-SAMPAH-20261111.md`

Nomor versi aplikasi tetap `3.0.59.59`, agar tidak diklaim sebagai rilis baru yang belum menjalani uji produksi. Identitas build ini adalah **Tahap 1** pada nama ZIP keluaran.

## 3. Hasil pengujian

| Pemeriksaan | Hasil | Catatan |
|---|---|---|
| Semua 29 skrip pengujian JS/CJS di `tools/test_*.js/.cjs` | **29 lulus, 0 gagal** | Termasuk pengujian baru core guards dan regresi fitur sebelumnya |
| Integritas modular (`test_refactor_integrity.py`) | **Lulus** | 34 modul JS berpenanda, 24 CSS, urutan aset dan sintaks |
| Browser smoke (`test_refactor_browser.py`) | **Lulus** | Rendering menu, modul, diagnostik, tanpa `pageerror` dalam lingkungan mock |
| Browser tahap 1 (`test_recycle_stage1_browser.py`) | **Lulus** | XSS terblokir, paket hapus–pulihkan, backup mencatat Sampah, cloud/View-only guard, rute `#settings` |
| Sintaks 3 JS kunci | **Lulus** | `node --check` |

**Batas uji:** Browser menggunakan CDN/cloud mock dan simulasi engine IndexedDB pada uji hapus–pulihkan. Tidak ada pengujian end-to-end multi-perangkat menggunakan Supabase produksi dan tidak ada uji beban/kapasitas IndexedDB pada kumpulan data besar. Pengujian yang lulus tidak berarti bebas dari seluruh kerentanan.

## 4. Batasan operasional dan keamanan data

- Gunakan fitur Sampah **hanya dalam mode lokal IndexedDB**. Jangan menganggap data Sampah sudah dicadangkan ke Supabase.
- **Mode cloud:** penghapusan melalui aksi inti yang dimigrasikan akan ditolak. Ini konsekuensi yang disengaja sampai dukungan server selesai. Jangan membuka blokir UI tanpa membuat schema, RPC dan RLS trash terlebih dahulu.
- Backup JSON terpisah tetap wajib sebelum migrasi atau pembaruan besar. Menghapus data browser, mengganti perangkat, atau kehabisan kuota IndexedDB dapat menghilangkan Sampah lokal.
- Penambahan Sampah tidak otomatis mencakup semua aksi yang menghapus record dalam modul ekstensi. Tidak ada fitur hapus permanen ataupun restore lintas perangkat pada Tahap 1.
- Data lama yang sudah dihapus sebelum Tahap 1 tidak dipulihkan oleh modul baru.
- Restore data harus memeriksa kembali kelengkapan data operasional dan keluaran dokumen; memulihkan record bukan berarti menyatakan keabsahan kebijakan pengadaan.

## 5. Peta jalan berurutan tanpa merusak fitur

### Tahap 2 — Data Safety Cloud dan Recycle Bin Supabase (P0)
- Desain tabel `trash_entries` dengan `organization_id`, `record_type`, `record_id`, `payload`, `deleted_by`, `deleted_at`, retensi; `RLS` sesuai scope OPD, tahun dan role.
- RPC atomik `archive_record`, `restore_record`, dan migrasi versi dengan audit log, idempotensi, dan optimistic concurrency.
- Kembalikan fungsi hapus yang kini diblokir *hanya setelah* uji integrasi SQL/RLS, rollback transaksi, dan recovery lintas perangkat berhasil.
- Lindungi setiap jalur delete di modul ekstensi: SPSE, Smart Survey, lampiran/bukti dan catatan lain, atau tampilkan bahwa data tersebut belum dapat dipulihkan.
- Uji ancaman upload/URL/CSP, import JSON yang berbahaya, batas ukuran, serta backup-restore dalam jumlah besar.

### Tahap 3 — Satu Mesin Data Inti (P1)
- Peta kontrak data berlapis: `BankRUP → Paket → Item → SumberHarga → HPS → Negosiasi → Dokumen → Laporan`.
- Ekstrak modul kalkulasi bersama `money/tax/rounding`, `hps`, `negotiation` tanpa mengubah hasil yang telah disahkan; gunakan golden-tests PDF/XLSX/CSV untuk regresi.
- Pisahkan layanan validasi, akses, repository, dokumentasi, sinkronisasi, dan presentasi. Pertahankan adapter API dari modul lama selama transisi.
- Terapkan pemeriksaan ketidaksesuaian RUP–Paket–OPD–tahun serta larangan mengubah referensi yang masih digunakan.

### Tahap 4 — Refaktor Arsitektur & UX Gen Z (P1/P2)
- Pecah `01-app-core.js` dan `05-cloud-sync.js` secara bertahap, satu domain tiap rilis, bukan rewrite besar.
- Standarisasi komponen form, toast, dialog, navigasi, pencarian universal dan halaman pemulihan; patuhi aksesibilitas dan mobile-first.
- Audit beban aplikasi, cache PWA, ukuran bundle, dependensi CDN dan performa pada perangkat lambat.
- Tingkatkan CI: test unit, integration, browser, migrasi skema dan pemeriksaan lintas role. Tambahkan panduan perawatan dan rollback.

**Aturan semua tahap:** Pertahankan seluruh fungsi aktif dan hasil perhitungan/dokumen yang sudah benar. Tidak menambah tahap verifikasi atau persetujuan berjenjang. Hak akses berbasis peran tetap merupakan kontrol akses, bukan persetujuan workflow.

## 6. Langkah pemasangan untuk lingkungan uji

1. Cadangkan ZIP versi sebelum perubahan dan backup JSON data operasional pada perangkat uji.
2. Ekstrak ZIP hasil Tahap 1 ke lingkungan **staging/test**, bukan menimpa produksi secara langsung.
3. Pastikan `00-core-guards.js` dimuat lebih dahulu daripada `01-app-core.js` dan service worker memperoleh cache baru.
4. Uji manual pembuatan paket, Bank RUP, HPS, negosiasi, dokumen, ekspor, hak akses, backup, lalu hapus–pulihkan pada IndexedDB.
5. Uji bahwa akun/cloud yang terkoneksi tidak dapat melakukan penghapusan yang tidak dapat dipulihkan. Untuk fitur hapus cloud yang diperlukan, selesaikan Tahap 2 dahulu.
6. Rilis ke produksi hanya setelah QA organisasi, cadangan, dan rencana rollback terpenuhi.
