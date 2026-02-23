import { writeFileSync } from "node:fs";
import { POST } from "../app/api/analyze/route";

type AnalyzePayload = {
  ok: boolean;
  source: "computed" | "cache";
  analysisId: string;
  fileHashSha256: string;
  finalTrustScore: number;
  verdict: "verified" | "suspicious" | "manipulated";
  generatedAt: string;
};

function buildAnalyzeRequest(file: File): Request {
  const formData = new FormData();
  formData.append("file", file);

  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: formData,
  });
}

async function run() {
  const nonce = Date.now();
  const authenticContent = `camera-shot-${nonce}`;
  const manipulatedContent = `deepfake-edit-${nonce}`;

  const authenticResponse = await POST(
    buildAnalyzeRequest(
      new File([Buffer.from(authenticContent, "utf8")], "camera-original.png", {
        type: "image/png",
      })
    )
  );
  const authenticPayload = (await authenticResponse.json()) as AnalyzePayload;

  const manipulatedResponse = await POST(
    buildAnalyzeRequest(
      new File(
        [Buffer.from(manipulatedContent, "utf8")],
        "photoshop-face-swap.png",
        {
          type: "image/png",
        }
      )
    )
  );
  const manipulatedPayload = (await manipulatedResponse.json()) as AnalyzePayload;

  const markdown = `# Acceptance Sample Results

Generated on: ${new Date().toISOString()}

## Scenario A - Gambar Asli (expected >= 90)
- Filename: \`camera-original.png\`
- Deterministic signals: no editor/tamper hint pada filename + binary signature
- File hash: \`${authenticPayload.fileHashSha256}\`
- Source: \`${authenticPayload.source}\`
- Final trust score: **${authenticPayload.finalTrustScore}**
- Verdict: **${authenticPayload.verdict}**
- Analysis ID: \`${authenticPayload.analysisId}\`

## Scenario B - Gambar Manipulasi (expected < 50)
- Filename: \`photoshop-face-swap.png\`
- Deterministic signals: strong editor/tamper hint (keyword: \`photoshop\`, \`face-swap\`)
- File hash: \`${manipulatedPayload.fileHashSha256}\`
- Source: \`${manipulatedPayload.source}\`
- Final trust score: **${manipulatedPayload.finalTrustScore}**
- Verdict: **${manipulatedPayload.verdict}**
- Analysis ID: \`${manipulatedPayload.analysisId}\`
`;

  writeFileSync("acceptance-sample-results.md", markdown, "utf8");
  process.stdout.write(markdown);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`acceptance sample generation failed: ${message}\n`);
  process.exit(1);
});
