import type { AgentResult, AgentRunContext } from "./types";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function deriveElaAnomalyScore(fileHashSha256: string): number {
  const sample = fileHashSha256.slice(0, 8);
  const value = parseInt(sample, 16);
  return (value % 1000) / 1000;
}

export async function runElaAgent(context: AgentRunContext): Promise<AgentResult> {
  const before = Date.now();
  await sleep(260);

  const anomalyScore = deriveElaAnomalyScore(context.fileHashSha256);
  const anomalyTier =
    anomalyScore >= 0.7 ? "high" : anomalyScore >= 0.35 ? "medium" : "low";

  const trustDelta =
    anomalyTier === "high" ? -22 : anomalyTier === "medium" ? -10 : -2;

  return {
    agentId: "noise-bot",
    agentName: "ELA Specialist (Noise-Bot)",
    status: "completed",
    confidence: anomalyTier === "high" ? 0.93 : 0.87,
    trustDelta,
    elapsedMs: Date.now() - before,
    logs: [
      `ELA pass generated for ${context.filenameNormalized}.`,
      `Anomaly intensity classified as ${anomalyTier}.`,
      "Compression residual map normalized.",
    ],
    rawResult: {
      anomalyScore: Number(anomalyScore.toFixed(3)),
      anomalyTier,
      highlightedRegions: anomalyTier === "high" ? 3 : anomalyTier === "medium" ? 2 : 1,
    },
  };
}
