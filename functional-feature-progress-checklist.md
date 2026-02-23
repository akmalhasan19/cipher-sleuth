# Cipher Sleuth - Functional Feature Progress Checklist (MVP Bertahap)

## 0) Baseline & Foundation
- [x] Lock target branch dan dokumentasikan baseline (`npm run build`, `npm run lint`) sebelum perubahan besar.
- [x] Rapikan error lint yang menghambat pipeline (mis. unescaped entities di `app/components/reviews-section.tsx`).
- [x] Buat folder struktur modular:
  - [x] `app/lib/validation`
  - [x] `app/lib/agents`
  - [x] `app/lib/scoring`
  - [x] `app/lib/report`
  - [x] `app/lib/db`
- [x] Tambah `zod` untuk validasi schema API input/output.

## 1) Input & Asset Validation (Feature 1)
- [x] Validasi tipe file pada backend (`image/jpeg`, `image/png`, `image/webp`), tetap menerima ekstensi `.jpg/.jpeg/.png/.webp`.
- [x] Validasi batas ukuran file maksimal `5MB` di backend.
- [x] Hitung hash SHA-256 dari binary file di backend.
- [x] Standarisasi nama file internal (`filenameNormalized`) ke `.webp` untuk chain konsistensi pemrosesan.
- [x] Return metadata validasi (`mimeType`, `fileSizeBytes`, `fileHashSha256`) di response API.
- [ ] Tangani error standar:
  - [x] `400` file tidak ada/tidak valid.
  - [x] `413` file melebihi ukuran.
  - [x] `415` MIME tidak didukung.

## 2) Multi-Agent Engine Deterministic (Feature 2 A/B/C)
- [x] Implement `Exif Agent` (extract metadata + software signature) di `app/lib/agents/exif-agent.ts`.
- [x] Implement `ELA Agent` (recompress + pixel difference + anomaly summary) di `app/lib/agents/ela-agent.ts`.
- [x] Implement `DWT-SVD Agent` (watermark integrity estimator) di `app/lib/agents/dwt-svd-agent.ts`.
- [x] Semua agent dijalankan paralel via `Promise.all` dari orchestrator route.
- [x] Setiap agent wajib return:
  - [x] `status`
  - [x] `elapsedMs`
  - [x] `confidence`
  - [x] `logs[]`
  - [x] `rawResult` terstruktur

## 3) LLM Orchestrator (Feature 2D)
- [x] Implement prompt builder yang menggabungkan output 3 agent deterministic.
- [x] Integrasi provider LLM via env var (`OPENAI_API_KEY` + model config).
- [x] Tambah fallback heuristic jika API key tidak tersedia atau request LLM gagal.
- [x] Orchestrator output wajib berisi:
  - [x] `reportText` (narasi manusia)
  - [x] `riskSignals[]`
  - [x] `recommendedVerdict`

## 4) Consensus & Auto Scoring (Feature 3)
- [x] Implement algoritma skor 0-100 dengan bobot eksplisit per agent.
- [x] Implement klasifikasi final:
  - [x] `verified` untuk 90-100
  - [x] `suspicious` untuk 50-89
  - [x] `manipulated` untuk <50
- [x] Simpan breakdown scoring (`TrustScoreBreakdown`) untuk auditability.
- [x] Samakan threshold scoring dengan PRD dan expose di config internal.

## 5) Forensic Report Generation (Feature 4)
- [x] Bentuk `forensic breakdown` terstruktur dari hasil agent + orchestrator.
- [x] Implement endpoint `GET /api/report/[analysisId]/pdf`.
- [x] PDF memuat minimal:
  - [x] hash file
  - [x] final trust score
  - [x] verdict
  - [x] ringkasan agent
  - [x] timestamp analisis
- [x] Pastikan PDF read-only dan konsisten dengan record database.

## 6) Database Logging & Duplicate Detection (Feature 5)
- [ ] Integrasi Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Buat tabel `investigations` dengan kolom:
  - [ ] `id`
  - [ ] `file_hash_sha256` (unique)
  - [ ] `filename_original`
  - [ ] `filename_normalized`
  - [ ] `mime_type`
  - [ ] `file_size_bytes`
  - [ ] `final_trust_score`
  - [ ] `verdict`
  - [ ] `report_text`
  - [ ] `agent_results_json`
  - [ ] `created_at`
- [ ] Sebelum analisis, cek duplikasi berdasarkan hash:
  - [ ] jika ada, return `source: "cache"`
  - [ ] jika tidak ada, jalankan komputasi lalu simpan dan return `source: "computed"`
- [ ] Logging error DB tidak boleh membuat API crash tanpa response terstruktur.

## 7) Frontend Integration (Workspace + Report UX)
- [x] Hubungkan upload di `HeroSection` ke API real (`/api/analyze`) bukan hanya local conversion.
- [ ] Tampilkan status per-agent real dari response API.
- [x] Tampilkan final trust score + verdict di UI utama.
- [x] Tampilkan hash file dan waktu analisis pada hasil.
- [ ] Tambah tombol export PDF yang mengarah ke endpoint report.
- [ ] Jaga kompatibilitas mobile layout (tidak tabrakan antar elemen).

## 8) Test Cases & Acceptance Scenarios
- [ ] Unit test validasi file (MIME, size, missing file).
- [ ] Unit test trust score banding (`verified/suspicious/manipulated`).
- [ ] Integration test `POST /api/analyze` untuk file valid PNG/JPG.
- [ ] Integration test duplicate upload: request kedua harus `source: "cache"`.
- [ ] Integration test `GET /api/report/[analysisId]/pdf` return `application/pdf`.
- [ ] Manual scenario:
  - [ ] 1 gambar asli -> skor tinggi (`>=90`)
  - [ ] 1 gambar manipulasi -> skor rendah (`<50`)
- [ ] Performance sanity:
  - [ ] payload `<=5MB` diproses tanpa timeout
  - [ ] UI tetap responsif saat animasi berjalan

## 9) Definition of Done
- [ ] Semua endpoint utama return payload sesuai kontrak.
- [ ] Semua checklist test lulus.
- [ ] Minimal 2 sampel uji (asli vs manipulasi) terdokumentasi.
- [ ] Dokumentasi env vars dan setup Supabase selesai.
- [ ] Build produksi berhasil (`npm run build`) tanpa regression UI mayor.

## Asumsi & Default
- [ ] Runtime API analisis: `nodejs` (bukan edge) untuk stabilitas image processing.
- [ ] Konversi internal ke WebP dipertahankan untuk konsistensi pipeline.
- [ ] LLM orchestrator wajib punya fallback heuristic jika API key belum tersedia.
- [ ] Duplicate detection ditentukan oleh hash `SHA-256` binary file.
- [ ] Out-of-scope PRD (deepfake video, face recognition) tidak diimplementasikan.
