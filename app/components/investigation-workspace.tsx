"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Database, ShieldCheck, Sparkles, Terminal } from "lucide-react";

const logs = [
  "[10:21:11] orchestrator booted.",
  "[10:21:12] exif-bot loaded metadata signatures.",
  "[10:21:13] noise-bot running ELA residual scan.",
  "[10:21:14] dwt-svd bot checking integrity map.",
  "[10:21:15] consensus model assembled final score.",
];

const badges = [
  {
    icon: Database,
    name: "Metadata Investigator (Exif-Bot)",
    color: "bg-[#00d4ff]",
  },
  {
    icon: Sparkles,
    name: "ELA Specialist (Noise-Bot)",
    color: "bg-[#ff3db8] text-white",
  },
  {
    icon: ShieldCheck,
    name: "Integrity Guard (DWT-SVD Bot)",
    color: "bg-[#ffeb3b]",
  },
];

export function InvestigationWorkspace() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const zoneStyle = useMemo(
    () =>
      isDragOver
        ? "bg-[#00d4ff] shadow-[10px_10px_0_#000]"
        : "bg-white shadow-[10px_10px_0_#000]",
    [isDragOver]
  );

  return (
    <section className="space-y-4 rounded-3xl border-4 border-black bg-[#ffeb3b] p-4 shadow-[10px_10px_0_#000] md:p-6">
      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <span
            key={badge.name}
            className={`inline-flex items-center gap-2 rounded-xl border-4 border-black px-3 py-2 text-xs font-bold uppercase shadow-[4px_4px_0_#000] ${badge.color}`}
          >
            <badge.icon className="h-3.5 w-3.5" />
            {badge.name}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label
          className={`rounded-2xl border-4 border-black p-7 text-center transition ${zoneStyle}`}
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
              setFileName(droppedFile.name);
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
                setFileName(selectedFile.name);
              }
            }}
          />
          <p className="text-3xl font-extrabold uppercase leading-none">Drop Evidence</p>
          <p className="mx-auto mt-3 max-w-md text-sm font-medium">
            Drag and drop JPG, PNG, or WebP here. This area reacts instantly
            before we pass the file into the orchestrator.
          </p>
          <p className="mt-5 inline-flex rounded-lg border-4 border-black bg-black px-3 py-2 text-xs font-bold uppercase text-white">
            {fileName ? `Queued: ${fileName}` : "No file queued"}
          </p>
        </label>

        <div className="rounded-2xl border-4 border-black bg-[#141414] p-5 text-white shadow-[10px_10px_0_#000]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border-4 border-black bg-[#ff3db8] px-3 py-1 text-xs font-bold uppercase">
            <Terminal className="h-4 w-4" />
            Multi-Agent Protocol
          </div>
          <div className="space-y-2 font-mono text-xs">
            {logs.map((log, index) => (
              <motion.p
                key={log}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.14 }}
                className="text-slate-200"
              >
                {log}
              </motion.p>
            ))}
          </div>
          <motion.div
            aria-hidden
            className="mt-5 h-2 w-24 rounded-full border-2 border-black bg-[#00d4ff]"
            animate={{ x: [0, 180, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </section>
  );
}
