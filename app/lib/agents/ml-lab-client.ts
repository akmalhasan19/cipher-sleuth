export type MlLabInferenceResponse = {
  ok: boolean;
  requestId?: string;
  modelVersion?: string;
  prediction?: {
    label: "authentic" | "manipulated";
    probability: number;
    confidence: number;
  };
  scores?: {
    elaScore: number;
    dwtsvdScore: number;
    fusionScore: number;
  };
  explainability?: {
    topSignals: string[];
    elaHeatmapBase64: string | null;
  };
  timingMs?: number;
  error?: string;
};

export async function callMlLabInference(params: {
  fileBytes: Uint8Array;
  filename: string;
  mimeType: string;
  returnHeatmap?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<MlLabInferenceResponse> {
  const baseUrl = params.baseUrl ?? process.env.ML_LAB_INFERENCE_URL ?? "http://127.0.0.1:8100";
  const timeoutMs = params.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const form = new FormData();
  form.append(
    "file",
    new Blob([params.fileBytes], { type: params.mimeType }),
    params.filename
  );
  form.append("returnHeatmap", String(Boolean(params.returnHeatmap)));

  try {
    const response = await fetch(`${baseUrl}/infer`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const payload = (await response.json()) as MlLabInferenceResponse;
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? `ML lab inference failed with status ${response.status}`,
      };
    }
    return payload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ML lab inference error";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
