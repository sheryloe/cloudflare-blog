import sharp from "sharp";

type AdminPostSummary = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  coverAlt?: string | null;
};

type MediaAsset = {
  url: string;
};

type UploadResult = {
  uploadedUrl: string | null;
  originalBytes: number;
  optimizedBytes: number;
  skipped: boolean;
  reason?: string;
};

type Options = {
  apiBaseUrl: string;
  limit: number;
  batch: number;
  retries: number;
  dryRun: boolean;
};

const DEFAULT_API_BASE_URL = "https://api.example.com";
const DEFAULT_LIMIT = 0;
const DEFAULT_BATCH = 5;
const DEFAULT_RETRIES = 2;
const MAX_LONG_EDGE = 1600;
const WEBP_QUALITY = 78;
const SKIP_RECOMPRESS_THRESHOLD_BYTES = 400 * 1024;

class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apiBaseUrl: process.env.BACKFILL_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    limit: DEFAULT_LIMIT,
    batch: DEFAULT_BATCH,
    retries: DEFAULT_RETRIES,
    dryRun: false,
  };

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [key, rawValue] = argument.slice(2).split("=", 2);
    const value = rawValue?.trim() ?? "";

    if (key === "api-base-url" && value) {
      options.apiBaseUrl = value;
      continue;
    }

    if (key === "limit" && value) {
      options.limit = Math.max(0, Number(value) || 0);
      continue;
    }

    if (key === "batch" && value) {
      options.batch = Math.max(1, Number(value) || DEFAULT_BATCH);
      continue;
    }

    if (key === "retries" && value) {
      options.retries = Math.max(0, Number(value) || 0);
      continue;
    }

    if (key === "dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string; json?: unknown } = {},
) {
  const headers = new Headers(init.headers);

  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, text, `HTTP ${response.status} ${path}`);
  }

  const payload = JSON.parse(text) as { success: boolean; data?: T; error?: { message: string } };

  if (!payload.success || !payload.data) {
    throw new Error(payload.error?.message || `API request failed: ${path}`);
  }

  return payload.data;
}

