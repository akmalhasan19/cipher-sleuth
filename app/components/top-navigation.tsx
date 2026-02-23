"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const navItems = ["Features", "Case Studies", "API", "Pricing"];

export function TopNavigation() {
  return (
    <header className="static px-4 pt-4 md:px-8" style={{ position: "static" }}>
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
          <a
            href="#"
            className="hidden text-sm font-semibold text-[#405046] md:inline-block"
          >
            Login
          </a>
          <motion.a
            href="#"
            whileHover={{ y: -2, x: -2 }}
            whileTap={{ y: 0, x: 0 }}
            className="border-2 border-black bg-[#1f2937] px-3 py-1.5 md:px-5 text-xs md:text-sm font-bold text-white shadow-[2px_2px_0_#000] md:shadow-[3px_3px_0_#000]"
          >
            Start Investigation
          </motion.a>
        </div>
      </nav>
    </header>
  );
}
