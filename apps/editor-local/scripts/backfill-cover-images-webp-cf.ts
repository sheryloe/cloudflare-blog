import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

type PostRow = {
  id: string;
  slug: string;
  cover_image: string | null;
  cover_alt: string | null;
};

type Options = {
  limit: number;
  dryRun: boolean;
  bucket: string;
  apiBaseUrl: string;
  maxLongEdge: number;
  quality: number;
  skipThresholdBytes: number;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_WORKDIR = path.resolve(SCRIPT_DIR, "../../api");
const DEFAULT_BUCKET = "donggeuri-assets";
const DEFAULT_API_BASE_URL = "https://api.example.com";
const DEFAULT_MAX_LONG_EDGE = 1600;
const DEFAULT_WEBP_QUALITY = 78;
const DEFAULT_SKIP_THRESHOLD = 400 * 1024;

function parseArgs(argv: string[]): Options {
  const options: Options = {
    limit: 0,
    dryRun: false,
    bucket: DEFAULT_BUCKET,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    maxLongEdge: DEFAULT_MAX_LONG_EDGE,
    quality: DEFAULT_WEBP_QUALITY,
    skipThresholdBytes: DEFAULT_SKIP_THRESHOLD,
  };

  for (const item of argv) {
    if (item === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (!item.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = item.slice(2).split("=", 2);
    const value = rawValue?.trim() ?? "";

    if (!value) {
      continue;
    }

    if (rawKey === "limit") {
      options.limit = Math.max(0, Number(value) || 0);
      continue;
    }

    if (rawKey === "bucket") {
      options.bucket = value;
      continue;
    }

    if (rawKey === "api-base-url") {
      options.apiBaseUrl = value.replace(/\/+$/, "");
      continue;
    }

    if (rawKey === "max-long-edge") {
      options.maxLongEdge = Math.max(256, Number(value) || DEFAULT_MAX_LONG_EDGE);
      continue;
    }

    if (rawKey === "quality") {
      options.quality = Math.max(50, Math.min(95, Number(value) || DEFAULT_WEBP_QUALITY));
      continue;
    }

    if (rawKey === "skip-threshold-bytes") {
      options.skipThresholdBytes = Math.max(0, Number(value) || DEFAULT_SKIP_THRESHOLD);
    }
  }

  return options;
}

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr || stdout}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function runWrangler(args: string[]) {
  if (process.platform === "win32") {
    const wranglerCmd = path.resolve(API_WORKDIR, "node_modules", ".bin", "wrangler.cmd");
    return runCommand("cmd", ["/d", "/s", "/c", wranglerCmd, ...args], API_WORKDIR);
  }

  const wranglerBin = path.resolve(API_WORKDIR, "node_modules", ".bin", "wrangler");
  return runCommand(wranglerBin, args, API_WORKDIR);
}

async function queryPosts(): Promise<PostRow[]> {
  const output = await runWrangler([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--json",
    "--command",
    "SELECT id, slug, cover_image, cover_alt FROM posts WHERE cover_image IS NOT NULL AND TRIM(cover_image) <> '' ORDER BY published_at DESC, created_at DESC",
  ]);
  const payload = JSON.parse(output) as Array<{ results?: PostRow[] }>;
  return payload[0]?.results ?? [];
}

function shouldProcess(coverImage: string) {
  try {
    const url = new URL(coverImage);
    return /\.(png|jpe?g)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function slugifyLikeApi(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^#+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getAssetKey(coverImage: string) {
  const pathname = new URL(coverImage).pathname;
  return decodeURIComponent(pathname.replace(/^\/assets\//, ""));
}

function resolveNewAssetKey(originalKey: string, postSlug: string, optimizedBuffer: Buffer) {
  const parsed = path.posix.parse(originalKey);
  const fallbackDir = (() => {
    const date = new Date();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const slug = slugifyLikeApi(postSlug) || "unassigned";
    return `media/posts/${year}/${month}/${slug}`;
  })();
  const dir = parsed.dir || fallbackDir;
  const rawBase = parsed.name || postSlug || "cover";
  const safeBase = slugifyLikeApi(rawBase) || "cover";
  const hash = createHash("sha1").update(optimizedBuffer).digest("hex").slice(0, 12);
  return `${dir}/${safeBase}.${hash}.webp`;
}

async function convertToWebp(buffer: Buffer, maxLongEdge: number, quality: number) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality,
      effort: 5,
    })
    .toBuffer();
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

async function uploadToR2(bucket: string, key: string, filePath: string) {
  await runWrangler([
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--remote",
    "--file",
    filePath,
    "--content-type",
    "image/webp",
  ]);
}

async function updatePostCover(post: PostRow, newKey: string, newUrl: string, size: number) {
  const nowIso = new Date().toISOString();
  const sql = `
UPDATE posts
SET cover_image='${escapeSql(newUrl)}'
WHERE id='${escapeSql(post.id)}';
INSERT OR IGNORE INTO media_assets (id, path, mime_type, size, alt_text, created_at)
VALUES (
  '${randomUUID()}',
  '${escapeSql(newKey)}',
  'image/webp',
  ${size},
  ${post.cover_alt ? `'${escapeSql(post.cover_alt)}'` : "NULL"},
  '${nowIso}'
);
`;
  const sqlFilePath = path.join(tmpdir(), `dongri-cover-update-${randomUUID()}.sql`);

  try {
    await fs.writeFile(sqlFilePath, sql, "utf8");
    await runWrangler([
      "d1",
      "execute",
      "DB",
      "--remote",
      "--file",
      sqlFilePath,
      "-y",
    ]);
  } finally {
    await fs.rm(sqlFilePath, { force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allPosts = await queryPosts();
  const candidates = allPosts.filter((post) => post.cover_image && shouldProcess(post.cover_image));
  const target = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let originalBytesTotal = 0;
  let optimizedBytesTotal = 0;
  const tempRoot = await fs.mkdtemp(path.join(tmpdir(), "dongri-cover-backfill-"));

  console.log(
    `[start] candidates=${target.length} dryRun=${options.dryRun} bucket=${options.bucket} apiBase=${options.apiBaseUrl}`,
  );

  try {
    for (const post of target) {
      processed += 1;

      try {
        const coverImage = post.cover_image as string;
        const response = await fetch(coverImage);

        if (!response.ok) {
          failed += 1;
          console.error(`[fail] slug=${post.slug} reason=download-status-${response.status}`);
          continue;
        }

        const originalBuffer = Buffer.from(await response.arrayBuffer());
        originalBytesTotal += originalBuffer.byteLength;

        if (originalBuffer.byteLength <= options.skipThresholdBytes) {
          skipped += 1;
          console.log(`[skip] slug=${post.slug} reason=already-small bytes=${originalBuffer.byteLength}`);
          continue;
        }

        const optimizedBuffer = await convertToWebp(originalBuffer, options.maxLongEdge, options.quality);
        optimizedBytesTotal += optimizedBuffer.byteLength;

        if (optimizedBuffer.byteLength >= originalBuffer.byteLength) {
          skipped += 1;
          console.log(
            `[skip] slug=${post.slug} reason=no-size-gain original=${originalBuffer.byteLength} optimized=${optimizedBuffer.byteLength}`,
          );
          continue;
        }

        const oldKey = getAssetKey(coverImage);
        const newKey = resolveNewAssetKey(oldKey, post.slug, optimizedBuffer);
        const newUrl = `${options.apiBaseUrl}/assets/${newKey}`;

        if (options.dryRun) {
          skipped += 1;
          console.log(
            `[dry-run] slug=${post.slug} original=${originalBuffer.byteLength} optimized=${optimizedBuffer.byteLength} next=${newUrl}`,
          );
          continue;
        }

        const tempFile = path.join(tempRoot, `${post.id}-${Date.now()}.webp`);
        await fs.writeFile(tempFile, optimizedBuffer);

        try {
          await uploadToR2(options.bucket, newKey, tempFile);
          await updatePostCover(post, newKey, newUrl, optimizedBuffer.byteLength);
        } finally {
          await fs.rm(tempFile, { force: true });
        }

        updated += 1;
        console.log(
          `[ok] slug=${post.slug} original=${originalBuffer.byteLength} optimized=${optimizedBuffer.byteLength} saved=${originalBuffer.byteLength - optimizedBuffer.byteLength}`,
        );
      } catch (error) {
        failed += 1;
        console.error(`[fail] slug=${post.slug} reason=${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const savedBytes = Math.max(0, originalBytesTotal - optimizedBytesTotal);
  console.log(
    `[done] processed=${processed} updated=${updated} skipped=${skipped} failed=${failed} originalMB=${(
      originalBytesTotal /
      1024 /
      1024
    ).toFixed(2)} optimizedMB=${(optimizedBytesTotal / 1024 / 1024).toFixed(2)} savedMB=${(savedBytes / 1024 / 1024).toFixed(2)}`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
