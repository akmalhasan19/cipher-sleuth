# Cipher Sleuth Testing Guide

Panduan ini dibuat untuk kamu yang mau **langsung test fitur** tanpa nebak-nebak.
Semua langkah di bawah diasumsikan dijalankan dari root project:

- `c:\Users\user\cipher-sleuth`

---

## 1) Prasyarat

Pastikan sudah ada:

1. Node.js terpasang (disarankan v20+).
2. Dependencies sudah terinstall.
3. Project Supabase aktif (untuk test DB logging + duplicate cache).
4. (Opsional tapi direkomendasikan) Cloudflare Turnstile site key + secret key jika mau aktifkan guest captcha.

Install dependencies:

```bash
npm install
```

---

## 2) Setup Environment

Copy template env:

```bash
copy .env.example .env
```

Lalu isi minimal ini di `.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `evidence-assets`)
- `ENABLE_DUPLICATE_DETECTION=true`
- `ENABLE_LLM_ORCHESTRATOR=false` (boleh tetap false saat testing dasar)
- `MAX_UPLOAD_MB=5`
- `ANALYZE_TIMEOUT_MS=45000`
- `ENABLE_GUEST_IP_RATE_LIMIT=true`
- `GUEST_IP_DAILY_LIMIT=15`
- `GUEST_IP_HASH_SALT=<secret-random-string>`

Jika mau aktifkan captcha guest:

- `ENABLE_GUEST_CAPTCHA=true`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<your-site-key>`
- `TURNSTILE_SECRET_KEY=<your-secret-key>`

Catatan:
- Kalau mau test mode LLM, isi juga `OPENAI_API_KEY`.
- Kalau tidak isi `OPENAI_API_KEY`, sistem akan fallback otomatis (itu normal).

---

## 3) Setup Supabase (Database + RLS)

Jalankan SQL migration ini di Supabase SQL Editor:

- `supabase/migrations/202602230001_create_investigations.sql`
- `supabase/migrations/202602230002_guest_ip_daily_usage.sql`

Migration ini:
- buat tabel `public.investigations`
- unique hash untuk duplicate detection
- enable RLS
- policy service role
- buat tabel `public.guest_ip_daily_usage` untuk limiter guest per-IP per-hari
- buat function `increment_guest_ip_daily_usage(...)` untuk increment counter atomik

Kalau tabel sudah pernah dibuat sebelum patch RLS, jalankan ulang blok RLS/policy (sudah ada di migration file tersebut).

---

## 4) Jalankan Aplikasi

```bash
npm run dev
```

Buka:

- `http://localhost:3000`

---

## 5) Cara Test Manual (UI)

### A. Test upload normal

1. Drag/drop 1 file gambar (`.png/.jpg/.jpeg/.webp`, max 5MB).
2. Tunggu hasil.
3. Pastikan tampil:
   - Trust Score
   - Verdict
   - SHA-256
   - Generated time
   - tombol `Download Report`

Expected:
- Request berhasil
- `source` dari API = `"computed"` untuk upload pertama

---

### B. Test duplicate detection (cache)

1. Upload file gambar A (pertama kali).
2. Upload file gambar A yang **sama persis** lagi.

Expected:
- Upload kedua tidak re-compute penuh
- response `source` jadi `"cache"`

Cara cek cepat di browser:
1. Tekan `F12` -> tab Network.
2. Klik request `POST /api/analyze`.
3. Lihat JSON response, pastikan:
   - request pertama: `"source": "computed"`
   - request kedua: `"source": "cache"`

---

### C. Test guest protections (captcha + rate limit + LLM block)

1. Aktifkan guest protections di `.env`:
   - `ENABLE_GUEST_CAPTCHA=true`
   - `ENABLE_GUEST_IP_RATE_LIMIT=true`
   - `GUEST_IP_DAILY_LIMIT=2` (untuk test cepat)
2. Restart `npm run dev`.
3. Coba analyze tanpa solve captcha (atau tanpa token).

Expected:
- API reject request (`403` captcha missing/invalid).

4. Solve captcha, lalu kirim 3 request guest dari browser/network yang sama.

Expected:
- request 1-2 lolos
- request 3 kena `429` quota exceeded

5. Jika `ENABLE_LLM_ORCHESTRATOR=true`, lakukan request sebagai guest.

Expected:
- mode tetap deterministic fallback (LLM diblok untuk guest)
- pada payload ada indikasi `guestProtection.llm.effectiveEnabled = false`

---

### D. Test export PDF

1. Setelah analisis selesai, klik `Download Report`.

Expected:
- file terdownload
- endpoint `GET /api/report/[analysisId]/pdf`
- header content type `application/pdf`

---

### E. Test refresh behavior: scroll reset ke atas

1. Scroll halaman sampai tengah/bawah.
2. Refresh browser (`Ctrl+R`).

Expected:
- halaman kembali ke posisi paling atas (scroll top = 0)

---

### F. Test glitch text "Pixel" saat first load/refresh

1. Buka halaman pertama kali atau refresh.
2. Perhatikan teks **Pixel** di hero headline.

Expected:
- muncul glitch sebentar
- lalu langsung balik normal jadi `"Pixel"`
- hover masih bisa memicu glitch lagi

---

## 6) Cara Test Otomatis

### A. Jalankan semua test

```bash
npm test
```

Mencakup:
- unit test validasi upload
- unit test banding trust score
- integration test analyze route
- integration test duplicate cache
- integration test report PDF
- integration test payload contract endpoint
- acceptance scenarios (asli tinggi, manipulasi rendah)
- integration test guest protections

### B. Lint

```bash
npm run lint
```

### C. Build produksi

```bash
npm run build
```

---

## 7) Generate Dokumen 2 Sampel Uji (Asli vs Manipulasi)

Script ini akan:
- generate 2 payload sampel
- hit API analyze
- tulis hasil ke markdown

Jalankan:

```bash
npx tsx scripts/generate-acceptance-samples.ts
```

Output file:

- `acceptance-sample-results.md`

Expected hasil:
- Scenario A (asli): score `>= 90`, verdict `verified`
- Scenario B (manipulasi): score `< 50`, verdict `manipulated`

---

## 8) Checklist Cepat Sebelum Demo

Jalankan urutan ini:

1. `npm install`
2. isi `.env`
3. apply migration Supabase
4. `npm run dev`
5. test upload pertama + kedua (cache)
6. test guest protections (captcha + rate limit)
7. test download PDF
8. test refresh scroll reset + glitch Pixel
9. `npm test`
10. `npm run lint`
11. `npm run build`

Kalau semua lolos, project siap untuk demo/submit.

---

## 9) Troubleshooting Singkat

### Upload gagal karena file type
- Pastikan file extension: `.jpg/.jpeg/.png/.webp`
- MIME harus image/jpeg, image/png, atau image/webp

### Duplicate cache tidak jalan
- Pastikan `ENABLE_DUPLICATE_DETECTION=true`
- Pastikan `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` valid
- Pastikan migration tabel `investigations` sudah apply

### Report PDF 403/404
- Pastikan request masih di sesi user/guest yang sama
- report disimpan per session owner untuk proteksi akses

### Captcha selalu gagal
- pastikan `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` pasangan yang benar
- cek response `security.captcha.status` di payload API

### Guest rate limit tidak jalan
- pastikan `ENABLE_GUEST_IP_RATE_LIMIT=true`
- apply migration `202602230002_guest_ip_daily_usage.sql`
- cek nilai `security.guestIpRateLimit` di response

### Scroll tidak reset saat refresh
- Pastikan kamu tes dengan hard refresh normal browser
- cek tidak ada extension browser yang override scroll restoration
