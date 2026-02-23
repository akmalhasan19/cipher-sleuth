import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { AnalysisInput } from "./types";

const MAX_ELA_ANALYZED_PIXELS = 220_000;
const RECOMPRESS_QUALITY = 90;
const MAX_ELA_PREVIEW_DIMENSION = 320;

type DecodedImage = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export type ElaCoreAnalysis = {
  mode: "computed" | "decode-failed" | "encode-failed";
  recompressQuality: number;
  sampleStep: number;
  sampleCount: number;
  width: number;
  height: number;
  meanResidual: number;
  stdResidual: number;
  p95Residual: number;
  highResidualRatio: number;
  smoothHighResidualRatio: number;
  largestHotspotRatio: number;
  highlightedRegions: number;
  anomalyScore: number;
  previewWidth: number;
  previewHeight: number;
  originalPreviewDataUrl: string | null;
  residualPreviewDataUrl: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitInsideMaxDimension(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function resizeRgbaNearest(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Uint8Array {
  const output = new Uint8Array(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor((y / targetHeight) * sourceHeight)
    );

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor((x / targetWidth) * sourceWidth)
      );

      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;

      output[targetIndex] = source[sourceIndex];
      output[targetIndex + 1] = source[sourceIndex + 1];
      output[targetIndex + 2] = source[sourceIndex + 2];
      output[targetIndex + 3] = 255;
    }
  }

  return output;
}

