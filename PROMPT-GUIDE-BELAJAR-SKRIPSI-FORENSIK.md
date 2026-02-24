# Prompt Guide: Belajar Skripsi Forensik Citra (Untuk ChatGPT/Gemini)

Dokumen ini berisi prompt siap pakai agar kamu bisa belajar:

- konsep dan rumus,
- struktur outline skripsi,
- isi subbab penting (Rumusan Masalah, Tujuan, Metode Penelitian, dll),
- serta validasi kualitas jawaban AI.

Tanggal: 24 Februari 2026

---

## 1) Cara Pakai Singkat

1. Salin `Master Prompt` di bawah ke ChatGPT/Gemini.
2. Ganti bagian placeholder sesuai project kamu.
3. Jalankan prompt turunan (Prompt A, B, C, D) sesuai kebutuhan.
4. Cek hasilnya pakai checklist validasi di bagian akhir.

---

## 2) Master Prompt (Tempel Sekali di Awal)

```text
Kamu adalah asisten akademik untuk skripsi Informatika dengan topik forensik citra digital.
Konteks project saya:
- Judul sementara: "Sistem Forensik Citra Digital Berbasis Multi-Agent Collaboration untuk Deteksi Multi-Tahap Manipulasi Aset Visual pada Platform Web"
- Metode utama: ELA dan DWT-SVD (hybrid/fusion)
- Tujuan: mendeteksi manipulasi gambar dan mengevaluasi robustness pada gangguan post-processing

Tugas kamu:
1) Jelaskan konsep secara bertahap dari dasar -> menengah -> implementasi.
2) Sertakan rumus matematika yang relevan (format LaTeX), definisi variabel, dan contoh hitung sederhana.
3) Bantu saya menulis outline skripsi Indonesia (Bab 1-3) secara akademik.
4) Beri daftar apa yang harus saya siapkan untuk eksperimen dan evaluasi.
5) Jika ada informasi yang belum pasti, beri catatan "perlu verifikasi literatur".

Aturan jawaban:
- Bahasa Indonesia formal akademik, ringkas tapi jelas.
- Pisahkan: Konsep, Rumus, Contoh, Kesalahan Umum, dan Checklist.
- Jangan asumsi berlebihan. Jika data kurang, tanyakan data apa yang dibutuhkan.
- Untuk klaim riset, beri referensi paper (nama, tahun, venue/jurnal, DOI/link jika ada).

Mulai dengan membuat peta belajar 14 hari untuk memahami:
ELA, DWT, SVD, DWT-SVD, metrik evaluasi (Accuracy, Precision, Recall, F1, AUC, IoU, Dice), uji signifikansi, dan penyusunan Bab 1-3.
```

---

## 3) Prompt A - Belajar Konsep dan Rumus

```text
Gunakan konteks skripsi saya (ELA + DWT-SVD). Tolong jelaskan:
1) Intuisi konsep ELA, DWT, SVD, dan gabungan DWT-SVD.
2) Rumus inti untuk masing-masing (format LaTeX), arti simbol, dan kapan dipakai.
3) Contoh numerik sederhana (angka kecil) agar saya paham langkah hitung.
4) Keterbatasan tiap metode dan dampaknya pada deteksi forgery.
5) Hubungan antara keluaran metode dan keputusan klasifikasi (authentic vs forged).

Format jawaban wajib:
- Konsep singkat
- Rumus + definisi variabel
- Contoh hitung
- Kesalahan umum mahasiswa
- Ringkasan 5 poin untuk hafalan sidang
```

---

## 4) Prompt B - Menyusun Outline Skripsi (Bab 1-3)

```text
Bertindak sebagai pembimbing skripsi informatika.
Susun outline Bab 1, Bab 2, Bab 3 untuk topik:
Hybrid ELA + DWT-SVD pada sistem forensik citra digital berbasis web multi-agent.

Keluaran yang saya butuhkan:
1) Bab 1:
   - Latar Belakang (poin argumen bertahap)
   - Identifikasi Masalah
   - Rumusan Masalah (3-5 pertanyaan penelitian)
   - Batasan Masalah
   - Tujuan Penelitian
   - Manfaat Penelitian (teoritis dan praktis)
2) Bab 2:
   - Landasan teori inti
   - Penelitian terdahulu (tabel gap)
   - Kerangka pemikiran
   - Hipotesis (jika relevan)
3) Bab 3:
   - Metode penelitian
   - Variabel penelitian
   - Dataset dan skenario uji
   - Prosedur implementasi
   - Metrik evaluasi + uji statistik

Tambahkan untuk setiap subbab:
- Tujuan subbab
- Isi minimum yang wajib ada
- Contoh kalimat pembuka formal
- Kesalahan umum yang harus dihindari
```

