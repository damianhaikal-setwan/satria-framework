# SATRIA 3.0.41.1 — Klarifikasi Admin dan OPD Input RUP

## Hak akses yang berlaku

- Admin organisasi **Supabase Auth** membaca dan memperbarui seluruh OPD/tahun dalam snapshot organisasinya (selama sudah tersedia dalam `S.opd`/`S.tahun`).
- User **Admin lokal** yang dipilih di header HTML hanya mengatur tampilan browser, bukan memberikan privilege Auth atau membatalkan pembatasan server.
- Operator/Viewer tetap dibatasi assignment OPD/tahun sesuai scope Supabase; HTML tidak melakukan eskalasi privilege.
- Peran dari `satria_memberships` Supabase aktif harus diverifikasi setelah login.

## Perbaikan UI

1. Default OPD **Input RUP Manual** mengikuti filter OPD di header, bukan pilihan `rupDefOpd` yang disimpan untuk impor JSON.
2. Pilihan OPD manual dipertahankan jika halaman dirender ulang (sampai filter utama diubah).
3. Jika header `Semua OPD` dan terdapat lebih dari satu pilihan, pengguna diwajibkan memilih OPD tujuan secara eksplisit.
4. Menu menampilkan status role cloud dan jumlah OPD tersedia, serta petunjuk jika OPD tujuan belum ada.
5. Tidak ada perubahan pada migrasi Supabase, kewenangan RLS, perhitungan HPS, dan generator dokumen.

## Cara uji (staging terlebih dahulu)

1. Login Supabase sebagai Admin (cek membership server), lalu **Tarik dari Supabase**.
2. Buka Pengaturan Sistem; pastikan BAPPERIDA dan DISPORAPAR sama-sama terdaftar pada OPD master. Jika DISPORAPAR belum ada, Admin tambahkan dan sinkronkan.
3. Pada header pilih DISPORAPAR, masuk Input RUP → Input RUP Manual. Kolom OPD tujuan harus otomatis DISPORAPAR.
4. Saat filter `Semua OPD`, pilih DISPORAPAR secara eksplisit; simpan RUP. RUP harus tercatat dengan `opd` milik DISPORAPAR, bukan BAPPERIDA.
5. Login Operator yang hanya ditugaskan BAPPERIDA; DISPORAPAR tidak boleh terlihat pada daftar OPD.
6. Pastikan impor JSON tetap menggunakan pilihan OPD impor secara terpisah.

**Catatan:** Kode aplikasi belum membuktikan apakah keanggotaan Admin, isi snapshot OPD, serta migrasi RLS sudah benar-benar diterapkan di Supabase milik pengguna.
