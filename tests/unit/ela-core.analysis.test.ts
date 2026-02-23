import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { analyzeTrueEla } from "@/app/lib/agents/ela-core";

function buildSyntheticPng(withTamper: boolean): Uint8Array {
  const width = 320;
  const height = 220;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const baseR = Math.round(45 + (x / width) * 110);
      const baseG = Math.round(52 + (y / height) * 90);
      const baseB = Math.round(48 + ((x + y) / (width + height)) * 85);
      png.data[idx] = baseR;
      png.data[idx + 1] = baseG;
      png.data[idx + 2] = baseB;
      png.data[idx + 3] = 255;
    }
  }

  if (withTamper) {
    for (let y = 36; y < 185; y += 1) {
      const centerX = Math.floor(width * 0.24 + (y % 43));
      for (let dx = -8; dx <= 8; dx += 1) {
        const x = centerX + dx;
        if (x < 0 || x >= width) {
          continue;
        }

        const idx = (y * width + x) * 4;
        png.data[idx] = 230;
        png.data[idx + 1] = 18;
        png.data[idx + 2] = 12;
        png.data[idx + 3] = 255;
      }
    }
  }

  return new Uint8Array(PNG.sync.write(png));
}

describe("analyzeTrueEla", () => {
  it("gives higher anomaly score for visibly tampered image", () => {
    const clean = analyzeTrueEla({
      fileBytes: buildSyntheticPng(false),
      mimeType: "image/png",
    });
    const tampered = analyzeTrueEla({
      fileBytes: buildSyntheticPng(true),
      mimeType: "image/png",
    });

    expect(clean.mode).toBe("computed");
    expect(tampered.mode).toBe("computed");
    expect(tampered.anomalyScore).toBeGreaterThan(clean.anomalyScore);
    expect(tampered.p95Residual).toBeGreaterThan(clean.p95Residual);
    expect(tampered.highResidualRatio).toBeGreaterThan(clean.highResidualRatio);
  });
});
