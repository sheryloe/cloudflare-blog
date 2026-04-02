import cors from "cors";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";

import { prepareHtmlForMdx } from "@cloudflare-blog/html-sanitizer";
import { checksum, splitHtmlIntoChunks, stripHtml } from "@cloudflare-blog/shared-utils";

const app = express();
const upload = multer();
const serverPort = Number(process.env.LOCAL_EDITOR_PORT || 4319);
const repoRoot = path.resolve(process.cwd(), "..", "..");
const localDataDir = path.join(repoRoot, "apps", "editor-local", ".local-data");
const draftsDir = path.join(localDataDir, "drafts");
const cacheDir = path.join(localDataDir, "cache");
const blogImageRoot = path.join(repoRoot, "apps", "blog-web", "public", "images", "posts");

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:4322$/, /^http:\/\/localhost:4322$/] }));
app.use(express.json({ limit: "5mb" }));

async function ensureDir(target: string) {
  await fs.mkdir(target, { recursive: true });
}

function classifyScore(total: number) {
  if (total >= 90) return "publish";
  if (total >= 75) return "review";
  if (total >= 60) return "revise";
  return "retry";
}

function scoreHtml(input: {
  sourceHtml: string;
  translatedHtml: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
}) {
  const warnings: string[] = [];
  const sourceLength = stripHtml(input.sourceHtml).length;
  const translatedLength = stripHtml(input.translatedHtml).length;
  const headingCount = (input.translatedHtml.match(/<h[1-3][^>]*>/g) ?? []).length;
  const imageCount = (input.translatedHtml.match(/<img /g) ?? []).length;

  const metrics = {
    structure: Math.min(25, headingCount > 0 ? 25 : 15),
    completeness: Math.min(20, translatedLength > sourceLength * 0.6 ? 20 : 12),
    readability: Math.min(15, translatedLength > 180 ? 15 : 10),
    seo: Math.min(15, input.title && input.description ? 15 : 8),
    titleDescription: Math.min(10, input.title.length > 10 && input.description.length > 20 ? 10 : 6),
    linksImages: Math.min(10, imageCount >= 0 ? 10 : 6),
    anomalies: 5,
  };

  if (translatedLength <= sourceLength * 0.6) {
    warnings.push("The translated result is much shorter than the source content.");
  }

  if (!headingCount) {
    warnings.push("No headings were found in the translated content.");
  }

  if (!input.tags.length) {
    warnings.push("No tags have been added.");
  }

  if (!input.category) {
    warnings.push("The category field is empty.");
  }

  const total = Object.values(metrics).reduce((sum, value) => sum + value, 0);

  return {
    total,
    status: classifyScore(total),
    metrics,
    warnings,
  };
}

async function translateChunkWithGemini(input: {
  html: string;
  sourceLang: "ko" | "en";
  targetLang: "ko" | "en";
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return input.html;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  `Translate the following HTML fragment from ${input.sourceLang} to ${input.targetLang}.`,
                  "Preserve tags, links, image src values, and code blocks.",
                  "Return only translated HTML with no markdown fences.",
                  input.html,
                ].join("\n\n"),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini translation request failed.");
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || input.html;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/local/save-assets", upload.single("file"), async (req, res) => {
  const file = req.file;
  const slug = z.string().min(1).parse(req.body.slug || "local-draft");
  const altText = z.string().min(1).parse(req.body.altText || "image");

  if (!file || !file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: { message: "Only image files can be uploaded." } });
  }

  await ensureDir(path.join(blogImageRoot, slug));
  const targetDir = path.join(blogImageRoot, slug);
  const bodyFiles = (await fs.readdir(targetDir).catch(() => []))
    .filter((entry) => /^body-\d+\.webp$/.test(entry))
    .sort();
  const filename = `body-${String(bodyFiles.length + 1).padStart(2, "0")}.webp`;
  const outputPath = path.join(targetDir, filename);

  await sharp(file.buffer).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 82 }).toFile(outputPath);

  res.json({
    id: checksum(`${slug}-${filename}`),
    url: `/images/posts/${slug}/${filename}`,
    path: `images/posts/${slug}/${filename}`,
    altText,
  });
});

