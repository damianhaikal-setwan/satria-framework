# SATRIA NEXT 3.0.59.52 — Penyesuaian PBJ 2026

**Tanggal paket:** 11 November 2026  
**Status:** kandidat rilis hasil pengujian lokal; **belum diotorisasi untuk deployment produksi** sebelum uji staging/live-readonly di bawah selesai.  
**Basis kode:** ZIP `satria-framework-main.zip` yang diserahkan pemilik; bukan otomatis identik dengan commit/deployment online terkini.

## Tujuan dan batas kewenangan

SATRIA adalah alat bantu internal Pejabat Pengadaan untuk pengelolaan paket, data harga, penyusunan bahan, dan dokumen pendukung **sistem resmi**. SATRIA **tidak** menjalankan proses SPSE/INAPROC, tidak menambah persetujuan berjenjang, tidak mengesahkan dokumen, tidak mengunggah otomatis, dan tidak memperluas kewenangan Pejabat Pengadaan. Perlu pemeriksaan petugas pada bukti dan dokumen sebelum penggunaan resmi.

## Dasar aturan dan sikap konservatif

- Perlem LKPP 3/2026: persiapan dan pelaksanaan PBJ melalui penyedia — https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-3-tahun-2026
- SE Kepala LKPP 3/2026: ketentuan peralihan — https://jdih.lkpp.go.id/regulation/surat-edaran-kepala-lkpp/surat-edaran-kepala-lkpp-nomor-3-tahun-2026
- Perlem LKPP 2/2026: tata kelola E-Purchasing/Katalog Elektronik — https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026

Perlem 3/2026 **tidak** diaplikasikan otomatis ke jalur Katalog. Tanggal mulai pemilihan yang dimasukkan pengguna hanya informasi yang harus diverifikasi; pada periode 22 Sep–9 Okt 2026 aplikasi meminta penilaian masa transisi, **tidak** otomatis menyimpulkan dasar yang benar. Penerapan Pasal, Lampiran, pengecualian, dokumen baku, batas kewenangan dan SOP instansi **harus diverifikasi dari sumber resmi** sebelum rilis produksi.

## Perubahan utama

1. **Evaluasi penetapan berdasarkan batas total.** Harga tayang dan hasil negosiasi per item yang lebih tinggi dari HPS satuan **bukan pemblokir otomatis**. Peringatan kewajaran tetap tampil dan dicatat. Penetapan tetap ditolak bila total akhir melebihi HPS paket/pagu, angka/tanggal/sumber negosiasi belum lengkap, atau hasil negosiasi melebihi harga tayang per unit. Catatan review historis tetap dipertahankan tetapi **opsional**.
2. **Bank RUP berulang tetap ada.** Satu RUP dapat ditautkan beberapa paket dengan alokasi HPS/cadangan dan penghitungan penetapan akhir untuk menghindari pemakaian ganda. Tidak ada penghapusan data, reset saldo atau migrasi SQL untuk fitur ini.
3. **Pemisahan jalur.** `frontend/pbj2026-policy.js` menandai Katalog, Pengadaan Langsung SPSE, dan SPSE metode lain secara terpisah. Pada Pengadaan Langsung, indikasi fitur pencatatan/transaksional berdasarkan jenis & nilai ditampilkan sebagai panduan, tidak menggantikan klasifikasi resmi.
4. **Paket dokumen bantu.** `frontend/pbj2026-workspace.js/.css` menambahkan panel di Studio Dokumen dan detail monitoring SPSE. Pada Pengadaan Langsung SPSE, tiga **DRAF** terintegrasi menggunakan informasi paket: Dokumen Pemilihan, BA Reviu DPP, Analisa Pasar Pejabat Pengadaan. Semua draf berlabel *belum siap unggah* jika belum dilengkapi. Tender/Seleksi tidak diberi generator khusus PP.
5. **E-Purchasing:** mempertahankan DPP yang tersedia. Kebutuhan operasional DPP di bawah Rp50 juta dan DPP + HRS di atas Rp50 juta ditampilkan sebagai panduan internal, **bukan klaim kewajiban hukum**. Istilah/format **HRS belum dikonfirmasi**, maka **tidak dibuat dokumen HRS palsu**. Persis Rp50 juta juga belum diberi klasifikasi otomatis sebelum SOP dipastikan.
6. **Analisis harga:** pembanding yang berbeda spesifikasi tidak otomatis disimpulkan wajar. PDF A4 potret mencantumkan tabel item, harga, peringatan bukti/spesifikasi, dan identitas draf. Rincian produk pembanding yang berbeda dijelaskan dalam narasi.
7. **Versi/cache dan tes:** berkas index, manifest, service worker, engine kualitas dokumen, dan ekspektasi tes lama diselaraskan dengan versi 3.0.59.52. Cache PWA baru memuat aset PBJ.

