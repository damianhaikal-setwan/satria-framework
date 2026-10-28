# SATRIA Framework 3.0.43 — Hotfix klasifikasi subkegiatan

## Penyebab yang dikonfirmasi
1. `rupParseRow()` menggunakan `S.kode[0]?.kode` sebagai nilai subkegiatan ketika data SiRUP tidak menyertakannya.
2. `rupcreate` kembali memakai fallback yang sama saat membuat paket dari Bank RUP.
3. Tabel daftar paket menampilkan `p.sub` dan nama Data Master secara langsung, tanpa mendeteksi placeholder `KODE-DEMO-001`.
4. `klasifikasiDetail` dapat memakai `S.meta` berisi contoh `Program Demo`/`Kegiatan Simulasi` sebagai default dokumen nyata.

## Perbaikan
- Impor JSON/CSV tidak lagi mengisi kode subkegiatan dari item pertama Data Master. Nilai `KODE-DEMO-001` disaring sebelum masuk hasil impor.
- Pembuatan paket dari Bank RUP memakai `sub` hanya jika berasal dari RUP dan bukan kode demo.
- Tabel paket desktop/mobile serta generator dokumen menggunakan sumber klasifikasi yang sama. Subkegiatan yang tidak diketahui ditampilkan `Belum diisi` di daftar paket, tanpa mengarang kode atau nama.
- Program/kegiatan/output contoh bawaan tidak digunakan sebagai fallback untuk paket nyata.
- Tersedia tombol satu kali **Bersihkan kode contoh pada paket/Bank RUP** pada daftar paket ketika menemukan referensi terkontaminasi. Tombol memerlukan konfirmasi dan mengikuti hak edit. Hanya `sub=KODE-DEMO-001` yang dibersihkan pada paket nyata tanpa subkegiatan manual serta entri Bank RUP non-demo. Tidak menghapus data paket atau rincian HPS.
- Pemeriksaan integritas memberi peringatan ketika subkegiatan paket nyata belum diisi.

## Cara memakai pada data yang sudah ada
1. **Backup JSON** sebelum mengganti versi.
2. Buka SATRIA 3.0.43, masuk ke Paket Pengadaan. Kode contoh pada paket nyata tidak lagi ditampilkan sebagai subkegiatan resmi.
3. Jika muncul kartu peringatan, tekan **Bersihkan kode contoh pada paket/Bank RUP**, periksa konfirmasi, dan lanjutkan jika benar.
4. Buka **Data Paket → Program, Kegiatan & Subkegiatan**, masukkan klasifikasi asli sesuai dokumen yang sah.
5. Periksa Nota Dinas, DPP, BAHP dan dokumen lain sebelum Save PDF.
6. Jika menggunakan Supabase, pastikan perubahan tersinkron sebelum mengganti perangkat atau menutup sesi. Migrasi SQL tidak diubah dalam versi ini.

## Pengujian
- 19 skrip inline lulus `node --check`.
- 9 skenario klasifikasi dan parser RUP lulus, termasuk RUP tanpa subkegiatan, subkegiatan resmi, legacy demo, serta nilai tak dikenal.
- Render tabel desktop terisolasi melalui Chromium menampilkan `Belum diisi` untuk paket nyata terkontaminasi dan tetap menampilkan `5.1.1 — Pelaksanaan Kegiatan` untuk data sah.
- Interaksi seluruh aplikasi dengan Supabase aktif **belum diuji secara langsung**.
- Semua template HTML dokumen cetak dipertahankan; hanya sumber klasifikasi yang dibenahi.
