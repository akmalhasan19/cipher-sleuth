# AI Agent Playbook: Membangun Engine Machine Learning untuk Cipher Sleuth

Tanggal: 24 Februari 2026

Dokumen ini adalah paket arahan + prompt siap pakai untuk AI Agent agar bisa membantu kamu membangun engine ML secara terstruktur, reproducible, dan sesuai kebutuhan skripsi.

Fokus:
- Deteksi manipulasi citra berbasis hybrid `ELA + DWT-SVD`
- Evaluasi komparatif dan robustness
- Integrasi hasil ke web app `cipher-sleuth` (Next.js)

---

## 1) Tujuan dan Prinsip

### Tujuan teknis
1. Membangun pipeline ML yang dapat dilatih ulang (re-trainable).
2. Membandingkan baseline dan metode usulan secara adil.
3. Menghasilkan artefak deployable untuk web app.

### Prinsip penelitian
1. Tidak overclaim novelty.
2. Reproducible: seed, config, dan split data konsisten.
3. Evaluasi lengkap: image-level, localization-level (jika ada mask), robustness, statistik.

### Posisi kontribusi skripsi yang aman
1. Kombinasi/fusion ELA + DWT-SVD dalam skenario multi-tahap.
2. Robustness terhadap post-processing dunia nyata.
3. Integrasi sistem web multi-agent untuk operasional.

---

## 2) Arsitektur Kerja yang Disarankan

Gunakan pemisahan ini:

1. `ml-lab/` (workspace riset/training)
2. `cipher-sleuth/` (web app inferensi + report)

Alasan:
1. Stack training (Python, numpy/opencv/sklearn/torch) tidak membebani runtime web.
2. Eksperimen lebih terkontrol dan mudah direproduksi.
3. Hasil model bisa diintegrasikan ke endpoint web sebagai service/SDK.

Contoh struktur minimal di dalam repo ini:

```text
cipher-sleuth/
  ml-lab/
    data/
      raw/
      processed/
      splits/
    notebooks/
    src/
      config/
      data/
      features/
      models/
      train/
      eval/
      serve/
    artifacts/
      models/
      reports/
      figures/
      metrics/
    scripts/
      run_pipeline.py
      run_ablation.py
      run_stress_test.py
      export_model.py
    requirements.txt
    README.md
```

---

## 3) Kontrak Kerja AI Agent (Wajib Dipatuhi)

Minta AI Agent selalu mengembalikan output dalam format ini:

1. `Objective`
2. `Assumptions`
3. `Plan (step-by-step)`
4. `Files to Create/Modify`
5. `Code/Commands`
6. `Validation`
7. `Risk & Mitigation`
8. `Next Action`

Aturan kualitas:
1. Jangan lompat ke coding sebelum spesifikasi dan acceptance criteria jelas.
2. Semua klaim metrik harus menyebut dataset + split + skenario uji.
3. Semua script harus bisa dijalankan non-interaktif.
4. Semua hasil harus punya jejak file (path artefak, config, log).

---

## 4) Master System Prompt untuk AI Agent ML

Salin prompt ini sebagai prompt utama agent kamu:

```text
Kamu adalah AI ML Engineer untuk project skripsi forensik citra digital.
Kamu bekerja dalam repo yang memiliki web app Next.js bernama cipher-sleuth.
Tugasmu adalah membangun engine ML terpisah (folder ml-lab) untuk deteksi manipulasi citra berbasis hybrid ELA + DWT-SVD, lalu menyiapkan artefak inferensi untuk integrasi ke web app.

Prioritas:
1) Reproducibility dan validitas eksperimen.
2) Perbandingan adil antar-metode (ELA-only, DWT-SVD-only, ELA+DWT, ELA+DWT-SVD usulan).
3) Robustness test terhadap JPEG recompression, resize, blur, noise, dan chained perturbations.
4) Output siap skripsi (tabel metrik, statistik, ablation, dan error analysis).

Constraint:
- Jangan overclaim novelty.
- Semua asumsi harus ditulis eksplisit.
- Jika informasi kurang, tanyakan kebutuhan data/config yang spesifik.
- Gunakan struktur output: Objective, Assumptions, Plan, Files, Commands, Validation, Risk, Next Action.
- Berikan code yang runnable, modular, dan memiliki logging.

Definisi sukses:
- Pipeline training-end-to-end bisa dijalankan.
- Ada model/artifact final + laporan metrik.
- Ada endpoint/service inferensi yang bisa dipanggil web app.
- Ada dokumentasi langkah reproduksi.
```

