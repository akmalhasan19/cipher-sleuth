import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runAllAgents } from "@/app/lib/agents/run-all-agents";
import type { AgentResult } from "@/app/lib/agents/types";
import { saveAnalysisRecord } from "@/app/lib/db/analysis-session-store";
import { storeEvidenceAssetIfLoggedIn } from "@/app/lib/db/evidence-storage";
import {
  buildDownloadableReportText,
  buildReportSummary,
} from "@/app/lib/report/build-report";
import { buildForensicBreakdown } from "@/app/lib/report/forensic-breakdown";
import { runOrchestratorSynthesis } from "@/app/lib/report/llm-orchestrator";
import { SCORING_CONFIG } from "@/app/lib/scoring/scoring-config";
import { computeTrustScore } from "@/app/lib/scoring/trust-score";
import type { Verdict } from "@/app/lib/scoring/trust-score";
import {
  jsonAnalyzeSchema,
  resolveAccessContext,
  validateAndNormalizeUpload,
} from "@/app/lib/validation/analyze-request";
import { getAppEnv } from "@/app/lib/validation/env";

export const runtime = "nodejs";

function toVerdictLabel(verdict: Verdict): string {
  if (verdict === "verified") {
    return "Likely Authentic";
  }
  if (verdict === "suspicious") {
    return "Needs Manual Review";
  }
  return "Likely Manipulated";
}

function buildGuestLimitResponse() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Guest usage limit reached. Please log in to continue analyzing and storing evidence assets.",
    },
    { status: 403 }
  );
}

function buildValidationErrorResponse(errorMessage: string) {
  if (errorMessage === "FILE_TOO_LARGE") {
    return NextResponse.json(
      { ok: false, error: "File exceeds maximum size limit." },
      { status: 413 }
    );
  }

  if (errorMessage === "UNSUPPORTED_FILE_TYPE") {
    return NextResponse.json(
      { ok: false, error: "Unsupported file type. Use JPG, JPEG, PNG, or WEBP." },
      { status: 415 }
    );
  }

  return NextResponse.json({ ok: false, error: errorMessage }, { status: 400 });
}

function sampleAgentResults(): AgentResult[] {
  return [
    {
      agentId: "exif-bot",
      agentName: "Metadata Investigator (Exif-Bot)",
      status: "completed",
      confidence: 0.89,
      trustDelta: -8,
      elapsedMs: 180,
      logs: ["Sample EXIF scan finished."],
      rawResult: { softwareSignature: "none", suspiciousMetadata: false },
    },
    {
      agentId: "noise-bot",
      agentName: "ELA Specialist (Noise-Bot)",
      status: "completed",
      confidence: 0.87,
      trustDelta: -10,
      elapsedMs: 260,
      logs: ["Sample ELA scan finished."],
      rawResult: { anomalyScore: 0.43, anomalyTier: "medium" },
    },
    {
      agentId: "dwt-svd-bot",
      agentName: "Integrity Guard (DWT-SVD Bot)",
      status: "completed",
      confidence: 0.84,
      trustDelta: -7,
      elapsedMs: 220,
      logs: ["Sample DWT-SVD verification finished."],
      rawResult: { watermarkIntegrity: 88, watermarkStatus: "partially-intact" },
    },
  ];
}

export async function GET() {
  const env = getAppEnv();
  const agentResults = sampleAgentResults();
  const score = computeTrustScore(agentResults);
  const verdictLabel = toVerdictLabel(score.verdict);
  const orchestration = await runOrchestratorSynthesis(
    {
      analysisId: "sample-analysis",
      filenameOriginal: "sample-evidence.jpg",
      fileHashSha256: "sample-hash",
      finalTrustScore: score.finalTrustScore,
      verdict: score.verdict,
      verdictLabel,
      agentResults,
    },
    env
  );
  const forensicBreakdown = buildForensicBreakdown({
    analysisId: "sample-analysis",
    generatedAt: new Date().toISOString(),
    filenameOriginal: "sample-evidence.jpg",
    fileHashSha256: "sample-hash",
    verdict: score.verdict,
    verdictLabel,
    finalTrustScore: score.finalTrustScore,
    trustScoreBreakdown: score,
    agentResults,
    orchestrator: orchestration,
  });

  return NextResponse.json({
    ok: true,
    message: "Analyze API is running with optional LLM orchestration and fallback.",
    capabilities: {
      llmEnabled: env.ENABLE_LLM_ORCHESTRATOR === "true",
      llmModel: env.OPENAI_MODEL,
      maxUploadMb: env.MAX_UPLOAD_MB,
      guestFreeAnalysisLimit: env.GUEST_FREE_ANALYSIS_LIMIT,
      scoringConfig: SCORING_CONFIG,
    },
    sample: {
      analysisMode:
        orchestration.mode === "llm" ? "llm-orchestrated" : "deterministic-no-ai",
      finalTrustScore: score.finalTrustScore,
      verdict: score.verdict,
      verdictLabel,
      trustScoreBreakdown: score,
      forensicBreakdown,
      reportText: orchestration.reportText,
      riskSignals: orchestration.riskSignals,
      recommendedVerdict: orchestration.recommendedVerdict,
    },
  });
}

