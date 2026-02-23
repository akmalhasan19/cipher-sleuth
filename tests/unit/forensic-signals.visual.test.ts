import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { collectForensicSignals } from "@/app/lib/agents/forensic-signals";

function buildPngBytes(withMarkerOverlay: boolean): Uint8Array {
  const width = 240;
  const height = 160;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const baseR = Math.round((x / width) * 55 + 75);
      const baseG = Math.round((y / height) * 45 + 78);
      const baseB = Math.round(((x + y) / (width + height)) * 40 + 70);

      png.data[index] = baseR;
      png.data[index + 1] = baseG;
      png.data[index + 2] = baseB;
      png.data[index + 3] = 255;
    }
  }

  if (withMarkerOverlay) {
    for (let y = 0; y < height; y += 1) {
      const centerX = Math.floor((y / height) * width);
      for (let dx = -5; dx <= 5; dx += 1) {
        const x = centerX + dx;
        if (x < 0 || x >= width) {
          continue;
        }

        const index = (y * width + x) * 4;
        png.data[index] = 215;
        png.data[index + 1] = 25;
        png.data[index + 2] = 25;
        png.data[index + 3] = 255;
      }
    }
  }

  return new Uint8Array(PNG.sync.write(png));
}

describe("collectForensicSignals visual overlay heuristic", () => {
  it("flags marker-like overlay while leaving plain photo-like sample unflagged", () => {
    const clean = collectForensicSignals({
      filenameOriginal: "camera-original.png",
      mimeType: "image/png",
      fileBytes: buildPngBytes(false),
    });
    const marked = collectForensicSignals({
      filenameOriginal: "camera-original.png",
      mimeType: "image/png",
      fileBytes: buildPngBytes(true),
    });

    expect(clean.hasVisualStrokeOverlayHint).toBe(false);
    expect(marked.hasVisualStrokeOverlayHint).toBe(true);
    expect(marked.visualOverlayScore).toBeGreaterThan(clean.visualOverlayScore);
  });
});
