"use client";

function isWebpFile(file: File): boolean {
  if (file.type === "image/webp") {
    return true;
  }

  return /\.webp$/i.test(file.name);
}

function toWebpFilename(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName || "uploaded-image";

  return `${baseName}.webp`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode uploaded image."));
    };

    image.src = objectUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert image to WebP."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

export async function ensureWebpFile(file: File, quality = 0.9): Promise<File> {
  if (isWebpFile(file)) {
    return file;
  }

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable in this browser.");
  }

  context.drawImage(image, 0, 0);

  const webpBlob = await canvasToWebpBlob(canvas, quality);
  return new File([webpBlob], toWebpFilename(file.name), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
