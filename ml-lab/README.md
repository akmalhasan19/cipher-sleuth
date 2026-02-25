# ML Lab - Cipher Sleuth

Engine eksperimen terpisah untuk deteksi manipulasi citra berbasis:
- `ELA-only`
- `DWT-SVD-only`
- `ELA+DWT`
- `ELA+DWT-SVD` (metode utama usulan)
- `CFA-only`
- `PRNU-only`
- `ManTra-like + CFA (+ PRNU)` hybrid track

Fokus implementasi:
- Reproducibility (`seed`, config terpusat, split konsisten)
- Perbandingan adil antar-metode pada split identik
- Robustness stress test (JPEG, resize, blur, noise, chained)
- Localization metrics (IoU/Dice/pixel-F1) saat `mask_path` tersedia
- Output artefak inferensi untuk dipanggil dari web app Next.js

## Struktur

```text
ml-lab/
  configs/
  scripts/
  src/ml_lab/
    config/
    data/
    features/
    models/
    eval/
    train/
    serve/
  artifacts/               # generated
  data/                    # generated / user-provided
```

## Dataset Layout

Minimal struktur dataset:

```text
data/raw/<nama_dataset>/
  authentic/
    *.jpg|*.png|...
  tampered/
    *.jpg|*.png|...
```

Alias folder class yang didukung:
- label 0: `authentic`, `clean`, `pristine`, `real`, `untampered`
- label 1: `tampered`, `fake`, `forged`, `manipulated`

## Setup

```bash
cd ml-lab
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.train.txt
```

Catatan deployment:
- `requirements.txt` dipakai untuk runtime inferensi (lean, cocok untuk Vercel limit).
- `requirements.train.txt` dipakai untuk eksperimen/training/evaluasi lengkap.

## Menjalankan Pipeline End-to-End

### 1) Smoke test cepat (synthetic demo)

```bash
python scripts/run_pipeline.py --config configs/demo.yaml --force-rebuild-manifest
```

Hybrid splicing scope (CFA + PRNU + ManTra-like):

```bash
python scripts/run_pipeline.py --config configs/hybrid_mantra_cfa_prnu.yaml --force-rebuild-manifest
```

Output utama:
- `artifacts/models/final_primary_artifact.joblib`
- `artifacts/metrics/main_metrics.csv`
- `artifacts/metrics/robustness_metrics.csv`
- `artifacts/metrics/localization_metrics.csv`
- `artifacts/metrics/method_stats.csv`
- `artifacts/reports/experiment_report.md`

### 2) Run pada dataset aktual

1. Ubah `configs/default.yaml`:
- `paths.dataset_root`
- `experiment.source_dataset`
- parameter fitur/model sesuai kebutuhan.
2. Jalankan:

```bash
python scripts/run_pipeline.py --config configs/default.yaml --force-rebuild-manifest
```

Untuk CASIA v2.0 yang sudah ada di `C:\Users\user\datasets\CASIA2`, gunakan config siap pakai:

```bash
python scripts/run_pipeline.py --config configs/casia2.yaml --force-rebuild-manifest
```

## Ablation & Stress Test

```bash
python scripts/run_ablation.py --config configs/default.yaml
python scripts/run_stress_test.py --config configs/default.yaml --bundle artifacts/models/model_bundle.joblib
```

## Cloud GPU Helpers (ManTra Track)

```bash
python scripts/prepare_cloud_bundle.py --dataset-root data/raw/synthetic_splicing_demo
python scripts/run_mantra_finetune.py --config configs/hybrid_mantra_cfa_prnu.yaml
python scripts/sync_cloud_artifacts.py --cloud-dir C:\path\to\downloaded\artifacts
```

## Primary Tuning (ELA+DWT-SVD vs baseline ELA+DWT)

Gunakan saat ingin menjaga `ela_dwt` sebagai baseline dan tetap menargetkan `ela_dwt_svd` sebagai metode utama:

```bash
python scripts/tune_primary.py --config configs/casia2_primary.yaml --feature-table artifacts/metrics/feature_table.csv
```

