# SATRIA Framework 3.0.42 — Gen Z Workspace dan Tipografi

Penyempurnaan visual Data Paket, Rincian Kebutuhan dan HPS, serta Penawaran dan Negosiasi.
Standar font: Inter untuk teks dan kontrol; Plus Jakarta Sans untuk judul; JetBrains Mono untuk nilai numerik.
Kelompok Data Paket: Identitas & Anggaran; Program/Kegiatan/Subkegiatan; Rekening & Output; Penanggung Jawab & Pelaksanaan; Jadwal & Dokumen.
Ringkasan total HPS, sisa pagu, jumlah barang, jumlah penyedia, dan progres negosiasi ditambahkan tanpa mengubah sumber data.
CSS tambahan berlaku hanya pada layar, tidak mengubah 14 template, Arial dan ukuran A4 pada PDF.

Diuji: sintaks 19 skrip JavaScript, kontrak markup 3 halaman, uji visual terisolasi 1440 dan 390 piksel, dan pemeriksaan lebar horizontal.
Belum diuji: seluruh alur interaksi tersambung/Supabase, pengujian PDF di seluruh browser dan perangkat nyata.

Deployment: backup data JSON lebih dahulu; unggah index.html dan sw.js bersama dari ZIP ini. Migrasi Supabase sama dengan versi 3.0.41.3.
