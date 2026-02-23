type TurnstileApiResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileVerificationResult = {
  status:
    | "verified"
    | "missing-token"
    | "secret-missing"
    | "rejected"
    | "request-failed";
  success: boolean;
  errorMessage: string | null;
  errorCodes: string[];
};

type VerifyTurnstileParams = {
  token: string | null | undefined;
  secretKey: string | undefined;
  remoteIp: string | null;
  timeoutMs?: number;
};

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
  params: VerifyTurnstileParams
): Promise<TurnstileVerificationResult> {
  if (!params.secretKey) {
    return {
      status: "secret-missing",
      success: false,
      errorMessage: "TURNSTILE_SECRET_KEY is missing.",
      errorCodes: [],
    };
  }

  if (!params.token?.trim()) {
    return {
      status: "missing-token",
      success: false,
      errorMessage: "Captcha token is required for guest usage.",
      errorCodes: [],
    };
  }

  const body = new URLSearchParams({
    secret: params.secretKey,
    response: params.token.trim(),
  });

  if (params.remoteIp) {
    body.set("remoteip", params.remoteIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 8000);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "request-failed",
        success: false,
        errorMessage: `Turnstile verification HTTP ${response.status}.`,
        errorCodes: [],
      };
    }

    const payload = (await response.json()) as TurnstileApiResponse;
    const errorCodes = payload["error-codes"] ?? [];
    if (payload.success) {
      return {
        status: "verified",
        success: true,
        errorMessage: null,
        errorCodes,
      };
    }

    return {
      status: "rejected",
      success: false,
      errorMessage:
        errorCodes.length > 0
          ? `Turnstile rejected token (${errorCodes.join(", ")}).`
          : "Turnstile rejected token.",
      errorCodes,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Turnstile verification failed: ${error.message}`
        : "Turnstile verification failed.";

    return {
      status: "request-failed",
      success: false,
      errorMessage,
      errorCodes: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}
