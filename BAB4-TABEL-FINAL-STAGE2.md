# Bab 4 - Hasil Eksperimen Final (Stage-2)

Dokumen ini disiapkan untuk naskah skripsi (siap tempel) berdasarkan evaluasi final pada 24 Februari 2026.

## 4.1 Setup Eksperimen
1. Dataset utama: CASIA v2.0 (Au vs Tp).
2. Split data reproducible: train 70%, val 10%, test 20% (seed tetap).
3. Baseline: `ELA-only`, `DWT-SVD-only`, `ELA+DWT`.
4. Metode utama: `ELA+DWT-SVD` stage-2 (fusion model non-linear + threshold calibration).
5. Skenario robustness: JPEG recompression, resize, blur, noise, dan chained perturbation.

## 4.2 Hasil Utama (Image-Level, Test Split)
| method             |   accuracy |   precision |   recall |       f1 |   roc_auc |   threshold |
|:-------------------|-----------:|------------:|---------:|---------:|----------:|------------:|
| ela_dwt_svd_stage2 |   0.732333 |    0.621754 | 0.86439  | 0.723265 |  0.785173 |       0.375 |
| ela_dwt            |   0.687327 |    0.588728 | 0.754146 | 0.661249 |  0.748724 |       0.44  |
| dwt_svd_only       |   0.572839 |    0.483724 | 0.826341 | 0.610231 |  0.664009 |       0.42  |
| ela_only           |   0.501777 |    0.442167 | 0.883902 | 0.58946  |  0.673118 |       0.36  |

Ringkasan: metode utama `ela_dwt_svd_stage2` mencapai F1 = 0.7233, lebih tinggi dari baseline `ela_dwt` (F1 = 0.6612) dengan delta +0.0620.

## 4.3 Uji Statistik (Interpretasi Aman untuk Sidang)
| primary_method     | baseline_method   | test_name            |     p_value | effect_size_name   |   effect_size |   mean_primary_acc |   mean_baseline_acc |
|:-------------------|:------------------|:---------------------|------------:|:-------------------|--------------:|-------------------:|--------------------:|
| ela_dwt_svd_stage2 | ela_only          | wilcoxon_signed_rank | 1.47604e-80 | rank_biserial      |      0.618644 |           0.732333 |            0.501777 |
| ela_dwt_svd_stage2 | dwt_svd_only      | wilcoxon_signed_rank | 1.25858e-48 | rank_biserial      |      0.531579 |           0.732333 |            0.572839 |
| ela_dwt_svd_stage2 | ela_dwt           | wilcoxon_signed_rank | 2.75446e-07 | rank_biserial      |      0.231707 |           0.732333 |            0.687327 |

Interpretasi akademik yang aman:
1. Perbandingan metode utama vs `ela_dwt` menghasilkan p-value < 0.05, sehingga perbedaan performa dianggap signifikan pada setting uji ini.
2. Effect size berada pada level kecil-menengah, sehingga peningkatan bersifat nyata namun tidak ekstrem.
3. Klaim dibatasi pada konfigurasi dataset, split, dan protokol eksperimen ini; tidak digeneralisasi sebagai superiority universal.

## 4.4 Robustness
### 4.4.1 Ringkasan Robustness Antar-Metode
| method             |   clean_f1 |   avg_robust_f1 |   avg_relative_drop_f1_pct | worst_scenario        |   worst_f1 |
|:-------------------|-----------:|----------------:|---------------------------:|:----------------------|-----------:|
| ela_dwt_svd_stage2 |   0.723265 |        0.382417 |                   47.1264  | jpeg_q75              | 0.0359508  |
| ela_dwt            |   0.661249 |        0.385314 |                   41.7294  | chain_j75_r075_b1_j85 | 0.0359848  |
| dwt_svd_only       |   0.610231 |        0.591825 |                    3.01615 | resize_05             | 0.571344   |
| ela_only           |   0.58946  |        0.368728 |                   37.4464  | chain_j75_r075_b1_j85 | 0.00389484 |

### 4.4.2 Detail Robustness Metode Utama (`ela_dwt_svd_stage2`)
| scenario              |        f1 |   relative_drop_f1_pct |
|:----------------------|----------:|-----------------------:|
| jpeg_q95              | 0.624157  |               13.703   |
| jpeg_q85              | 0.0503262 |               93.0418  |
| jpeg_q75              | 0.0359508 |               95.0294  |
| jpeg_q65              | 0.0395108 |               94.5372  |
| resize_05             | 0.43      |               40.5474  |
| resize_075            | 0.606322  |               16.1688  |
| resize_125            | 0.640975  |               11.3776  |
| blur_s1               | 0.424588  |               41.2957  |
| blur_s2               | 0.156895  |               78.3074  |
| noise_g3              | 0.658389  |                8.96985 |
| noise_g7              | 0.57609   |               20.3487  |
| noise_sp01            | 0.613926  |               15.1174  |
| chain_j75_r075_b1_j85 | 0.114286  |               84.1986  |

Interpretasi robustnes yang aman:
1. Metode utama unggul pada evaluasi clean split, namun belum paling stabil di semua gangguan ekstrem.
2. Penurunan terbesar muncul pada JPEG agresif (q85 ke bawah) dan chained perturbation.
3. Ini menunjukkan ruang perbaikan pada domain shift akibat kompresi berat/post-processing berlapis.

## 4.5 Error Analysis
Distribusi error (top confident errors): false_positive = 54, false_negative = 26.

Observasi ringkas:
1. False positive dominan pada subset citra authentic tertentu (khususnya tekstur/scene yang menghasilkan residual tinggi).
2. False negative dominan pada subset tampered dengan jejak manipulasi yang halus atau terdegradasi kompresi.
3. Hasil ini konsisten dengan pola robustness yang menurun pada kompresi agresif.

## 4.6 Kesimpulan Bab 4
1. Pada setting eksperimen ini, `ELA+DWT-SVD` stage-2 menjadi kandidat metode utama karena mengungguli baseline `ELA+DWT` pada metrik utama (F1) dan didukung uji statistik.
2. Meskipun demikian, ketahanan terhadap perturbasi ekstrem masih menjadi keterbatasan penting dan harus dinyatakan eksplisit.
3. Kontribusi penelitian diposisikan pada desain fusion, protokol evaluasi robustness, dan integrasi sistem, bukan klaim novelty absolut komponen metode.