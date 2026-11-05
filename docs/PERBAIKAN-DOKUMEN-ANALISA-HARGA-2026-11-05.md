# Perbaikan dokumen nomor 15 — Analisis Kewajaran Harga

**Acuan tata letak:** `Contoh analisa.pdf` yang diberikan pengguna (4 halaman, A4 portrait).
**Sumber dokumen:** data paket yang sudah ada dalam SATRIA, bukan data contoh yang ditanam di kode.

## Yang disesuaikan

1. **Kop dan identitas paket** ditampilkan terlebih dahulu, dengan baris `Program`, `Kegiatan`, `Sub Kegiatan`, `Akun Belanja`, `Kode RUP`, `Nama Paket`, `Pagu Anggaran`, dan `Metode Pengadaan`. Kop diambil dari Pengaturan/OPD; jangan menyalin logo dan pejabat milik paket lain.
2. **I. Latar Belakang:** dua paragraf fungsi analisis dan tujuan pemanfaatan anggaran.
3. **II. Daftar Kebutuhan Barang:** tabel nomor, nama dan spesifikasi, volume, satuan, HPS satuan, dan jumlah HPS. Total = Σ(volume × HPS satuan).
4. **III. Metode Referensi:** penyedia A dan B/C/dst. hanya sebanyak yang benar-benar tercatat; target adalah pemenang valid, jika sudah ada.
5. **IV. Tabel Analisa Beda Harga Per Item:** harga tayang target dibandingkan dengan harga tayang masing-masing pembanding per **satuan barang**. Selisih = harga pembanding − harga target; arah selisih diterangkan, dan status kewajaran tidak dipastikan otomatis.
6. **V. Analisa dan Pertimbangan Kewajaran:** tiap barang memiliki harga penawaran, analisis, dan kesimpulan, menggunakan satuan dan nama penyedia yang sesuai; catatan beda produk/ukuran tetap terlihat.
7. **VI. Rekapitulasi:** total HPS, total negosiasi penyedia ditetapkan *termasuk ongkir tercatat*, dan efisiensi HPS. Jika pemenang atau negosiasi belum valid, nominal final tidak dibuat.
8. **VII. Kesimpulan dan Rekomendasi:** tetap tiga butir, tidak menyatakan seluruh item wajar hanya karena lebih murah. Kota, tanggal dokumen, nama dan NIP penandatangan diambil dari data aplikasi.
9. **Cetak:** A4 portrait, judul tengah bergaris bawah, identitas paket tanpa garis tabel, tabel barang/pembanding bergaris, lampiran foto dicetak hanya ketika foto asli tercatat.

## Ketidaksesuaian pada PDF contoh yang sengaja tidak disalin

- Metode menyebut **3 sumber pembanding**, tetapi yang tercantum hanya **2 penyedia**. SATRIA menghitung jumlah sumber sesuai data.
- Tabel harga tayang FOTO COPY PRIMA untuk tujuh barang menghasilkan **Rp 1.749.800** berdasarkan volume dan harga satuan di contoh. Angka **Rp 1.725.100** pada bagian rekap tidak identik dengan nilai tayang tersebut, sehingga harus dianggap nominal hasil transaksi berbeda yang memerlukan dasar negosiasi asli; aplikasi tidak menyamakan keduanya.
- Nilai **Rp 199.700** dari HPS **Rp 1.924.800** berarti sekitar **10,38%**, bukan **4,55%** seperti yang tertulis.
- Di kesimpulan tercantum **PT Nusantara Mandiri**, padahal tabel membandingkan **FOTO COPY PRIMA** dengan **RIAN ALBHENI**. SATRIA menggunakan nama pemenang yang valid di paket, tidak nama contoh.
- PDF contoh mencantumkan beberapa satuan/angka selisih yang tidak konsisten; SATRIA menghitung selisih dan satuan per baris, bukan menyalin nilai teks.

## Batas dan penggunaan

- Ini adalah **template dokumen dinamis**, bukan penerbitan ulang dokumen pengadaan tahun 2026. Tanggal cetak mengikuti tanggal pembuatan dokumen saat ini, bukan dimundurkan otomatis ke tanggal transaksi historis.
- Bukti katalog, kesetaraan produk, pajak, ongkir, tanggal harga, dan kesimpulan kewajaran tetap memerlukan pemeriksaan manual oleh pejabat terkait.
- Perubahan hanya pada `frontend/satria-price-analysis.js`, `frontend/satria-price-analysis.css`, test perbandingan harga, dan nama cache `sw.js` agar pengguna aplikasi terpasang memperoleh versi terbaru. Tidak ada perubahan ke Supabase atau data paket.

## Pengujian

- `node tools/test_price_product_comparison_336.js`
- `node tools/test_price_analysis_evidence_335.js`
- Uji offline Chromium: 7 item, 2 penyedia, penyedia belum ditetapkan, dan skenario pemenang valid; cetak PDF A4 portrait; pembandingan nominal, kesesuaian 7 bagian, dan pemeriksaan tidak adanya mutasi data paket.

## Langkah setelah unggah

Perbarui file di repositori/deployment, lakukan pemuatan ulang aplikasi bila perlu, kemudian buka **Dokumen → 15. Analisis Kewajaran Harga & Bukti → Cetak / Simpan PDF**. Verifikasi isi dengan data satu paket nyata dan bukti pembandingnya sebelum digunakan secara resmi.
