import { describe, expect, it } from "vitest";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

describe("Manual acceptance scenarios via API", () => {
  it("returns high score for authentic sample and low score for manipulated sample", async () => {
    const { POST } = await import("@/app/api/analyze/route");

    const nonce = Date.now();
    const authenticContent = `camera-shot-${nonce}`;
    const manipulatedContent = `deepfake-edit-${nonce}`;

    const authenticResponse = await POST(
      createAnalyzeRequest(
        createImageFile("camera-original.png", "image/png", authenticContent)
      )
    );
    const authenticPayload = (await authenticResponse.json()) as {
      ok: boolean;
      source: string;
      finalTrustScore: number;
      verdict: string;
    };

    expect(authenticResponse.status).toBe(200);
    expect(authenticPayload.ok).toBe(true);
    expect(authenticPayload.source).toBe("computed");
    expect(authenticPayload.finalTrustScore).toBeGreaterThanOrEqual(90);
    expect(authenticPayload.verdict).toBe("verified");

    const manipulatedResponse = await POST(
      createAnalyzeRequest(
        createImageFile(
          "photoshop-face-swap.png",
          "image/png",
          manipulatedContent
        )
      )
    );
    const manipulatedPayload = (await manipulatedResponse.json()) as {
      ok: boolean;
      source: string;
      finalTrustScore: number;
      verdict: string;
    };

    expect(manipulatedResponse.status).toBe(200);
    expect(manipulatedPayload.ok).toBe(true);
    expect(manipulatedPayload.source).toBe("computed");
    expect(manipulatedPayload.finalTrustScore).toBeLessThan(50);
    expect(manipulatedPayload.verdict).toBe("manipulated");
  });
});
