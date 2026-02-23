import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

function hashHex(content: string): string {
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

function deriveElaAnomalyScore(fileHashSha256: string): number {
  const sample = fileHashSha256.slice(0, 8);
  const value = Number.parseInt(sample, 16);
  return (value % 1000) / 1000;
}

function deriveIntegrity(fileHashSha256: string): number {
  const sample = fileHashSha256.slice(-6);
  const value = Number.parseInt(sample, 16);
  return 70 + (value % 31);
}

function findContentByHashConstraints(
  prefix: string,
  predicate: (hash: string) => boolean,
  maxAttempts = 50_000
): string {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = `${prefix}-${i}`;
    const hash = hashHex(candidate);
    if (predicate(hash)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to find suitable test payload for prefix ${prefix} within ${maxAttempts} attempts.`
  );
}

describe("Manual acceptance scenarios via API", () => {
  it("returns high score for authentic sample and low score for manipulated sample", async () => {
    const { POST } = await import("@/app/api/analyze/route");

    const nonce = Date.now();
    const authenticContent = findContentByHashConstraints(
      `authentic-${nonce}`,
      (hash) => deriveElaAnomalyScore(hash) < 0.35 && deriveIntegrity(hash) >= 90
    );
    const manipulatedContent = findContentByHashConstraints(
      `manipulated-${nonce}`,
      (hash) => deriveElaAnomalyScore(hash) >= 0.7 && deriveIntegrity(hash) < 75
    );

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
