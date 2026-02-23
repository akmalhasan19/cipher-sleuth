import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { AnalysisInput } from "./types";

const MAX_BINARY_SCAN_BYTES = 512 * 1024;
const MAX_ANALYZED_PIXELS = 140_000;
const SEARCHABLE_CHARS = /^[a-z0-9._\-/]+$/;

const EDITOR_KEYWORDS = [
  "photoshop",
  "lightroom",
  "gimp",
  "canva",
  "snapseed",
  "facetune",
  "pixlr",
  "picsart",
  "deepfake",
  "face-swap",
  "faceswap",
  "removebg",
  "polish",
  "magic eraser",
  "background remover",
  "markup",
  "retouch",
  "touchretouch",
  "airbrush",
] as const;

const STRONG_EDITOR_KEYWORDS = new Set([
  "photoshop",
  "lightroom",
  "gimp",
  "canva",
  "deepfake",
  "face-swap",
  "faceswap",
  "facetune",
]);

export type ForensicSignalSnapshot = {
  keywordHits: number;
  matchedKeywords: string[];
  hintSource: "none" | "filename" | "binary" | "both";
  hasStrongTamperHint: boolean;
  hasExifSignature: boolean;
  hasXmpSignature: boolean;
  hasAdobeSignature: boolean;
  isLikelyBinaryImage: boolean;
  hasVisualStrokeOverlayHint: boolean;
  visualOverlayScore: number;
  visualOverlayEvidence: string;
  scannedBytes: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSearchableAscii(bytes: Uint8Array): {
  text: string;
  nonPrintableRatio: number;
} {
  let nonPrintableCount = 0;
  let result = "";

  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) {
      result += String.fromCharCode(byte);
      continue;
    }

    nonPrintableCount += 1;
    result += " ";
  }

  return {
    text: result.toLowerCase(),
    nonPrintableRatio: bytes.length === 0 ? 0 : nonPrintableCount / bytes.length,
  };
}

function normalizeFilename(filename: string): string {
  const lower = filename.toLowerCase();
  return lower
    .split("")
    .map((char) => (SEARCHABLE_CHARS.test(char) ? char : " "))
    .join(" ");
}

function collectKeywordMatches(text: string): string[] {
  const matches = EDITOR_KEYWORDS.filter((keyword) => text.includes(keyword));
  return Array.from(new Set(matches));
}

