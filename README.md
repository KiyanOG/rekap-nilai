# Rekap Nilai (Vercel + Neon Postgres)

Web rekap nilai: login, matkul, kolom nilai dinamis, impor nama, download Excel.
Data disimpan di database Postgres (Neon), password di-hash dengan scrypt.

## Struktur
- `public/`  : tampilan (index.html, app.js, xlsx.mini.min.js)
- `api/`     : serverless function (auth.js, courses.js)
- `lib/`     : helper database, hash password, sesi
- Tabel dibuat otomatis saat pertama kali dipakai (tidak perlu jalankan SQL manual).

## Deploy ke Vercel
1. Upload folder ini ke GitHub (repo baru).
2. Di vercel.com: Add New > Project > pilih repo tadi.
   Framework Preset: "Other". Jangan ubah setting lain.
3. Sebelum Deploy (atau setelah, lalu Redeploy):
   - Tab Storage (atau Marketplace) > Neon (Postgres) > Create > Connect ke project ini.
     Ini otomatis menambah env var `DATABASE_URL`.
   - Settings > Environment Variables > tambah `SESSION_SECRET`
     isi dengan teks acak panjang. Contoh bikin: `openssl rand -hex 32`
4. Deploy. Buka URL-nya, daftar akun, selesai.

## Jalan di lokal
```
npm i -g vercel
npm i
vercel link
vercel env pull .env.local
vercel dev
```

## Catatan
- Jangan bagikan `SESSION_SECRET` dan `DATABASE_URL`. Jika bocor, ganti.
- Belum ada pembatasan percobaan login (rate limit). Untuk dipakai umum, tambahkan.
