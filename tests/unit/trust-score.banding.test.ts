import { describe, expect, it } from "vitest";
import type { AgentId, AgentResult } from "@/app/lib/agents/types";
import { computeTrustScore } from "@/app/lib/scoring/trust-score";

function buildAgentResult(agentId: AgentId, trustDelta: number): AgentResult {
  const agentNameById: Record<AgentId, string> = {
    "exif-bot": "Metadata Investigator (Exif-Bot)",
    "noise-bot": "ELA Specialist (Noise-Bot)",
    "dwt-svd-bot": "Integrity Guard (DWT-SVD Bot)",
  };

  return {
    agentId,
    agentName: agentNameById[agentId],
    status: "completed",
    confidence: 0.9,
    trustDelta,
    elapsedMs: 10,
    logs: [],
    rawResult: {},
  };
}

function buildAgentResults(trustDelta: number): AgentResult[] {
  return [
    buildAgentResult("exif-bot", trustDelta),
    buildAgentResult("noise-bot", trustDelta),
    buildAgentResult("dwt-svd-bot", trustDelta),
  ];
}

describe("computeTrustScore verdict banding", () => {
  it("classifies verified for score 90-100", () => {
    const result = computeTrustScore(buildAgentResults(-2));

    expect(result.finalTrustScore).toBeGreaterThanOrEqual(90);
    expect(result.verdict).toBe("verified");
  });

  it("classifies suspicious for score 50-89", () => {
    const result = computeTrustScore(buildAgentResults(-10));

    expect(result.finalTrustScore).toBeGreaterThanOrEqual(50);
    expect(result.finalTrustScore).toBeLessThan(90);
    expect(result.verdict).toBe("suspicious");
  });

  it("classifies manipulated for score below 50", () => {
    const result = computeTrustScore(buildAgentResults(-25));

    expect(result.finalTrustScore).toBeLessThan(50);
    expect(result.verdict).toBe("manipulated");
  });
});
