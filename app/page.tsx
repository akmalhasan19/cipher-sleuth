"use client";

import { useState, useEffect } from "react";
import { HeroSection } from "./components/hero-section";
import { ReviewsSection } from "./components/reviews-section";
import { TopNavigation } from "./components/top-navigation";

export default function HomePage() {
  const [isGlobalDragOver, setIsGlobalDragOver] = useState(false);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsGlobalDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set to false if we are leaving the window
      if (e.clientX === 0 && e.clientY === 0) {
        setIsGlobalDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsGlobalDragOver(false);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[#2d5a45] text-black">
      {isGlobalDragOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
          <div className="pointer-events-none flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-[#e2b300] bg-[#f8f4ea] p-12 text-center shadow-[8px_8px_0_#000]">
            <svg
              className="mb-4 h-16 w-16 text-[#2d5a45]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h2 className="text-3xl font-extrabold text-[#1d2a24]">
              Drop Evidence Here
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#405046]">
              Release to start forensic analysis
            </p>
          </div>
        </div>
      )}

      <div className="brutalist-grid pointer-events-none absolute inset-0" />

      <TopNavigation />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-4 pt-5 md:px-8 md:pb-6">
        <HeroSection />
        <ReviewsSection />

        <footer className="rounded-2xl border-4 border-black bg-white px-5 py-4 shadow-[4px_4px_0_#000] md:shadow-[8px_8px_0_#000]">
          <div className="flex flex-col items-center justify-between gap-3 text-sm font-semibold md:flex-row">
            <div className="flex flex-wrap justify-center gap-4">
              <a href="#" className="underline-offset-4 hover:underline">
                Teams
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Docs
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Blog
              </a>
              <a href="#" className="underline-offset-4 hover:underline">
                Playbook
              </a>
            </div>
            <p>Cipher Sleuth (c) 2026</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