function hasExifSignature(bytes: Uint8Array): boolean {
  const signature = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // Exif\0\0

  for (let i = 0; i <= bytes.length - signature.length; i += 1) {
    let matched = true;
    for (let j = 0; j < signature.length; j += 1) {
      if (bytes[i + j] !== signature[j]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return true;
    }
  }

  return false;
}

function isPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

type DecodedPixels = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

function decodePixels(
  input: Pick<AnalysisInput, "fileBytes" | "mimeType">
): DecodedPixels | null {
  const mimeType = input.mimeType.toLowerCase();
  const bytes = input.fileBytes;

  try {
    if (mimeType === "image/png" || isPngSignature(bytes)) {
      const parsed = PNG.sync.read(Buffer.from(bytes), { checkCRC: false });
      return {
        width: parsed.width,
        height: parsed.height,
        rgba: new Uint8Array(parsed.data),
      };
    }

    if (mimeType === "image/jpeg" || isJpegSignature(bytes)) {
      const parsed = jpeg.decode(Buffer.from(bytes), { useTArray: true });
      return {
        width: parsed.width,
        height: parsed.height,
        rgba: parsed.data,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function rgbToHsv(r: number, g: number, b: number): {
  saturation: number;
  value: number;
} {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  return {
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
}

type VisualOverlayAnalysis = {
  hasVisualStrokeOverlayHint: boolean;
  visualOverlayScore: number;
  visualOverlayEvidence: string;
};

function analyzeVisualStrokeOverlay(
  input: Pick<AnalysisInput, "fileBytes" | "mimeType">
): VisualOverlayAnalysis {
  const decoded = decodePixels(input);
  if (!decoded || decoded.width < 24 || decoded.height < 24) {
    return {
      hasVisualStrokeOverlayHint: false,
      visualOverlayScore: 0,
      visualOverlayEvidence: "visual-analysis-unavailable",
    };
  }

  const sampledStep = Math.max(
    1,
    Math.ceil(
      Math.sqrt((decoded.width * decoded.height) / MAX_ANALYZED_PIXELS)
    )
  );
  const sampledWidth = Math.ceil(decoded.width / sampledStep);
  const sampledHeight = Math.ceil(decoded.height / sampledStep);
  const sampledCount = sampledWidth * sampledHeight;

  const sampledR = new Uint8Array(sampledCount);
  const sampledG = new Uint8Array(sampledCount);
  const sampledB = new Uint8Array(sampledCount);

  const histogram = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>();

  let sampleIndex = 0;
  for (let y = 0; y < decoded.height; y += sampledStep) {
    for (let x = 0; x < decoded.width; x += sampledStep) {
      const rgbaIndex = (y * decoded.width + x) * 4;
      const alpha = decoded.rgba[rgbaIndex + 3] ?? 255;

      const r = alpha < 8 ? 255 : decoded.rgba[rgbaIndex];
      const g = alpha < 8 ? 255 : decoded.rgba[rgbaIndex + 1];
      const b = alpha < 8 ? 255 : decoded.rgba[rgbaIndex + 2];

      sampledR[sampleIndex] = r;
      sampledG[sampleIndex] = g;
      sampledB[sampleIndex] = b;

      const binKey = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bin = histogram.get(binKey);
      if (bin) {
        bin.count += 1;
        bin.sumR += r;
        bin.sumG += g;
        bin.sumB += b;
      } else {
        histogram.set(binKey, {
          count: 1,
          sumR: r,
          sumG: g,
          sumB: b,
        });
      }

      sampleIndex += 1;
    }
  }

  if (sampleIndex < 400 || histogram.size === 0) {
    return {
      hasVisualStrokeOverlayHint: false,
      visualOverlayScore: 0,
      visualOverlayEvidence: "visual-analysis-insufficient-pixels",
    };
  }

  const topBins = Array.from(histogram.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  let strongestScore = 0;
  let strongestEvidence = "visual-overlay-not-detected";

  for (const [, bin] of topBins) {
    const areaRatio = bin.count / sampleIndex;
    if (areaRatio < 0.004 || areaRatio > 0.28) {
      continue;
    }

    const averageR = Math.round(bin.sumR / bin.count);
    const averageG = Math.round(bin.sumG / bin.count);
    const averageB = Math.round(bin.sumB / bin.count);

    const mask = new Uint8Array(sampleIndex);
    let maskCount = 0;
    let totalDistance = 0;

    for (let i = 0; i < sampleIndex; i += 1) {
      const colorDistance =
        Math.abs(sampledR[i] - averageR) +
        Math.abs(sampledG[i] - averageG) +
        Math.abs(sampledB[i] - averageB);
      if (colorDistance <= 24) {
        mask[i] = 1;
        maskCount += 1;
        totalDistance += colorDistance;
      }
    }

    if (maskCount < 80) {
      continue;
    }

    let edgeCount = 0;
    for (let y = 0; y < sampledHeight; y += 1) {
      for (let x = 0; x < sampledWidth; x += 1) {
        const pixelIndex = y * sampledWidth + x;
        if (mask[pixelIndex] !== 1) {
          continue;
        }

        const touchesOutside =
          (x > 0 && mask[pixelIndex - 1] === 0) ||
          (x + 1 < sampledWidth && mask[pixelIndex + 1] === 0) ||
          (y > 0 && mask[pixelIndex - sampledWidth] === 0) ||
          (y + 1 < sampledHeight && mask[pixelIndex + sampledWidth] === 0);

        if (touchesOutside) {
          edgeCount += 1;
        }
      }
    }

    const edgeDensity = edgeCount / maskCount;
    const averageDistance = totalDistance / maskCount;
    const { saturation, value } = rgbToHsv(averageR, averageG, averageB);
    const colorSignal =
      saturation >= 0.55 || value <= 0.18 || (value >= 0.92 && saturation <= 0.12);
    if (!colorSignal || edgeDensity < 0.14 || areaRatio > 0.2 || averageDistance > 10) {
      continue;
    }

    const edgeScore = clamp((edgeDensity - 0.4) / 0.6, 0, 1);
    const areaScore = clamp(1 - Math.abs(areaRatio - 0.06) / 0.06, 0, 1);
    const colorScore = saturation >= 0.55 ? 1 : value <= 0.18 ? 0.85 : 0.7;
    const solidScore = clamp((12 - averageDistance) / 12, 0, 1);
    const score = Number(
      (
        edgeScore * 0.35 +
        areaScore * 0.25 +
        colorScore * 0.15 +
        solidScore * 0.25
      ).toFixed(3)
    );

    if (score > strongestScore) {
      strongestScore = score;
      strongestEvidence =
        `candidate-rgb(${averageR},${averageG},${averageB});` +
        `area=${areaRatio.toFixed(3)};edge=${edgeDensity.toFixed(3)};sat=${saturation.toFixed(3)};val=${value.toFixed(3)};dist=${averageDistance.toFixed(3)}`;
    }
  }

  // Fallback path: detect synthetic marker-like color mask globally.
  if (strongestScore < 0.62) {
    const mask = new Uint8Array(sampleIndex);
    let maskCount = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let i = 0; i < sampleIndex; i += 1) {
      const r = sampledR[i];
      const g = sampledG[i];
      const b = sampledB[i];
      const hsv = rgbToHsv(r, g, b);
      const looksLikeInkColor =
        (hsv.saturation >= 0.7 && hsv.value >= 0.12 && hsv.value <= 0.98) ||
        hsv.value <= 0.1;

      if (!looksLikeInkColor) {
        continue;
      }

      mask[i] = 1;
      maskCount += 1;
      sumR += r;
      sumG += g;
      sumB += b;
    }

    if (maskCount >= 100) {
      const areaRatio = maskCount / sampleIndex;
      if (areaRatio >= 0.003 && areaRatio <= 0.18) {
        const avgR = sumR / maskCount;
        const avgG = sumG / maskCount;
        const avgB = sumB / maskCount;

        let squaredDiffSum = 0;
        let edgeCount = 0;

        for (let y = 0; y < sampledHeight; y += 1) {
          for (let x = 0; x < sampledWidth; x += 1) {
            const pixelIndex = y * sampledWidth + x;
            if (mask[pixelIndex] !== 1) {
              continue;
            }

            const dr = sampledR[pixelIndex] - avgR;
            const dg = sampledG[pixelIndex] - avgG;
            const db = sampledB[pixelIndex] - avgB;
            squaredDiffSum += (dr * dr + dg * dg + db * db) / 3;

            const touchesOutside =
              (x > 0 && mask[pixelIndex - 1] === 0) ||
              (x + 1 < sampledWidth && mask[pixelIndex + 1] === 0) ||
              (y > 0 && mask[pixelIndex - sampledWidth] === 0) ||
              (y + 1 < sampledHeight && mask[pixelIndex + sampledWidth] === 0);

            if (touchesOutside) {
              edgeCount += 1;
            }
          }
        }

        const stdDev = Math.sqrt(squaredDiffSum / maskCount);
        const edgeDensity = edgeCount / maskCount;

        if (stdDev <= 22 && edgeDensity >= 0.1) {
          const areaScore = clamp(1 - Math.abs(areaRatio - 0.05) / 0.05, 0, 1);
          const uniformityScore = clamp((24 - stdDev) / 24, 0, 1);
          const edgeScore = clamp((edgeDensity - 0.08) / 0.35, 0, 1);
          const fallbackScore = Number(
            (areaScore * 0.35 + uniformityScore * 0.4 + edgeScore * 0.25).toFixed(3)
          );

          if (fallbackScore > strongestScore) {
            strongestScore = fallbackScore;
            strongestEvidence =
              `fallback-mask-area=${areaRatio.toFixed(3)};` +
              `std=${stdDev.toFixed(3)};edge=${edgeDensity.toFixed(3)}`;
          }
        }
      }
    }
  }

  return {
    hasVisualStrokeOverlayHint: strongestScore >= 0.62,
    visualOverlayScore: strongestScore,
    visualOverlayEvidence: strongestEvidence,
  };
}

export function collectForensicSignals(
  input: Pick<AnalysisInput, "filenameOriginal" | "fileBytes" | "mimeType">
): ForensicSignalSnapshot {
  const scannedBytes = clamp(input.fileBytes.length, 0, MAX_BINARY_SCAN_BYTES);
  const binarySample = input.fileBytes.subarray(0, scannedBytes);
  const ascii = toSearchableAscii(binarySample);

  const filenameSearchText = normalizeFilename(input.filenameOriginal);
  const filenameMatches = collectKeywordMatches(filenameSearchText);
  const binaryMatches = collectKeywordMatches(ascii.text);
  const mergedMatches = Array.from(
    new Set([...filenameMatches, ...binaryMatches])
  );

  const hintSource: ForensicSignalSnapshot["hintSource"] =
    filenameMatches.length > 0 && binaryMatches.length > 0
      ? "both"
      : filenameMatches.length > 0
      ? "filename"
      : binaryMatches.length > 0
      ? "binary"
      : "none";

  const hasXmpSignature = ascii.text.includes("http://ns.adobe.com/xap/1.0/");
  const hasAdobeSignature =
    ascii.text.includes("adobe") ||
    ascii.text.includes("photoshop") ||
    ascii.text.includes("lightroom");
  const visualOverlay = analyzeVisualStrokeOverlay(input);
  const strongKeywordHits = mergedMatches.filter((keyword) =>
    STRONG_EDITOR_KEYWORDS.has(keyword)
  ).length;
  const hasCorroboratedKeywordTamperHint =
    (strongKeywordHits >= 2 && hintSource === "both") || strongKeywordHits >= 3;
  const hasStrongTamperHint =
    visualOverlay.hasVisualStrokeOverlayHint || hasCorroboratedKeywordTamperHint;

  return {
    keywordHits: mergedMatches.length,
    matchedKeywords: mergedMatches,
    hintSource,
    hasStrongTamperHint,
    hasExifSignature: hasExifSignature(binarySample),
    hasXmpSignature,
    hasAdobeSignature,
    isLikelyBinaryImage: ascii.nonPrintableRatio >= 0.2,
    hasVisualStrokeOverlayHint: visualOverlay.hasVisualStrokeOverlayHint,
    visualOverlayScore: visualOverlay.visualOverlayScore,
    visualOverlayEvidence: visualOverlay.visualOverlayEvidence,
    scannedBytes,
  };
}
