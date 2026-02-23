import { analyzeTrueEla } from "./ela-core";
import type { AgentResult, AgentRunContext } from "./types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type ElaHeuristic = {
  anomalyScore: number;
  anomalyTier: "low" | "medium" | "high";
  highlightedRegions: number;
  trustDelta: number;
  confidence: number;
  rationale: string;
  elaMode: "computed" | "decode-failed" | "encode-failed";
  meanResidual: number;
  p95Residual: number;
  stdResidual: number;
  highResidualRatio: number;
  smoothHighResidualRatio: number;
  largestHotspotRatio: number;
  recompressQuality: number;
  sampleStep: number;
  sampleCount: number;
  imageWidth: number;
  imageHeight: number;
  previewWidth: number;
  previewHeight: number;
  originalPreviewDataUrl: string | null;
  residualPreviewDataUrl: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveElaHeuristic(context: AgentRunContext): ElaHeuristic {
  const ela = analyzeTrueEla(context);
  const signals = context.forensicSignals;
  const matchedKeywords = signals.matchedKeywords.join(", ") || "none";

  let anomalyScore = ela.anomalyScore;
  let rationale = "ELA residual statistics computed from recompression analysis.";

  if (signals.hasVisualStrokeOverlayHint) {
    anomalyScore = clamp(anomalyScore + 0.22, 0, 1);
    rationale = `ELA boosted by visual overlay signal (overlayScore=${signals.visualOverlayScore.toFixed(3)}).`;
  } else if (signals.hasStrongTamperHint) {
    anomalyScore = clamp(anomalyScore + 0.2, 0, 1);
    rationale = `ELA boosted by strong editor/tamper hints (${matchedKeywords}; source=${signals.hintSource}).`;
  } else if (signals.keywordHits > 0) {
    anomalyScore = clamp(anomalyScore + 0.08, 0, 1);
    rationale = `ELA adjusted by metadata/editor hints (${matchedKeywords}; source=${signals.hintSource}).`;
  }

  if (signals.hasXmpSignature || signals.hasAdobeSignature) {
    anomalyScore = clamp(anomalyScore + 0.05, 0, 1);
  }

  if (ela.mode !== "computed" && anomalyScore < 0.25) {
    anomalyScore = signals.hasVisualStrokeOverlayHint || signals.hasStrongTamperHint
      ? 0.8
      : signals.keywordHits > 0
      ? 0.55
      : 0.2;
    rationale =
      ela.mode === "decode-failed"
        ? "ELA decode failed; score derived from auxiliary forensic signals."
        : "ELA recompression failed; score derived from auxiliary forensic signals.";
  }

  const anomalyTier =
    anomalyScore >= 0.72 ? "high" : anomalyScore >= 0.42 ? "medium" : "low";

  const trustDelta =
    anomalyTier === "high" ? -22 : anomalyTier === "medium" ? -11 : -2;
  const confidence =
    ela.mode === "computed"
      ? anomalyTier === "high"
        ? 0.93
        : anomalyTier === "medium"
        ? 0.86
        : 0.8
      : 0.74;

  return {
    anomalyScore: Number(anomalyScore.toFixed(3)),
    anomalyTier,
    highlightedRegions:
      anomalyTier === "high"
        ? Math.max(3, ela.highlightedRegions)
        : anomalyTier === "medium"
        ? Math.max(2, ela.highlightedRegions)
        : Math.max(1, ela.highlightedRegions),
    trustDelta,
    confidence,
    rationale,
    elaMode: ela.mode,
    meanResidual: ela.meanResidual,
    p95Residual: ela.p95Residual,
    stdResidual: ela.stdResidual,
    highResidualRatio: ela.highResidualRatio,
    smoothHighResidualRatio: ela.smoothHighResidualRatio,
    largestHotspotRatio: ela.largestHotspotRatio,
    recompressQuality: ela.recompressQuality,
    sampleStep: ela.sampleStep,
    sampleCount: ela.sampleCount,
    imageWidth: ela.width,
    imageHeight: ela.height,
    previewWidth: ela.previewWidth,
    previewHeight: ela.previewHeight,
    originalPreviewDataUrl: ela.originalPreviewDataUrl,
    residualPreviewDataUrl: ela.residualPreviewDataUrl,
  };
}

export async function runElaAgent(context: AgentRunContext): Promise<AgentResult> {
  const before = Date.now();
  await sleep(260);

  const heuristic = deriveElaHeuristic(context);

  return {
    agentId: "noise-bot",
    agentName: "ELA Specialist (Noise-Bot)",
    status: "completed",
    confidence: heuristic.confidence,
    trustDelta: heuristic.trustDelta,
    elapsedMs: Date.now() - before,
    logs: [
      `ELA recompression pass generated for ${context.filenameNormalized}.`,
      `Anomaly intensity classified as ${heuristic.anomalyTier} (score=${heuristic.anomalyScore}).`,
      `ELA core mode: ${heuristic.elaMode}; sampled ${heuristic.sampleCount} pixels with step ${heuristic.sampleStep}.`,
      heuristic.rationale,
    ],
    rawResult: {
      anomalyScore: heuristic.anomalyScore,
      anomalyTier: heuristic.anomalyTier,
      highlightedRegions: heuristic.highlightedRegions,
      elaMode: heuristic.elaMode,
      recompressQuality: heuristic.recompressQuality,
      imageWidth: heuristic.imageWidth,
      imageHeight: heuristic.imageHeight,
      previewWidth: heuristic.previewWidth,
      previewHeight: heuristic.previewHeight,
      originalPreviewDataUrl: heuristic.originalPreviewDataUrl,
      residualPreviewDataUrl: heuristic.residualPreviewDataUrl,
      sampleStep: heuristic.sampleStep,
      sampleCount: heuristic.sampleCount,
      meanResidual: heuristic.meanResidual,
      stdResidual: heuristic.stdResidual,
      p95Residual: heuristic.p95Residual,
      highResidualRatio: heuristic.highResidualRatio,
      smoothHighResidualRatio: heuristic.smoothHighResidualRatio,
      largestHotspotRatio: heuristic.largestHotspotRatio,
      tamperKeywordHits: context.forensicSignals.keywordHits,
      tamperKeywords: context.forensicSignals.matchedKeywords.join(", ") || "none",
      tamperHintSource: context.forensicSignals.hintSource,
      visualOverlayHint: context.forensicSignals.hasVisualStrokeOverlayHint,
      visualOverlayScore: Number(context.forensicSignals.visualOverlayScore.toFixed(3)),
      visualOverlayEvidence: context.forensicSignals.visualOverlayEvidence,
    },
  };
}
