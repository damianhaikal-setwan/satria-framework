# SATRIA NEXT 3.0.48 — Perbaikan Enam Grafik Dashboard

Basis: `SATRIA-Framework-3_0_47-Integrasi-Kalkulator-Penawaran.html`.

## Temuan yang diperbaiki

1. **Grafik macet di Loading**: cache `__renderedCharts` masih mengingat ID grafik lama saat DOM Dashboard dibuat ulang, sehingga `IntersectionObserver` menolak render ulang grafik sesudah perubahan filter atau data.
2. **Ketergantungan D3 CDN**: tanpa internet, semua grafik sebelumnya tetap pada skeleton; engine baru membuat visualisasi memakai DOM/SVG native tanpa ketergantungan CDN.
3. **Efisiensi semu**: selisih pagu terhadap nilai penetapan tidak sama dengan efisiensi/penghematan. Kini dipisahkan menjadi nilai penetapan, sisa pagu paket yang ditetapkan, pagu paket belum ditetapkan, dan selisih HPS–negosiasi yang hanya berlaku untuk paket dengan penetapan tervalidasi.
4. **Grafik negatif/tanpa data**: sekarang ada empty state khusus dan peringatan jika HPS > pagu atau penetapan melampaui pagu.
5. **Institusi tanpa penetapan**: OPD sebelumnya hilang dari grafik karena batang bernilai nol. Kini tetap muncul menggunakan pagu dan nilai penetapan sebagai dua ukuran terpisah.
6. **Filter tahun & OPD**: semua grafik mengikuti data `filt()` yang telah menegakkan tahun, OPD, dan cakupan akun; tren lintas tahun menerapkan filter yang sama untuk tiap tahun.

## Definisi indikator

- **Pagu**: total pagu paket sesuai filter.
- **HPS**: jumlah rincian barang (volume × harga HPS satuan).
- **Nilai penetapan**: hasil penawaran/negosiasi yang lolos `pemenang(p)` / pemeriksaan kelayakan saat ini di aplikasi. *Bukan* nilai kontrak terverifikasi atau realisasi pembayaran.
- **Selisih HPS–negosiasi**: `HPS - nilai penetapan` hanya untuk paket dengan penetapan valid. **Bukan** penghematan kas atau efisiensi yang sudah terealisasi.
- **Budget Utilization**: tiga kelompok—nilai penetapan, sisa pagu pada paket yang sudah ditetapkan, dan seluruh pagu pada paket belum ditetapkan.
- **Governance Status**: jumlah paket berdasarkan tahapan proses yang dikembalikan `stt(p)`, bukan hasil penilaian kepatuhan hukum.
- **Performance Matrix**: sebaran HPS versus pagu pada paket yang memiliki keduanya, dengan tanda jika HPS melebihi pagu.
- **Institution Analytics**: pagu dan nilai penetapan per OPD pada tahun serta lingkup akun aktif.

## Pengujian yang telah dilakukan

- Node.js `--check` terhadap semua skrip inline: **lulus**.
- Chromium terisolasi: dataset paket dengan penetapan valid dan paket draf: **lulus**.
- Ganti tahun 2026 → 2025 dengan grafik dirender ulang: **lulus**.
- Filter OPD: **lulus**.
- Tidak ada paket: enam grafik menampilkan keterangan, tidak macet di Loading: **lulus**.
- Layar 390px: **lulus dalam pengujian terisolasi**.
- Render ulang melalui `render()` aplikasi penuh (set_content, tanpa dependensi CDN): **lulus**; perubahan OPD mereset dan memperbarui grafik.

## Batasan

Pengujian di atas menggunakan simulasi lokal, bukan data operasional atau koneksi Supabase produksi. Hasil tampilan di Safari iPhone, data cloud multiuser, dan keseluruhan 14 cetakan dokumen belum diuji ulang pada versi ini. Modul dokumen dan migrasi SQL tidak diubah.
