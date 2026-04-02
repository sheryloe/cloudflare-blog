import type { MediaAsset } from "@cloudflare-blog/shared";

import { slugify } from "./posts";

const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export class MediaUploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "MediaUploadError";
  }
}

function buildAssetUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}/${path}`;
}

function sanitizeFilenameParts(filename: string) {
  const extensionIndex = filename.lastIndexOf(".");
  const name = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex >= 0 ? filename.slice(extensionIndex).toLowerCase() : "";
  const safeName = slugify(name || "asset") || "asset";
  return {
    name: safeName,
    extension,
  };
}

function resolveExtension(extension: string, mimeType: string) {
  if (extension) {
    return extension;
  }

  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/avif":
      return ".avif";
    default:
      return "";
  }
}

async function hashBuffer(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-1", buffer);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 12);
}

function mapMediaAsset(row: Record<string, unknown>, publicBaseUrl: string): MediaAsset {
  const path = String(row.path);

  return {
    id: String(row.id),
    path,
    url: buildAssetUrl(publicBaseUrl, path),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    altText: row.alt_text ? String(row.alt_text) : null,
    createdAt: String(row.created_at),
  };
}

export async function listMediaAssets(db: D1Database, publicBaseUrl: string) {
  const result = await db
    .prepare(
      `
        SELECT id, path, mime_type, size, alt_text, created_at
        FROM media_assets
        ORDER BY created_at DESC
      `,
    )
    .all<Record<string, unknown>>();

  return result.results.map((row) => mapMediaAsset(row, publicBaseUrl));
}

export async function storeMediaAsset(
  env: { ASSETS: R2Bucket; DB: D1Database; R2_PUBLIC_BASE_URL: string },
  file: File,
  options: { postSlug?: string | null; altText?: string | null },
) {
  if (!ALLOWED_MEDIA_MIME_TYPES.has(file.type)) {
    throw new MediaUploadError(
      "Only JPEG, PNG, WebP, GIF, and AVIF images can be uploaded.",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  }

  if (file.size > MAX_MEDIA_FILE_SIZE) {
    throw new MediaUploadError("Upload size must be 10 MB or smaller.", "FILE_TOO_LARGE", 413);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const slug = slugify(options.postSlug || "unassigned") || "unassigned";
  const fileBuffer = await file.arrayBuffer();
  const filenameParts = sanitizeFilenameParts(file.name || "upload.bin");
  const extension = resolveExtension(filenameParts.extension, file.type);
  const fingerprint = await hashBuffer(fileBuffer);
  const path = `media/posts/${year}/${month}/${slug}/${filenameParts.name}.${fingerprint}${extension}`;

  await env.ASSETS.put(path, fileBuffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  const existing = await env.DB
    .prepare("SELECT id, path, mime_type, size, alt_text, created_at FROM media_assets WHERE path = ?1 LIMIT 1")
    .bind(path)
    .first<Record<string, unknown>>();

  if (existing) {
    await env.DB
      .prepare(
        `
          UPDATE media_assets
          SET mime_type = ?2,
              size = ?3,
              alt_text = ?4
          WHERE path = ?1
        `,
      )
      .bind(
        path,
        file.type || "application/octet-stream",
        file.size,
        options.altText ?? null,
      )
      .run();

    const updated = await env.DB
      .prepare("SELECT id, path, mime_type, size, alt_text, created_at FROM media_assets WHERE path = ?1 LIMIT 1")
      .bind(path)
      .first<Record<string, unknown>>();

    return updated ? mapMediaAsset(updated, env.R2_PUBLIC_BASE_URL) : null;
  }

  await env.DB
    .prepare(
      `
        INSERT INTO media_assets (id, path, mime_type, size, alt_text, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `,
    )
    .bind(
      id,
      path,
      file.type || "application/octet-stream",
      file.size,
      options.altText ?? null,
      now.toISOString(),
    )
    .run();

  const result = await env.DB
    .prepare("SELECT id, path, mime_type, size, alt_text, created_at FROM media_assets WHERE id = ?1")
    .bind(id)
    .first<Record<string, unknown>>();

  return result ? mapMediaAsset(result, env.R2_PUBLIC_BASE_URL) : null;
}

export async function updateMediaAssetMeta(
  db: D1Database,
  publicBaseUrl: string,
  assetId: string,
  input: { altText?: string | null },
) {
  const nextAltText = input.altText?.trim() || null;

  await db
    .prepare(
      `
        UPDATE media_assets
        SET alt_text = ?2
        WHERE id = ?1
      `,
    )
    .bind(assetId, nextAltText)
    .run();

  const result = await db
    .prepare("SELECT id, path, mime_type, size, alt_text, created_at FROM media_assets WHERE id = ?1 LIMIT 1")
    .bind(assetId)
    .first<Record<string, unknown>>();

  return result ? mapMediaAsset(result, publicBaseUrl) : null;
}
