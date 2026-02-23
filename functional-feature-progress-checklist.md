# Cipher Sleuth - Functional Feature Progress Checklist (MVP Bertahap)

## 0) Baseline & Foundation
- [ ] Lock target branch dan dokumentasikan baseline (`npm run build`, `npm run lint`) sebelum perubahan besar.
- [ ] Rapikan error lint yang menghambat pipeline (mis. unescaped entities di `app/components/reviews-section.tsx`).
- [ ] Buat folder struktur modular:
  - [ ] `app/lib/validation`
  - [ ] `app/lib/agents`
  - [ ] `app/lib/scoring`
  - [ ] `app/lib/report`
  - [ ] `app/lib/db`
- [ ] Tambah `zod` untuk validasi schema API input/output.

## 1) Input & Asset Validation (Feature 1)
- [ ] Validasi tipe file pada backend (`image/jpeg`, `image/png`, `image/webp`), tetap menerima ekstensi `.jpg/.jpeg/.png/.webp`.
- [ ] Validasi batas ukuran file maksimal `5MB` di backend.
- [ ] Hitung hash SHA-256 dari binary file di backend.
- [ ] Standarisasi nama file internal (`filenameNormalized`) ke `.webp` untuk chain konsistensi pemrosesan.
- [ ] Return metadata validasi (`mimeType`, `fileSizeBytes`, `fileHashSha256`) di response API.
- [ ] Tangani error standar:
  - [ ] `400` file tidak ada/tidak valid.
  - [ ] `413` file melebihi ukuran.
  - [ ] `415` MIME tidak didukung.

## 2) Multi-Agent Engine Deterministic (Feature 2 A/B/C)
- [ ] Implement `Exif Agent` (extract metadata + software signature) di `app/lib/agents/exif-agent.ts`.
- [ ] Implement `ELA Agent` (recompress + pixel difference + anomaly summary) di `app/lib/agents/ela-agent.ts`.
- [ ] Implement `DWT-SVD Agent` (watermark integrity estimator) di `app/lib/agents/dwt-svd-agent.ts`.
- [ ] Semua agent dijalankan paralel via `Promise.all` dari orchestrator route.
- [ ] Setiap agent wajib return:
  - [ ] `status`
  - [ ] `elapsedMs`
  - [ ] `confidence`
  - [ ] `logs[]`
  - [ ] `rawResult` terstruktur

## 3) LLM Orchestrator (Feature 2D)
- [ ] Implement prompt builder yang menggabungkan output 3 agent deterministic.
- [ ] Integrasi provider LLM via env var (`OPENAI_API_KEY` + model config).
- [ ] Tambah fallback heuristic jika API key tidak tersedia atau request LLM gagal.
- [ ] Orchestrator output wajib berisi:
  - [ ] `reportText` (narasi manusia)
  - [ ] `riskSignals[]`
  - [ ] `recommendedVerdict`

## 4) Consensus & Auto Scoring (Feature 3)
- [ ] Implement algoritma skor 0-100 dengan bobot eksplisit per agent.
- [ ] Implement klasifikasi final:
  - [ ] `verified` untuk 90-100
  - [ ] `suspicious` untuk 50-89
  - [ ] `manipulated` untuk <50
- [ ] Simpan breakdown scoring (`TrustScoreBreakdown`) untuk auditability.
- [ ] Samakan threshold scoring dengan PRD dan expose di config internal.

## 5) Forensic Report Generation (Feature 4)
- [ ] Bentuk `forensic breakdown` terstruktur dari hasil agent + orchestrator.
- [ ] Implement endpoint `GET /api/report/[analysisId]/pdf`.
- [ ] PDF memuat minimal:
  - [ ] hash file
  - [ ] final trust score
  - [ ] verdict
  - [ ] ringkasan agent
  - [ ] timestamp analisis
- [ ] Pastikan PDF read-only dan konsisten dengan record database.

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
- [ ] Hubungkan upload di `HeroSection` ke API real (`/api/analyze`) bukan hanya local conversion.
- [ ] Tampilkan status per-agent real dari response API.
- [ ] Tampilkan final trust score + verdict di UI utama.
- [ ] Tampilkan hash file dan waktu analisis pada hasil.
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