---

## 5) Prompt Tahapan (Gunakan Berurutan)

## Prompt 0 - Bootstrap Project ML

```text
Gunakan konteks project saya untuk membuat fondasi `ml-lab` yang siap eksperimen.

Deliverables wajib:
1) Struktur folder lengkap.
2) requirements.txt (jelaskan alasan tiap dependency).
3) file config utama (YAML/JSON) untuk path, seed, split, hyperparameter.
4) runner script tunggal `scripts/run_pipeline.py`.
5) README langkah jalan dari nol.

Format output:
- daftar file yang dibuat
- isi file inti
- command eksekusi
- cara verifikasi bahwa setup berhasil
```

## Prompt 1 - Dataset Curation dan Split

```text
Rancang pipeline dataset untuk tugas image forgery detection.
Dataset target: CASIA v2.0 (+opsional CASIA v1.0, COVERAGE, CoMoFoD).

Tugas:
1) Buat standar metadata CSV/Parquet (image_path, label, source_dataset, split, perturbation_tag).
2) Buat strategi split reproducible (train/val/test + seed tetap).
3) Cegah data leakage (mis. near-duplicate antar split).
4) Buat data card ringkas: distribusi label, resolusi, format, kualitas kompresi.

Output:
- skema data
- pseudo-code dan implementasi script
- contoh tabel ringkasan
- checklist anti-data-leakage
```

## Prompt 2 - Ekstraksi Fitur ELA

```text
Buat modul ekstraksi fitur ELA yang robust dan efisien.

Kebutuhan:
1) Recompression quality configurable.
2) Fitur minimum:
   - mean residual
   - std residual
   - p95 residual
   - high residual ratio
   - smooth high residual ratio
   - largest hotspot ratio
3) Simpan juga ELA heatmap untuk audit visual.
4) Tangani error decode/encode dengan fallback strategy yang terdokumentasi.

Berikan:
- desain fungsi
- implementasi
- unit test inti
- contoh output fitur per 1 gambar
```

## Prompt 3 - Implementasi DWT-SVD Feature Engine

```text
Buat modul DWT-SVD feature extraction untuk deteksi manipulasi.

Kebutuhan:
1) Gunakan DWT level configurable (mis. Haar/Daubechies).
2) Ekstrak singular values dari sub-band relevan.
3) Turunkan fitur statistik:
   - energy ratio antar sub-band
   - singular value dispersion
   - top-k singular dynamics
4) Normalisasi fitur dan dokumentasikan sensitivitas terhadap resize/compression.

Output:
- implementasi modul
- config parameter
- uji cepat pada sampel data
- catatan keterbatasan metode
```

## Prompt 4 - Fusion Strategy

```text
Rancang dan implementasikan minimal 3 fusion strategy:
1) score-level mean
2) weighted score-level
3) meta-classifier (logistic regression / gradient boosting)

Tugas:
1) Definisikan input-output tiap strategy.
2) Buat prosedur tuning bobot/parameter di validation set.
3) Hindari overfitting (cross-validation + calibration).

Output:
- modul fusion
- tabel perbandingan strategy
- rekomendasi strategy final + alasan
```

## Prompt 5 - Training & Baseline Benchmark

