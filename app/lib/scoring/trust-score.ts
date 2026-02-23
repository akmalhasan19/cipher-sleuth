import type { AgentResult } from "../agents/types";
import {
  SCORING_MODEL_VERSION,
  getScoringConfig,
  type ScoringCalibrationMode,
  type ScoringThresholds,
  type ScoringWeights,
} from "./scoring-config";

export type Verdict = "verified" | "suspicious" | "manipulated";

export type TrustScoreBreakdown = {
  scoringModel: typeof SCORING_MODEL_VERSION;
  calibrationMode: ScoringCalibrationMode;
  maxPenaltyPerAgent: number;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
  penaltyScales: ScoringWeights;
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

export function computeTrustScore(
  agentResults: AgentResult[],
  calibrationMode: ScoringCalibrationMode = "balanced"
): TrustScoreBreakdown {
  const scoring = getScoringConfig(calibrationMode);

  const perAgent = agentResults.map((result) => {
    const rawPenalty = Math.max(0, -result.trustDelta);
    const penaltyScale = scoring.penaltyScales[result.agentId] ?? 1;
    const scaledPenalty = rawPenalty * penaltyScale;
    const normalizedPenalty = Math.min(
      1,
      scaledPenalty / scoring.maxPenaltyPerAgent
    );
    const weight = scoring.weights[result.agentId] ?? 0;
    const weightedPenaltyContribution = normalizedPenalty * weight;

    return {
      agentId: result.agentId,
      rawPenalty: Number(scaledPenalty.toFixed(4)),
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
    finalTrustScore >= scoring.thresholds.verifiedMin
      ? "verified"
      : finalTrustScore >= scoring.thresholds.suspiciousMin
      ? "suspicious"
      : "manipulated";

  return {
    scoringModel: SCORING_MODEL_VERSION,
    calibrationMode: scoring.mode,
    maxPenaltyPerAgent: scoring.maxPenaltyPerAgent,
    weights: scoring.weights,
    thresholds: scoring.thresholds,
    penaltyScales: scoring.penaltyScales,
    perAgent,
    scorePenaltyRaw,
    weightedPenaltyRatio,
    weightedPenaltyScore,
    finalTrustScore,
    verdict,
  };
}
