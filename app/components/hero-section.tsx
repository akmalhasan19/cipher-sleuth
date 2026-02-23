"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Upload } from "lucide-react";
import { ensureWebpFile } from "../lib/ensure-webp-file";

const stripItems = [
  "Exif-Bot Active",
  "Noise-Bot Active",
  "DWT-SVD Active",
  "Deepfake Trace",
  "Metadata Drift",
  "Integrity Layer",
];

function TypewriterLine({ text, delay = 0, speed = 50, className = "", start = false, loopDelay = 10000 }: { text: string, delay?: number, speed?: number, className?: string, start?: boolean, loopDelay?: number }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!start) return;

    let typeTimer: NodeJS.Timeout;
    let startTimer: NodeJS.Timeout;
    const runAnimation = () => {
      setDisplayedText(""); // Reset text
      startTimer = setTimeout(() => {
        let i = 0;
        typeTimer = setInterval(() => {
          i++;
          setDisplayedText(text.slice(0, i));
          if (i >= text.length) clearInterval(typeTimer);
        }, speed);
      }, delay);
    };

    // Initial run
    runAnimation();

    // Setup loop
    const loopTimer = setInterval(() => {
      clearInterval(typeTimer);
      clearTimeout(startTimer);
      runAnimation();
    }, loopDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(typeTimer);
      clearInterval(loopTimer);
    };
  }, [text, delay, speed, start, loopDelay]);

  return <div className={`min-h-[1.5em] ${className}`}>{displayedText}</div>;
}

function GlitchText({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Hanya menggunakan huruf kapital dan huruf kecil
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  const startGlitch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setDisplayText(text.split("").map(() => chars[Math.floor(Math.random() * chars.length)]).join(""));
    }, 50);
  };

  const stopGlitch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    let iteration = 0;
    
    intervalRef.current = setInterval(() => {
      setDisplayText(() => 
        text.split("").map((letter, index) => {
          if (index < iteration) return text[index];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("")
      );
      
      if (iteration >= text.length) {
        clearInterval(intervalRef.current!);
        setDisplayText(text);
      }
      
      iteration += 1 / 3;
    }, 30);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <span 
      onMouseEnter={startGlitch} 
      onMouseLeave={stopGlitch}
      className="inline-block cursor-crosshair"
    >
      {displayText}
    </span>
  );
}

