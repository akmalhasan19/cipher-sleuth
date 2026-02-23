Project Name: Cipher Sleuth
Version: 1.0.0 (MVP)
Platform: Web Application
Primary Theme: Digital Image Forensics via Multi-Agent Collaboration

1. Project Overview
Masalah: Meningkatnya manipulasi gambar digital (forgery) membuat validasi keaslian aset visual menjadi sulit bagi orang awam. Analisis forensik tradisional mengharuskan pengguna memahami cara membaca grafik teknis (seperti ELA) secara manual.
Solusi: "Cipher Sleuth", sebuah platform investigasi berbasis web yang menggunakan arsitektur Multi-Agent Collaboration. Sistem akan mendelegasikan analisis gambar ke beberapa agen AI spesifik (Metadata, ELA, dan DWT-SVD) yang bekerja secara paralel, berdiskusi, dan menghasilkan satu skor kepercayaan (Final Trust Score) beserta laporan yang mudah dipahami.

2. Target Audience
Dosen Penguji Skripsi: Menilai kebaruan (novelty) dari kolaborasi Multi-Agent dan efisiensi pemrosesan algoritma pada browser.

Investigator / Jurnalis (End-User simulasi): Pengguna awam yang membutuhkan alat cepat untuk memvalidasi keaslian sebuah gambar tanpa harus menjadi pakar kriptografi.

3. Key Features (Scope MVP)
Berikut adalah fitur utama yang wajib ada untuk rilis versi MVP:

A. The Investigation Workspace (Dashboard)
Drag & Drop Upload Zone: Area interaktif untuk mengunggah gambar. Harus memiliki feedback visual saat file diseret (hover state).

Real-time Agent Logs (Terminal UI): Panel samping yang menampilkan log komunikasi antar-agen secara real-time (mirip terminal coding).

Status Badges: Indikator visual status masing-masing agen (contoh: [ANALYZING], [THREAT DETECTED], [CLEAN]).

B. Multi-Agent Engine (The Core)
Sistem orkestrasi yang menjalankan tiga agen berikut secara paralel:

Agent 1 (Exif-Bot): Mengekstrak dan menganalisis metadata, mendeteksi software signature (misal: "Disimpan dengan Photoshop").

Agent 2 (Noise-Bot): Melakukan analisis tingkat kesalahan kompresi (Error Level Analysis / ELA) untuk mendeteksi splicing atau tempelan.

Agent 3 (Cipher-Bot): Memeriksa integritas watermark kriptografi DWT-SVD pada tingkat bit-layer.

C. Forensic Report Generation
Final Trust Score: Persentase yang menunjukkan tingkat keaslian gambar hasil dari konsensus (gabungan skor) ketiga agen.

Interactive Heatmap: Visualisasi hasil ELA yang bisa di- toggle hidup/mati di atas gambar asli.

4. UI/UX & Design Guidelines
Desain mengusung tema "Playful Skeuomorphism" dengan sentuhan modern.

Visual Style: Menggabungkan elemen dunia nyata yang di- digitalisasi (kartu laporan yang saling tumpang tindih, rotasi elemen miring/ skewed, sticky notes kuning).

Animasi: Efek continuous levitation (elemen mengambang tiada henti) dan parallax scrolling menggunakan Framer Motion.

Tipografi: Menghindari font standar yang terlalu membulat. Gunakan font yang punya karakter teknis/ bold seperti Space Grotesk, Clash Display, dipadukan dengan monospace font (seperti JetBrains Mono) untuk area Terminal Log dan handwritten font untuk anotasinya.

Warna: Latar belakang off-white, elemen UI dominan putih dengan drop shadow halus untuk efek 3D, serta aksen warna biru elektrik atau stabilo untuk highlight investigasi.

5. Technical Specifications (Tech Stack)
Frontend Framework: Next.js (App Router), React.

Styling & Animation: Tailwind CSS, Framer Motion.

Backend / API: Next.js API Routes (berfungsi sebagai Agent Orchestrator).

Database & Storage: Supabase (Untuk menyimpan histori investigasi, log terminal, dan hosting gambar sementara).

Image Processing: HTML5 Canvas API (untuk kalkulasi pixel ELA) dan modul JavaScript custom (untuk DWT-SVD).

6. System Architecture (Simplified)
Input: User mengunggah gambar via UI.

Processing (Orchestrator API): Gambar dikirim ke API -> API memecah task menggunakan Promise.all ke 3 modul Agen (Exif, ELA, DWT-SVD).

Consensus Logic: Jika Exif mendeteksi editan, tapi ELA menyatakan bersih, Orchestrator akan memberikan bobot (weight) tertentu pada masing-masing hasil untuk menentukan Trust Score.

Output: Mengirimkan log terminal dan JSON report kembali ke Frontend, lalu menyimpannya ke Supabase.

7. Success Metrics (Syarat Lulus Skripsi)
Sistem berhasil membedakan minimal 1 gambar asli dan 1 gambar hasil manipulasi (Photoshop/tampered).

UI berjalan lancar (smooth animation 60fps) dan Terminal Log menampilkan langkah kerja dengan akurat.

Skrip DWT-SVD berhasil diintegrasikan sebagai salah satu modul Agen tanpa merusak aliran Promise.all di backend.