# SATRIA NEXT 3.0.59.22 — Ringkasan Utama dan Bank RUP: HPS & penetapan

## Perubahan dari 3.0.59.21

- Ringkasan Utama dan Bank RUP menunjukkan alokasi menurut HPS/cadangan, nilai penetapan yang tervalidasi, sisa sebelum penetapan, dan sisa setelah penetapan.
- **RUP tunggal**: setelah pemenang dinyatakan valid oleh gate negosiasi SATRIA, alokasi paket dihitung memakai nilai penetapan **menggantikan** HPS/cadangan paket itu, bukan keduanya dijumlahkan.
- **Paket belum ditetapkan**: tetap menggunakan total volume × HPS satuan jika seluruh rincian lengkap; jika belum lengkap, pagu paket dicadangkan.
- **Konsolidasi multi-RUP**: nilai penetapan yang terhubung ditampilkan sebagai **belum teratribusi**; alokasi konsolidasi tetap memakai pembagian eksplisit atau cadangan konservatif. Nilai penetapan multi-RUP tidak diprorata tanpa dasar sehingga tidak terjadi atribusi palsu/dobel.
- **SPSE monitoring**: kontrak dan pembayaran SPSE **bukan** penetapan pemenang e-Purchasing; alokasi SPSE tetap dicadangkan di Bank RUP, nilainya ditampilkan secara terpisah.
- Ringkasan Utama menambahkan status paket e-Purchasing, administrasi belum lengkap, masalah RUP, keterlambatan SPSE, dan pembayaran terverifikasi.
- Persentase kelengkapan dan rasio penetapan terhadap pagu e-Purchasing tidak lagi memakai paket monitoring SPSE sebagai penyebut.
- Perubahan adalah **perhitungan baca saja**; tidak mengubah nilai pagu di sumber RUP, penawaran, pemenang, kontrak, dokumen resmi, data tersimpan, skema SQL, atau hak akses.

## Rumus dan contoh

Untuk satu RUP dengan pagu Rp100.000.000:

- Paket A: HPS Rp40.000.000; penetapan valid Rp35.000.000.
- Paket B: belum ditetapkan; HPS/cadangan Rp20.000.000.
- **Sisa menurut HPS** = Rp100.000.000 − Rp40.000.000 − Rp20.000.000 = **Rp40.000.000**.
- **Sisa setelah penetapan** = Rp100.000.000 − Rp35.000.000 − Rp20.000.000 = **Rp45.000.000**.
- Total nilai penetapan: Rp35.000.000. HPS Paket A tidak dikurangi lagi di atas Rp35.000.000.

**Penting:** Sisa RUP = kapasitas rencana anggaran berbasis data SATRIA, **bukan** kas tersedia, realisasi, nilai pembayaran, atau keputusan perubahan pagu RUP resmi. Angka agregat sisa menjumlahkan kapasitas positif per RUP; RUP yang minus disoroti terpisah sebagai kelebihan, tidak saling menutup dengan RUP lain. Angka multi-RUP tanpa atribusi tidak masuk nilai penetapan **teratribusi**, tetapi muncul dalam indikator nilai penetapan multi-RUP yang belum terbagi.

## Pengujian sebelum produksi

```bash
node tools/test_rup_bank_visibility.js
node tools/test_rup_award_dashboard.js
node tools/test_nego_net_349.js
node tools/test_navigation_survey_winner_350.js
node tests/test_dpp_352.js
python tools/test_rup_bank_contract.py
python tools/security_static_check.py
```

Lakukan uji di staging dengan akun/operator sesungguhnya; ulangi sesudah logout-login dan sinkronisasi cloud. Pengujian Node/Python hanya menguji logika secara lokal; pengujian database cloud/produksi belum dilakukan. Versi ini tidak meminta migrasi Supabase tambahan. Service worker diberi versi cache baru supaya browser memuat kode Dashboard terbaru.