export function HeroSection() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [boardOverflowBottom, setBoardOverflowBottom] = useState(0);
  const boardAreaRef = useRef<HTMLDivElement | null>(null);
  const stickyNotesRef = useRef<HTMLDivElement | null>(null);
  const chalkboardRef = useRef<HTMLDivElement | null>(null);
  const isChalkboardInView = useInView(chalkboardRef, { once: true, margin: "-100px" });

  useEffect(() => {
    const boardArea = boardAreaRef.current;

    if (!boardArea) {
      return;
    }

    const updateScrollBoundary = () => {
      const boardAreaRect = boardArea.getBoundingClientRect();
      const stickyNotes = stickyNotesRef.current;
      const stickyRect = stickyNotes?.getBoundingClientRect();
      const stickyVisible =
        stickyNotes && window.getComputedStyle(stickyNotes).display !== "none";

      const requiredExtra =
        stickyRect && stickyVisible
          ? Math.max(0, Math.ceil(stickyRect.bottom - boardAreaRect.bottom))
          : 0;

      setBoardOverflowBottom((prev) =>
        prev === requiredExtra ? prev : requiredExtra
      );
    };

    const runUpdate = () => {
      window.requestAnimationFrame(updateScrollBoundary);
    };

    runUpdate();

    const observer = new ResizeObserver(runUpdate);
    observer.observe(boardArea);
    if (stickyNotesRef.current) {
      observer.observe(stickyNotesRef.current);
    }

    window.addEventListener("resize", runUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", runUpdate);
    };
  }, [isChalkboardInView]);

  const handleIncomingFile = async (inputFile: File) => {
    try {
      await ensureWebpFile(inputFile);
    } catch {
      // Keep silent in UI; upload flow continues.
    }
  };

  return (
    <section className="space-y-6 py-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-4xl px-1 text-center md:px-2"
      >
        <p className="inline-flex rounded-xl border-4 border-black bg-[#f3e8cf] px-3 py-1 text-xs font-bold uppercase text-black">
          Multi-Agent Image Forensics
        </p>
        <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[0.95] tracking-tight text-[#f7f0df] md:text-7xl">
          The Truth is in
          <br />
          The{" "}
          <span className="relative inline-block">
            <GlitchText text="Pixel" />
            <svg
              className="absolute -bottom-2 left-0 h-3 w-full text-[#e2b300]"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M2 7 C 28 10, 72 10, 98 7"
                stroke="currentColor"
                strokeWidth="3.2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm font-medium text-[#f3ebda]/95 md:text-base">
          Upload image evidence and run metadata, ELA noise, and integrity
          checks in one synchronized pipeline.
        </p>

        <label
          className={`mx-auto mt-7 flex w-full max-w-md cursor-pointer items-center justify-center gap-2 rounded-full border-4 border-black px-5 py-3 text-sm font-bold shadow-[3px_3px_0_#000] md:shadow-[5px_5px_0_#000] transition ${isDragOver ? "bg-[#d5f5df]" : "bg-[#f8f4ea]"
            }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            const droppedFile = event.dataTransfer.files?.[0];
            if (droppedFile) {
              void handleIncomingFile(droppedFile);
            }
          }}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (selectedFile) {
                void handleIncomingFile(selectedFile);
              }
            }}
          />
          <Upload className="h-4 w-4" />
          Drop Evidence Here
        </label>
      </motion.div>

      <div
        ref={boardAreaRef}
        className="relative mx-auto max-w-6xl"
        style={
          boardOverflowBottom > 0
            ? { marginBottom: `${boardOverflowBottom}px` }
            : undefined
        }
      >
        <div ref={chalkboardRef} className="relative min-h-[320px] w-full max-w-3xl overflow-hidden rounded-sm border-[8px] md:border-[16px] border-[#d4a373] bg-[#2b2f32] p-3 md:p-4 shadow-[6px_6px_0_#000] md:shadow-[10px_10px_0_#000] md:min-h-[470px]">
          {/* Inner frame shadow */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"></div>

          {/* Chalk smudges background */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.03)_0%,transparent_25%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.02)_0%,transparent_30%),radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.01)_0%,transparent_40%),radial-gradient(circle_at_10%_80%,rgba(255,255,255,0.02)_0%,transparent_20%)]"></div>

          {/* Eraser marks (more subtle and broad like the image) */}
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute left-1/4 top-1/4 h-64 w-96 -rotate-12 rounded-full bg-white/5 blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 h-40 w-64 rotate-45 rounded-full bg-white/5 blur-3xl"></div>
            <div className="absolute left-10 top-10 h-32 w-64 rotate-12 rounded-full bg-white/5 blur-2xl"></div>
          </div>

          {/* Decorative chalk drawings (like the image) */}
          <div className="pointer-events-none absolute inset-0 opacity-40">
            {/* Scribbles top left */}
            <svg className="absolute left-8 top-8 h-24 w-32 text-white" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10,30 Q30,10 50,30 T90,20" />
              <path d="M15,40 Q40,20 60,40 T85,35" />
              <path d="M20,50 Q50,30 70,50 T80,45" />
            </svg>
          </div>

          {/* 2D Chalk Tray & Eraser (SVG based to match aesthetic) */}
          <div className="pointer-events-none absolute bottom-0 right-4 z-20 opacity-80 md:right-10">
            <svg className="h-16 w-48 md:h-20 md:w-80 text-white" viewBox="0 0 300 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Tray Line */}
              <line x1="0" y1="70" x2="300" y2="70" strokeWidth="3" />
              <line x1="10" y1="75" x2="290" y2="75" strokeWidth="1" opacity="0.5" />

              {/* Chalk Pieces */}
              <rect x="30" y="62" width="40" height="6" rx="2" transform="rotate(5 50 65)" fill="currentColor" fillOpacity="0.2" />
              <rect x="80" y="64" width="30" height="5" rx="2" transform="rotate(-8 95 66)" fill="currentColor" fillOpacity="0.2" />
              <rect x="120" y="60" width="45" height="7" rx="2" transform="rotate(12 142 63)" fill="currentColor" fillOpacity="0.2" />

              {/* Eraser */}
              <g transform="translate(200, 40) rotate(-3)">
                {/* Eraser Body */}
                <rect x="0" y="0" width="70" height="28" rx="3" />
                {/* Eraser Handle/Top part */}
                <rect x="0" y="0" width="70" height="18" rx="3" fill="currentColor" fillOpacity="0.1" />
                {/* Eraser Felt/Bottom part */}
                <rect x="0" y="18" width="70" height="10" rx="1" fill="currentColor" fillOpacity="0.4" />
                {/* Chalk dust on eraser */}
                <path d="M5,28 Q15,35 25,28 T45,28 T65,28" strokeWidth="1" opacity="0.6" />
                <path d="M10,28 Q20,32 30,28 T50,28" strokeWidth="1" opacity="0.4" />
              </g>
            </svg>
          </div>

          <div className="chalk-font relative z-10 flex h-full flex-col gap-6 px-2 pt-2 pb-20 text-white/90 drop-shadow-[0_0_1px_rgba(255,255,255,0.5)] md:p-6">
            {/* Evidence Stack Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isChalkboardInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5 }}
              className="absolute -left-2 -top-2 flex items-center gap-2 rounded-xl border-[3px] border-black bg-[#fdf8ec] px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] drop-shadow-none font-serif"
            >
              Evidence Stack
            </motion.div>

            {/* Terminal Output */}
            <div className="mt-10 flex flex-col gap-2 text-sm md:text-xl">
              <TypewriterLine start={isChalkboardInView} text="> [SYSTEM] Initiating Forensic Audit..." delay={500} loopDelay={12000} />
              <TypewriterLine start={isChalkboardInView} text="> [EXIF-BOT] Analyzing metadata... OK (No anomalies)" delay={2000} loopDelay={12000} />
              <TypewriterLine start={isChalkboardInView} text="> [NOISE-BOT] Running ELA scan... OK (Uniform compression)" delay={4000} loopDelay={12000} />
              <TypewriterLine start={isChalkboardInView} text="> [DWT-SVD] Checking structural integrity... OK (No watermarks)" delay={6000} loopDelay={12000} />
              <TypewriterLine start={isChalkboardInView} text="> ----------------------------------------" delay={8000} speed={15} loopDelay={12000} />
              <TypewriterLine start={isChalkboardInView} text="> VERDICT: LIKELY AUTHENTIC" delay={8500} loopDelay={12000} className="mt-2 text-lg md:text-2xl font-bold text-green-400/90 drop-shadow-[0_0_2px_rgba(74,222,128,0.8)]" />
              <TypewriterLine start={isChalkboardInView} text="> TRUST SCORE: 98/100" delay={9500} loopDelay={12000} className="text-lg md:text-2xl font-bold text-white" />
            </div>
          </div>
        </div>

        {/* Sticky Notes Section (Right side of chalkboard) */}
        <div
          ref={stickyNotesRef}
          className="absolute -bottom-12 left-4 flex gap-4 md:-right-12 md:bottom-auto md:left-auto md:top-10 md:flex-col md:gap-6 lg:-right-1"
        >
          {/* Sticky Note 1 */}
          <motion.div
            initial={{ opacity: 0, x: 20, rotate: 0 }}
            animate={isChalkboardInView ? { opacity: 1, x: 0, rotate: 6 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative h-24 w-24 md:h-32 md:w-32 bg-[#fef08a] p-2 md:p-3 shadow-[4px_4px_10px_rgba(0,0,0,0.3)]"
          >
            {/* Red Pin */}
            <div className="absolute -top-2 left-1/2 h-3 w-3 md:h-4 md:w-4 -translate-x-1/2 rounded-full bg-red-500 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.3),2px_2px_4px_rgba(0,0,0,0.4)]">
              <div className="absolute left-1 top-1 h-1 w-1 rounded-full bg-white/60"></div>
            </div>
            <div className="chalk-font mt-1 md:mt-2 text-[10px] md:text-sm text-black/80">
              Session #1042
              <br />
              <span className="text-[8px] md:text-xs">Status: Cleared</span>
            </div>
            {/* Dummy Image Placeholder */}
            <div className="mt-1 md:mt-2 h-8 md:h-12 w-full border border-black/10 bg-black/5 flex items-center justify-center">
              <span className="text-[8px] md:text-[10px] text-black/40">IMG_001.jpg</span>
            </div>
          </motion.div>

          {/* Sticky Note 2 */}
          <motion.div
            initial={{ opacity: 0, x: 20, rotate: 0 }}
            animate={isChalkboardInView ? { opacity: 1, x: 0, rotate: -4 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="relative h-24 w-24 md:h-32 md:w-32 bg-[#bbf7d0] p-2 md:p-3 shadow-[4px_4px_10px_rgba(0,0,0,0.3)]"
          >
            {/* Blue Pin */}
            <div className="absolute -top-2 left-1/2 h-3 w-3 md:h-4 md:w-4 -translate-x-1/2 rounded-full bg-blue-500 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.3),2px_2px_4px_rgba(0,0,0,0.4)]">
              <div className="absolute left-1 top-1 h-1 w-1 rounded-full bg-white/60"></div>
            </div>
            <div className="chalk-font mt-1 md:mt-2 text-[10px] md:text-sm text-black/80">
              Session #1043
              <br />
              <span className="text-[8px] md:text-xs text-red-600/80">Status: Flagged</span>
            </div>
            {/* Dummy Image Placeholder */}
            <div className="mt-1 md:mt-2 h-8 md:h-12 w-full border border-black/10 bg-black/5 flex items-center justify-center">
              <span className="text-[8px] md:text-[10px] text-black/40">IMG_002.png</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-4 border-black bg-[#e7dbc1] py-2 shadow-[4px_4px_0_#000] md:shadow-[8px_8px_0_#000]">
        <motion.div
          className="flex w-max gap-3"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 2 }).map((_, groupIndex) => (
            <div key={groupIndex} className="flex gap-3 px-2">
              {stripItems.map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="rounded-lg border-4 border-black bg-[#f7edd7] px-4 py-1 text-xs font-bold uppercase"
                >
                  {item}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
