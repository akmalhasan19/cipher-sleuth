import { describe, expect, it, vi } from "vitest";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

type MockInvestigation = {
  id: string;
  fileHashSha256: string;
  filenameOriginal: string;
  filenameNormalized: string;
  mimeType: string;
  fileSizeBytes: number;
  finalTrustScore: number;
  verdict: "verified" | "suspicious" | "manipulated";
  reportText: string;
  generatedAt: string;
  agentResults: unknown[];
  trustScoreBreakdown: unknown;
  orchestrator: {
    mode: "llm" | "heuristic-fallback";
    provider: "gemini" | "openai" | "internal";
    model: string;
    reportText: string;
    riskSignals: string[];
    recommendedVerdict: "verified" | "suspicious" | "manipulated";
  };
  deterministicSummary: string;
};

const duplicateStore = new Map<string, MockInvestigation>();

vi.mock("@/app/lib/db/investigation-ledger", () => ({
  findInvestigationByHash: vi.fn(async (fileHashSha256: string) => {
    const investigation = duplicateStore.get(fileHashSha256) ?? null;
    if (!investigation) {
      return { status: "not-found", investigation: null, errorMessage: null };
    }

    return { status: "found", investigation, errorMessage: null };
  }),
  persistInvestigation: vi.fn(async (input: {
    fileHashSha256: string;
    filenameOriginal: string;
    filenameNormalized: string;
    mimeType: string;
    fileSizeBytes: number;
    finalTrustScore: number;
    verdict: "verified" | "suspicious" | "manipulated";
    reportText: string;
    generatedAt: string;
    agentResults: unknown[];
    trustScoreBreakdown: unknown;
    orchestrator: {
      mode: "llm" | "heuristic-fallback";
      provider: "gemini" | "openai" | "internal";
      model: string;
      reportText: string;
      riskSignals: string[];
      recommendedVerdict: "verified" | "suspicious" | "manipulated";
    };
    deterministicSummary: string;
  }) => {
    const investigation: MockInvestigation = {
      id: `mock-investigation-${duplicateStore.size + 1}`,
      fileHashSha256: input.fileHashSha256,
      filenameOriginal: input.filenameOriginal,
      filenameNormalized: input.filenameNormalized,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      finalTrustScore: input.finalTrustScore,
      verdict: input.verdict,
      reportText: input.reportText,
      generatedAt: input.generatedAt,
      agentResults: input.agentResults,
      trustScoreBreakdown: input.trustScoreBreakdown,
      orchestrator: input.orchestrator,
      deterministicSummary: input.deterministicSummary,
    };

    duplicateStore.set(input.fileHashSha256, investigation);

    return { status: "stored", investigation, errorMessage: null };
  }),
}));

describe("POST /api/analyze duplicate detection", () => {
  it("returns source cache on second identical upload", async () => {
    duplicateStore.clear();
    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile("duplicate.png", "image/png", "same-hash-content");

    const firstResponse = await POST(createAnalyzeRequest(file));
    const firstPayload = (await firstResponse.json()) as {
      ok: boolean;
      source: string;
      fileHashSha256: string;
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.ok).toBe(true);
    expect(firstPayload.source).toBe("computed");

    const secondResponse = await POST(createAnalyzeRequest(file));
    const secondPayload = (await secondResponse.json()) as {
      ok: boolean;
      source: string;
      fileHashSha256: string;
      database: { persist: { status: string } };
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.source).toBe("cache");
    expect(secondPayload.fileHashSha256).toBe(firstPayload.fileHashSha256);
    expect(secondPayload.database.persist.status).toBe("skipped-cache-hit");
  });
});
