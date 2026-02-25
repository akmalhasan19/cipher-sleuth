# FINAL-SCOPE-IMPLEMENTATION-PLAN

## Ringkasan
Status implementasi plan `Hybrid Forensics: ManTra-Net + CFA (utama) + PRNU (fase 2)` di repo `cipher-sleuth`.

## Scope Final (Locked)
- [x] Fokus deep model utama: `ManTra-Net` (adapter + fallback heuristic + TorchScript hook).
- [x] Fokus forensic klasik tahap awal: `CFA artifacts detection` berbasis estimasi varians error.
- [x] Fokus forensic klasik tahap lanjutan: `PRNU extraction` berbasis wavelet-Wiener residual.
- [x] `RGB-N Two-stream Faster R-CNN` out-of-scope implementasi inti.
- [x] Target kontribusi: peningkatan akurasi + robustness dibanding baseline existing.

## Perubahan API/Interface Publik
- [x] Kontrak respons inferensi `ml-lab` diperluas.
- [x] Tambahan skor: `cfaScore`, `mantraScore`, `prnuScore`.
- [x] Tambahan explainability: `cfaMapBase64`, `mantraMaskBase64`, `prnuResidualBase64`.
- [x] Backward compatibility dipertahankan (`elaScore`, `dwtsvdScore`, `fusionScore` tetap ada).
- [x] Type TS client di-update dengan field baru sebagai optional.
- [x] Tanpa migrasi schema SQL baru; sinyal tersimpan via `agent_results_json` dan `forensic_breakdown_json`.

## Checklist Implementasi (Phase-by-Phase)

### Phase 0 - Baseline Freeze & Reproducibility
- [x] Mekanisme freeze baseline ditambahkan (`baseline.freeze_enabled` + snapshot copier).
- [x] Snapshot config + metrics + artifact baseline otomatis saat freeze aktif.
- [x] Seed tetap (`42`) dan split konsisten dipertahankan.
- [x] Template report tetap mencakup main/robustness/stat/error.

### Phase 1 - Data Pipeline untuk Splicing + Localization
- [x] Generator synthetic splicing bermask ditambahkan.
- [x] Mask ground-truth disimpan di folder `groundtruth`.
- [x] Manifest mendukung `mask_path`.
- [x] Validasi anti-data-leakage antar split ditambahkan.
- [x] Helper packaging cloud ditambahkan (`prepare_cloud_bundle.py`, `sync_cloud_artifacts.py`).

### Phase 2 - CFA Artifacts Module
- [x] Modul `ml_lab.features.cfa` diimplementasikan.
- [x] Konfigurasi CFA ditambahkan di YAML (`window_size`, `variance_threshold`, `smooth_sigma`).
- [x] Integrasi CFA ke feature extraction + robustness + inference service.
- [x] Visualisasi map CFA tersedia (save map + base64 explainability).

### Phase 3 - ManTra-Net Integration
- [x] Adapter ManTra-like diimplementasikan (`ml_lab.features.mantra`) dengan fallback heuristic.
- [x] Hook TorchScript untuk model hasil cloud tersedia (`checkpoint_path`).
- [x] Script spec fine-tuning cloud ditambahkan (`run_mantra_finetune.py`).
- [x] Fallback inference-only ada saat fine-tune/checkpoint tidak tersedia.
- [x] Versi model tetap tercatat lewat artifact `modelVersion`.

### Phase 4 - Fusion v1 (ManTra + CFA)
- [x] Metode fusion baru ditambahkan di trainer methods (`mantra_only`, `mantra_cfa`, `mantra_cfa_prnu`, dll).
- [x] Tuning threshold validation tetap aktif via pipeline existing.
- [x] Threshold final berbasis target metric `F1`.
- [x] Reporting sudah memuat kontribusi metode baru melalui summary/stats table.

### Phase 5 - PRNU Module
- [x] Modul `ml_lab.features.prnu` (wavelet-Wiener residual) diimplementasikan.
- [x] Fungsi referensi/correlation PRNU disediakan (pseudo-reference util).
- [x] `prnuScore` terintegrasi ke inference response.
- [x] PRNU masuk ke jalur fusion method (`prnu_only`, `mantra_cfa_prnu`).

### Phase 6 - Evaluasi, Ablation, Statistik
- [x] Evaluasi image-level tetap berjalan (Acc/Prec/Rec/F1/AUC).
- [x] Evaluasi localization ditambahkan (IoU, Dice, pixel-F1) saat mask tersedia.
- [x] Robustness suite existing kini menghitung fitur CFA/PRNU/ManTra.
- [x] Ablation method list untuk hybrid tersedia lewat config baru.
- [x] Uji statistik paired tetap tersedia di pipeline.

### Phase 7 - Integrasi Aplikasi Web & Reporting
- [x] Client inference membaca field `cfa/mantra/prnu`.
- [x] Forensic breakdown/orchestrator mendukung agent finding baru.
- [x] Sinyal baru dipersist ke `agent_results_json` dan ikut masuk breakdown JSON.
- [x] Guardrail fallback inference tetap aktif (status failed/disabled tetap ditangani).
- [x] Kompatibilitas endpoint report/PDF dipertahankan.

### Phase 8 - Finalisasi Skripsi (Bab Hasil)
- [x] Config hybrid dan pipeline output siap menghasilkan tabel utama/robustness/ablation/statistik.
- [x] Dokumentasi README dan path artifact untuk reproducibility diperbarui.
- [ ] Narasi Bab 4 final (teks akademik) perlu disusun manual dari hasil run terbaru.
- [ ] Benchmark final di dataset target (CASIA/CoMoFoD real) perlu dijalankan di cloud GPU.

## Test Cases & Skenario Wajib
- [x] Unit test existing tetap dipertahankan dan schema agent diperluas.
- [x] Contract test API diperbarui untuk agent baru.
- [x] Integration path analyze/report tetap kompatibel.
- [x] Robustness + localization metric path tersedia di pipeline.
- [ ] Unit test Python khusus CFA/PRNU/fusion belum ditambahkan (masih gap).
- [ ] Performance benchmark final latency belum dijalankan ulang setelah perubahan.

## Asumsi & Default
- [x] Training/fine-tuning deep model diasumsikan di `Colab/Kaggle GPU`.
- [x] Deep model default: ManTra track; RGB-N tidak diimplementasikan.
- [x] Sequencing default: `CFA -> ManTra fusion -> PRNU`.
- [x] Storage default: reuse JSONB existing, tanpa migrasi schema.
- [x] Kriteria sukses teknis: hybrid mengungguli baseline freeze.

## Definition of Done
- [ ] Seluruh phase checklist 100% selesai (masih tersisa run cloud + laporan final).
- [x] Artifact/hook model final siap dipakai endpoint inferensi lokal.
- [x] Jalur laporan metrik + robustness + statistik + localization tersedia.
- [x] Integrasi web end-to-end tetap berjalan pada jalur utama.
- [ ] Dokumen hasil Bab 4 final belum otomatis dibuat karena memerlukan run eksperimen final.