## Perubahan penyimpanan data

- Tidak ada perubahan skema SQL atau kebijakan RLS dalam paket ini.
- Dua properti opsional baru pada objek paket JSON: `tglMulaiPemilihan` dan `dasarRegulasi`; disimpan melalui `SATRIA.tx` dengan kontrol hak tulis dan scope OPD/tahun yang sudah ada. Cadangkan snapshot dan uji dua arah Supabase sebelum produksi.
- **Tidak ada** migrasi historis massal, persetujuan baru, penghapusan riwayat atau penetapan otomatis.

## Bukti pengujian lokal

- **43/43 pengujian otomatis lulus** (Node, Python, Chromium headless) pada snapshot ini. Log lengkap pada lampiran `SATRIA_2026_TEST_RESULTS.json` di luar ZIP.
- Termasuk: anggaran RUP, kontrol award vs HPS total/pagu, harga/unit, PPN pecahan, bukti harga, PDF A4, 15 dokumen lama, hak akses lokal, proses transisi, dokumen SPSE yang hanya draf, dan perlindungan Tender/Seleksi.
- Semua data kasus pengujian sintetis. **Belum menjalankan** pengetesan akun Supabase staging nyata, RLS nyata, sinkronisasi multiakun secara end-to-end, produksi, kompatibilitas seluruh perangkat, dan pemeriksaan format dokumen oleh pejabat/instansi.

## Prosedur staging dan go/no-go produksi

1. Cocokkan commit GitHub terbaru dan konfigurasi yang dipakai di deployment saat ini. Jika berbeda dari ZIP dasar, **merge dan audit diff** sebelum memasang; jangan menimpa fitur produksi yang lebih baru.
2. Cadangkan data JSON aplikasi, snapshot database Supabase, dan repositori/deployment lama. Simpan cara rollback yang dapat diuji.
3. Ekstrak ZIP, unggah **semua file sambil mempertahankan struktur direktori** di cabang staging; jangan mengganti direktori `supabase` produksi atau menjalankan SQL bila tidak diperlukan.
4. Buka `https://staging...`, hard refresh/reload PWA dan cek service worker versi `satria-v3.0.59.52-...`; pastikan JS/CSS baru memuat tanpa 404 / error Console.
5. Dengan akun Pejabat Pengadaan yang benar: uji paket E-Purchasing memiliki item di atas HPS satuan tetapi total di bawah HPS dan pagu. Pastikan penetapan dapat diproses setelah bukti lengkap; paket di atas HPS total/pagu tetap ditolak. Uji RUP dipakai berulang tanpa penghitungan ganda.
6. Dengan akun OPD A, OPD B, Viewer dan Admin pada data uji: verifikasi RLS server, keterbatasan edit, akses lintas tahun dan pencegahan pembacaan paket lain. Uji login ulang dan sinkronisasi dua browser (termasuk konflik, jaringan putus dan pemulihan data).
7. Dengan paket SPSE **Pengadaan Langsung**, cek tiga draf beserta data dan disclaimer; metode Tender tidak boleh menampilkan draf PP. Tinjau tanggal transisi 2026 dan dasar hukum historis terhadap bukti.
8. Periksa 15 jenis dokumen lama, contoh 7 produk, PDF A4, nomor, tanggal, tanda tangan, hasil perbandingan, serta kebutuhan unggah e-Katalog/SPSE aktual. **Konfirmasi identitas dan templat HRS dengan SOP resmi**.
9. Periksa akses CDN Dexie/Supabase JS pada lingkungan target; PWA belum sepenuhnya mandiri offline karena dependensi pihak ketiga masih berasal dari CDN. Pastikan fitur online/stabilitas sesuai kebutuhan operasional.
10. Hanya setelah semua poin lolos dan disetujui pemilik aplikasi serta penanggung jawab data, lakukan deploy dengan pemantauan transaksi dan log. Bila ada gangguan: rollback ke commit dan deployment terdahulu, lalu pulihkan data **hanya** berdasarkan prosedur yang tervalidasi untuk menghindari penghapusan transaksi baru.

**Kesimpulan:** artefak ini adalah **release candidate yang siap diuji dalam staging**, bukan bukti bahwa kode live sudah dimutakhirkan atau sistem secara hukum telah tersertifikasi sepenuhnya terhadap Perlem 3/2026. Jangan menyajikan draf baru sebagai dokumen resmi tanpa kelengkapan dan pemeriksaan orang berwenang.
