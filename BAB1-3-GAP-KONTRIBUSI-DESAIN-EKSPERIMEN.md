# Tabel Gap Penelitian + Kontribusi Skripsi + Desain Eksperimen (Siap Tempel Bab 1-3)

Tanggal penyusunan: **24 Februari 2026**

Dokumen ini disusun untuk menjawab pertanyaan dosen terkait:

- kebaruan (novelty),
- urgensi penelitian,
- metrik keberhasilan,
- metrik perbandingan,
- dan cara pembandingan metode.

---

## A. Tabel Gap Penelitian (untuk Bab 1-2)

### A1) Ringkasan posisi novelty yang aman

Klaim yang aman secara akademik:

- **Belum aman** mengklaim "pertama di dunia" untuk gabungan `ELA + DWT-SVD` tanpa systematic review penuh.
- **Aman** mengklaim kontribusi pada:
  - **skema fusi spesifik** yang diusulkan,
  - **evaluasi robustness multi-tahap** (compression, resize, blur, noise, pipeline media sosial),
  - **implementasi sistem web multi-agent** yang operasional dan terukur.

### A2) Matriks studi terkait dan gap

| ID | Studi | Fokus Metode | Dataset/Setting (yang terlapor) | Metrik/Temuan Utama | Keterbatasan yang Tercatat | Gap yang Bisa Diisi Skripsi |
|---|---|---|---|---|---|---|
| R1 | Li et al., ICME 2007 (rujukan klasik DWT-SVD) | Deteksi region duplication berbasis **DWT + SVD** (copy-move) | Konteks awal CMFD (conference) | Menjadi rujukan awal metode DWT-SVD di CMFD | Fokus copy-move klasik; bukan framework multi-metode | Integrasi DWT-SVD dengan sinyal lain (ELA) + evaluasi modern |
| R2 | Jeronymo, ESWA 2017 | **ELA + wavelet soft-thresholding** untuk denoising peta ELA | Gambar standar yang didokter (uji terkontrol) | Denoising wavelet membantu keterbacaan artefak ELA | Disebut terbatas pada citra lossy-compressed; belum skema fusi dengan DWT-SVD | Tambah tahap DWT-SVD + evaluasi komparatif terukur |
| R3 | Jang & Hou, Sensors 2020 | Deteksi abnormalitas konteks berbasis CL-CNN + object detector | COCO-based context learning | Akurasi keseluruhan klasifikasi dilaporkan 92.8% | Ditunjukkan bahwa ELA bisa gagal pada global post-processing tertentu | Rancang hybrid yang lebih tahan post-processing global |
| R4 | Alawida et al., PeerJ CS 2024 | **ELA + CNN** untuk klasifikasi manipulasi | CASIA 2.0 (JPEG subset) | Testing acc 94.14%, precision 94.1%, recall 94.07% | Fokus image-level; generalisasi lintas-dataset dan robustness gangguan belum jadi fokus utama | Tambah evaluasi cross-dataset + robustness stress-test |
| R5 | Alencar et al., Future Internet 2024 | Multi-stream CNN dengan stream original + **ELA** + **DWT-based** | Dataset gabungan 4 sumber (kurasi penulis) | Model gabungan 89.59% (lebih tinggi dari stream tunggal) | Penulis menyatakan belum memberi lokasi/jenis tampering secara spesifik | Fokuskan skripsi ke localization + robustness + pipeline deployment |
| R6 | Kassem et al., Frontiers 2022 | VFCMFD (copy-move), pembahasan ketahanan pada transformasi | FAU, GRIP, 4K UHD | Pixel F1 dilaporkan tinggi di beberapa benchmark | Spesifik copy-move; bukan detector umum multi-manipulasi | Metode skripsi diarahkan ke multi-jenis manipulasi |
| R7 | Shallal et al., Applied Sciences 2025 (review) | Review CMFD, metrik, dan tantangan dunia nyata | Sintesis lintas dataset | Menegaskan pentingnya image-level + pixel-level metrics (Acc/Prec/Rec/F1, IoU, DSC) | Banyak dataset tidak merepresentasikan campuran artefak real-world | Skripsi mengisi celah lewat skenario gangguan bertahap dan realistis |

