import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

const verdictSchema = z.enum(["verified", "suspicious", "manipulated"]);

const analyzePostSuccessSchema = z.object({
  ok: z.literal(true),
  analysisId: z.string().startsWith("analysis_"),
  source: z.enum(["computed", "cache"]),
  filenameOriginal: z.string().min(1),
  filenameNormalized: z.string().regex(/\.webp$/i),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSizeBytes: z.number().int().positive(),
  fileHashSha256: z.string().regex(/^[a-f0-9]{64}$/),
  finalTrustScore: z.number().int().min(0).max(100),
  verdict: verdictSchema,
  verdictLabel: z.string().min(1),
  trustScoreBreakdown: z.object({
    finalTrustScore: z.number().int().min(0).max(100),
    verdict: verdictSchema,
  }),
  forensicBreakdown: z.object({
    analysisId: z.string().startsWith("analysis_"),
    fileHashSha256: z.string().regex(/^[a-f0-9]{64}$/),
    finalTrustScore: z.number().int().min(0).max(100),
    verdict: verdictSchema,
  }),
  reportSummary: z.string().min(1),
  reportDownloadUrl: z.string().regex(/^\/api\/report\/.+\/pdf$/),
  generatedAt: z.string().min(1),
  agentResults: z.array(
    z.object({
      agentId: z.enum(["exif-bot", "noise-bot", "dwt-svd-bot"]),
      status: z.literal("completed"),
      elapsedMs: z.number().int().nonnegative(),
      confidence: z.number(),
      logs: z.array(z.string()),
      rawResult: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    })
  ),
  access: z.object({
    isLoggedIn: z.boolean(),
    guestFreeAnalysisLimit: z.number().int().min(1),
    guestUsageRemaining: z.number().int().min(0).nullable(),
  }),
  database: z.object({
    duplicateDetectionEnabled: z.boolean(),
    lookup: z.object({
      status: z.string().min(1),
      errorMessage: z.string().nullable(),
    }),
    persist: z.object({
      status: z.string().min(1),
      errorMessage: z.string().nullable(),
    }),
  }),
});

const analyzeGetSchema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
  capabilities: z.object({
    llmEnabled: z.boolean(),
    duplicateDetectionEnabled: z.boolean(),
    llmModel: z.string().min(1),
    maxUploadMb: z.number().int().positive(),
    guestFreeAnalysisLimit: z.number().int().min(1),
  }),
  sample: z.object({
    finalTrustScore: z.number().int().min(0).max(100),
    verdict: verdictSchema,
    verdictLabel: z.string().min(1),
    reportText: z.string().min(1),
    riskSignals: z.array(z.string()),
    recommendedVerdict: verdictSchema,
  }),
});

describe("API payload contract checks", () => {
  it("GET /api/analyze returns contract-compliant payload", async () => {
    const { GET } = await import("@/app/api/analyze/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    const parsed = analyzeGetSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("POST /api/analyze returns contract-compliant payload", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile("contract-sample.png", "image/png", "contract-content");

    const response = await POST(createAnalyzeRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    const parsed = analyzePostSuccessSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("GET /api/report/[analysisId] redirects to pdf route", async () => {
    const { GET } = await import("@/app/api/report/[analysisId]/route");
    const response = await GET(
      new Request("http://localhost/api/report/analysis_abc"),
      { params: Promise.resolve({ analysisId: "analysis_abc" }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/api/report/analysis_abc/pdf");
  });
});
