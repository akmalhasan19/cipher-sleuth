# Catatan Skripsi: Novelty, Urgensi, Metrik, dan Pembanding (ELA + DWT-SVD)

Tanggal ringkasan: **24 Februari 2026**

## 1) Jawaban Inti untuk Pertanyaan Dosen

Per cek literatur cepat, klaim bahwa gabungan **ELA + DWT-SVD** itu "benar-benar baru" **belum aman** jika dinyatakan absolut.

Posisi yang lebih kuat:

- Kombinasi komponen forensik pasif sudah pernah dieksplor.
- Kontribusi skripsi dapat difokuskan pada:
  - **skema fusi spesifik** ELA + DWT-SVD,
  - **skenario multi-tahap manipulasi + post-processing media sosial**,
  - **implementasi sistem web multi-agent** yang operasional.

## 2) Kenapa Klaim "Absolut Baru" Perlu Hati-Hati

- Teknik berbasis DWT-SVD untuk deteksi forgery sudah lama muncul di literatur.
- ELA juga sudah lama digunakan, termasuk pernah digabung dengan teknik lain.
- Pendekatan multi-stream/hybrid pada forensik citra sudah ada.

Kesimpulan praktis:

- Novelty skripsi tidak sebaiknya diletakkan pada "komponen metode tunggal",
- tetapi pada **desain eksperimen, strategi integrasi, robustness, dan deployment**.

## 3) Urgensi Penelitian Tetap Kuat

Argumen urgensi:

- Tidak ada satu metode pasif yang konsisten terbaik untuk semua jenis manipulasi.
- ELA dapat turun performanya pada kompresi kuat, resize, blur, atau noise.
- Metode klasik tertentu juga rentan saat ada post-processing berlapis.

Makna untuk skripsi:

- Penelitian hybrid/ensemble tetap relevan,
- terutama untuk kondisi dunia nyata (gambar lewat platform sosial yang melakukan recompression dan resizing).

## 4) Metrik Keberhasilan (Yang Bisa Dijawab ke Dosen)

Gunakan evaluasi 3 level:

1. **Image-level detection**
   - Accuracy
   - Precision
   - Recall
   - F1-score
   - ROC-AUC
2. **Localization-level** (jika ada ground-truth mask)
   - IoU
   - Dice / DSC
   - Pixel-level F1
3. **Robustness**
   - Penurunan metrik terhadap variasi gangguan:
     - JPEG quality turun,
     - resizing,
     - blur,
     - noise.

## 5) Metrik Perbandingan dan Cara Membandingkan

Baseline pembanding yang disarankan:

1. ELA-only
2. DWT-SVD-only
3. ELA + DWT (tanpa SVD)
4. Metode usulan: ELA + DWT-SVD (fusion)
5. (Opsional) baseline modern ringan, misalnya ELA+CNN

Aturan eksperimen:

1. Dataset dan split yang sama untuk semua metode.
2. Uji pada kondisi normal dan kondisi terdistorsi (compression/noise/resize).
3. Laporan nilai rata-rata + standar deviasi.
4. Tambahkan uji signifikansi sederhana (paired t-test atau Wilcoxon).

## 6) Jika Novelty Dinilai Kurang

Alihkan fokus judul/kontribusi ke:

- **robustness pada multi-stage manipulation**, 
- **strategi fusi lintas-metode**, 
- **explainability hasil deteksi**, 
- **kesiapan implementasi sistem web**.

Contoh framing:

> Robust Multi-Stage Image Forgery Detection under Social-Media Post-Processing using Hybrid Passive Forensics

## 7) Referensi Awal (untuk pijakan)

- MDPI Future Internet 2024 (multi-stream kombinasi metode pasif):  
  <https://www.mdpi.com/1999-5903/16/3/97>
- Frontiers 2022 (membahas rujukan DWT-SVD 2007 + DOI):  
  <https://www.frontiersin.org/journals/signal-processing/articles/10.3389/frsip.2022.906304/full>
- Expert Systems with Applications 2017 (ELA + wavelet thresholding):  
  <https://www.sciencedirect.com/science/article/pii/S0957417417303664>
- Sensors 2020 (keterbatasan ELA pada post-processing kuat):  
  <https://www.mdpi.com/1424-8220/20/8/2262>
- Applied Sciences 2025 (contoh metrik: Acc/Prec/Recall/F1, IoU, DSC, robustness):  
  <https://www.mdpi.com/2076-3417/15/21/11774>
- PeerJ Computer Science 2024 (ELA + CNN):  
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC11323046/>

## 8) Catatan Validitas Klaim

Ringkasan ini adalah **rapid scan**, bukan systematic literature review penuh.

Untuk klaim final "novel", tetap lakukan:

1. pencarian sistematis (Scopus/WoS/IEEE Xplore/ACM/ScienceDirect),
2. definisi keyword + inclusion/exclusion criteria,
3. tabel gap riset yang terdokumentasi.