Catatan interpretasi:

- Dari rapid scan ini, bukti kuat yang ditemukan adalah **komponen-komponen** sudah pernah dipakai secara terpisah/parsial.
- Celah yang paling kredibel adalah **cara fusi + protokol evaluasi robustness + implementasi sistem**.

---

## B. Tabel Kontribusi Skripsi (untuk Bab 1-2)

| Kode | Kontribusi yang Diusulkan | Gap yang Ditutup | Deliverable Software | Indikator Keberhasilan | Target Awal (bisa disesuaikan) |
|---|---|---|---|---|---|
| K1 | Desain **fusion strategy** ELA + DWT-SVD (score-level atau feature-level) | R2, R4, R5 | Modul `hybrid_detector` | F1/AUC lebih tinggi dari baseline tunggal | +3 sampai +8 poin F1 vs baseline terbaik tunggal |
| K2 | Protokol **robustness multi-tahap** (JPEG, resize, blur, noise, kombinasi) | R3, R7 | Modul `stress_test_runner` | Penurunan performa saat gangguan terkontrol | Relative drop F1 lebih kecil dari baseline |
| K3 | Dukungan **deteksi + lokalisasi** (jika mask tersedia) | R5, R7 | Endpoint heatmap / mask | IoU, Dice, pixel-F1 | IoU >= 0.45 sebagai target awal realistis |
| K4 | Integrasi **multi-agent workflow** di web (ingest, preprocess, detect, report) | R5 | Pipeline layanan terpisah per tugas | Latensi end-to-end dan stabilitas | p95 latency sesuai batas internal sistem |
| K5 | **Explainability report** (artefak ELA, kanal DWT-SVD, skor fusion) | R3, R5 | Laporan analisis per citra | Keterbacaan bukti forensik untuk pengguna | Setiap prediksi menyertakan bukti visual + skor |
| K6 | Reproducible benchmarking | R7 | Skrip evaluasi + seed tetap + config | Hasil dapat diulang konsisten | Deviasi metrik antar-run kecil |

---

## C. Desain Eksperimen (untuk Bab 3)

## C1) Pertanyaan penelitian (RQ) dan hipotesis

| Kode | Research Question | Hipotesis Operasional |
|---|---|---|
| RQ1 | Apakah gabungan ELA + DWT-SVD meningkatkan deteksi dibanding metode tunggal? | H1: Metode hybrid memberi F1/AUC lebih tinggi dari ELA-only dan DWT-SVD-only |
| RQ2 | Apakah metode hybrid lebih robust pada post-processing bertahap? | H2: Penurunan F1 hybrid lebih kecil pada skenario gangguan |
| RQ3 | Apakah metode hybrid tetap berguna lintas dataset? | H3: Gap performa train-test lintas dataset lebih kecil dari baseline tunggal |
| RQ4 | Apakah implementasi web multi-agent layak pakai? | H4: Sistem memenuhi SLA latensi dan menghasilkan laporan forensik yang konsisten |

## C2) Variabel penelitian

| Jenis | Variabel | Definisi Operasional |
|---|---|---|
| Independen | Metode deteksi | ELA-only, DWT-SVD-only, ELA+DWT, ELA+DWT-SVD (usulan), opsional ELA+CNN |
| Independen | Kondisi citra | Clean, JPEG recompress, resize, blur, noise, chained perturbations |
| Dependen | Kinerja image-level | Accuracy, Precision, Recall, F1, ROC-AUC |
| Dependen | Kinerja localization | IoU, Dice/DSC, pixel-F1 (dataset dengan mask) |
| Dependen | Kinerja operasional | Waktu inferensi, throughput, memory, p95 latency |
| Kontrol | Split data & seed | Split identik antar-metode, seed tetap, preprocessing konsisten |

