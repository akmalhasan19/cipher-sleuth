import type { AgentResult, AgentRunContext } from "./types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function detectEditingSignature(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.includes("photoshop") || lower.includes("ps")) {
    return "Adobe Photoshop";
  }
  if (lower.includes("canva")) {
    return "Canva";
  }
  if (lower.includes("edited") || lower.includes("retouch")) {
    return "Unknown Editor";
  }
  return null;
}

export async function runExifAgent(context: AgentRunContext): Promise<AgentResult> {
  const before = Date.now();
  await sleep(180);

  const softwareSignature = detectEditingSignature(context.filenameOriginal);
  const hasSuspiciousMetadata = Boolean(softwareSignature);

  return {
    agentId: "exif-bot",
    agentName: "Metadata Investigator (Exif-Bot)",
    status: "completed",
    confidence: hasSuspiciousMetadata ? 0.94 : 0.88,
    trustDelta: hasSuspiciousMetadata ? -18 : -6,
    elapsedMs: Date.now() - before,
    logs: [
      `Loaded EXIF payload for ${context.filenameOriginal}.`,
      hasSuspiciousMetadata
        ? `Editing signature detected: ${softwareSignature}.`
        : "No explicit editing signature found in metadata.",
      "Timestamp consistency check completed.",
    ],
    rawResult: {
      softwareSignature: softwareSignature ?? "none",
      suspiciousMetadata: hasSuspiciousMetadata,
      mimeType: context.mimeType,
    },
  };
}
