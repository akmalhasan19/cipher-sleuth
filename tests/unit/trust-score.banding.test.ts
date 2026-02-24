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

  it("strict mode is more conservative than balanced mode", () => {
    const agentResults = buildAgentResults(-8);
    const balanced = computeTrustScore(agentResults, "balanced");
    const strict = computeTrustScore(agentResults, "strict");

    expect(strict.finalTrustScore).toBeLessThanOrEqual(balanced.finalTrustScore);
    expect(strict.calibrationMode).toBe("strict");
    expect(balanced.calibrationMode).toBe("balanced");
  });

  it("maps stage-2 fusion score into trust scoring", () => {
    const agentResults = buildAgentResults(-2);
    const base = computeTrustScore(agentResults, "balanced");
    const lowFusion = computeTrustScore(agentResults, "balanced", {
      stage2FusionScore: 0,
    });
    const highFusion = computeTrustScore(agentResults, "balanced", {
      stage2FusionScore: 1,
    });

    expect(lowFusion.stage2Fusion.enabled).toBe(true);
    expect(highFusion.stage2Fusion.enabled).toBe(true);
    expect(lowFusion.finalTrustScore).toBeGreaterThan(base.finalTrustScore);
    expect(highFusion.finalTrustScore).toBeLessThan(base.finalTrustScore);
    expect(base.verdict).toBe("verified");
    expect(highFusion.verdict).toBe("suspicious");
  });

  it("ignores invalid stage-2 fusion score inputs", () => {
    const agentResults = buildAgentResults(-8);
    const base = computeTrustScore(agentResults, "balanced");
    const invalid = computeTrustScore(agentResults, "balanced", {
      stage2FusionScore: Number.NaN,
    });

    expect(invalid.finalTrustScore).toBe(base.finalTrustScore);
    expect(invalid.verdict).toBe(base.verdict);
    expect(invalid.stage2Fusion.enabled).toBe(false);
  });
});
