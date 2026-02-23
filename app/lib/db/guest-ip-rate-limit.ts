import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "./supabase-admin";

export type GuestIpRateLimitResult = {
  status:
    | "disabled"
    | "allowed"
    | "blocked"
    | "supabase-not-configured"
    | "error";
  allowed: boolean;
  usedCount: number | null;
  remaining: number | null;
  limit: number;
  errorMessage: string | null;
};

type ConsumeGuestIpDailyLimitParams = {
  request: Request;
  enabled: boolean;
  dailyLimit: number;
  hashSalt?: string;
};

type GuestRateLimitRpcRow = {
  request_count: number;
  allowed: boolean;
};

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function hashIp(clientIp: string, hashSalt?: string): string {
  const hash = createHash("sha256");
  hash.update(`${clientIp}|${hashSalt ?? ""}`);
  return hash.digest("hex");
}

export async function consumeGuestIpDailyLimit(
  params: ConsumeGuestIpDailyLimitParams
): Promise<GuestIpRateLimitResult> {
  if (!params.enabled) {
    return {
      status: "disabled",
      allowed: true,
      usedCount: null,
      remaining: null,
      limit: params.dailyLimit,
      errorMessage: null,
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      status: "supabase-not-configured",
      allowed: true,
      usedCount: null,
      remaining: null,
      limit: params.dailyLimit,
      errorMessage: null,
    };
  }

  const clientIp = resolveClientIp(params.request);
  const ipHash = hashIp(clientIp, params.hashSalt);
  const usageDate = new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase.rpc("increment_guest_ip_daily_usage", {
      p_usage_date: usageDate,
      p_ip_hash: ipHash,
      p_limit: params.dailyLimit,
    });

    if (error) {
      const errorMessage = error.code
        ? `${error.message} (${error.code})`
        : error.message;
      console.error("[guest-rate-limit] rpc failed:", errorMessage);
      return {
        status: "error",
        allowed: false,
        usedCount: null,
        remaining: null,
        limit: params.dailyLimit,
        errorMessage,
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | GuestRateLimitRpcRow
      | null
      | undefined;

    if (!row || typeof row.request_count !== "number") {
      const errorMessage = "Invalid guest rate-limit RPC payload.";
      console.error("[guest-rate-limit] invalid rpc payload.");
      return {
        status: "error",
        allowed: false,
        usedCount: null,
        remaining: null,
        limit: params.dailyLimit,
        errorMessage,
      };
    }

    const remaining = Math.max(0, params.dailyLimit - row.request_count);
    return {
      status: row.allowed ? "allowed" : "blocked",
      allowed: row.allowed,
      usedCount: row.request_count,
      remaining,
      limit: params.dailyLimit,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `Guest rate-limit check failed: ${error.message}`
        : "Guest rate-limit check failed.";
    console.error("[guest-rate-limit] unexpected error:", errorMessage);
    return {
      status: "error",
      allowed: false,
      usedCount: null,
      remaining: null,
      limit: params.dailyLimit,
      errorMessage,
    };
  }
}
