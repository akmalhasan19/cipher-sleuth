"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const navItems = ["Features", "Case Studies", "API", "Pricing"];

export function TopNavigation() {
  return (
    <header className="sticky top-4 z-50 px-4 md:px-8">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between border-2 border-black bg-[#e9efea] px-4 shadow-[0_8px_0_#16382b] md:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center border-2 border-black bg-white">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#1d2a24]">
            Asset Sleuth
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
            className="border-2 border-black bg-[#1f2937] px-4 py-1.5 text-sm font-bold text-white shadow-[3px_3px_0_#000] md:px-5"
          >
            Start Investigation
          </motion.a>
        </div>
      </nav>
    </header>
  );
}
