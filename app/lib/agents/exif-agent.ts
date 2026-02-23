import type { AgentResult, AgentRunContext } from "./types";
import exifr from "exifr";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isJpegLikeMime(mimeType: string): boolean {
  return mimeType.toLowerCase() === "image/jpeg";
}

function readStringTag(
  source: Record<string, unknown>,
  key: string
): string | null {
  const value = source[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDateLikeTag(
  source: Record<string, unknown>,
  key: string
): string | null {
  const value = source[key];
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function findSoftwareSignature(exif: Record<string, unknown>): string | null {
  const candidates = [
    readStringTag(exif, "Software"),
    readStringTag(exif, "ProcessingSoftware"),
  ].filter((item): item is string => Boolean(item));

  return candidates[0] ?? null;
}

function isSuspiciousSoftware(softwareSignature: string | null): boolean {
  if (!softwareSignature) {
    return false;
  }

  const normalized = softwareSignature.toLowerCase();
  return /(photoshop|canva|gimp|lightroom|snapseed|facetune|pixlr|picsart)/.test(
    normalized
  );
}

type ExifParseSnapshot = {
  parseMode: "parsed" | "skipped-non-jpeg" | "parse-failed";
  softwareSignature: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  dateTimeOriginal: string | null;
  createDate: string | null;
  gpsPresent: boolean;
};

async function parseExifSnapshot(
  context: AgentRunContext
): Promise<ExifParseSnapshot> {
  if (!isJpegLikeMime(context.mimeType)) {
    return {
      parseMode: "skipped-non-jpeg",
      softwareSignature: null,
      cameraMake: null,
      cameraModel: null,
      dateTimeOriginal: null,
      createDate: null,
      gpsPresent: false,
    };
  }

  try {
    const parsed = (await exifr.parse(context.fileBytes, [
      "Software",
      "ProcessingSoftware",
      "Make",
      "Model",
      "DateTimeOriginal",
      "CreateDate",
      "latitude",
      "longitude",
    ])) as Record<string, unknown> | null;

    if (!parsed) {
      return {
        parseMode: "parse-failed",
        softwareSignature: null,
        cameraMake: null,
        cameraModel: null,
        dateTimeOriginal: null,
        createDate: null,
        gpsPresent: false,
      };
    }

    return {
      parseMode: "parsed",
      softwareSignature: findSoftwareSignature(parsed),
      cameraMake: readStringTag(parsed, "Make"),
      cameraModel: readStringTag(parsed, "Model"),
      dateTimeOriginal: readDateLikeTag(parsed, "DateTimeOriginal"),
      createDate: readDateLikeTag(parsed, "CreateDate"),
      gpsPresent:
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number",
    };
  } catch {
    return {
      parseMode: "parse-failed",
      softwareSignature: null,
      cameraMake: null,
      cameraModel: null,
      dateTimeOriginal: null,
      createDate: null,
      gpsPresent: false,
    };
  }
}

export async function runExifAgent(context: AgentRunContext): Promise<AgentResult> {
  const before = Date.now();
  await sleep(180);

  const snapshot = await parseExifSnapshot(context);
  const hasSuspiciousMetadata = isSuspiciousSoftware(snapshot.softwareSignature);
  const hasCameraTags = Boolean(snapshot.cameraMake || snapshot.cameraModel);
  const hasCaptureTimestamp = Boolean(
    snapshot.dateTimeOriginal || snapshot.createDate
  );

  const trustDelta =
    snapshot.parseMode === "parse-failed"
      ? -1
      : hasSuspiciousMetadata
      ? -18
      : snapshot.parseMode === "skipped-non-jpeg"
      ? 0
      : hasCameraTags && hasCaptureTimestamp
      ? 9
      : hasCameraTags
      ? 6
      : hasCaptureTimestamp
      ? 3
      : -1;
  const confidence =
    snapshot.parseMode === "parse-failed"
      ? 0.7
      : hasSuspiciousMetadata
      ? 0.94
      : hasCameraTags && hasCaptureTimestamp
      ? 0.9
      : snapshot.parseMode === "parsed"
      ? 0.84
      : 0.76;

  const logs: string[] = [
    `Loaded EXIF pipeline for ${context.filenameOriginal}.`,
  ];

  if (snapshot.parseMode === "skipped-non-jpeg") {
    logs.push("EXIF parsing skipped (non-JPEG mime type).");
  } else if (snapshot.parseMode === "parse-failed") {
    logs.push("EXIF parsing failed or metadata section is unavailable.");
  } else {
    logs.push(
      snapshot.softwareSignature
        ? `Software signature found: ${snapshot.softwareSignature}.`
        : "No software signature found in EXIF metadata."
    );
    logs.push(
      snapshot.cameraMake || snapshot.cameraModel
        ? `Camera tag detected: ${snapshot.cameraMake ?? "Unknown"} ${snapshot.cameraModel ?? ""}`.trim()
        : "Camera make/model tags are unavailable."
    );
    logs.push(
      hasCaptureTimestamp
        ? "Capture timestamp tag is present."
        : "Capture timestamp tags are unavailable."
    );
  }

  return {
    agentId: "exif-bot",
    agentName: "Metadata Investigator (Exif-Bot)",
    status: "completed",
    confidence,
    trustDelta,
    elapsedMs: Date.now() - before,
    logs,
    rawResult: {
      parseMode: snapshot.parseMode,
      softwareSignature: snapshot.softwareSignature ?? "none",
      cameraMake: snapshot.cameraMake ?? "unknown",
      cameraModel: snapshot.cameraModel ?? "unknown",
      dateTimeOriginal: snapshot.dateTimeOriginal ?? "unknown",
      createDate: snapshot.createDate ?? "unknown",
      gpsPresent: snapshot.gpsPresent,
      hasCameraTags,
      hasCaptureTimestamp,
      suspiciousMetadata: hasSuspiciousMetadata,
      mimeType: context.mimeType,
    },
  };
}
