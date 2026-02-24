import type { AgentId } from "../agents/types";

export const SCORING_MODEL_VERSION = "weighted-deterministic-v2" as const;

export type ScoringWeights = Record<AgentId, number>;
export type ScoringCalibrationMode = "balanced" | "strict";

export type ScoringThresholds = {
  verifiedMin: number;
  suspiciousMin: number;
};

export type ScoringCalibrationPreset = {
  mode: ScoringCalibrationMode;
  model: typeof SCORING_MODEL_VERSION;
  maxPenaltyPerAgent: number;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
  penaltyScales: ScoringWeights;
  stage2FusionWeight: number;
};

export const SCORING_CALIBRATION_TABLE: Record<
  ScoringCalibrationMode,
  ScoringCalibrationPreset
> = {
  balanced: {
    mode: "balanced",
    model: SCORING_MODEL_VERSION,
    maxPenaltyPerAgent: 25,
    weights: {
      "exif-bot": 0.3,
      "noise-bot": 0.45,
      "dwt-svd-bot": 0.25,
    },
    thresholds: {
      verifiedMin: 90,
      suspiciousMin: 50,
    },
    penaltyScales: {
      "exif-bot": 1,
      "noise-bot": 1,
      "dwt-svd-bot": 1,
    },
    stage2FusionWeight: 0.25,
  },
  strict: {
    mode: "strict",
    model: SCORING_MODEL_VERSION,
    maxPenaltyPerAgent: 22,
    weights: {
      "exif-bot": 0.25,
      "noise-bot": 0.5,
      "dwt-svd-bot": 0.25,
    },
    thresholds: {
      verifiedMin: 94,
      suspiciousMin: 60,
    },
    penaltyScales: {
      "exif-bot": 1.1,
      "noise-bot": 1.2,
      "dwt-svd-bot": 1.15,
    },
    stage2FusionWeight: 0.35,
  },
};

export function getScoringConfig(
  mode: ScoringCalibrationMode = "balanced"
): ScoringCalibrationPreset {
  return SCORING_CALIBRATION_TABLE[mode];
}

export const SCORING_CONFIG = getScoringConfig("balanced");
