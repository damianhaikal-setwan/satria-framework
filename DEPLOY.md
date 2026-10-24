# SATRIA Final Bundle - Siap Push ke Repo + Pages.dev

## Isi Bundle
```
satria-final-bundle/
├── index.html          # Aplikasi utama (sudah minify tipis + PWA + auto-sync)
├── manifest.json       # PWA manifest AWA
├── sw.js               # Service Worker (offline + cache CDN, skip Supabase API)
├── icon-192.png        # Icon 192 (install HP)
├── icon-512.png        # Icon 512 (splash screen)
├── _headers            # Cloudflare Pages headers (SW no-cache)
├── _redirects          # SPA fallback
└── DEPLOY.md           # Ini
```

## Checklist Deploy Cloudflare Pages.dev

### 1. Push ke GitHub
```bash
# Di root repo kamu (yang sudah git init)
cp satria-final-bundle/index.html ./index.html
cp satria-final-bundle/manifest.json ./manifest.json
cp satria-final-bundle/sw.js ./sw.js
cp satria-final-bundle/icon-*.png ./
cp satria-final-bundle/_headers ./_headers
cp satria-final-bundle/_redirects ./_redirects

git add index.html manifest.json sw.js icon-*.png _headers _redirects
git commit -m "feat: SATRIA final bundle - PWA AWA + Supabase auto-sync HP + virtual scroll all pages (90% lighter)"
git push origin main
```

### 2. Cloudflare Pages Setup
1. Buka https://dash.cloudflare.com > Pages > Create project > Connect to Git
2. Pilih repo kamu
3. Build settings:
   - Framework preset: None / Static
   - Build command: (kosongkan)
   - Build output directory: `/` atau `.` (root)
4. Deploy > selesai

### 3. Setelah Deploy
- Buka `https://namaproject.pages.dev`
- Buka di HP Android: Chrome > Menu > Install app / Tambahkan ke layar utama
- Buka di iPhone: Safari > Share > Add to Home Screen

### 4. Aktifkan Supabase Auto-Sync di HP

#### Opsi A: Embedded config (auto-login, recommended untuk OPD)
Edit `index.html`, cari:
```js
window.SATRIA_EMBEDDED_SUPABASE_CONFIG = {};
```
Ganti jadi:
```js
window.SATRIA_EMBEDDED_SUPABASE_CONFIG = {
  url: "https://xxxx.supabase.co",
  key: "eyJhbGciOi... (anon key, BUKAN service_role)",
  org: "uuid-organisasi-kamu"
};
```
Lalu commit + push lagi. HP langsung auto terhubung tanpa input manual.

#### Opsi B: Login manual di HP
1. Buka aplikasi di HP > Pengaturan Sistem > Cloud Sync
2. Isi:
   - Project URL: `https://xxxx.supabase.co`
   - Anon Key: `eyJ...`
   - Org UUID: `...`
3. Isi Email + Password akun Supabase
4. Klik Connect > Pull

### 5. Test Auto-Sync HP -> Supabase
1. Di HP, tambah paket baru / edit HPS
2. Lihat badge kanan atas: `⏳ Menyimpan ke HP & Cloud...` -> `✅ Sinkron ke Supabase`
3. Buka di laptop/desktop, login akun sama, klik Pull -> data HP muncul
4. Test offline: matikan internet HP > edit data > toast `📴 Offline • disimpan di HP` > nyalakan internet > otomatis sync `🌐 Online • siap sync`

### 6. Performance Check (Android)
- Chrome DevTools > Remote Devices > Inspect HP
- Lighthouse: Performance harus >90 (karena virtual scroll + lazy charts)
- Network: Supabase API tidak di-cache SW (network-only), CDN di-cache

## AWA (Aplikasi Web App) Fitur HP
- ✅ Install ke home screen (standalone, tanpa address bar)
- ✅ Splash screen teal #0F766E
- ✅ Offline: bisa buka app tanpa internet (data dari Dexie IndexedDB)
- ✅ Auto-sync: setiap perubahan di HP → debounce 850ms → delta push ke Supabase
- ✅ Conflict detection: kalau 2 HP edit barengan, tidak saling timpa, muncul warning
- ✅ Background sync: saat online lagi, auto push
- ✅ Badge sync: di kanan atas HP, status sync realtime

## Security
- Jangan commit service_role key ke repo
- Hanya anon/publishable key yang boleh di-embed
- Org UUID tidak sensitif, tapi jangan share publik
- RLS di Supabase sudah enforce role viewer/operator/admin

## Ukuran
- Original: ~470KB
- Final bundle index.html: ~490KB (tambah PWA ~20KB)
- Setelah gzip Cloudflare: ~85KB transfer (sangat ringan untuk HP)

## Support
Jika ada issue di HP:
- Hapus `satria-supabase-bridge-config-v1` di localStorage untuk reset config
- Clear cache SW: DevTools > Application > Clear storage
