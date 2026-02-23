import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import type { AgentResult } from "../agents/types";
import { buildReportSummary } from "../report/build-report";
import type { OrchestratorSynthesis } from "../report/orchestrator-types";
import { SCORING_MODEL_VERSION } from "../scoring/scoring-config";
import { computeTrustScore, type TrustScoreBreakdown, type Verdict } from "../scoring/trust-score";
import { getSupabaseAdminClient } from "./supabase-admin";

const INVESTIGATIONS_TABLE = "investigations";
const INVESTIGATION_SELECT_COLUMNS = [
  "id",
  "file_hash_sha256",
  "filename_original",
  "filename_normalized",
  "mime_type",
  "file_size_bytes",
  "final_trust_score",
  "verdict",
  "report_text",
  "agent_results_json",
  "created_at",
].join(",");

const verdictSchema = z.enum(["verified", "suspicious", "manipulated"]);

const agentResultSchema = z.object({
  agentId: z.enum(["exif-bot", "noise-bot", "dwt-svd-bot"]),
  agentName: z.string(),
  status: z.literal("completed"),
  confidence: z.number(),
  trustDelta: z.number(),
  elapsedMs: z.number().int().nonnegative(),
  logs: z.array(z.string()),
  rawResult: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  ),
});

const trustScoreBreakdownSchema = z.object({
  scoringModel: z.literal(SCORING_MODEL_VERSION),
  calibrationMode: z.enum(["balanced", "strict"]).optional(),
  maxPenaltyPerAgent: z.number(),
  weights: z.object({
    "exif-bot": z.number(),
    "noise-bot": z.number(),
    "dwt-svd-bot": z.number(),
  }),
  penaltyScales: z
    .object({
      "exif-bot": z.number(),
      "noise-bot": z.number(),
      "dwt-svd-bot": z.number(),
    })
    .optional(),
  thresholds: z.object({
    verifiedMin: z.number(),
    suspiciousMin: z.number(),
  }),
  perAgent: z.array(
    z.object({
      agentId: z.enum(["exif-bot", "noise-bot", "dwt-svd-bot"]),
      rawPenalty: z.number(),
      normalizedPenalty: z.number(),
      weight: z.number(),
      weightedPenaltyContribution: z.number(),
    })
  ),
  scorePenaltyRaw: z.number(),
  weightedPenaltyRatio: z.number(),
  weightedPenaltyScore: z.number(),
  finalTrustScore: z.number(),
  verdict: verdictSchema,
});

const orchestratorSynthesisSchema = z.object({
  mode: z.enum(["llm", "heuristic-fallback"]),
  provider: z.enum(["gemini", "openai", "internal"]),
  model: z.string(),
  reportText: z.string(),
  riskSignals: z.array(z.string()),
  recommendedVerdict: verdictSchema,
});

const investigationSnapshotSchema = z.object({
  agentResults: z.array(agentResultSchema),
  trustScoreBreakdown: trustScoreBreakdownSchema.optional(),
  orchestrator: orchestratorSynthesisSchema.optional(),
  deterministicSummary: z.string().optional(),
});

const investigationRowSchema = z.object({
  id: z.string().min(1),
  file_hash_sha256: z.string().min(1),
  filename_original: z.string().min(1),
  filename_normalized: z.string().min(1),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().positive(),
  final_trust_score: z.coerce.number().int().min(0).max(100),
  verdict: verdictSchema,
  report_text: z.string(),
  agent_results_json: z.unknown(),
  created_at: z.string().min(1),
});

type InvestigationSnapshot = z.infer<typeof investigationSnapshotSchema>;

type InvestigationRow = z.infer<typeof investigationRowSchema>;

type LookupStatus =
  | "supabase-not-configured"
  | "not-found"
  | "found"
  | "invalid-data"
  | "error";

type StoreStatus =
  | "supabase-not-configured"
  | "stored"
  | "duplicate"
  | "invalid-data"
  | "error";

export type InvestigationRecord = {
  id: string;
  fileHashSha256: string;
  filenameOriginal: string;
  filenameNormalized: string;
  mimeType: string;
  fileSizeBytes: number;
  finalTrustScore: number;
  verdict: Verdict;
  reportText: string;
  generatedAt: string;
  agentResults: AgentResult[];
  trustScoreBreakdown: TrustScoreBreakdown;
  orchestrator: OrchestratorSynthesis;
  deterministicSummary: string;
};

export type FindInvestigationByHashResult = {
  status: LookupStatus;
  investigation: InvestigationRecord | null;
  errorMessage: string | null;
};

export type PersistInvestigationResult = {
  status: StoreStatus;
  investigation: InvestigationRecord | null;
  errorMessage: string | null;
};

type PersistInvestigationInput = {
  fileHashSha256: string;
  filenameOriginal: string;
  filenameNormalized: string;
  mimeType: string;
  fileSizeBytes: number;
  finalTrustScore: number;
  verdict: Verdict;
  reportText: string;
  generatedAt: string;
  agentResults: AgentResult[];
  trustScoreBreakdown: TrustScoreBreakdown;
  orchestrator: OrchestratorSynthesis;
  deterministicSummary: string;
};

function normalizePostgrestError(error: PostgrestError): string {
  const codePart = error.code ? ` (${error.code})` : "";
  return `${error.message}${codePart}`;
}

