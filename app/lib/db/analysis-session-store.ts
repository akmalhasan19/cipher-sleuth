import type { AgentResult } from "../agents/types";
import type { TrustScoreBreakdown, Verdict } from "../scoring/trust-score";
import type { ForensicBreakdown } from "../report/forensic-breakdown";

export type StoredAnalysisRecord = {
  analysisId: string;
  ownerUserId: string | null;
  ownerGuestId: string | null;
  filenameOriginal: string;
  filenameNormalized: string;
  fileHashSha256: string;
  finalTrustScore: number;
  verdict: Verdict;
  trustScoreBreakdown: TrustScoreBreakdown;
  forensicBreakdown: ForensicBreakdown;
  generatedAt: string;
  reportText: string;
  agentResults: AgentResult[];
};

type AnalysisStore = Map<string, StoredAnalysisRecord>;

declare global {
  var __cipherSleuthAnalysisStore: AnalysisStore | undefined;
}

function getStore(): AnalysisStore {
  if (!globalThis.__cipherSleuthAnalysisStore) {
    globalThis.__cipherSleuthAnalysisStore = new Map<string, StoredAnalysisRecord>();
  }

  return globalThis.__cipherSleuthAnalysisStore;
}

export function saveAnalysisRecord(record: StoredAnalysisRecord): void {
  getStore().set(record.analysisId, record);
}

export function getAnalysisRecord(
  analysisId: string
): StoredAnalysisRecord | null {
  return getStore().get(analysisId) ?? null;
}
