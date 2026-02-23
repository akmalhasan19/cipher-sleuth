import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnalyzeRequest, createImageFile } from "../utils/request-fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@/app/lib/db/guest-ip-rate-limit");
  vi.doUnmock("@/app/lib/report/llm-orchestrator");
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("Guest protection enforcement", () => {
  it("blocks guest request when captcha is required but token is missing", async () => {
    vi.stubEnv("ENABLE_GUEST_CAPTCHA", "true");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    vi.stubEnv("ENABLE_GUEST_IP_RATE_LIMIT", "false");

    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile("captcha-required.png", "image/png", "payload");

    const response = await POST(createAnalyzeRequest(file));
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      security?: { captcha?: { status: string } };
    };

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("captcha");
    expect(payload.security?.captcha?.status).toBe("missing-token");
  });

  it("returns 429 when guest IP daily quota is exceeded", async () => {
    vi.stubEnv("ENABLE_GUEST_CAPTCHA", "false");
    vi.stubEnv("ENABLE_GUEST_IP_RATE_LIMIT", "true");
    vi.stubEnv("GUEST_IP_DAILY_LIMIT", "15");

    vi.doMock("@/app/lib/db/guest-ip-rate-limit", () => ({
      consumeGuestIpDailyLimit: vi.fn(async () => ({
        status: "blocked",
        allowed: false,
        usedCount: 16,
        remaining: 0,
        limit: 15,
        errorMessage: null,
      })),
    }));

    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile("rate-limited.png", "image/png", "payload");

    const response = await POST(createAnalyzeRequest(file));
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      security?: {
        guestIpRateLimit?: {
          status: string;
          limit: number;
          usedCount: number;
        };
      };
    };

    expect(response.status).toBe(429);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("quota");
    expect(payload.security?.guestIpRateLimit?.status).toBe("blocked");
    expect(payload.security?.guestIpRateLimit?.limit).toBe(15);
    expect(payload.security?.guestIpRateLimit?.usedCount).toBe(16);
  });

  it("forces LLM off for guest even when global LLM toggle is enabled", async () => {
    vi.stubEnv("ENABLE_GUEST_CAPTCHA", "false");
    vi.stubEnv("ENABLE_GUEST_IP_RATE_LIMIT", "false");
    vi.stubEnv("ENABLE_LLM_ORCHESTRATOR", "true");
    vi.stubEnv("OPENAI_API_KEY", "fake-key");

    const orchestratorSpy = vi.fn(
      async (_input: unknown, env: { ENABLE_LLM_ORCHESTRATOR: "true" | "false" }) => ({
        mode: env.ENABLE_LLM_ORCHESTRATOR === "true" ? "llm" : "heuristic-fallback",
        provider: env.ENABLE_LLM_ORCHESTRATOR === "true" ? "openai" : "internal",
        model: "mock-model",
        reportText: "mock report",
        riskSignals: ["mock risk"],
        recommendedVerdict: "suspicious" as const,
      })
    );

    vi.doMock("@/app/lib/report/llm-orchestrator", () => ({
      runOrchestratorSynthesis: orchestratorSpy,
    }));

    const { POST } = await import("@/app/api/analyze/route");
    const file = createImageFile("guest-llm-off.png", "image/png", "payload");

    const response = await POST(createAnalyzeRequest(file));
    const payload = (await response.json()) as {
      ok: boolean;
      analysisMode: string;
      guestProtection?: { llm?: { blockedForGuest: boolean; effectiveEnabled: boolean } };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.analysisMode).toBe("deterministic-no-ai");
    expect(payload.guestProtection?.llm?.blockedForGuest).toBe(true);
    expect(payload.guestProtection?.llm?.effectiveEnabled).toBe(false);

    expect(orchestratorSpy).toHaveBeenCalledTimes(1);
    const envArg = orchestratorSpy.mock.calls[0]?.[1] as
      | { ENABLE_LLM_ORCHESTRATOR: "true" | "false" }
      | undefined;
    expect(envArg?.ENABLE_LLM_ORCHESTRATOR).toBe("false");
  });
});
