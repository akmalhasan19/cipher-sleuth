import { describe, expect, it } from "vitest";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

describe("POST /api/analyze integration", () => {
  it.each([
    { name: "sample.png", mimeType: "image/png", content: "png-payload-1" },
    { name: "sample.jpg", mimeType: "image/jpeg", content: "jpg-payload-1" },
  ])("accepts valid $name upload", async ({ name, mimeType, content }) => {
    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile(name, mimeType, content);

    const response = await POST(createAnalyzeRequest(file));
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      analysisId: string;
      finalTrustScore: number;
      verdict: string;
      fileHashSha256: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("computed");
    expect(payload.analysisId).toMatch(/^analysis_/);
    expect(payload.finalTrustScore).toBeGreaterThanOrEqual(0);
    expect(payload.finalTrustScore).toBeLessThanOrEqual(100);
    expect(payload.verdict).toMatch(/^(verified|suspicious|manipulated)$/);
    expect(payload.fileHashSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("processes payload <=5MB without timeout", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const file = new File([new Uint8Array(4 * 1024 * 1024)], "performance.png", {
      type: "image/png",
    });

    const startedAt = Date.now();
    const response = await POST(createAnalyzeRequest(file));
    const elapsedMs = Date.now() - startedAt;
    const payload = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(elapsedMs).toBeLessThan(45_000);
  });
});

describe("GET /api/report/[analysisId]/pdf integration", () => {
  it("returns application/pdf for a valid analysisId", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const guestCookie =
      "cipher_sleuth_guest_id=guest-report-test; cipher_sleuth_guest_used_count=0";
    const analyzeFile = createImageFile(
      "report-target.png",
      "image/png",
      "report-content"
    );

    const analyzeResponse = await POST(createAnalyzeRequest(analyzeFile, guestCookie));
    const analyzePayload = (await analyzeResponse.json()) as {
      ok: boolean;
      analysisId: string;
    };

    expect(analyzeResponse.status).toBe(200);
    expect(analyzePayload.ok).toBe(true);

    const { GET } = await import("@/app/api/report/[analysisId]/pdf/route");
    const reportResponse = await GET(
      new Request(`http://localhost/api/report/${analyzePayload.analysisId}/pdf`, {
        headers: new Headers({
          cookie: "cipher_sleuth_guest_id=guest-report-test",
        }),
      }),
      { params: Promise.resolve({ analysisId: analyzePayload.analysisId }) }
    );

    expect(reportResponse.status).toBe(200);
    expect(reportResponse.headers.get("content-type")).toContain("application/pdf");

    const pdfBytes = new Uint8Array(await reportResponse.arrayBuffer());
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