function encodePngDataUrl(
  rgba: Uint8Array,
  width: number,
  height: number
): string | null {
  if (width <= 0 || height <= 0 || rgba.length !== width * height * 4) {
    return null;
  }

  try {
    const png = new PNG({
      width,
      height,
      inputHasAlpha: true,
      colorType: 6,
    });
    png.data = Buffer.from(rgba);
    const pngBuffer = PNG.sync.write(png, { colorType: 6 });
    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function mapResidualToHeatColor(normalized: number): [number, number, number] {
  const t = clamp(normalized, 0, 1);

  if (t < 0.35) {
    const local = t / 0.35;
    const r = Math.round(20 + local * (70 - 20));
    const g = Math.round(32 + local * (145 - 32));
    const b = Math.round(82 + local * (225 - 82));
    return [r, g, b];
  }

  if (t < 0.7) {
    const local = (t - 0.35) / 0.35;
    const r = Math.round(70 + local * (248 - 70));
    const g = Math.round(145 + local * (205 - 145));
    const b = Math.round(225 + local * (80 - 225));
    return [r, g, b];
  }

  const local = (t - 0.7) / 0.3;
  const r = Math.round(248 + local * (220 - 248));
  const g = Math.round(205 + local * (64 - 205));
  const b = Math.round(80 + local * (48 - 80));
  return [r, g, b];
}

function buildOriginalPreview(
  original: DecodedImage
): { previewWidth: number; previewHeight: number; dataUrl: string | null } {
  const { width: previewWidth, height: previewHeight } = fitInsideMaxDimension(
    original.width,
    original.height,
    MAX_ELA_PREVIEW_DIMENSION
  );

  if (previewWidth === 0 || previewHeight === 0) {
    return { previewWidth: 0, previewHeight: 0, dataUrl: null };
  }

  const previewRgba = resizeRgbaNearest(
    original.rgba,
    original.width,
    original.height,
    previewWidth,
    previewHeight
  );

  return {
    previewWidth,
    previewHeight,
    dataUrl: encodePngDataUrl(previewRgba, previewWidth, previewHeight),
  };
}

function buildResidualPreview(
  residualValues: number[],
  sampleWidth: number,
  sampleHeight: number,
  p95Residual: number,
  targetWidth: number,
  targetHeight: number
): string | null {
  if (
    sampleWidth <= 0 ||
    sampleHeight <= 0 ||
    residualValues.length !== sampleWidth * sampleHeight
  ) {
    return null;
  }

  const sourceRgba = new Uint8Array(sampleWidth * sampleHeight * 4);
  const reference = Math.max(2, p95Residual, 0.001);

  for (let i = 0; i < residualValues.length; i += 1) {
    const normalized = clamp(residualValues[i] / reference, 0, 1);
    const [r, g, b] = mapResidualToHeatColor(normalized);
    const offset = i * 4;
    sourceRgba[offset] = r;
    sourceRgba[offset + 1] = g;
    sourceRgba[offset + 2] = b;
    sourceRgba[offset + 3] = 255;
  }

  const previewRgba = resizeRgbaNearest(
    sourceRgba,
    sampleWidth,
    sampleHeight,
    targetWidth,
    targetHeight
  );

  return encodePngDataUrl(previewRgba, targetWidth, targetHeight);
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

function decodeImage(
  input: Pick<AnalysisInput, "fileBytes" | "mimeType">
): DecodedImage | null {
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

function recompressToJpeg(image: DecodedImage, quality: number): DecodedImage | null {
  try {
    const encoded = jpeg.encode(
      {
        data: image.rgba,
        width: image.width,
        height: image.height,
      },
      quality
    );
    const parsed = jpeg.decode(encoded.data, { useTArray: true });
    return {
      width: parsed.width,
      height: parsed.height,
      rgba: parsed.data,
    };
  } catch {
    return null;
  }
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.max(
    0,
    Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * ratio))
  );
  return sortedValues[index];
}

function computeHotspotStats(
  highMask: Uint8Array,
  sampleWidth: number,
  sampleHeight: number
): { largestHotspotRatio: number; highlightedRegions: number } {
  const totalCells = sampleWidth * sampleHeight;
  if (totalCells === 0) {
    return { largestHotspotRatio: 0, highlightedRegions: 0 };
  }

  const visited = new Uint8Array(totalCells);
  const queue = new Int32Array(totalCells);
  let largestComponent = 0;
  let highlightedRegions = 0;

  for (let i = 0; i < totalCells; i += 1) {
    if (highMask[i] !== 1 || visited[i] === 1) {
      continue;
    }

    let queueHead = 0;
    let queueTail = 0;
    queue[queueTail++] = i;
    visited[i] = 1;
    let componentSize = 0;

    while (queueHead < queueTail) {
      const current = queue[queueHead++];
      componentSize += 1;

      const x = current % sampleWidth;
      const y = Math.floor(current / sampleWidth);

      const neighbors = [
        y > 0 ? current - sampleWidth : -1,
        y + 1 < sampleHeight ? current + sampleWidth : -1,
        x > 0 ? current - 1 : -1,
        x + 1 < sampleWidth ? current + 1 : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          highMask[neighbor] === 1 &&
          visited[neighbor] === 0
        ) {
          visited[neighbor] = 1;
          queue[queueTail++] = neighbor;
        }
      }
    }

    largestComponent = Math.max(largestComponent, componentSize);
    if (componentSize / totalCells >= 0.0025) {
      highlightedRegions += 1;
    }
  }

  return {
    largestHotspotRatio: largestComponent / totalCells,
    highlightedRegions,
  };
}

export function analyzeTrueEla(
  input: Pick<AnalysisInput, "fileBytes" | "mimeType">
): ElaCoreAnalysis {
  const original = decodeImage(input);
  if (!original || original.width < 16 || original.height < 16) {
    return {
      mode: "decode-failed",
      recompressQuality: RECOMPRESS_QUALITY,
      sampleStep: 1,
      sampleCount: 0,
      width: original?.width ?? 0,
      height: original?.height ?? 0,
      meanResidual: 0,
      stdResidual: 0,
      p95Residual: 0,
      highResidualRatio: 0,
      smoothHighResidualRatio: 0,
      largestHotspotRatio: 0,
      highlightedRegions: 0,
      anomalyScore: 0,
      previewWidth: 0,
      previewHeight: 0,
      originalPreviewDataUrl: null,
      residualPreviewDataUrl: null,
    };
  }

  const originalPreview = buildOriginalPreview(original);

  const recompressed = recompressToJpeg(original, RECOMPRESS_QUALITY);
  if (!recompressed) {
    return {
      mode: "encode-failed",
      recompressQuality: RECOMPRESS_QUALITY,
      sampleStep: 1,
      sampleCount: 0,
      width: original.width,
      height: original.height,
      meanResidual: 0,
      stdResidual: 0,
      p95Residual: 0,
      highResidualRatio: 0,
      smoothHighResidualRatio: 0,
      largestHotspotRatio: 0,
      highlightedRegions: 0,
      anomalyScore: 0,
      previewWidth: originalPreview.previewWidth,
      previewHeight: originalPreview.previewHeight,
      originalPreviewDataUrl: originalPreview.dataUrl,
      residualPreviewDataUrl: null,
    };
  }

  const sampleStep = Math.max(
    1,
    Math.ceil(Math.sqrt((original.width * original.height) / MAX_ELA_ANALYZED_PIXELS))
  );
  const sampleWidth = Math.ceil(original.width / sampleStep);
  const sampleHeight = Math.ceil(original.height / sampleStep);
  const sampleCount = sampleWidth * sampleHeight;

  if (sampleCount === 0) {
    return {
      mode: "decode-failed",
      recompressQuality: RECOMPRESS_QUALITY,
      sampleStep,
      sampleCount: 0,
      width: original.width,
      height: original.height,
      meanResidual: 0,
      stdResidual: 0,
      p95Residual: 0,
      highResidualRatio: 0,
      smoothHighResidualRatio: 0,
      largestHotspotRatio: 0,
      highlightedRegions: 0,
      anomalyScore: 0,
      previewWidth: originalPreview.previewWidth,
      previewHeight: originalPreview.previewHeight,
      originalPreviewDataUrl: originalPreview.dataUrl,
      residualPreviewDataUrl: null,
    };
  }

  const residualValues: number[] = [];
  residualValues.length = sampleCount;
  const highMask = new Uint8Array(sampleCount);

  let index = 0;
  let residualSum = 0;
  let highResidualCount = 0;
  let smoothCount = 0;
  let smoothHighCount = 0;

  for (let y = 0; y < original.height; y += sampleStep) {
    for (let x = 0; x < original.width; x += sampleStep) {
      const pixelIndex = (y * original.width + x) * 4;
      const originalR = original.rgba[pixelIndex];
      const originalG = original.rgba[pixelIndex + 1];
      const originalB = original.rgba[pixelIndex + 2];
      const compressedR = recompressed.rgba[pixelIndex];
      const compressedG = recompressed.rgba[pixelIndex + 1];
      const compressedB = recompressed.rgba[pixelIndex + 2];

      const residual =
        (Math.abs(originalR - compressedR) +
          Math.abs(originalG - compressedG) +
          Math.abs(originalB - compressedB)) /
        3;

      residualValues[index] = residual;
      residualSum += residual;

      if (residual >= 2.2) {
        highMask[index] = 1;
        highResidualCount += 1;
      }

      const rightX = Math.min(original.width - 1, x + sampleStep);
      const downY = Math.min(original.height - 1, y + sampleStep);

      const rightIndex = (y * original.width + rightX) * 4;
      const downIndex = (downY * original.width + x) * 4;
      const centerLum = luminance(originalR, originalG, originalB);
      const rightLum = luminance(
        original.rgba[rightIndex],
        original.rgba[rightIndex + 1],
        original.rgba[rightIndex + 2]
      );
      const downLum = luminance(
        original.rgba[downIndex],
        original.rgba[downIndex + 1],
        original.rgba[downIndex + 2]
      );
      const gradient = (Math.abs(centerLum - rightLum) + Math.abs(centerLum - downLum)) / 2;

      if (gradient < 12) {
        smoothCount += 1;
        if (residual >= 1.8) {
          smoothHighCount += 1;
        }
      }

      index += 1;
    }
  }

  const meanResidual = residualSum / sampleCount;
  let varianceSum = 0;
  for (const residual of residualValues) {
    const diff = residual - meanResidual;
    varianceSum += diff * diff;
  }
  const stdResidual = Math.sqrt(varianceSum / sampleCount);

  const sorted = [...residualValues].sort((a, b) => a - b);
  const p95Residual = percentile(sorted, 0.95);
  const highResidualRatio = highResidualCount / sampleCount;
  const smoothHighResidualRatio = smoothCount === 0 ? 0 : smoothHighCount / smoothCount;
  const hotspotStats = computeHotspotStats(highMask, sampleWidth, sampleHeight);

  const normMean = clamp((meanResidual - 0.65) / 2.4, 0, 1);
  const normStd = clamp((stdResidual - 0.35) / 2.6, 0, 1);
  const normP95 = clamp((p95Residual - 1.2) / 7.2, 0, 1);
  const normHigh = clamp((highResidualRatio - 0.01) / 0.24, 0, 1);
  const normSmooth = clamp((smoothHighResidualRatio - 0.006) / 0.14, 0, 1);
  const normHotspot = clamp((hotspotStats.largestHotspotRatio - 0.003) / 0.08, 0, 1);

  const anomalyScore = Number(
    (
      normMean * 0.2 +
      normStd * 0.22 +
      normP95 * 0.18 +
      normHigh * 0.2 +
      normSmooth * 0.12 +
      normHotspot * 0.08
    ).toFixed(3)
  );

  const residualPreviewDataUrl = buildResidualPreview(
    residualValues,
    sampleWidth,
    sampleHeight,
    p95Residual,
    originalPreview.previewWidth,
    originalPreview.previewHeight
  );

  return {
    mode: "computed",
    recompressQuality: RECOMPRESS_QUALITY,
    sampleStep,
    sampleCount,
    width: original.width,
    height: original.height,
    meanResidual: Number(meanResidual.toFixed(3)),
    stdResidual: Number(stdResidual.toFixed(3)),
    p95Residual: Number(p95Residual.toFixed(3)),
    highResidualRatio: Number(highResidualRatio.toFixed(4)),
    smoothHighResidualRatio: Number(smoothHighResidualRatio.toFixed(4)),
    largestHotspotRatio: Number(hotspotStats.largestHotspotRatio.toFixed(4)),
    highlightedRegions: hotspotStats.highlightedRegions,
    anomalyScore,
    previewWidth: originalPreview.previewWidth,
    previewHeight: originalPreview.previewHeight,
    originalPreviewDataUrl: originalPreview.dataUrl,
    residualPreviewDataUrl,
  };
}
