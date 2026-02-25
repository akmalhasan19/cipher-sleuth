import type { AgentResult } from "../agents/types";
import { z } from "zod";
import type { TrustScoreBreakdown, Verdict } from "../scoring/trust-score";
import type { ForensicBreakdown } from "../report/forensic-breakdown";
import { getSupabaseAdminClient } from "./supabase-admin";
import type { PostgrestError } from "@supabase/supabase-js";

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

type FindPersistedAnalysisRecordStatus =
  | "supabase-not-configured"
  | "not-found"
  | "found"
  | "invalid-data"
  | "error";

type PersistAnalysisRecordStatus =
  | "supabase-not-configured"
  | "stored"
  | "invalid-data"
  | "error";

export type FindPersistedAnalysisRecordResult = {
  status: FindPersistedAnalysisRecordStatus;
  record: StoredAnalysisRecord | null;
  errorMessage: string | null;
};

export type PersistAnalysisRecordResult = {
  status: PersistAnalysisRecordStatus;
  record: StoredAnalysisRecord | null;
  errorMessage: string | null;
};

const ANALYSIS_SESSIONS_TABLE = "analysis_sessions";
const ANALYSIS_SESSION_SELECT_COLUMNS = [
  "analysis_id",
  "owner_user_id",
  "owner_guest_id",
  "filename_original",
  "filename_normalized",
  "file_hash_sha256",
  "final_trust_score",
  "verdict",
  "trust_score_breakdown_json",
  "forensic_breakdown_json",
  "generated_at",
  "report_text",
  "agent_results_json",
].join(",");

const analysisSessionRowSchema = z.object({
  analysis_id: z.string().min(1),
  owner_user_id: z.string().min(1).nullable(),
  owner_guest_id: z.string().min(1).nullable(),
  filename_original: z.string().min(1),
  filename_normalized: z.string().min(1),
  file_hash_sha256: z.string().min(1),
  final_trust_score: z.coerce.number().int().min(0).max(100),
  verdict: z.enum(["verified", "suspicious", "manipulated"]),
  trust_score_breakdown_json: z.unknown(),
  forensic_breakdown_json: z.unknown(),
  generated_at: z.string().min(1),
  report_text: z.string(),
  agent_results_json: z.unknown(),
});

type AnalysisSessionRow = z.infer<typeof analysisSessionRowSchema>;

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

function normalizePostgrestError(error: PostgrestError): string {
  const codePart = error.code ? ` (${error.code})` : "";
  return `${error.message}${codePart}`;
}

function toPersistedRow(record: StoredAnalysisRecord) {
  return {
    analysis_id: record.analysisId,
    owner_user_id: record.ownerUserId,
    owner_guest_id: record.ownerGuestId,
    filename_original: record.filenameOriginal,
    filename_normalized: record.filenameNormalized,
    file_hash_sha256: record.fileHashSha256,
    final_trust_score: record.finalTrustScore,
    verdict: record.verdict,
    trust_score_breakdown_json: record.trustScoreBreakdown,
    forensic_breakdown_json: record.forensicBreakdown,
    generated_at: record.generatedAt,
    report_text: record.reportText,
    agent_results_json: record.agentResults,
  };
}

function parsePersistedRecord(data: unknown): StoredAnalysisRecord | null {
  const parsed = analysisSessionRowSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  const row: AnalysisSessionRow = parsed.data;
  return {
    analysisId: row.analysis_id,
    ownerUserId: row.owner_user_id,
    ownerGuestId: row.owner_guest_id,
    filenameOriginal: row.filename_original,
    filenameNormalized: row.filename_normalized,
    fileHashSha256: row.file_hash_sha256,
    finalTrustScore: row.final_trust_score,
    verdict: row.verdict as Verdict,
    trustScoreBreakdown:
      row.trust_score_breakdown_json as TrustScoreBreakdown,
    forensicBreakdown: row.forensic_breakdown_json as ForensicBreakdown,
    generatedAt: row.generated_at,
    reportText: row.report_text,
    agentResults: row.agent_results_json as AgentResult[],
  };
}

export async function findPersistedAnalysisRecord(
  analysisId: string
): Promise<FindPersistedAnalysisRecordResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      status: "supabase-not-configured",
      record: null,
      errorMessage: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from(ANALYSIS_SESSIONS_TABLE)
      .select(ANALYSIS_SESSION_SELECT_COLUMNS)
      .eq("analysis_id", analysisId)
      .maybeSingle();

    if (error) {
      const errorMessage = normalizePostgrestError(error);
      console.error("[analysis-sessions] lookup failed:", errorMessage);
      return {
        status: "error",
        record: null,
        errorMessage,
      };
    }

    if (!data) {
      return {
        status: "not-found",
        record: null,
        errorMessage: null,
      };
    }

    const parsedRecord = parsePersistedRecord(data);
    if (!parsedRecord) {
      const errorMessage = "Invalid analysis_sessions row payload shape.";
      console.error("[analysis-sessions] lookup returned invalid row payload.");
      return {
        status: "invalid-data",
        record: null,
        errorMessage,
      };
    }

    return {
      status: "found",
      record: parsedRecord,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected analysis session lookup error.";
    console.error("[analysis-sessions] lookup crashed:", errorMessage);
    return {
      status: "error",
      record: null,
      errorMessage,
    };
  }
}

export async function persistAnalysisRecord(
  record: StoredAnalysisRecord
): Promise<PersistAnalysisRecordResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      status: "supabase-not-configured",
      record: null,
      errorMessage: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from(ANALYSIS_SESSIONS_TABLE)
      .upsert(toPersistedRow(record), { onConflict: "analysis_id" })
      .select(ANALYSIS_SESSION_SELECT_COLUMNS)
      .single();

    if (error) {
      const errorMessage = normalizePostgrestError(error);
      console.error("[analysis-sessions] upsert failed:", errorMessage);
      return {
        status: "error",
        record: null,
        errorMessage,
      };
    }

    const parsedRecord = parsePersistedRecord(data);
    if (!parsedRecord) {
      const errorMessage = "Invalid analysis_sessions row payload shape after upsert.";
      console.error("[analysis-sessions] upsert returned invalid row payload.");
      return {
        status: "invalid-data",
        record: null,
        errorMessage,
      };
    }

    return {
      status: "stored",
      record: parsedRecord,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected analysis session upsert error.";
    console.error("[analysis-sessions] upsert crashed:", errorMessage);
    return {
      status: "error",
      record: null,
      errorMessage,
    };
  }
}
