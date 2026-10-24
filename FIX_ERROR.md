
# FIX ERROR dari screenshot

Error di screenshot:
1. Uncaught SyntaxError: Unexpected token '.' at (index):2040
   -> Penyebab: CSS .satria-cloud-btn{} masuk ke dalam <script> karena patch dashboard lazy menghapus </script><style> boundary
   -> Fix: rebuild dari index_virtual_dok.html yang clean, inject dashboard lazy dengan benar, tidak menghapus tag boundary

2. Cannot read properties of null (reading 'addEventListener') at 2834
   -> $id('scClose') null karena modal HTML belum ada atau script jalan sebelum DOM ready
   -> Fix: tambahkan safe check if(el) sebelum addEventListener, dan if(modal) sebelum modal.hidden

3. Cannot set properties of null (setting 'value') at fillConfig 2462
   -> $id('scUrl').value = ... tapi element null
   -> Fix: safe check const a=$id('scUrl'); if(a) a.value=...

4. SW Cache addAll partial fail + FetchEvent network error
   -> SW mencoba cache.addAll dengan Request mode no-cors dan external CDN yang gagal, plus fetch handler tidak handle error
   -> Fix: SW baru hanya cache ['./','./index.html'], skip Supabase API (network-only), handle catch fallback ke cache

5. OPD belum tersedia + Entitas 0
   -> Karena ada localStorage satria-supabase-bridge-config-v1 tersisa, window.SATRIA_CLOUD_CONFIGURED=true, maka boot() mengosongkan S.opd=[]
   -> Fix: ini intentional untuk cloud mode, tapi untuk local mode user harus clear localStorage atau login. Di bundle fixed, kita tambahkan badge "Atur Supabase" jika config ada tapi belum login.
   -> Untuk reset local: buka Console > localStorage.removeItem('satria-supabase-bridge-config-v1') > refresh

Setelah fix ini, console harus bersih 0 error.
