import type { AgentId } from "../agents/types";

export const SCORING_MODEL_VERSION = "weighted-deterministic-v2" as const;

export type ScoringWeights = Record<AgentId, number>;

export const SCORING_WEIGHTS: ScoringWeights = {
  "exif-bot": 0.3,
  "noise-bot": 0.45,
  "dwt-svd-bot": 0.25,
};

export const SCORING_THRESHOLDS = {
  verifiedMin: 90,
  suspiciousMin: 50,
} as const;

export const SCORING_CONFIG = {
  model: SCORING_MODEL_VERSION,
  maxPenaltyPerAgent: 25,
  weights: SCORING_WEIGHTS,
  thresholds: SCORING_THRESHOLDS,
} as const;
