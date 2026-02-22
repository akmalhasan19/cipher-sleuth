"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Fingerprint, Lock, Upload } from "lucide-react";

const stripItems = [
  "Exif-Bot Active",
  "Noise-Bot Active",
  "DWT-SVD Active",
  "Deepfake Trace",
  "Metadata Drift",
  "Integrity Layer",
];

const floatTransition = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  repeatType: "reverse" as const,
  ease: "easeInOut" as const,
});

function TypewriterLine({ text, delay = 0, speed = 50, className = "", start = false, loopDelay = 10000 }: { text: string, delay?: number, speed?: number, className?: string, start?: boolean, loopDelay?: number }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!start) return;
    
    let typeTimer: NodeJS.Timeout;
    let startTimer: NodeJS.Timeout;
    let loopTimer: NodeJS.Timeout;

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
    loopTimer = setInterval(() => {
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

export function HeroSection() {
  const [isDragOver, setIsDragOver] = useState(false);
  const chalkboardRef = useRef(null);
  const isChalkboardInView = useInView(chalkboardRef, { once: true, margin: "-100px" });

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
            Pixel
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
          className={`mx-auto mt-7 flex w-full max-w-md cursor-pointer items-center justify-center gap-2 rounded-full border-4 border-black px-5 py-3 text-sm font-bold shadow-[5px_5px_0_#000] transition ${
            isDragOver ? "bg-[#d5f5df]" : "bg-[#f8f4ea]"
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
          }}
        >
          <input type="file" accept="image/*" className="sr-only" />
          <Upload className="h-4 w-4" />
          Drop Evidence Here
        </label>
      </motion.div>

      <div ref={chalkboardRef} className="relative min-h-[360px] max-w-3xl overflow-hidden rounded-sm border-[16px] border-[#d4a373] bg-[#2b2f32] p-4 shadow-[10px_10px_0_#000] md:min-h-[470px]">
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
          <svg className="h-20 w-64 text-white md:w-80" viewBox="0 0 300 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        <div className="chalk-font relative z-10 flex h-full flex-col gap-6 p-2 text-white/90 drop-shadow-[0_0_1px_rgba(255,255,255,0.5)] md:p-6">
          {/* Evidence Stack Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isChalkboardInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="absolute -left-4 -top-4 flex items-center gap-2 rounded-xl border-[3px] border-black bg-[#fdf8ec] px-4 py-1.5 text-sm font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] drop-shadow-none font-serif"
          >
            Evidence Stack
          </motion.div>

          {/* Terminal Output */}
          <div className="mt-10 flex flex-col gap-2 text-lg md:text-xl">
            <TypewriterLine start={isChalkboardInView} text="> [SYSTEM] Initiating Forensic Audit..." delay={500} loopDelay={12000} />
            <TypewriterLine start={isChalkboardInView} text="> [EXIF-BOT] Analyzing metadata... OK (No anomalies)" delay={2000} loopDelay={12000} />
            <TypewriterLine start={isChalkboardInView} text="> [NOISE-BOT] Running ELA scan... OK (Uniform compression)" delay={4000} loopDelay={12000} />
            <TypewriterLine start={isChalkboardInView} text="> [DWT-SVD] Checking structural integrity... OK (No watermarks)" delay={6000} loopDelay={12000} />
            <TypewriterLine start={isChalkboardInView} text="> ----------------------------------------" delay={8000} speed={15} loopDelay={12000} />
            <TypewriterLine start={isChalkboardInView} text="> VERDICT: LIKELY AUTHENTIC" delay={8500} loopDelay={12000} className="mt-2 text-2xl font-bold text-green-400/90 drop-shadow-[0_0_2px_rgba(74,222,128,0.8)]" />
            <TypewriterLine start={isChalkboardInView} text="> TRUST SCORE: 98/100" delay={9500} loopDelay={12000} className="text-2xl font-bold text-white" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-4 border-black bg-[#e7dbc1] py-2 shadow-[8px_8px_0_#000]">
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
