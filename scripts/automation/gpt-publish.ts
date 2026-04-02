import type { ApiResponse, Category, UpsertPostBySlugInput, UpsertPostBySlugResult } from "@cloudflare-blog/shared";

const OPENAI_MODEL = "gpt-5.4-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

type CliOptions = {
  topic: string;
  categorySlug: string;
  tone: string;
  primaryKeywords: string[];
  slugHint: string;
  publish: boolean;
  references: string[];
};

type ReferenceSource = {
  title: string;
  url: string;
  snippet: string;
};

type GeneratedPostDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tagNames: string[];
};

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCliOptions(): CliOptions {
  const args = parseArgs(process.argv.slice(2));
  const topic = (args.topic ?? "").trim();

  if (!topic) {
    throw new Error("Usage: pnpm automation:gpt-publish -- --topic \"주제\" [--categorySlug slug] [--tone \"톤\"] [--primaryKeywords \"a,b\"] [--slugHint slug] [--publish true|false] [--references \"https://...,...\"]");
  }

  return {
    topic,
    categorySlug: (args.categorySlug ?? args.category_slug ?? "").trim(),
    tone: (args.tone ?? "전문적이지만 읽기 쉬운 설명형 톤").trim(),
    primaryKeywords: parseCsv(args.primaryKeywords ?? args.keywords_csv ?? ""),
    slugHint: (args.slugHint ?? args.slug_hint ?? "").trim(),
    publish: normalizeBoolean(args.publish, true),
    references: parseCsv(args.references ?? args.references_csv ?? ""),
  };
}

