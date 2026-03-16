import type { MediaAsset } from "@donggeuri/shared";

import { slugify } from "./posts";

function buildAssetUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}/${path}`;
}

function sanitizeFilename(filename: string) {
  const extensionIndex = filename.lastIndexOf(".");
  const name = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex >= 0 ? filename.slice(extensionIndex).toLowerCase() : "";
  const safeName = slugify(name || "asset") || "asset";
  return `${safeName}${extension}`;
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
  const now = new Date();
  const id = crypto.randomUUID();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const slug = slugify(options.postSlug || "unassigned") || "unassigned";
  const filename = sanitizeFilename(file.name || "upload.bin");
  const path = `media/posts/${year}/${month}/${slug}/${filename}`;

  await env.ASSETS.put(path, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

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
