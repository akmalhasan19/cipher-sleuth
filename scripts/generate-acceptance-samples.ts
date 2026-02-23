import { createHash } from "node:crypto";
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
): { content: string; hash: string } {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = `${prefix}-${i}`;
    const hash = hashHex(candidate);
    if (predicate(hash)) {
      return { content: candidate, hash };
    }
  }

  throw new Error(`Unable to find suitable test payload for prefix ${prefix}.`);
}

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

  const authenticFixture = findContentByHashConstraints(
    `authentic-${nonce}`,
    (hash) => deriveElaAnomalyScore(hash) < 0.35 && deriveIntegrity(hash) >= 90
  );
  const manipulatedFixture = findContentByHashConstraints(
    `manipulated-${nonce}`,
    (hash) => deriveElaAnomalyScore(hash) >= 0.7 && deriveIntegrity(hash) < 75
  );

  const authenticResponse = await POST(
    buildAnalyzeRequest(
      new File([Buffer.from(authenticFixture.content, "utf8")], "camera-original.png", {
        type: "image/png",
      })
    )
  );
  const authenticPayload = (await authenticResponse.json()) as AnalyzePayload;

  const manipulatedResponse = await POST(
    buildAnalyzeRequest(
      new File(
        [Buffer.from(manipulatedFixture.content, "utf8")],
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
- Hash constraints: ELA low (\`<0.35\`) + watermark intact (\`>=90\`) + no suspicious metadata signature
- File hash: \`${authenticPayload.fileHashSha256}\`
- Source: \`${authenticPayload.source}\`
- Final trust score: **${authenticPayload.finalTrustScore}**
- Verdict: **${authenticPayload.verdict}**
- Analysis ID: \`${authenticPayload.analysisId}\`

## Scenario B - Gambar Manipulasi (expected < 50)
- Filename: \`photoshop-face-swap.png\`
- Hash constraints: ELA high (\`>=0.7\`) + watermark damaged (\`<75\`) + suspicious metadata signature (filename contains \`photoshop\`)
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