function slugify(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^#+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

function dedupeReferences(items: ReferenceSource[]) {
  const seen = new Set<string>();
  const deduped: ReferenceSource[] = [];

  for (const item of items) {
    const key = item.url.trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function normalizeTagNames(items: string[]) {
  const normalized = new Map<string, string>();

  for (const raw of items) {
    const name = raw.replace(/^#+/g, "").trim().replace(/\s+/g, " ");

    if (!name) {
      continue;
    }

    const key = name.toLocaleLowerCase("ko-KR");

    if (!normalized.has(key)) {
      normalized.set(key, name);
    }
  }

  return [...normalized.values()].slice(0, 10);
}

function ensureReferenceSection(content: string, references: ReferenceSource[]) {
  if (!references.length || content.includes("## 참고 근거")) {
    return content;
  }

  const lines = references.map((item) => `- [${item.title}](${item.url})`);
  return `${content.trim()}\n\n## 참고 근거\n${lines.join("\n")}`;
}

function ensureCoreSummarySection(content: string) {
  if (content.includes("## 핵심 요약")) {
    return content;
  }

  return `## 핵심 요약\n- 핵심 내용을 2~3줄로 요약하세요.\n\n${content.trim()}`;
}

function assertContentQuality(content: string) {
  const h2Count = (content.match(/^##\s+/gm) ?? []).length;

  if (h2Count < 3) {
    throw new Error("Generated content must contain at least 3 H2 sections.");
  }
}

async function fetchSerpReferences(topic: string, primaryKeywords: string[], apiKey: string) {
  const query = [topic, ...primaryKeywords].join(" ").trim();
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    hl: "ko",
    gl: "kr",
    num: "8",
    api_key: apiKey,
  });

  const response = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    organic_results?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
    }>;
  };

  const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];

  return organic
    .slice(0, 6)
    .map((item) => ({
      title: item.title?.trim() || "검색 결과",
      url: item.link?.trim() || "",
      snippet: item.snippet?.trim() || "",
    }))
    .filter((item) => Boolean(item.url));
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text;

  if (typeof maybeOutputText === "string" && maybeOutputText.trim()) {
    return maybeOutputText;
  }

  const output = (payload as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const chunks: string[] = [];

  if (Array.isArray(output)) {
    for (const item of output) {
      if (!Array.isArray(item.content)) {
        continue;
      }

      for (const contentItem of item.content) {
        if (typeof contentItem.text === "string" && contentItem.text.trim()) {
          chunks.push(contentItem.text);
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

async function generateWithOpenAI(options: {
  openaiKey: string;
  topic: string;
  tone: string;
  primaryKeywords: string[];
  slugHint: string;
  references: ReferenceSource[];
}) {
  const referenceText = options.references.length
    ? options.references
        .map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}\n요약: ${item.snippet || "요약 없음"}`)
        .join("\n\n")
    : "검색 참고 자료 없음";
  const keywordText = options.primaryKeywords.length ? options.primaryKeywords.join(", ") : "(없음)";

  const systemPrompt = [
    "You are a Korean blog content generator for SEO + GEO quality.",
    "Always output valid JSON only (no markdown wrapper).",
    "Rules:",
    "- Korean language only.",
    "- Do not claim latest rankings or facts without grounding in provided references.",
    "- Build readable structure with clear H2 sections and practical guidance.",
    "- Keep excerpt concise for meta/preview use.",
    "- slug must be lower-case hyphen format.",
  ].join("\n");

  const userPrompt = [
    `주제: ${options.topic}`,
    `톤: ${options.tone}`,
    `핵심 키워드: ${keywordText}`,
    `슬러그 힌트: ${options.slugHint || "(없음)"}`,
    "",
    "콘텐츠 요구사항:",
    "- 반드시 '## 핵심 요약' 섹션 포함",
    "- H2 섹션 최소 3개",
    "- 필요하면 '## FAQ' 섹션 추가",
    "- 문장은 과장 없이 근거 기반으로 작성",
    "- 마지막에 참고 근거를 바탕으로 독자가 다음 행동을 정할 수 있게 정리",
    "",
    "참고 자료:",
    referenceText,
  ].join("\n");

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "generated_blog_post",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "slug", "excerpt", "content", "tagNames"],
            properties: {
              title: { type: "string", minLength: 8, maxLength: 120 },
              slug: { type: "string", minLength: 3, maxLength: 80 },
              excerpt: { type: "string", minLength: 40, maxLength: 180 },
              content: { type: "string", minLength: 500 },
              tagNames: {
                type: "array",
                minItems: 3,
                maxItems: 10,
                items: { type: "string", minLength: 1, maxLength: 30 },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new Error("OpenAI returned empty output.");
  }

  let parsed: GeneratedPostDraft;

  try {
    parsed = JSON.parse(stripCodeFence(outputText)) as GeneratedPostDraft;
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON output: ${error instanceof Error ? error.message : String(error)}`);
  }

  return parsed;
}

async function resolveCategoryIdBySlug(apiBaseUrl: string, categorySlug: string) {
  if (!categorySlug) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/public/categories`);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<Category[]>;

  if (!payload.success) {
    throw new Error(`Failed to fetch categories: ${payload.error.code} ${payload.error.message}`);
  }

  const category = payload.data.find((item) => item.slug === categorySlug);

  if (!category) {
    throw new Error(`Category slug not found: ${categorySlug}`);
  }

  return category.id;
}

async function upsertPost(apiBaseUrl: string, automationKey: string, payload: UpsertPostBySlugInput) {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/admin/posts/upsert-by-slug`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-automation-key": automationKey,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as ApiResponse<UpsertPostBySlugResult>;

  if (!response.ok || !body.success) {
    if (!body.success) {
      throw new Error(`Upsert failed: ${body.error.code} ${body.error.message}`);
    }

    throw new Error(`Upsert failed with status ${response.status}.`);
  }

  return body.data;
}

async function main() {
  const options = parseCliOptions();
  const openaiKey = requireEnv("OPENAI_API_KEY");
  const serpApiKey = requireEnv("SERPAPI_API_KEY");
  const automationApiUrl = requireEnv("AUTOMATION_API_URL");
  const automationApiKey = requireEnv("AUTOMATION_API_KEY");

  const searchReferences = await fetchSerpReferences(options.topic, options.primaryKeywords, serpApiKey);
  const manualReferences = options.references.map((url) => ({
    title: "외부 참고 링크",
    url,
    snippet: "",
  }));
  const references = dedupeReferences([...manualReferences, ...searchReferences]);

  const generated = await generateWithOpenAI({
    openaiKey,
    topic: options.topic,
    tone: options.tone,
    primaryKeywords: options.primaryKeywords,
    slugHint: options.slugHint,
    references,
  });

  const normalizedTitle = generated.title.trim();
  const normalizedSlug = slugify(generated.slug || options.slugHint || normalizedTitle || options.topic);
  const normalizedExcerpt = generated.excerpt.trim().slice(0, 180);
  const normalizedContent = ensureReferenceSection(ensureCoreSummarySection(generated.content.trim()), references);
  const normalizedTagNames = normalizeTagNames(generated.tagNames);

  if (!normalizedTitle) {
    throw new Error("Generated title is empty.");
  }

  if (!normalizedSlug) {
    throw new Error("Generated slug is empty.");
  }

  if (!normalizedExcerpt) {
    throw new Error("Generated excerpt is empty.");
  }

  assertContentQuality(normalizedContent);

  const categoryId = await resolveCategoryIdBySlug(automationApiUrl, options.categorySlug);
  const payload: UpsertPostBySlugInput = {
    title: normalizedTitle,
    slug: normalizedSlug,
    excerpt: normalizedExcerpt,
    content: normalizedContent,
    categoryId,
    tagNames: normalizedTagNames,
    status: options.publish ? "published" : "draft",
    publishedAt: options.publish ? new Date().toISOString() : null,
  };

  const result = await upsertPost(automationApiUrl, automationApiKey, payload);

  console.log(
    JSON.stringify(
      {
        model: OPENAI_MODEL,
        operation: result.operation,
        slug: result.post.slug,
        status: result.post.status,
        title: result.post.title,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
