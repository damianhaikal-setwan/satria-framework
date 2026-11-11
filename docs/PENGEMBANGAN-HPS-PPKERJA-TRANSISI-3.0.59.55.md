# SATRIA NEXT 3.0.59.55 — Generator HPS, Kertas Kerja PP, dan perbaikan transisi

Tanggal paket rilis: 11 November 2026. Basis: SATRIA NEXT 3.0.59.54 dari ZIP yang disediakan sebelumnya. Perubahan ini kandidat rilis berbasis pengujian lokal; bukan klaim kepatuhan hukum menyeluruh ataupun pengujian basis data produksi.

## 1. Tujuan dan batasan

- SATRIA adalah alat kerja Pejabat Pengadaan, **bukan** pengganti SPSE, Katalog Elektronik, INAPROC, maupun SiRUP.
- Tidak ada tambahan verifikator, approval, reviewer berjenjang, OAuth eksternal, atau database kedua.
- Dokumen dari generator baru adalah **DRAF**. Pengguna harus memeriksa identitas, bukti sumber, pajak, harga, kewenangan dan aturan sistem resmi sebelum diunggah.
- Pengujian lokal tidak mengotorisasi transaksi resmi; Perlem LKPP 3/2026 dibedakan dari Perlem 2/2026 untuk katalog.

## 2. Audit lampiran `ppkerja (1).zip`

ZIP berisi 149 entri. `package.json` menunjukkan React/Vite/TypeScript; Express + tRPC untuk server; Drizzle ORM dan MySQL; autentikasi Manus. README menyatakan aplikasi satu instansi (tidak mengisolasi OPD atau tahun seperti SATRIA) dan memiliki peran Admin, Pejabat Pengadaan, dan Reviewer/PPK. Kode server/routers.ts dan schema Drizzle menyimpan catatan reviewer. Aplikasi menyediakan demo HTML terpisah, tetapi README sendiri melarang pemakaian data nyata/dokumen produksi pada demo karena ketiadaan autentikasi dan proteksi.

**Keputusan audit:** jangan menempelkan seluruh ZIP ke root SATRIA atau menyalin server MySQL/Manus ke produksi SATRIA. Hal itu berisiko membuat dua identitas pengguna dan dua sumber data, menambah permukaan serangan serta persetujuan yang tidak diminta. Adaptasi yang diambil hanya pola kertas kerja per paket, pengecekan isian dasar, pengingat kewenangan, dan penanda bahwa keluaran masih draf. Adaptasi ini ditulis ulang sebagai `frontend/pbj2026-ppkerja-adapter.js`, sepenuhnya berbasis data paket yang sudah ada dan read-only.

Konsep yang **tidak dipindahkan**: workflow reviewer/PPK di aplikasi lain, batas nilai yang ditafsir otomatis sebagai otorisasi, aturan paket satu instansi, server, OAuth, MySQL, Drizzle, API eksternal, lampiran contoh sebagai dokumen resmi.

## 3. Generator HPS dari contoh pengguna

File contoh `Contoh tamplet hps .xlsx` dipakai sebagai acuan visual dan kolom, bukan sebagai ketentuan nasional yang mengikat. File contoh memuat 1 rincian x 3 set; harga satuan Rp42.792.000; subtotal Rp128.376.000; pajak Rp14.121.360; dan total Rp142.497.360. Kolom contoh bertuliskan `Pajak (%)` padahal berisi **nominal rupiah**. SATRIA 3.0.59.55 memisahkan tarif (%) dari nominal pajak (Rp).

Kode baru `frontend/satria-hps-generator.js` dan CSS pendukung:

