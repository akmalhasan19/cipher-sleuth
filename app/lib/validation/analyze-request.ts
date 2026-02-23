import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { readCookie } from "./http-cookies";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const jsonAnalyzeSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  userId: z.string().trim().min(1).max(128).optional(),
  turnstileToken: z.string().trim().min(1).optional(),
});

export type ValidatedUpload = {
  filenameOriginal: string;
  filenameNormalized: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHashSha256: string;
};

export type AccessContext = {
  userId: string | null;
  guestId: string;
  isLoggedIn: boolean;
  guestLimitUsed: boolean;
  guestUsedCount: number;
};

function hasSupportedExtension(fileName: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext));
}

function toWebpFilename(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName =
    dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName || "uploaded-image";
  return `${baseName}.webp`;
}

export async function computeSha256Hex(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hash = createHash("sha256");
  hash.update(Buffer.from(arrayBuffer));
  return hash.digest("hex");
}

export async function validateAndNormalizeUpload(
  file: File,
  maxUploadMb: number
): Promise<ValidatedUpload> {
  const maxUploadBytes = maxUploadMb * 1024 * 1024;

  if (!file.name) {
    throw new Error("Filename is missing.");
  }

  if (file.size <= 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (file.size > maxUploadBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  const mimeType = file.type?.toLowerCase() ?? "";
  if (!SUPPORTED_MIME_TYPES.has(mimeType) || !hasSupportedExtension(file.name)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  return {
    filenameOriginal: file.name,
    filenameNormalized: toWebpFilename(file.name),
    mimeType,
    fileSizeBytes: file.size,
    fileHashSha256: await computeSha256Hex(file),
  };
}

export function resolveAccessContext(
  request: Request,
  guestLimit: number,
  userIdFromBody?: string
): AccessContext {
  const headerUserId =
    request.headers.get("x-user-id") ??
    request.headers.get("x-userid") ??
    undefined;
  const cookieHeader = request.headers.get("cookie");
  const cookieUserId = readCookie(cookieHeader, "cipher_sleuth_user_id") ?? undefined;
  const rawUserId = userIdFromBody ?? headerUserId ?? cookieUserId;
  const userId = rawUserId?.trim() ? rawUserId.trim() : null;
  const guestId =
    readCookie(cookieHeader, "cipher_sleuth_guest_id") ?? randomUUID();
  const guestUsedCount = Number(
    readCookie(cookieHeader, "cipher_sleuth_guest_used_count") ?? "0"
  );

  return {
    userId,
    guestId,
    isLoggedIn: Boolean(userId),
    guestLimitUsed: guestUsedCount >= guestLimit,
    guestUsedCount,
  };
}
