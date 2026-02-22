import { NextResponse } from "next/server";

type AgentResult = {
  agentId: "exif-bot" | "noise-bot" | "dwt-svd-bot";
  agentName: string;
  status: "completed";
  confidence: number;
  trustDelta: number;
  elapsedMs: number;
  logs: string[];
};

type AnalysisPayload = {
  analysisId: string;
  filename: string;
  finalTrustScore: number;
  verdict: "Likely Authentic" | "Likely Manipulated";
  generatedAt: string;
  agentResults: AgentResult[];
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function runExifBot(filename: string): Promise<AgentResult> {
  await sleep(380);
  return {
    agentId: "exif-bot",
    agentName: "Metadata Investigator (Exif-Bot)",
    status: "completed",
    confidence: 0.91,
    trustDelta: -6,
    elapsedMs: 380,
    logs: [
      `Loaded EXIF payload for ${filename}.`,
      "Timestamp consistency check: passed.",
      "Camera signature verified against known profiles.",
    ],
  };
}

async function runNoiseBot(filename: string): Promise<AgentResult> {
  await sleep(620);
  return {
    agentId: "noise-bot",
    agentName: "ELA Specialist (Noise-Bot)",
    status: "completed",
    confidence: 0.88,
    trustDelta: -12,
    elapsedMs: 620,
    logs: [
      `ELA pass generated for ${filename}.`,
      "Detected 2 local compression deviations.",
      "Noise-map gradients suggest selective editing.",
    ],
  };
}

async function runDwtSvdBot(filename: string): Promise<AgentResult> {
  await sleep(470);
  return {
    agentId: "dwt-svd-bot",
    agentName: "Integrity Guard (DWT-SVD Bot)",
    status: "completed",
    confidence: 0.86,
    trustDelta: -5,
    elapsedMs: 470,
    logs: [
      `Wavelet transform sequence completed for ${filename}.`,
      "SVD singular values within expected range.",
      "No hard watermark collision detected.",
    ],
  };
}

async function orchestrateAnalysis(filename: string): Promise<AnalysisPayload> {
  const [exifResult, noiseResult, dwtSvdResult] = await Promise.all([
    runExifBot(filename),
    runNoiseBot(filename),
    runDwtSvdBot(filename),
  ]);

  const agentResults = [exifResult, noiseResult, dwtSvdResult];
  const scorePenalty = agentResults.reduce(
    (total, result) => total + Math.abs(result.trustDelta),
    0
  );
  const finalTrustScore = Math.max(1, 100 - scorePenalty);

  return {
    analysisId: `analysis_${Date.now()}`,
    filename,
    finalTrustScore,
    verdict: finalTrustScore >= 70 ? "Likely Authentic" : "Likely Manipulated",
    generatedAt: new Date().toISOString(),
    agentResults,
  };
}

export async function GET() {
  const result = await orchestrateAnalysis("sample-evidence.jpg");
  return NextResponse.json({
    ok: true,
    message: "Mock orchestration finished via GET.",
    ...result,
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let filename = "uploaded-image.jpg";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file instanceof File && file.name) {
        filename = file.name;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      if (typeof body?.filename === "string" && body.filename.trim().length > 0) {
        filename = body.filename.trim();
      }
    }

    const result = await orchestrateAnalysis(filename);

    return NextResponse.json({
      ok: true,
      message: "Mock orchestration finished via POST.",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected analysis error";

    return NextResponse.json(
      { ok: false, error: message },
      {
        status: 500,
      }
    );
  }
}
