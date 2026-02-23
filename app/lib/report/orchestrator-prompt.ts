import type { AgentResult } from "../agents/types";
import type { OrchestratorInput } from "./orchestrator-types";

function simplifyAgent(agent: AgentResult) {
  return {
    agentId: agent.agentId,
    agentName: agent.agentName,
    confidence: agent.confidence,
    trustDelta: agent.trustDelta,
    rawResult: agent.rawResult,
    logs: agent.logs,
  };
}

export function buildOrchestratorPrompt(input: OrchestratorInput): string {
  const payload = {
    analysisId: input.analysisId,
    filenameOriginal: input.filenameOriginal,
    fileHashSha256: input.fileHashSha256,
    finalTrustScore: input.finalTrustScore,
    deterministicVerdict: input.verdict,
    deterministicVerdictLabel: input.verdictLabel,
    agentResults: input.agentResults.map(simplifyAgent),
  };

  return [
    "You are a digital image forensics lead analyst.",
    "Synthesize the agent outputs into a concise investigation narrative.",
    "Return strict JSON only with this schema:",
    '{ "reportText": string, "riskSignals": string[], "recommendedVerdict": "verified" | "suspicious" | "manipulated" }',
    "Rules:",
    "- reportText must be 2-4 sentences, objective and technical.",
    "- riskSignals must list concrete signals derived from provided agent outputs.",
    "- recommendedVerdict must be aligned with the evidence.",
    "- Do not include markdown, code fences, or extra keys.",
    "",
    "Analysis input:",
    JSON.stringify(payload),
  ].join("\n");
}
