import type { AgentResult } from "../agents/types";
import type { TrustScoreBreakdown, Verdict } from "../scoring/trust-score";
import type { OrchestratorSynthesis } from "./orchestrator-types";

type ReportInput = {
  analysisId: string;
  filenameOriginal: string;
  filenameNormalized: string;
  fileHashSha256: string;
  finalTrustScore: number;
  verdict: Verdict;
  trustScoreBreakdown: TrustScoreBreakdown;
  generatedAt: string;
  agentResults: AgentResult[];
  isLoggedIn: boolean;
  orchestrator: OrchestratorSynthesis;
};

function verdictLabel(verdict: Verdict): string {
  if (verdict === "verified") {
    return "Likely Authentic";
  }
  if (verdict === "suspicious") {
    return "Needs Manual Review";
  }
  return "Likely Manipulated";
}

export function buildReportSummary(
  verdict: Verdict,
  finalTrustScore: number,
  agentResults: AgentResult[]
): string {
  const strongestSignal = agentResults.reduce((current, candidate) =>
    Math.abs(candidate.trustDelta) > Math.abs(current.trustDelta)
      ? candidate
      : current
  );

  return [
    "Deterministic synthesis mode active (no AI orchestrator).",
    `Highest risk contributor: ${strongestSignal.agentName} (${strongestSignal.trustDelta}).`,
    `Final verdict: ${verdictLabel(verdict)}.`,
    `Trust score: ${finalTrustScore}/100.`,
  ].join(" ");
}

export function buildDownloadableReportText(input: ReportInput): string {
  const lines = [
    "Cipher Sleuth Forensic Report",
    "============================",
    `Analysis ID: ${input.analysisId}`,
    `Generated At: ${input.generatedAt}`,
    `Original Filename: ${input.filenameOriginal}`,
    `Normalized Filename: ${input.filenameNormalized}`,
    `File Hash (SHA-256): ${input.fileHashSha256}`,
    `Trust Score: ${input.finalTrustScore}/100`,
    `Verdict: ${verdictLabel(input.verdict)}`,
    `Account Type: ${input.isLoggedIn ? "Logged-in" : "Guest"}`,
    `Orchestrator Mode: ${input.orchestrator.mode}`,
    `Orchestrator Model: ${input.orchestrator.model}`,
    "",
    "Scoring Breakdown:",
    `- Model: ${input.trustScoreBreakdown.scoringModel}`,
    `- Thresholds: verified>=${input.trustScoreBreakdown.thresholds.verifiedMin}, suspicious>=${input.trustScoreBreakdown.thresholds.suspiciousMin}`,
    `- Raw Penalty Sum: ${input.trustScoreBreakdown.scorePenaltyRaw}`,
    `- Weighted Penalty: ${input.trustScoreBreakdown.weightedPenaltyScore}`,
    "",
    "Orchestrator Synthesis:",
    input.orchestrator.reportText,
    "",
    "Risk Signals:",
    ...input.orchestrator.riskSignals.map((signal) => `- ${signal}`),
    "",
    "Per-Agent Scoring Contributions:",
    ...input.trustScoreBreakdown.perAgent.map(
      (item) =>
        `- ${item.agentId}: raw=${item.rawPenalty}, normalized=${item.normalizedPenalty}, weight=${item.weight}, weighted=${item.weightedPenaltyContribution}`
    ),
    "",
    "Agent Findings:",
    ...input.agentResults.map(
      (agent) =>
        `- ${agent.agentName}: delta ${agent.trustDelta}, confidence ${agent.confidence}, elapsed ${agent.elapsedMs}ms`
    ),
  ];

  return `${lines.join("\n")}\n`;
}
