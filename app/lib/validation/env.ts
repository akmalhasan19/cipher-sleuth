import { z } from "zod";

const envSchema = z.object({
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(5),
  ANALYZE_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  ENABLE_LLM_ORCHESTRATOR: z.enum(["true", "false"]).default("false"),
  ENABLE_DUPLICATE_DETECTION: z.enum(["true", "false"]).default("true"),
  ENABLE_GUEST_CAPTCHA: z.enum(["true", "false"]).default("false"),
  ENABLE_GUEST_IP_RATE_LIMIT: z.enum(["true", "false"]).default("true"),
  GUEST_FREE_ANALYSIS_LIMIT: z.coerce.number().int().min(1).default(1),
  GUEST_IP_DAILY_LIMIT: z.coerce.number().int().min(1).default(15),
  GUEST_IP_HASH_SALT: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("evidence-assets"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getAppEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