Output:
- `artifacts/metrics/primary_tuning_sweep.csv`
- `artifacts/metrics/primary_vs_baseline_stats.csv`
- `artifacts/models/final_primary_artifact_tuned.joblib`
- `artifacts/reports/primary_tuning_summary.json`

Stage-2 tuning yang lebih kuat (termasuk model fusion non-linear):

```bash
python scripts/tune_primary_stage2.py --config configs/casia2_primary.yaml --feature-table artifacts/metrics/feature_table.csv
```

Output stage-2:
- `artifacts/metrics/primary_tuning_stage2_sweep.csv`
- `artifacts/metrics/primary_stage2_vs_baseline_stats.csv`
- `artifacts/metrics/primary_stage2_besttest_vs_baseline_stats.csv`
- `artifacts/models/final_primary_artifact_stage2.joblib`
- `artifacts/reports/primary_tuning_stage2_summary.json`

## Final Bab 4 Pack (Stage-2)

```bash
python scripts/evaluate_stage2_final.py --config configs/casia2_primary.yaml --feature-table artifacts/metrics/feature_table.csv --split-csv data/splits/casia2_split.csv --stage2-artifact artifacts/models/final_primary_artifact_stage2.joblib
```

Output:
- `artifacts/metrics/final_stage2_main_metrics.csv`
- `artifacts/metrics/final_stage2_stats.csv`
- `artifacts/metrics/final_stage2_robustness_metrics.csv`
- `artifacts/metrics/final_stage2_robustness_summary.csv`
- `artifacts/reports/final_stage2_error_analysis.csv`
- `artifacts/reports/BAB4-TABEL-FINAL-STAGE2.md`

## Export Artifact

```bash
python scripts/export_model.py --source artifacts/models/final_primary_artifact.joblib --target-dir artifacts/export
```

## Inference Service (FastAPI)

Jalankan service:

```bash
python scripts/run_infer_service.py --artifact artifacts/models/final_primary_artifact.joblib --port 8100
```

Endpoint:
- `GET /health`
- `POST /infer` (`multipart/form-data`: `file`, opsional `returnHeatmap`)

Contoh curl:

```bash
curl -X POST "http://127.0.0.1:8100/infer" ^
  -F "file=@sample.jpg" ^
  -F "returnHeatmap=true"
```

## Integrasi ke Next.js (contoh)

Panggilan dari API route/agent:

```ts
const form = new FormData();
form.append("file", new Blob([fileBytes]), filenameOriginal);
form.append("returnHeatmap", "false");

const response = await fetch("http://127.0.0.1:8100/infer", {
  method: "POST",
  body: form,
});
const mlResult = await response.json();
```

Mapping awal yang direkomendasikan:
- `mlResult.prediction.probability` -> skor manipulasi utama
- `mlResult.scores.elaScore` -> sinyal ELA agent
- `mlResult.scores.dwtsvdScore` -> sinyal DWT-SVD agent
- `mlResult.scores.cfaScore` -> sinyal CFA artifact
- `mlResult.scores.mantraScore` -> sinyal ManTra-like detector
- `mlResult.scores.prnuScore` -> sinyal PRNU residual

## Artefak & Reproducibility

Jejak run disimpan di:
- log: `artifacts/logs/*.log`
- config path: tercatat di log + report
- data card: `artifacts/reports/data_card_summary.json`
- ringkasan hasil: `artifacts/reports/pipeline_result.json`

Asumsi eksplisit:
1. Implementasi saat ini fokus ke image-level binary classification.
2. Localization metrics adalah evaluasi proxy berbasis mask tersedia (tidak selalu dari deep model full-resolution).
3. Uji statistik dilakukan terhadap vektor correctness per-image antar-metode pada test split identik.
4. Robustness menggunakan perturbasi sintetis terkontrol (bukan simulasi lengkap semua pipeline platform sosial).
5. Hasil demo synthetic hanya untuk validasi pipeline teknis, bukan klaim performa ilmiah.