async function requestBinary(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new HttpError(response.status, await response.text(), `Failed to download: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function shouldBackfill(coverImage: string) {
  try {
    const url = new URL(coverImage);
    return /\.(png|jpe?g)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function toWebpFilename(coverImage: string, fallbackSlug: string) {
  try {
    const pathname = decodeURIComponent(new URL(coverImage).pathname);
    const filename = pathname.split("/").pop() || fallbackSlug;
    const extensionIndex = filename.lastIndexOf(".");
    const baseName = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
    return `${baseName || fallbackSlug}.webp`;
  } catch {
    return `${fallbackSlug}.webp`;
  }
}

async function convertToWebp(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 5,
    })
    .toBuffer();
}

async function login(baseUrl: string) {
  const tokenFromEnv = process.env.BACKFILL_ADMIN_TOKEN?.trim();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  const email = process.env.BACKFILL_ADMIN_EMAIL?.trim();
  const password = process.env.BACKFILL_ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("Set BACKFILL_ADMIN_TOKEN or BACKFILL_ADMIN_EMAIL/BACKFILL_ADMIN_PASSWORD.");
  }

  const result = await requestJson<{ token: string }>(baseUrl, "/api/admin/login", {
    method: "POST",
    json: { email, password },
  });

  return result.token;
}

async function uploadOptimizedCover(
  baseUrl: string,
  token: string,
  post: AdminPostSummary,
  optimizedBuffer: Buffer,
) {
  const form = new FormData();
  const filename = toWebpFilename(post.coverImage || post.slug, post.slug);
  const blob = new Blob([optimizedBuffer], { type: "image/webp" });
  form.set("file", blob, filename);
  form.set("postSlug", post.slug);

  if (post.coverAlt?.trim()) {
    form.set("altText", post.coverAlt.trim());
  }

  const asset = await requestJson<MediaAsset>(baseUrl, "/api/admin/media", {
    method: "POST",
    body: form,
    token,
  });

  return asset.url;
}

async function updatePostCoverImage(baseUrl: string, token: string, postId: string, coverImage: string) {
  await requestJson(baseUrl, `/api/admin/posts/${postId}`, {
    method: "PUT",
    token,
    json: { coverImage },
  });
}

async function runWithRetries<T>(task: () => Promise<T>, retries: number) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function processPost(baseUrl: string, token: string, post: AdminPostSummary, options: Options): Promise<UploadResult> {
  const coverImage = post.coverImage?.trim();

  if (!coverImage) {
    return { uploadedUrl: null, originalBytes: 0, optimizedBytes: 0, skipped: true, reason: "missing-cover" };
  }

  if (!shouldBackfill(coverImage)) {
    return { uploadedUrl: null, originalBytes: 0, optimizedBytes: 0, skipped: true, reason: "non-raster-or-webp" };
  }

  const originalBuffer = await requestBinary(coverImage);

  if (originalBuffer.byteLength <= SKIP_RECOMPRESS_THRESHOLD_BYTES) {
    return {
      uploadedUrl: null,
      originalBytes: originalBuffer.byteLength,
      optimizedBytes: originalBuffer.byteLength,
      skipped: true,
      reason: "already-small",
    };
  }

  const optimizedBuffer = await convertToWebp(originalBuffer);

  if (optimizedBuffer.byteLength >= originalBuffer.byteLength) {
    return {
      uploadedUrl: null,
      originalBytes: originalBuffer.byteLength,
      optimizedBytes: optimizedBuffer.byteLength,
      skipped: true,
      reason: "no-size-gain",
    };
  }

  if (options.dryRun) {
    return {
      uploadedUrl: null,
      originalBytes: originalBuffer.byteLength,
      optimizedBytes: optimizedBuffer.byteLength,
      skipped: true,
      reason: "dry-run",
    };
  }

  const uploadedUrl = await uploadOptimizedCover(baseUrl, token, post, optimizedBuffer);
  await updatePostCoverImage(baseUrl, token, post.id, uploadedUrl);

  return {
    uploadedUrl,
    originalBytes: originalBuffer.byteLength,
    optimizedBytes: optimizedBuffer.byteLength,
    skipped: false,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.apiBaseUrl);
  const token = await login(baseUrl);
  const posts = await requestJson<AdminPostSummary[]>(baseUrl, "/api/admin/posts", { token });
  const candidates = posts.filter((post) => Boolean(post.coverImage) && shouldBackfill(post.coverImage || ""));
  const targetPosts = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let originalBytesTotal = 0;
  let optimizedBytesTotal = 0;

  console.log(
    `[backfill] total=${targetPosts.length} batch=${options.batch} retries=${options.retries} dryRun=${options.dryRun}`,
  );

  for (let cursor = 0; cursor < targetPosts.length; cursor += options.batch) {
    const chunk = targetPosts.slice(cursor, cursor + options.batch);
    const results = await Promise.allSettled(
      chunk.map((post) =>
        runWithRetries(() => processPost(baseUrl, token, post, options), options.retries).then((result) => ({
          post,
          result,
        })),
      ),
    );

    for (const item of results) {
      processed += 1;

      if (item.status === "rejected") {
        failed += 1;
        console.error(`[fail] ${String(item.reason)}`);
        continue;
      }

      const { post, result } = item.value;
      originalBytesTotal += result.originalBytes;
      optimizedBytesTotal += result.optimizedBytes;

      if (result.skipped) {
        skipped += 1;
        console.log(
          `[skip] slug=${post.slug} reason=${result.reason || "skipped"} original=${result.originalBytes} optimized=${result.optimizedBytes}`,
        );
        continue;
      }

      updated += 1;
      console.log(
        `[ok] slug=${post.slug} original=${result.originalBytes} optimized=${result.optimizedBytes} cover=${result.uploadedUrl}`,
      );
    }

    console.log(`[progress] ${processed}/${targetPosts.length}`);
  }

  console.log(
    `[done] processed=${processed} updated=${updated} skipped=${skipped} failed=${failed} ` +
      `originalMB=${(originalBytesTotal / 1024 / 1024).toFixed(2)} optimizedMB=${(optimizedBytesTotal / 1024 / 1024).toFixed(2)}`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
