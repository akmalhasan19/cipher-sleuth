import type { AgentResult } from "../agents/types";
import type { Verdict } from "../scoring/trust-score";

export type OrchestratorInput = {
  analysisId: string;
  filenameOriginal: string;
  fileHashSha256: string;
  finalTrustScore: number;
  verdict: Verdict;
  verdictLabel: string;
  agentResults: AgentResult[];
};

export type OrchestratorSynthesis = {
  mode: "llm" | "heuristic-fallback";
  provider: "gemini" | "openai" | "internal";
  model: string;
  reportText: string;
  riskSignals: string[];
  recommendedVerdict: Verdict;
};