---

## 5) Prompt C - Khusus Bab 3 (Metode Penelitian) + Rumus Evaluasi

```text
Tolong buatkan draft Bab 3 yang kuat secara metodologi untuk skripsi forensik citra:
metode utama ELA + DWT-SVD.

Saya butuh:
1) Desain eksperimen komparatif:
   - Baseline: ELA-only, DWT-SVD-only, ELA+DWT, ELA+DWT-SVD (usulan)
2) Skenario robustness:
   - JPEG recompression, resize, blur, noise, chained perturbations
3) Rumus metrik (LaTeX):
   - Accuracy, Precision, Recall, F1, ROC-AUC, IoU, Dice, Relative Drop
4) Uji statistik:
   - kapan pakai paired t-test vs Wilcoxon
   - contoh interpretasi p-value dan effect size
5) Template tabel hasil Bab 4 yang konsisten dengan Bab 3.

Output akhir:
- Narasi siap edit
- Tabel siap tempel
- Checklist "siap sidang metodologi"
```

---

## 6) Prompt D - Simulasi Tanya Jawab Dosen

```text
Simulasikan dosen penguji yang kritis untuk topik skripsi saya:
hybrid ELA + DWT-SVD pada forensik citra.

Buat:
1) 25 pertanyaan sidang paling mungkin (metodologi, novelty, metrik, validitas).
2) Jawaban ideal versi mahasiswa (singkat, teknis, tidak bertele-tele).
3) Follow-up question dari dosen jika jawaban saya lemah.
4) Versi perbaikan jawaban agar lebih defensible.

Kelompokkan tingkat kesulitan:
- Dasar
- Menengah
- Sulit
```

---

## 7) Prompt E - Minta AI Review Draft Kamu

```text
Saya akan kirim draft Bab [isi: 1/2/3].
Tolong review dengan standar pembimbing skripsi:
- cek logika argumen,
- cek konsistensi istilah,
- cek kesesuaian metode dan metrik,
- cek apakah klaim novelty overclaim.

Format review:
1) Temuan kritis (urut dari paling serius)
2) Revisi kalimat yang disarankan
3) Bagian yang masih lemah dan data yang perlu ditambah
4) Skor kesiapan bimbingan (0-100) + alasan
```

---

## 8) Checklist Validasi Jawaban AI (Wajib)

Gunakan checklist ini setiap habis menerima jawaban AI:

- Apakah rumus ditulis benar dan simbolnya didefinisikan?
- Apakah ada contoh hitung sederhana?
- Apakah metrik cocok dengan jenis tugas (classification vs localization)?
- Apakah baseline pembanding sudah adil?
- Apakah ada uji statistik, bukan sekadar banding angka mentah?
- Apakah klaim novelty tidak berlebihan?
- Apakah ada bagian yang butuh verifikasi dari paper asli?

Jika ada jawaban yang tidak memenuhi checklist, minta AI:

```text
Perbaiki jawaban sebelumnya dengan fokus pada item checklist yang belum terpenuhi.
Jangan ubah struktur utama, cukup tambah bagian yang kurang.
```

---

## 9) Outline Skripsi Minimal (Template Cepat)

Gunakan daftar ini sebagai kerangka minimum:

1. Judul Penelitian
2. Latar Belakang
3. Identifikasi Masalah
4. Rumusan Masalah
5. Batasan Masalah
6. Tujuan Penelitian
7. Manfaat Penelitian
8. Tinjauan Pustaka
9. Gap Penelitian
10. Kerangka Pemikiran
11. Metode Penelitian
12. Dataset dan Skenario Uji
13. Metrik Evaluasi dan Uji Statistik
14. Rancangan Implementasi Sistem
15. Rencana Pengujian dan Analisis Hasil

---

## 10) Catatan Penting

- AI sangat membantu struktur dan penjelasan, tapi validasi akhir tetap pada paper asli dan arahan dosen.
- Untuk klaim "belum pernah ada", gunakan kalimat aman:
  - "Berdasarkan telaah literatur yang dilakukan pada periode [isi periode], belum ditemukan studi yang mengevaluasi kombinasi ini pada skenario [isi skenario] secara komprehensif."
