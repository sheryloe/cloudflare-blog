const SKIP_RECOMPRESS_THRESHOLD_BYTES = 400 * 1024;
const MAX_LONG_EDGE = 1600;
const WEBP_QUALITY = 0.78;

const COMPRESSIBLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function toWebpFilename(filename: string) {
  const fallback = "upload.webp";
  const trimmed = filename.trim();

  if (!trimmed) {
    return fallback;
  }

  const extensionIndex = trimmed.lastIndexOf(".");

  if (extensionIndex < 0) {
    return `${trimmed}.webp`;
  }

  return `${trimmed.slice(0, extensionIndex)}.webp`;
}

function loadImageBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") {
    return Promise.resolve(null);
  }

  return createImageBitmap(file).catch(() => null);
}

async function compressToWebp(file: File) {
  const bitmap = await loadImageBitmap(file);

  if (!bitmap) {
    return null;
  }

  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const longestEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longestEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
    });

    if (!blob) {
      return null;
    }

    return new File([blob], toWebpFilename(file.name), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export async function optimizeImageForUpload(file: File) {
  if (typeof window === "undefined") {
    return file;
  }

  if (!COMPRESSIBLE_MIME_TYPES.has(file.type)) {
    return file;
  }

  if (file.size <= SKIP_RECOMPRESS_THRESHOLD_BYTES) {
    return file;
  }

  const optimizedFile = await compressToWebp(file);

  if (!optimizedFile) {
    return file;
  }

  if (optimizedFile.size >= file.size) {
    return file;
  }

  return optimizedFile;
}