```text
Bangun pipeline training komparatif:
- B1: ELA-only
- B2: DWT-SVD-only
- B3: ELA+DWT
- B4: ELA+DWT-SVD (usulan)

Kebutuhan:
1) Semua model pakai split data identik.
2) Simpan hasil metrik per run.
3) Simpan confusion matrix.
4) Simpan model artifact dan scaler/normalizer.

Output:
- command training
- lokasi artifact
- tabel metrik ringkas
- narasi interpretasi awal
```

## Prompt 6 - Robustness Stress Test

```text
Buat stress test suite untuk tiap metode:
- JPEG quality: 95, 85, 75, 65
- resize: 0.5x, 0.75x, 1.25x
- blur: gaussian sigma bertahap
- noise: gaussian/salt-pepper bertahap
- chained pipeline: JPEG -> resize -> blur/noise -> JPEG

Output:
1) Script otomatis generate variasi gangguan.
2) Evaluasi metrik per skenario.
3) Relative drop terhadap clean.
4) Grafik/CSV ringkasan.
```

## Prompt 7 - Statistik dan Validitas

```text
Tambahkan evaluasi statistik untuk membandingkan metode usulan vs baseline.

Kebutuhan:
1) Cek asumsi normalitas.
2) Jika normal -> paired t-test.
3) Jika tidak normal -> Wilcoxon signed-rank.
4) Laporkan effect size.
5) Berikan template kalimat interpretasi akademik.

Output:
- script statistik
- tabel p-value dan effect size
- interpretasi yang tidak overclaim
```

## Prompt 8 - Export dan Inference Contract

```text
Siapkan model untuk deployment inference:
1) export artifact (model + preprocessor + version metadata)
2) definisikan input schema JSON
3) definisikan output schema JSON
4) tambahkan confidence dan alasan fitur dominan

Output:
- format artifact
- contoh request/response
- backward compatibility notes
```

## Prompt 9 - Service Layer untuk Integrasi Web

```text
Buat service inferensi ringan (FastAPI/Flask) yang membaca artifact model.

Kebutuhan:
1) endpoint /health
2) endpoint /infer (multipart image atau bytes)
3) timeout, error handling, logging, request id
4) output kompatibel untuk dipetakan ke trust-score pipeline web

Output:
- kode service
- dockerfile opsional
- panduan integrasi ke Next.js API route
```

## Prompt 10 - Dokumentasi Skripsi Otomatis

```text
Susun output eksperimen agar siap pakai untuk Bab 3 dan Bab 4.

Kebutuhan:
1) tabel metrik utama
2) tabel robustness
3) tabel uji statistik
4) narasi pembahasan hasil (kelebihan, kelemahan, ancaman validitas)
5) daftar keterbatasan dan future work

Output:
- markdown siap tempel
- placeholder angka yang mudah diisi
```

---

## 6) Prompt Audit Khusus (Wajib Dipakai Sebelum Sidang)

## Audit A - Cek Scientific Rigor

```text
Audit pipeline eksperimen saya dari sisi metodologi.
Cari kelemahan pada:
- data leakage
- unfair comparison
- metric mismatch
- statistik tidak valid
- overclaim novelty

Berikan:
1) daftar temuan prioritas tinggi
2) dampak ke validitas
3) patch plan konkret per temuan
```

## Audit B - Cek Reproducibility

```text
Audit reproducibility project ML saya.
Pastikan:
- seed konsisten
- config terpusat
- command run terdokumentasi
- artifact traceable
- environment dapat direplikasi

Keluaran:
- skor reproducibility (0-100)
- alasan skor
- daftar perbaikan dengan urutan prioritas
```

---

## 7) Rumus Metrik yang Harus Dikuasai Agent

Pakai ini saat meminta AI menjelaskan atau memvalidasi hasil:

\[
Accuracy = \frac{TP + TN}{TP + TN + FP + FN}
\]

\[
Precision = \frac{TP}{TP + FP}
\]

