import { describe, expect, it } from "vitest";
import { validateAndNormalizeUpload } from "@/app/lib/validation/analyze-request";
import { createImageFile } from "../utils/request-fixtures";

describe("validateAndNormalizeUpload", () => {
  it("rejects missing filename", async () => {
    const file = new File([Buffer.from("content")], "", { type: "image/png" });

    await expect(validateAndNormalizeUpload(file, 5)).rejects.toThrow(
      "Filename is missing."
    );
  });

  it("rejects unsupported MIME type", async () => {
    const file = createImageFile("evidence.png", "image/gif", "gif-content");

    await expect(validateAndNormalizeUpload(file, 5)).rejects.toThrow(
      "UNSUPPORTED_FILE_TYPE"
    );
  });

  it("rejects file larger than limit", async () => {
    const file = new File([new Uint8Array(6 * 1024 * 1024)], "large.png", {
      type: "image/png",
    });

    await expect(validateAndNormalizeUpload(file, 5)).rejects.toThrow(
      "FILE_TOO_LARGE"
    );
  });

  it("returns normalized metadata for valid upload", async () => {
    const file = createImageFile("document.JPG", "image/jpeg", "abc-123");

    const result = await validateAndNormalizeUpload(file, 5);

    expect(result.filenameOriginal).toBe("document.JPG");
    expect(result.filenameNormalized).toBe("document.webp");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.fileSizeBytes).toBe(file.size);
    expect(result.fileHashSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