export async function POST(request: Request) {
  try {
    const env = getAppEnv();
    const contentType = request.headers.get("content-type") ?? "";

    let uploadedFile: File | null = null;
    let userIdFromBody: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const userId = formData.get("userId");

      if (file instanceof File) {
        uploadedFile = file;
      }
      if (typeof userId === "string") {
        userIdFromBody = userId;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      const parsed = jsonAnalyzeSchema.safeParse(body);
      if (parsed.success) {
        userIdFromBody = parsed.data.userId;
      }
    }

    const access = resolveAccessContext(
      request,
      env.GUEST_FREE_ANALYSIS_LIMIT,
      userIdFromBody
    );
    if (!access.isLoggedIn && access.guestLimitUsed) {
      return buildGuestLimitResponse();
    }

    if (!uploadedFile) {
      return NextResponse.json(
        { ok: false, error: "No image file provided. Submit multipart/form-data with field 'file'." },
        { status: 400 }
      );
    }

    let validatedUpload;
    try {
      validatedUpload = await validateAndNormalizeUpload(uploadedFile, env.MAX_UPLOAD_MB);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid upload payload.";
      return buildValidationErrorResponse(message);
    }

    const analysisId = `analysis_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const generatedAt = new Date().toISOString();

    const agentResults = await runAllAgents({
      filenameOriginal: validatedUpload.filenameOriginal,
      filenameNormalized: validatedUpload.filenameNormalized,
      mimeType: validatedUpload.mimeType,
      fileSizeBytes: validatedUpload.fileSizeBytes,
      fileHashSha256: validatedUpload.fileHashSha256,
    });
    const score = computeTrustScore(agentResults);
    const verdictLabel = toVerdictLabel(score.verdict);
    const deterministicSummary = buildReportSummary(
      score.verdict,
      score.finalTrustScore,
      agentResults
    );
    const orchestration = await runOrchestratorSynthesis(
      {
        analysisId,
        filenameOriginal: validatedUpload.filenameOriginal,
        fileHashSha256: validatedUpload.fileHashSha256,
        finalTrustScore: score.finalTrustScore,
        verdict: score.verdict,
        verdictLabel,
        agentResults,
      },
      env
    );
    const forensicBreakdown = buildForensicBreakdown({
      analysisId,
      generatedAt,
      filenameOriginal: validatedUpload.filenameOriginal,
      fileHashSha256: validatedUpload.fileHashSha256,
      verdict: score.verdict,
      verdictLabel,
      finalTrustScore: score.finalTrustScore,
      trustScoreBreakdown: score,
      agentResults,
      orchestrator: orchestration,
    });

    const storageResult = await storeEvidenceAssetIfLoggedIn({
      userId: access.userId,
      file: uploadedFile,
      filenameNormalized: validatedUpload.filenameNormalized,
      fileHashSha256: validatedUpload.fileHashSha256,
    });

    const downloadableReport = buildDownloadableReportText({
      analysisId,
      filenameOriginal: validatedUpload.filenameOriginal,
      filenameNormalized: validatedUpload.filenameNormalized,
      fileHashSha256: validatedUpload.fileHashSha256,
      finalTrustScore: score.finalTrustScore,
      verdict: score.verdict,
      trustScoreBreakdown: score,
      generatedAt,
      agentResults,
      isLoggedIn: access.isLoggedIn,
      orchestrator: orchestration,
    });

    saveAnalysisRecord({
      analysisId,
      ownerUserId: access.userId,
      ownerGuestId: access.isLoggedIn ? null : access.guestId,
      filenameOriginal: validatedUpload.filenameOriginal,
      filenameNormalized: validatedUpload.filenameNormalized,
      fileHashSha256: validatedUpload.fileHashSha256,
      finalTrustScore: score.finalTrustScore,
      verdict: score.verdict,
      forensicBreakdown,
      trustScoreBreakdown: score,
      generatedAt,
      reportText: downloadableReport,
      agentResults,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Deterministic orchestration completed.",
      analysisId,
      analysisMode:
        orchestration.mode === "llm" ? "llm-orchestrated" : "deterministic-no-ai",
      source: "computed",
      filenameOriginal: validatedUpload.filenameOriginal,
      filenameNormalized: validatedUpload.filenameNormalized,
      mimeType: validatedUpload.mimeType,
      fileSizeBytes: validatedUpload.fileSizeBytes,
      fileHashSha256: validatedUpload.fileHashSha256,
      finalTrustScore: score.finalTrustScore,
      verdict: score.verdict,
      verdictLabel,
      trustScoreBreakdown: score,
      forensicBreakdown,
      reportSummary: orchestration.reportText,
      deterministicSummary,
      reportText: orchestration.reportText,
      riskSignals: orchestration.riskSignals,
      recommendedVerdict: orchestration.recommendedVerdict,
      orchestrator: orchestration,
      reportDownloadUrl: `/api/report/${analysisId}/pdf`,
      generatedAt,
      agentResults,
      storage: storageResult,
      access: {
        isLoggedIn: access.isLoggedIn,
        guestFreeAnalysisLimit: env.GUEST_FREE_ANALYSIS_LIMIT,
        guestUsageRemaining: access.isLoggedIn
          ? null
          : Math.max(0, env.GUEST_FREE_ANALYSIS_LIMIT - (access.guestUsedCount + 1)),
      },
    });

    if (!access.isLoggedIn) {
      const isProduction = process.env.NODE_ENV === "production";
      response.cookies.set("cipher_sleuth_guest_id", access.guestId, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      response.cookies.set(
        "cipher_sleuth_guest_used_count",
        String(access.guestUsedCount + 1),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        }
      );
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected analysis error";

    return NextResponse.json(
      { ok: false, error: message },
      {
        status: 500,
      }
    );
  }
}