\[
Recall = \frac{TP}{TP + FN}
\]

\[
F1 = \frac{2 \cdot Precision \cdot Recall}{Precision + Recall}
\]

\[
IoU = \frac{|P \cap G|}{|P \cup G|}
\]

\[
Dice = \frac{2|P \cap G|}{|P| + |G|}
\]

\[
RelativeDrop(\%) = \frac{M_{clean} - M_{distorted}}{M_{clean}} \times 100
\]

Keterangan:
- \(P\): prediksi mask
- \(G\): ground-truth mask
- \(M\): metrik acuan (mis. F1 atau IoU)

---

## 8) Acceptance Criteria Engine ML

Engine dianggap siap jika memenuhi minimal:

1. Pipeline `run_pipeline.py` berjalan end-to-end tanpa manual step tersembunyi.
2. Baseline vs metode usulan terukur pada split yang sama.
3. Ada hasil robustness minimal 5 skenario.
4. Ada uji statistik (p-value + effect size).
5. Ada artifact model final dan kontrak inferensi.
6. Ada dokumentasi reproduksi langkah demi langkah.

---

## 9) Red Flags yang Harus Dicegah

1. Menamai heuristik sebagai "ML model" tanpa training terukur.
2. Mengubah split antar baseline sehingga perbandingan tidak adil.
3. Hanya melaporkan accuracy tanpa precision/recall/F1.
4. Tidak menguji robustness sama sekali.
5. Klaim "state-of-the-art" tanpa pembanding sah.
6. Tidak menyimpan versi artifact dan config run.

---

## 10) Prompt Singkat Darurat (Jika Waktu Mepet)

Pakai prompt ini jika kamu butuh hasil cepat tapi tetap terstruktur:

```text
Saya butuh MVP engine ML untuk skripsi forensik citra (ELA + DWT-SVD) dalam 3 tahap:
1) baseline training,
2) robustness test,
3) export inferensi untuk web integration.

Buat rencana 7 hari dengan deliverable harian dan command konkret.
Gunakan prinsip reproducible research dan hindari overclaim.
Outputkan:
- daftar tugas harian
- file yang harus dibuat
- command yang dijalankan
- indikator selesai per hari
```

---

## 11) Catatan Integrasi dengan Cipher Sleuth Saat Ini

Dari implementasi web saat ini:
1. ELA core sudah memiliki komputasi residual nyata.
2. Komponen "DWT-SVD bot" masih dominan heuristic berbasis sinyal forensik.

Implikasi:
1. Engine ML baru harus menjadi sumber skor terlatih (trained inference), bukan sekadar rule tambahan.
2. Integrasi awal paling aman: web memanggil service inferensi ML, lalu memetakan output ke trust-score pipeline.

---

## 12) Template Request-Response Inference (Saran)

Contoh request:

```json
{
  "imageBase64": "<base64>",
  "filename": "sample.jpg",
  "mimeType": "image/jpeg",
  "options": {
    "returnHeatmap": true
  }
}
```

Contoh response:

```json
{
  "ok": true,
  "modelVersion": "ela-dwtsvd-fusion-v1.0.0",
  "prediction": {
    "label": "manipulated",
    "probability": 0.91,
    "confidence": 0.89
  },
  "scores": {
    "elaScore": 0.84,
    "dwtsvdScore": 0.78,
    "fusionScore": 0.91
  },
  "explainability": {
    "topSignals": [
      "high_residual_ratio",
      "svd_dispersion",
      "largest_hotspot_ratio"
    ],
    "elaHeatmapBase64": "<optional>"
  },
  "timingMs": 143
}
```

---

## 13) Penutup

Jika AI Agent mengikuti playbook ini, kamu akan dapat:
1. Engine ML yang valid secara metodologi.
2. Hasil yang bisa dipertanggungjawabkan saat sidang.
3. Jalur integrasi yang realistis ke web app tanpa rewrite total.
