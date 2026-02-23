Product Requirements Document (PRD): Functional Features
Project Name: Cipher Sleuth
Type: Web-Based Multi-Agent Image Forensic Platform

1. Alur Kerja Utama Sistem (System Workflow)
Sistem beroperasi berdasarkan alur linear yang diproses secara asinkron di latar belakang:

Ingestion (Input): Sistem menerima file gambar dari pengguna dan melakukan validasi format serta ukuran.

Deconstruction (Pemecahan): File gambar dipecah salinannya untuk dikirim ke masing-masing Agen Forensik secara paralel.

Analysis (Pemrosesan Agen): Setiap agen menjalankan algoritmanya secara independen (DWT-SVD, ELA, EXIF) dan menghasilkan nilai data mentah.

Synthesis (Orkestrasi LLM): Agen Orkestrator (berbasis LLM API) membaca semua data mentah dari agen teknis, mencari anomali/konflik data, dan merumuskan kesimpulan.

Output (Pelaporan): Sistem menghasilkan Final Trust Score dan laporan teks komprehensif yang disimpan ke database.

2. Rincian Fitur & Modul Utama
Fitur 1: Modul Input & Validasi Aset
Fitur ini bertanggung jawab sebagai gerbang awal sebelum gambar masuk ke ruang investigasi.

Format Checking: Hanya menerima format gambar standar (JPEG, PNG, JPG).

Hash Generation: Saat gambar diunggah, sistem langsung membuat cryptographic hash (misal: SHA-256) dari file tersebut. Ini berfungsi sebagai "sidik jari digital" untuk memastikan bahwa gambar yang dianalisis tidak diubah selama proses di dalam sistem (menjaga Chain of Custody).

File Size Limiter: Membatasi ukuran file (misal maksimal 5MB) agar pemrosesan algoritma DWT-SVD dan ELA di server/browser tidak mengalami memory leak atau timeout.

Fitur 2: Mesin Forensik "Multi-Agent" (Core Feature)
Ini adalah jantung dari Cipher Sleuth. Terdiri dari 4 Agen independen yang memiliki tugas spesifik:

A. Agent 1: The Metadata Extractor (Deterministic)

Fungsi: Membedah struktur internal file gambar (EXIF Data).

Cara Kerja: Mengekstrak informasi tersembunyi seperti tanggal pengambilan gambar, jenis kamera/perangkat, resolusi asli, koordinat GPS (jika ada), dan yang terpenting: Software Signature (jejak aplikasi yang terakhir menyimpan gambar tersebut, seperti "Adobe Photoshop" atau "Canva").

Output: Objek JSON berisi daftar metadata yang ditemukan.

B. Agent 2: The ELA Scanner (Deterministic)

Fungsi: Menganalisis inkonsistensi tingkat kompresi pada gambar untuk mendeteksi splicing (objek tempelan).

Cara Kerja: Sistem menyimpan ulang gambar yang diunggah dengan tingkat kualitas kompresi rendah (misal 90%). Kemudian, sistem membandingkan nilai piksel gambar asli dengan gambar hasil kompresi tersebut. Area yang memiliki perbedaan nilai (error level) sangat kontras akan ditandai.

Output: Koordinat area piksel dengan nilai anomali tinggi dan menghasilkan matriks/gambar heatmap.

C. Agent 3: The DWT-SVD Verifier (Deterministic)

Fungsi: Memeriksa keberadaan dan keutuhan watermark kriptografi yang ditanamkan.

Cara Kerja: Menerapkan transformasi Discrete Wavelet Transform untuk memecah gambar ke dalam pita frekuensi (LL, HL, LH, HH), lalu menggunakan Singular Value Decomposition pada matriks frekuensi untuk mengekstrak bit watermark. Sistem akan mencocokkan bit yang diekstrak dengan bit watermark asli.

Output: Persentase kerusakan/keutuhan watermark (contoh: "Watermark Integrity: 85%").

D. Agent 4: The LLM Orchestrator (Synthesis/Judge)

Fungsi: Bertindak sebagai Hakim atau Ketua Investigasi yang menyimpulkan hasil kerja Agen 1, 2, dan 3.

Cara Kerja: Mengumpulkan JSON output dari ketiga agen teknis di atas, lalu menyusunnya menjadi sebuah prompt terstruktur yang dikirim ke API LLM (seperti OpenAI/Gemini). LLM diprogram untuk bertindak sebagai ahli forensik yang mencari korelasi. (Contoh logika: Jika Agent 1 bilang diedit Photoshop, dan Agent 2 mendeteksi noise di area wajah, maka ini adalah manipulasi wajah).

Output: Narasi laporan investigasi (dalam bahasa manusia) dan penentuan bobot akhir (Final Trust Score).

Fitur 3: Sistem Konsensus & Skoring Otomatis
Trust Score Calculation: Algoritma internal yang mengeluarkan skor akhir 0% hingga 100%.

Skor 90-100%: Gambar terverifikasi asli (Watermark utuh, ELA normal, EXIF bersih).

Skor 50-89%: Gambar mencurigakan (Terdapat indikasi editing ringan atau kompresi berulang/WhatsApp).

Skor < 50%: Gambar terbukti dimanipulasi (Watermark rusak/hilang, ELA mendeteksi tempelan kuat).

Fitur 4: Generator Laporan Forensik Tertulis
Forensic Breakdown: Sistem memecah laporan dari Orkestrator menjadi poin-poin yang mudah dibaca.

Report Export: Fitur untuk mengunduh hasil investigasi akhir beserta hash gambar dan Trust Score ke dalam format dokumen yang read-only (seperti PDF).

Fitur 5: Manajemen Riwayat & Bukti Digital (Database Logging)
Investigation Ledger: Setiap kali gambar selesai dianalisis, sistem menyimpan log lengkap ke Supabase. Data yang disimpan meliputi: Tanggal analisis, Hash gambar asal, skor tiap agen, dan kesimpulan akhir.

Duplicate Detection: Jika seseorang mengunggah gambar yang sama persis (hash cocok dengan database), sistem tidak perlu melakukan proses komputasi agen lagi, melainkan langsung menampilkan hasil dari database untuk menghemat waktu komputasi.

3. Batasan Sistem (Out of Scope)
Untuk menjaga agar skripsi tetap fokus dan realistis selesai dalam satu semester, Cipher Sleuth TIDAK mencakup fitur berikut:

Tidak melakukan deteksi Deepfake video.

Tidak melakukan pelacakan wajah (Face Recognition) untuk mencari identitas orang di dalam gambar.

Agen ELA dan DWT-SVD memproses perhitungan matematis murni, bukan menggunakan model Machine Learning untuk computer vision.