## C3) Dataset dan justifikasi

| Dataset | Penggunaan | Kelebihan | Risiko/Keterbatasan |
|---|---|---|---|
| CASIA V2.0 | Deteksi image-level, baseline utama | Ukuran cukup besar (7491 authentic, 5123 forged; dilaporkan di literatur) | Tidak ideal untuk evaluasi pixel-level jika tanpa mask konsisten |
| CASIA V1.0 | Tambahan validasi | Digunakan luas untuk perbandingan klasik | Skala lebih kecil dari V2.0 |
| COVERAGE | Uji kasus visual similarity tinggi | Menantang karena objek mirip visual | Skala kecil (100 original, 100 forged) |
| CoMoFoD | Localization + robustness transformasi | Menyediakan ground-truth mask dan variasi transformasi | Tantangan komputasi/metodologis pada subset besar |
| Dataset internal "Social-Media Pipeline" | Uji real-world deployment | Mereplikasi recompression/resizing platform | Butuh prosedur kurasi dan dokumentasi ketat |

## C4) Baseline dan ablation

### Baseline utama

1. `B1`: ELA-only  
2. `B2`: DWT-SVD-only  
3. `B3`: ELA + DWT (tanpa SVD)  
4. `B4`: ELA + DWT-SVD (metode usulan)  
5. `B5` (opsional): ELA+CNN ringan sebagai pembanding modern  

### Ablation yang wajib

1. Matikan komponen ELA dari model usulan.  
2. Matikan komponen DWT-SVD dari model usulan.  
3. Ubah strategi fusi (`mean`, `weighted`, `logistic calibrator`).  
4. Uji sensitivitas threshold keputusan.  

## C5) Skenario robustness (stress test)

| Kode | Skenario | Parameter Uji |
|---|---|---|
| S0 | Clean | Tanpa gangguan |
| S1 | JPEG recompression | Q = 95, 85, 75, 65 |
| S2 | Resize | skala 0.5x, 0.75x, 1.25x |
| S3 | Blur | Gaussian blur dengan beberapa sigma |
| S4 | Noise | Gaussian/salt-pepper level bertahap |
| S5 | Chained pipeline | JPEG -> resize -> sharpen/blur -> JPEG |

## C6) Metrik dan rumus (siap tempel)

Untuk klasifikasi image-level:

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

Untuk localization:

\[
IoU = \frac{|P \cap G|}{|P \cup G|}
\]

\[
Dice = \frac{2|P \cap G|}{|P| + |G|}
\]

Metrik robustness:

\[
RelativeDrop(\%) = \frac{M_{clean} - M_{distorted}}{M_{clean}} \times 100
\]

dengan \(M\) bisa F1 atau IoU.

## C7) Prosedur evaluasi statistik

1. Laporkan mean, median, standar deviasi per metrik.  
2. Hitung 95% confidence interval (bootstrap).  
3. Uji signifikansi antar-metode:
   - paired t-test (jika asumsi normal terpenuhi),
   - Wilcoxon signed-rank (jika tidak normal).  
4. Laporkan effect size (mis. Cliff's delta / Cohen's d).  

## C8) Kriteria keberhasilan skripsi (example)

| Kriteria | Nilai Minimum |
|---|---|
| Hybrid mengungguli baseline tunggal di F1 image-level | Ya, signifikan statistik |
| Hybrid lebih tahan gangguan pada minimal 3 skenario robustness | Ya |
| Localization dapat berjalan pada dataset bermask | Ya (IoU dan Dice terlapor) |
| Sistem web menghasilkan laporan forensik otomatis | Ya |

---

## D. Template Tabel Hasil (siap dipakai di Bab 4)

### D1) Tabel perbandingan utama

