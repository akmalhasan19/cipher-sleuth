import { GoogleGenAI } from "@google/genai";
import type { AgentResult } from "../agents/types";
import type { Verdict } from "../scoring/trust-score";
import type { AppEnv } from "../validation/env";
import { buildOrchestratorPrompt } from "./orchestrator-prompt";
import type {
  OrchestratorInput,
  OrchestratorSynthesis,
} from "./orchestrator-types";

function isVerdict(value: string): value is Verdict {
  return value === "verified" || value === "suspicious" || value === "manipulated";
}

function extractRiskSignals(
  agentResults: AgentResult[],
  finalTrustScore: number
): string[] {
  const signals: string[] = [];

  for (const agent of agentResults) {
    if (agent.agentId === "exif-bot") {
      const suspicious = agent.rawResult.suspiciousMetadata;
      if (suspicious === true) {
        signals.push(
          `Metadata anomaly detected (${String(agent.rawResult.softwareSignature)}).`
        );
      }
    }

    if (agent.agentId === "noise-bot") {
      const tier = String(agent.rawResult.anomalyTier ?? "unknown");
      if (tier === "high" || tier === "medium") {
        signals.push(`ELA anomaly tier is ${tier}.`);
      }
    }

    if (agent.agentId === "dwt-svd-bot") {
      const status = String(agent.rawResult.watermarkStatus ?? "unknown");
      if (status !== "intact") {
        signals.push(`Watermark integrity status is ${status}.`);
      }
    }

    if (agent.agentId === "cfa-bot") {
      const score = Number(agent.rawResult.score ?? 0);
      if (Number.isFinite(score) && score >= 0.45) {
        signals.push(`CFA inconsistency score is elevated (${score.toFixed(3)}).`);
      }
    }

    if (agent.agentId === "mantra-bot") {
      const score = Number(agent.rawResult.score ?? 0);
      if (Number.isFinite(score) && score >= 0.45) {
        signals.push(`Neural splicing detector (ManTra) score is elevated (${score.toFixed(3)}).`);
      }
    }

    if (agent.agentId === "prnu-bot") {
      const score = Number(agent.rawResult.score ?? 0);
      if (Number.isFinite(score) && score >= 0.45) {
        signals.push(`PRNU fingerprint inconsistency score is elevated (${score.toFixed(3)}).`);
      }
    }
  }

  if (signals.length === 0) {
    signals.push("No high-risk forensic anomalies were flagged by deterministic agents.");
  }

  if (finalTrustScore < 50) {
    signals.push("Aggregate trust score falls in high-risk band (<50).");
  } else if (finalTrustScore < 90) {
    signals.push("Aggregate trust score falls in cautionary band (50-89).");
  } else {
    signals.push("Aggregate trust score indicates high authenticity confidence (>=90).");
  }

  return signals;
}

function buildHeuristicFallback(
  input: OrchestratorInput,
  reason: string
): OrchestratorSynthesis {
  const riskSignals = extractRiskSignals(input.agentResults, input.finalTrustScore);

  return {
    mode: "heuristic-fallback",
    provider: "internal",
    model: "deterministic-fallback",
    reportText: [
      "LLM orchestrator is unavailable; fallback synthesis is used.",
      `Deterministic consensus indicates ${input.verdictLabel} with trust score ${input.finalTrustScore}/100.`,
      `Primary risk summary: ${riskSignals[0]}`,
      `Fallback reason: ${reason}.`,
    ].join(" "),
    riskSignals,
    recommendedVerdict: input.verdict,
  };
}

function parseJsonContent(content: string): {
  reportText: string;
  riskSignals: string[];
  recommendedVerdict: Verdict;
} | null {
  let raw = content.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }

  try {
    const parsed = JSON.parse(raw) as {
      reportText?: unknown;
      riskSignals?: unknown;
      recommendedVerdict?: unknown;
    };

    if (typeof parsed.reportText !== "string") {
      return null;
    }
    if (!Array.isArray(parsed.riskSignals)) {
      return null;
    }
    if (typeof parsed.recommendedVerdict !== "string") {
      return null;
    }
    if (!isVerdict(parsed.recommendedVerdict)) {
      return null;
    }

    const riskSignals = parsed.riskSignals
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return {
      reportText: parsed.reportText.trim(),
      riskSignals:
        riskSignals.length > 0
          ? riskSignals
          : ["LLM did not return risk signals; fallback placeholder applied."],
      recommendedVerdict: parsed.recommendedVerdict,
    };
  } catch {
    return null;
  }
}

function resolveGeminiApiKey(env: AppEnv): string | null {
  const explicitGeminiKey = env.GEMINI_API_KEY?.trim();
  if (explicitGeminiKey) {
    return explicitGeminiKey;
  }

  const genericGoogleKey = env.GOOGLE_API_KEY?.trim();
  if (genericGoogleKey) {
    return genericGoogleKey;
  }

  return null;
}

export async function runOrchestratorSynthesis(
  input: OrchestratorInput,
  env: AppEnv
): Promise<OrchestratorSynthesis> {
  const llmEnabled = env.ENABLE_LLM_ORCHESTRATOR === "true";
  if (!llmEnabled) {
    return buildHeuristicFallback(input, "ENABLE_LLM_ORCHESTRATOR is false");
  }

  const geminiApiKey = resolveGeminiApiKey(env);
  if (!geminiApiKey) {
    return buildHeuristicFallback(input, "GEMINI_API_KEY (or GOOGLE_API_KEY) is missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(env.ANALYZE_TIMEOUT_MS, 30000)
  );

  try {
    const prompt = buildOrchestratorPrompt(input);
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a rigorous digital forensics analyst. Output valid JSON only.",
        temperature: 0.2,
        responseMimeType: "application/json",
        abortSignal: controller.signal,
      },
    });

    const content = response.text?.trim() ?? "";
    if (!content) {
      return buildHeuristicFallback(input, "Gemini response content was empty");
    }

    const parsed = parseJsonContent(content);
    if (!parsed) {
      return buildHeuristicFallback(input, "Gemini JSON parse failed");
    }

    return {
      mode: "llm",
      provider: "gemini",
      model: env.GEMINI_MODEL,
      reportText: parsed.reportText,
      riskSignals: parsed.riskSignals,
      recommendedVerdict: parsed.recommendedVerdict,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return buildHeuristicFallback(input, reason);
  } finally {
    clearTimeout(timeout);
  }
}