- Mengisi rincian, nama barang, spesifikasi, volume, satuan, HPS/satuan langsung dari paket yang telah tersimpan.
- Memilih perhitungan harga **sudah termasuk pajak** (default: jangan menambah pajak lagi) atau **sebelum pajak** (jumlahkan pajak sesuai tarif yang diinput manual).
- Tarif pajak *tidak ditebak*. Pemakai memilih tarif dengan mempertimbangkan pengenaan pajak yang sebenarnya; tidak semua transaksi otomatis menggunakan tarif identik.
- Menyusun Excel `.xlsx` mandiri dengan rumus aktif, PDF A4 landscape melalui fasilitas cetak browser, dan draf dengan kop, tanggal, tempat, identitas penyusun/penetap, serta peringatan ketidaksesuaian.
- Menyimpan pengaturan HPS dalam objek paket (`hpsDokumen`) melalui transaksi SATRIA, **tidak memodifikasi** rincian HPS, penawaran, penetapan, atau nomor RUP.
- Memberikan peringatan jika total hasil dokumen melebihi pagu atau jika mode sebelum pajak mengubah total relatif terhadap angka paket tersimpan.
- Tidak otomatis menjamin format HPS yang diwajibkan untuk setiap metode. Template ini adalah adaptasi dari contoh pengguna, identitas PPTK/PPK bukan workflow tambahan.

**Contoh QA:** dengan mode sebelum pajak, 3 x 42.792.000 = 128.376.000; 11% = 14.121.360; total = 142.497.360. Berkas Excel dibuka kembali dengan `artifact_tool` dan formula tercatat; PDF A4 landscape dirender satu halaman untuk simulasi satu item.

## 4. Dropdown "Dasar regulasi transisi"

**Penyebab bug:** event umum SATRIA memicu gambar ulang form setiap kali dropdown berubah, menyebabkan nilai belum disimpan kembali ke nilai paket tersimpan. Fix: mengecualikan `data-pbj-start`, `data-pbj-basis`, dan `data-hps-doc-field` dari alur render umum, menyimpan isian sementara per paket sampai tombol Simpan dipilih, serta menguji perubahan dropdown pada browser asli.

**Apakah tahap ini wajib? TIDAK.**

- Pada E-Purchasing/katalog, selector Perlem 3/2026 disembunyikan karena jalur katalog mengikuti Perlem LKPP 2/2026 dan ketentuan yang relevan; bukan melaporkan transisi SPSE melalui penyedia secara paksa.
- Pada SPSE, catatan tanggal mulai pemilihan dan dasar transisi hanya ditampilkan **opsional**, untuk kasus yang relevan. Peraturan lama tidak boleh dipilih sebagai pengecualian otomatis. Pejabat harus memastikan kronologi dan bukti sesuai SE Kepala LKPP 3/2026.
- Menyimpan catatan tidak sama dengan pengesahan atau persetujuan pejabat.
- Untuk metode Tender/Seleksi yang tidak terbukti berada dalam ruang kewenangan PP, generator draf khusus PP tetap dibatasi seperti rilis sebelumnya.

Rujukan resmi: https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026 ; https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026 ; https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026

## 5. Pengujian

46/46 pengujian aplikasi lulus di lingkungan lokal: 24 JavaScript/Node dan 22 Python/browser. Pengujian mencakup dokumen, RUP, perhitungan harga, preview, sintaks/aset/cache PWA, pembatasan UI baca saja, dropdown transisi, dan ekspor HPS. File Excel diperiksa dengan `artifact_tool` dan PDF diperiksa melalui hasil render. Pengujian **tidak** mengakses koneksi Supabase produksi ataupun memastikan penerapan RLS online.

## 6. Rilis dan database

- **Tidak ada migrasi SQL baru.** Tidak ada tabel, kebijakan RLS, atau Edge Function baru dalam patch ini. Jangan jalankan ulang SQL lama.
- Data `hpsDokumen`, `tglMulaiPemilihan`, dan `dasarRegulasi` adalah atribut objek paket yang sudah tersimpan, tetapi persistensi/cloud-sync dengan akun asli perlu diperiksa di staging untuk memastikan konfigurasi serialisasi dan izin yang berlaku di deployment tersebut.
- Jalankan pengujian dengan akun dan paket contoh pada staging / cadangan sebelum mengubah paket aktif pengguna.
- Backup commit saat ini dan backup database terlebih dahulu; pasang patch ke root GitHub tanpa menghapus direktori. Setelah deploy, periksa versi header, panel PBJ, generator HPS, kolom transisi khusus SPSE, unduhan Excel/PDF, dan sinkronisasi antar perangkat.
- Bila gagal, rollback commit ke 3.0.59.54; jangan hapus IndexedDB atau reset Supabase.

Tidak ada kode `ppkerja` asli yang ditanamkan; hanya konsep yang diimplementasikan ulang dalam stack SATRIA.