function toInvestigationRecord(row: InvestigationRow): InvestigationRecord | null {
  const snapshotParsed = investigationSnapshotSchema.safeParse(row.agent_results_json);
  if (!snapshotParsed.success) {
    return null;
  }

  const snapshot: InvestigationSnapshot = snapshotParsed.data;
  const trustScoreBreakdownFromSnapshot =
    snapshot.trustScoreBreakdown as TrustScoreBreakdown | undefined;
  const trustScoreBreakdown =
    trustScoreBreakdownFromSnapshot ?? computeTrustScore(snapshot.agentResults);
  const deterministicSummary =
    snapshot.deterministicSummary ??
    buildReportSummary(row.verdict, row.final_trust_score, snapshot.agentResults);
  const orchestrator: OrchestratorSynthesis = snapshot.orchestrator ?? {
    mode: "heuristic-fallback",
    provider: "internal",
    model: "cache-fallback",
    reportText: deterministicSummary,
    riskSignals: [],
    recommendedVerdict: row.verdict,
  };

  return {
    id: row.id,
    fileHashSha256: row.file_hash_sha256,
    filenameOriginal: row.filename_original,
    filenameNormalized: row.filename_normalized,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    finalTrustScore: row.final_trust_score,
    verdict: row.verdict,
    reportText: row.report_text,
    generatedAt: row.created_at,
    agentResults: snapshot.agentResults,
    trustScoreBreakdown,
    orchestrator,
    deterministicSummary,
  };
}

function parseInvestigationRow(data: unknown): InvestigationRow | null {
  const parsed = investigationRowSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function findInvestigationByHash(
  fileHashSha256: string
): Promise<FindInvestigationByHashResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      status: "supabase-not-configured",
      investigation: null,
      errorMessage: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from(INVESTIGATIONS_TABLE)
      .select(INVESTIGATION_SELECT_COLUMNS)
      .eq("file_hash_sha256", fileHashSha256)
      .maybeSingle();

    if (error) {
      const errorMessage = normalizePostgrestError(error);
      console.error("[investigations] lookup failed:", errorMessage);
      return {
        status: "error",
        investigation: null,
        errorMessage,
      };
    }

    if (!data) {
      return {
        status: "not-found",
        investigation: null,
        errorMessage: null,
      };
    }

    const parsedRow = parseInvestigationRow(data);
    if (!parsedRow) {
      const errorMessage = "Invalid investigations row payload shape.";
      console.error("[investigations] lookup returned invalid row payload.");
      return {
        status: "invalid-data",
        investigation: null,
        errorMessage,
      };
    }

    const investigation = toInvestigationRecord(parsedRow);
    if (!investigation) {
      const errorMessage = "Invalid investigations.agent_results_json payload.";
      console.error("[investigations] lookup returned invalid agent_results_json.");
      return {
        status: "invalid-data",
        investigation: null,
        errorMessage,
      };
    }

    return {
      status: "found",
      investigation,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected database lookup error.";
    console.error("[investigations] lookup crashed:", errorMessage);
    return {
      status: "error",
      investigation: null,
      errorMessage,
    };
  }
}

export async function persistInvestigation(
  input: PersistInvestigationInput
): Promise<PersistInvestigationResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      status: "supabase-not-configured",
      investigation: null,
      errorMessage: null,
    };
  }

  const snapshot: InvestigationSnapshot = {
    agentResults: input.agentResults,
    trustScoreBreakdown: input.trustScoreBreakdown,
    orchestrator: input.orchestrator,
    deterministicSummary: input.deterministicSummary,
  };

  try {
    const { data, error } = await supabase
      .from(INVESTIGATIONS_TABLE)
      .insert({
        file_hash_sha256: input.fileHashSha256,
        filename_original: input.filenameOriginal,
        filename_normalized: input.filenameNormalized,
        mime_type: input.mimeType,
        file_size_bytes: input.fileSizeBytes,
        final_trust_score: input.finalTrustScore,
        verdict: input.verdict,
        report_text: input.reportText,
        agent_results_json: snapshot,
        created_at: input.generatedAt,
      })
      .select(INVESTIGATION_SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        const lookup = await findInvestigationByHash(input.fileHashSha256);
        if (lookup.status === "found") {
          return {
            status: "duplicate",
            investigation: lookup.investigation,
            errorMessage: null,
          };
        }

        return {
          status: "duplicate",
          investigation: null,
          errorMessage: lookup.errorMessage,
        };
      }

      const errorMessage = normalizePostgrestError(error);
      console.error("[investigations] insert failed:", errorMessage);
      return {
        status: "error",
        investigation: null,
        errorMessage,
      };
    }

    const parsedRow = parseInvestigationRow(data);
    if (!parsedRow) {
      const errorMessage = "Invalid investigations row payload shape after insert.";
      console.error("[investigations] insert returned invalid row payload.");
      return {
        status: "invalid-data",
        investigation: null,
        errorMessage,
      };
    }

    const investigation = toInvestigationRecord(parsedRow);
    if (!investigation) {
      const errorMessage =
        "Invalid investigations.agent_results_json payload after insert.";
      console.error("[investigations] insert returned invalid agent_results_json.");
      return {
        status: "invalid-data",
        investigation: null,
        errorMessage,
      };
    }

    return {
      status: "stored",
      investigation,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected database insert error.";
    console.error("[investigations] insert crashed:", errorMessage);
    return {
      status: "error",
      investigation: null,
      errorMessage,
    };
  }
}
