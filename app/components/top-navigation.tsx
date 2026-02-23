"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X } from "lucide-react";

const navItems = ["Features", "Case Studies", "API", "Pricing"];

export function TopNavigation() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
      <nav className="mx-auto flex h-14 md:h-16 w-full max-w-6xl items-center justify-between rounded-2xl border-2 border-black bg-[#f8f4ea] px-3 md:px-6 shadow-[0_4px_0_#16382b] md:shadow-[0_8px_0_#16382b]">
        <div className="flex items-center gap-2">
          <Image
            src="/cipher-sleuth-logo.webp"
            alt="Cipher Sleuth logo"
            width={40}
            height={40}
            className="h-8 w-8 md:h-10 md:w-10 object-contain"
            priority
          />
          <span className="text-base md:text-lg font-bold tracking-tight text-[#1d2a24]">
            Cipher Sleuth
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm font-semibold text-[#405046] lg:flex">
          {navItems.map((item) => (
            <a key={item} href="#" className="transition hover:text-black">
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLoginOpen(true)}
            className="hidden text-sm font-semibold text-[#405046] transition hover:text-black md:inline-block"
          >
            Login
          </button>
          <motion.a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              window.dispatchEvent(new CustomEvent('trigger-arrow', {
                detail: {
                  startX: rect.left + rect.width / 2,
                  startY: rect.bottom + window.scrollY
                }
              }));
            }}
            whileHover={{ y: -2, x: -2 }}
            whileTap={{ y: 0, x: 0 }}
            className="border-2 border-black bg-[#1f2937] px-3 py-1.5 md:px-5 text-xs md:text-sm font-bold text-white shadow-[2px_2px_0_#000] md:shadow-[3px_3px_0_#000]"
          >
            Start Investigation
          </motion.a>
        </div>
      </nav>

      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-3xl border-4 border-black bg-[#f8f4ea] p-6 shadow-[8px_8px_0_#000] md:p-8"
            >
              <button
                onClick={() => setIsLoginOpen(false)}
                className="absolute right-4 top-4 rounded-full border-2 border-black bg-white p-1 transition hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 text-center">
                <h2 className="text-2xl font-extrabold text-[#1d2a24]">
                  Agent Access
                </h2>
                <p className="mt-1 text-sm font-medium text-[#405046]">
                  Enter your credentials to continue
                </p>
              </div>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold uppercase text-[#1d2a24]">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="agent@cipher-sleuth.com"
                    className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-[#e2b300] focus:ring-2 focus:ring-[#e2b300]/20"
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold uppercase text-[#1d2a24]">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-[#e2b300] focus:ring-2 focus:ring-[#e2b300]/20"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-6 w-full rounded-xl border-2 border-black bg-[#1f2937] py-3 text-sm font-bold uppercase text-white shadow-[4px_4px_0_#000] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000]"
                >
                  Authenticate
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
