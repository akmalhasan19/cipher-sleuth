import type { AgentResult } from "../agents/types";
import {
  SCORING_CONFIG,
  SCORING_MODEL_VERSION,
  SCORING_THRESHOLDS,
  SCORING_WEIGHTS,
} from "./scoring-config";

export type Verdict = "verified" | "suspicious" | "manipulated";

export type TrustScoreBreakdown = {
  scoringModel: typeof SCORING_MODEL_VERSION;
  maxPenaltyPerAgent: number;
  weights: typeof SCORING_WEIGHTS;
  thresholds: typeof SCORING_THRESHOLDS;
  perAgent: Array<{
    agentId: AgentResult["agentId"];
    rawPenalty: number;
    normalizedPenalty: number;
    weight: number;
    weightedPenaltyContribution: number;
  }>;
  scorePenaltyRaw: number;
  weightedPenaltyRatio: number;
  weightedPenaltyScore: number;
  finalTrustScore: number;
  verdict: Verdict;
};

export function computeTrustScore(agentResults: AgentResult[]): TrustScoreBreakdown {
  const perAgent = agentResults.map((result) => {
    const rawPenalty = Math.max(0, -result.trustDelta);
    const normalizedPenalty = Math.min(
      1,
      rawPenalty / SCORING_CONFIG.maxPenaltyPerAgent
    );
    const weight = SCORING_WEIGHTS[result.agentId] ?? 0;
    const weightedPenaltyContribution = normalizedPenalty * weight;

    return {
      agentId: result.agentId,
      rawPenalty,
      normalizedPenalty: Number(normalizedPenalty.toFixed(4)),
      weight,
      weightedPenaltyContribution: Number(weightedPenaltyContribution.toFixed(4)),
    };
  });

  const scorePenaltyRaw = perAgent.reduce(
    (total, item) => total + item.rawPenalty,
    0
  );
  const weightedPenaltyRatio = Number(
    perAgent
      .reduce((total, item) => total + item.weightedPenaltyContribution, 0)
      .toFixed(4)
  );
  const weightedPenaltyScore = Number((weightedPenaltyRatio * 100).toFixed(2));
  const finalTrustScore = Math.max(
    0,
    Math.min(100, Math.round((1 - weightedPenaltyRatio) * 100))
  );

  const verdict: Verdict =
    finalTrustScore >= SCORING_THRESHOLDS.verifiedMin
      ? "verified"
      : finalTrustScore >= SCORING_THRESHOLDS.suspiciousMin
      ? "suspicious"
      : "manipulated";

  return {
    scoringModel: SCORING_MODEL_VERSION,
    maxPenaltyPerAgent: SCORING_CONFIG.maxPenaltyPerAgent,
    weights: SCORING_WEIGHTS,
    thresholds: SCORING_THRESHOLDS,
    perAgent,
    scorePenaltyRaw,
    weightedPenaltyRatio,
    weightedPenaltyScore,
    finalTrustScore,
    verdict,
  };
}
