# SATRIA — Smart Survey tanpa pengulangan evaluasi spesifikasi

Tanggal: 8 November 2026. Sumber proyek: ZIP SATRIA PPKom Bapperida/Disporapar yang telah diuji sebelumnya.

## Perilaku baru

- **Mode Sederhana:** Tidak menampilkan pilihan nilai kesesuaian spesifikasi. Tetap mencatat identitas produk e-Katalog, harga sebelum pajak, PPN, URL produk, dan bukti sesuai alur yang sudah ada.
- **Mode Lengkap:** Bagian lama **“Kesesuaian spesifikasi (pilih satu)”** diganti menjadi **“Informasi pendukung produk (opsional)”**. Pilihan lulus/tidak lulus/klarifikasi dan catatan penilaian teknis dihapus dari formulir baru. Informasi PDN/TKDN, UMKK, ongkos kirim simulasi, dan catatan produk tetap tersedia.
- **Kompletnya bukti:** Kelengkapan referensi dihitung dari 7 indikator, tanpa indikator penilaian kesesuaian spesifikasi yang sebelumnya harus diisi manual.
- **Pembanding harga:** Kolom status sekarang menyatakan **“Referensi katalog”** (atau catatan penilaian lama yang masih bermasalah), bukan klaim **“Sesuai”** otomatis.
- **Dokumen Analisis Kewajaran Harga:** Kesimpulan harga tidak lagi mensyaratkan pilihan `suitability === 'sesuai'`. Dokumen **tidak menyimpulkan produk otomatis sesuai dengan kebutuhan/KAK**; PPK tetap bertanggung jawab memastikan pilihan produk tepat. Indikasi konflik nama/model/ukuran tetap ditandai.

## Keamanan dan kompatibilitas data lama

- Penilaian spesifikasi lama yang tersimpan **tidak dimigrasi massal dan tidak dihapus**. Jika produk sama disimpan ulang, status penting lama tetap dipertahankan sebagai informasi historis. Jika pengguna mengganti produk, status dari produk lama tidak diwariskan secara otomatis kepada produk baru; riwayat menyimpan status sebelumnya.
- Jika produk pembanding lama digunakan sebagai referensi, catatan lama tetap terbawa selama identitas produk sama.
- Tidak ada perubahan database, izin OPD/tahun, logika simpan harga/negosiasi, identitas penyedia, penetapan pemenang, ataupun template DPP.
- Keterangan yang ada di katalog tidak otomatis memastikan pemenuhan kebutuhan spesifik paket. Rujukan: **Peraturan LKPP Nomor 2 Tahun 2026** tentang Katalog Elektronik, terutama Pasal 12 ayat (3)–(6); lihat https://jdih.lkpp.go.id/regulation/peraturan-lkpp/peraturan-lkpp-nomor-2-tahun-2026.

## Penerapan

Unggah seluruh isi ZIP lengkap ke repository SATRIA seperti biasa atau gunakan patch untuk perubahan terbatas. Cloudflare Pages menerbitkan frontend. Cache PWA dinaikkan agar browser memuat skrip dan CSS terbaru. **Tidak perlu perubahan SQL atau Edge Function Supabase khusus perbaikan Smart Survey ini.** Perubahan akun PPKom dari rilis sebelumnya tetap memerlukan Edge Functions yang sesuai, jika belum diterapkan.

## Pengujian

Dari root proyek:

```bash
node tools/test_smart_survey_no_reassessment_20261108.js
node tools/test_price_analysis_evidence_335.js
node tools/test_price_product_comparison_336.js
node tools/test_supplier_catalog_source_20261108.js
node tools/test_navigation_survey_winner_350.js
```