| Metode | Accuracy | Precision | Recall | F1 | AUC | IoU | Dice | Avg Inference (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ELA-only |  |  |  |  |  |  |  |  |
| DWT-SVD-only |  |  |  |  |  |  |  |  |
| ELA + DWT |  |  |  |  |  |  |  |  |
| ELA + DWT-SVD (Usulan) |  |  |  |  |  |  |  |  |
| ELA + CNN (opsional) |  |  |  |  |  |  |  |  |

### D2) Tabel robustness

| Metode | Clean F1 | S1 F1 | S2 F1 | S3 F1 | S4 F1 | S5 F1 | Avg Relative Drop (%) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ELA-only |  |  |  |  |  |  |  |
| DWT-SVD-only |  |  |  |  |  |  |  |
| ELA + DWT-SVD (Usulan) |  |  |  |  |  |  |  |

### D3) Tabel uji signifikansi

| Perbandingan | p-value | Effect Size | Keputusan |
|---|---:|---:|---|
| Usulan vs ELA-only |  |  |  |
| Usulan vs DWT-SVD-only |  |  |  |
| Usulan vs ELA + DWT |  |  |  |

---

## E. Naskah Singkat Siap Jawab Dosen

"Kontribusi penelitian saya bukan pada komponen tunggal ELA atau DWT-SVD karena keduanya sudah dikenal, tetapi pada **strategi fusi keduanya**, **evaluasi robustness multi-tahap yang realistis**, dan **implementasi sistem web multi-agent** yang bisa dipakai operasional. Keberhasilan metode diukur pada tiga level: image-level (Accuracy/Precision/Recall/F1/AUC), localization-level (IoU/Dice), dan robustness (relative performance drop di bawah berbagai gangguan). Pembandingnya adalah ELA-only, DWT-SVD-only, ELA+DWT, dan metode usulan ELA+DWT-SVD, dengan uji signifikansi statistik untuk memastikan peningkatan yang terjadi bukan kebetulan."

---

## F. Referensi yang Dipakai (Rapid Scan, akses 24 Februari 2026)

- [R1] Kassem, A. et al. (2022). *A Very Fast Copy-Move Forgery Detection Method for 4K Ultra HD Images*. Frontiers in Signal Processing. (Memuat rujukan eksplisit Li et al. 2007 DWT-SVD, DOI: 10.1109/ICME.2007.4285009).  
  https://www.frontiersin.org/journals/signal-processing/articles/10.3389/frsip.2022.906304/full

- [R2] Jeronymo, D.C. (2017). *Image forgery detection by semi-automatic wavelet soft-thresholding with error level analysis*. Expert Systems with Applications, 85, 348-356. DOI: 10.1016/j.eswa.2017.05.044.  
  https://www.sciencedirect.com/science/article/pii/S0957417417303664

- [R3] Jang, H.; Hou, J.-U. (2020). *Exposing Digital Image Forgeries by Detecting Contextual Abnormality Using Convolutional Neural Networks*. Sensors, 20(8), 2262. DOI: 10.3390/s20082262.  
  https://www.mdpi.com/1424-8220/20/8/2262

- [R4] Alawida, M. et al. (2024). *Detecting image manipulation with ELA-CNN integration*. PeerJ Computer Science.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11323046/

- [R5] Alencar, A.L. et al. (2024). *Detection of Forged Images Using a Combination of Passive Methods Based on Neural Networks*. Future Internet, 16(3), 97. DOI: 10.3390/fi16030097.  
  https://www.mdpi.com/1999-5903/16/3/97

- [R6] Shallal, I. et al. (2025). *Image Forgery Detection with Focus on Copy-Move: An Overview, Real World Challenges and Future Directions*. Applied Sciences, 15(21), 11774.  
  https://www.mdpi.com/2076-3417/15/21/11774

Catatan validitas:

- Dokumen ini berbasis **rapid scan** literatur, bukan systematic review formal Scopus/WoS.
- Untuk klaim novelty final di naskah skripsi, tetap disarankan menambah prosedur pencarian sistematis (keyword, database, inclusion/exclusion, dan tabel gap final).