app.post("/api/local/save-draft", async (req, res) => {
  await ensureDir(draftsDir);
  const draft = req.body as { id?: string };

  if (!draft?.id) {
    return res.status(400).json({ error: { message: "Draft id is required." } });
  }

  await fs.writeFile(path.join(draftsDir, `${draft.id}.json`), JSON.stringify(draft, null, 2), "utf8");
  res.json({ saved: true, id: draft.id });
});

app.get("/api/local/load-draft/:id", async (req, res) => {
  try {
    const file = await fs.readFile(path.join(draftsDir, `${req.params.id}.json`), "utf8");
    res.json(JSON.parse(file));
  } catch {
    res.status(404).json({ error: { message: "Draft not found." } });
  }
});

app.post("/api/local/translate", async (req, res) => {
  const body = z
    .object({
      html: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      sourceLang: z.enum(["ko", "en"]),
      targetLang: z.enum(["ko", "en"]),
    })
    .parse(req.body);

  await ensureDir(cacheDir);
  const chunks = splitHtmlIntoChunks(body.html);
  const translatedParts: string[] = [];

  for (const chunk of chunks) {
    const cachePath = path.join(cacheDir, `${chunk.hash}-${body.targetLang}.json`);

    try {
      const cached = await fs.readFile(cachePath, "utf8");
      translatedParts.push(JSON.parse(cached).html as string);
      continue;
    } catch {
      // ignore cache miss
    }

    const translatedHtml = await translateChunkWithGemini({
      html: chunk.html,
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
    });

    await fs.writeFile(cachePath, JSON.stringify({ html: translatedHtml }, null, 2), "utf8");
    translatedParts.push(translatedHtml);
  }

  res.json({
    lang: body.targetLang,
    html: translatedParts.join("\n\n"),
    title: body.title,
    description: body.description,
    warnings: [],
  });
});

app.post("/api/local/score", (req, res) => {
  const body = z
    .object({
      sourceHtml: z.string().min(1),
      translatedHtml: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      tags: z.array(z.string()),
      category: z.string(),
    })
    .parse(req.body);

  res.json(scoreHtml(body));
});

app.post("/api/local/export-mdx", (req, res) => {
  const body = z
    .object({
      lang: z.enum(["ko", "en"]),
      title: z.string().min(1),
      description: z.string().min(1),
      slug: z.string().min(1),
      groupId: z.string().min(1),
      translationOf: z.string().nullable(),
      publishedAt: z.string().min(1),
      updatedAt: z.string().min(1),
      draft: z.boolean(),
      coverImage: z.string().min(1),
      coverAlt: z.string().min(1),
      tags: z.array(z.string()),
      category: z.string().min(1),
      canonicalLang: z.enum(["ko", "en"]),
      ogImage: z.string().min(1),
      html: z.string().min(1),
    })
    .parse(req.body);

  const frontmatter = [
    "---",
    `title: "${body.title}"`,
    `description: "${body.description}"`,
    `lang: "${body.lang}"`,
    `slug: "${body.slug}"`,
    `groupId: "${body.groupId}"`,
    `translationOf: ${body.translationOf ? `"${body.translationOf}"` : "null"}`,
    `publishedAt: "${body.publishedAt}"`,
    `updatedAt: "${body.updatedAt}"`,
    `draft: ${body.draft}`,
    `coverImage: "${body.coverImage}"`,
    `coverAlt: "${body.coverAlt}"`,
    `tags: [${body.tags.map((tag) => `"${tag}"`).join(", ")}]`,
    `category: "${body.category}"`,
    `canonicalLang: "${body.canonicalLang}"`,
    `ogImage: "${body.ogImage}"`,
    "---",
    "",
  ].join("\n");

  res.json({
    mdx: `${frontmatter}${prepareHtmlForMdx(body.html)}\n`,
  });
});

app.listen(serverPort, "127.0.0.1", async () => {
  await ensureDir(localDataDir);
  console.log(`Local editor API listening on http://127.0.0.1:${serverPort}`);
});
