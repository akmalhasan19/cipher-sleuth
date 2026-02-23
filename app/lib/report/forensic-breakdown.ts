import type { AgentResult } from "../agents/types";
import type { TrustScoreBreakdown, Verdict } from "../scoring/trust-score";
import type { OrchestratorSynthesis } from "./orchestrator-types";

export type ForensicBreakdown = {
  analysisId: string;
  generatedAt: string;
  filenameOriginal: string;
  fileHashSha256: string;
  verdict: Verdict;
  verdictLabel: string;
  finalTrustScore: number;
  trustScoreBreakdown: TrustScoreBreakdown;
  executiveSummary: string;
  technicalFindings: string[];
  agentFindings: Array<{
    agentId: AgentResult["agentId"];
    agentName: string;
    confidence: number;
    trustDelta: number;
    keyFinding: string;
  }>;
  orchestrator: OrchestratorSynthesis;
};

type BreakdownInput = {
  analysisId: string;
  generatedAt: string;
  filenameOriginal: string;
  fileHashSha256: string;
  verdict: Verdict;
  verdictLabel: string;
  finalTrustScore: number;
  trustScoreBreakdown: TrustScoreBreakdown;
  agentResults: AgentResult[];
  orchestrator: OrchestratorSynthesis;
};

function inferKeyFinding(agent: AgentResult): string {
  if (agent.agentId === "exif-bot") {
    return `Software signature: ${String(agent.rawResult.softwareSignature ?? "none")}`;
  }
  if (agent.agentId === "noise-bot") {
    return `ELA anomaly tier: ${String(agent.rawResult.anomalyTier ?? "unknown")}`;
  }
  return `Watermark status: ${String(agent.rawResult.watermarkStatus ?? "unknown")}`;
}

export function buildForensicBreakdown(input: BreakdownInput): ForensicBreakdown {
  const technicalFindings = [
    `Scoring model: ${input.trustScoreBreakdown.scoringModel}.`,
    `Thresholds => verified >= ${input.trustScoreBreakdown.thresholds.verifiedMin}, suspicious >= ${input.trustScoreBreakdown.thresholds.suspiciousMin}.`,
    `Weighted penalty score: ${input.trustScoreBreakdown.weightedPenaltyScore}.`,
    `Orchestrator mode: ${input.orchestrator.mode} (${input.orchestrator.model}).`,
  ];

  return {
    analysisId: input.analysisId,
    generatedAt: input.generatedAt,
    filenameOriginal: input.filenameOriginal,
    fileHashSha256: input.fileHashSha256,
    verdict: input.verdict,
    verdictLabel: input.verdictLabel,
    finalTrustScore: input.finalTrustScore,
    trustScoreBreakdown: input.trustScoreBreakdown,
    executiveSummary: input.orchestrator.reportText,
    technicalFindings,
    agentFindings: input.agentResults.map((agent) => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      confidence: agent.confidence,
      trustDelta: agent.trustDelta,
      keyFinding: inferKeyFinding(agent),
    })),
    orchestrator: input.orchestrator,
  };
}
