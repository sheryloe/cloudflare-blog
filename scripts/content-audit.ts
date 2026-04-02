import fs from "node:fs/promises";
import path from "node:path";

type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  status: "draft" | "published" | "archived";
};

type PostDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  coverImage?: string | null;
  coverAlt?: string | null;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
  updatedAt?: string | null;
  category?: { id: string; slug: string; name: string } | null;
};

type AuditFlag =
  | "thin_content_warn"
  | "thin_content_high"
  | "test_like_slug"
  | "missing_excerpt"
  | "missing_cover_alt"
  | "external_image"
  | "draft_or_test_candidate";

type AuditRow = {
  slug: string;
  title: string;
  status: string;
  category: string;
  textLength: number;
  flags: AuditFlag[];
  externalImages: string[];
  suggestedAction: string;
};

const TEST_LIKE_PATTERN = /(test|check|verify|preview|sample|demo|tmp|?꾩떆|?뚯뒪??寃利?/i;
const DEFAULT_OUTPUT = path.join(process.cwd(), "output", "content-audit-report.md");
const DEFAULT_API_BASE_URL = process.env.CONTENT_AUDIT_API_BASE_URL || "http://127.0.0.1:8787";
const DEFAULT_EMAIL = process.env.CONTENT_AUDIT_ADMIN_EMAIL || "admin@example.com";
const DEFAULT_PASSWORD = process.env.CONTENT_AUDIT_ADMIN_PASSWORD || "admin123!";
const PUBLISHED_ONLY = (process.env.CONTENT_AUDIT_PUBLISHED_ONLY || "true").toLowerCase() !== "false";

async function request<T>(pathName: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${DEFAULT_API_BASE_URL}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Audit request failed: ${response.status} ${pathName}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

async function login() {
  const response = await fetch(`${DEFAULT_API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Audit login failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

function stripContent(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+]\([^)]+\)/g, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImageUrls(content: string) {
  const urls = new Set<string>();
  for (const match of content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
    if (match[1]) {
      urls.add(match[1].trim());
    }
  }
  for (const match of content.matchAll(/(?:src|data-src)=["']([^"']+)["']/g)) {
    if (match[1]) {
      urls.add(match[1].trim());
    }
  }
  return [...urls];
}

function isExternalImage(url: string) {
  if (!url) {
    return false;
  }
  if (url.startsWith("/")) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "example.com" || hostname.endsWith(".example.com")) {
      return false;
    }
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return false;
    }
    if (hostname.endsWith(".r2.dev")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function buildSuggestedAction(flags: AuditFlag[]) {
  if (flags.includes("draft_or_test_candidate")) {
    return "?댁쁺 ?몄텧 以묒씠硫?鍮꾧났媛??먮뒗 ??젣";
  }
  if (flags.includes("thin_content_high")) {
    return "蹂몃Ц 蹂닿컯 ???좎? ?щ? ?ы뙋??;
  }
  if (flags.includes("external_image")) {
    return "異쒖쿂? 沅뚮━ ?뺤씤 ???좎?";
  }
  if (flags.includes("missing_cover_alt")) {
    return "????대?吏 ALT 蹂닿컯";
  }
  if (flags.includes("missing_excerpt")) {
    return "?붿빟臾?蹂닿컯";
  }
  if (flags.includes("thin_content_warn")) {
    return "蹂몃Ц 湲몄씠 蹂닿컯 寃??;
  }
  return "?좎?";
}

function auditPost(post: PostDetail): AuditRow {
  const textLength = stripContent(post.content || "").length;
  const flags: AuditFlag[] = [];
  const externalImages = extractImageUrls(post.content || "").filter(isExternalImage);
  const testLike = TEST_LIKE_PATTERN.test(`${post.slug} ${post.title}`);

  if (textLength < 500) {
    flags.push("thin_content_high");
  } else if (textLength < 900) {
    flags.push("thin_content_warn");
  }

  if (testLike) {
    flags.push("test_like_slug");
  }

  if (!post.excerpt?.trim()) {
    flags.push("missing_excerpt");
  }

  if (post.coverImage?.trim() && !post.coverAlt?.trim()) {
    flags.push("missing_cover_alt");
  }

  if (externalImages.length) {
    flags.push("external_image");
  }

  if (post.status === "published" && testLike) {
    flags.push("draft_or_test_candidate");
  }

  return {
    slug: post.slug,
    title: post.title,
    status: post.status,
    category: post.category?.name || "移댄뀒怨좊━ ?놁쓬",
    textLength,
    flags,
    externalImages,
    suggestedAction: buildSuggestedAction(flags),
  };
}

function buildReport(rows: AuditRow[]) {
  const published = rows.filter((row) => row.status === "published");
  const flagged = rows.filter((row) => row.flags.length > 0);
  const counts = {
    total: rows.length,
    published: published.length,
    flagged: flagged.length,
    thinHigh: rows.filter((row) => row.flags.includes("thin_content_high")).length,
    thinWarn: rows.filter((row) => row.flags.includes("thin_content_warn")).length,
    testLike: rows.filter((row) => row.flags.includes("test_like_slug")).length,
    publishedTestLike: rows.filter((row) => row.flags.includes("draft_or_test_candidate")).length,
    externalImage: rows.filter((row) => row.flags.includes("external_image")).length,
    missingExcerpt: rows.filter((row) => row.flags.includes("missing_excerpt")).length,
    missingCoverAlt: rows.filter((row) => row.flags.includes("missing_cover_alt")).length,
  };

  const lines = [
    "# 肄섑뀗痢?媛먯궗 由ы룷??,
    "",
    `- 湲곗? API: \`${DEFAULT_API_BASE_URL}\``,
    `- 寃뚯떆 ?곹깭 ?꾪꽣: \`${PUBLISHED_ONLY ? "published only" : "all"}\``,
    `- ?꾩껜 湲 ?? \`${counts.total}\``,
    `- 怨듦컻 湲 ?? \`${counts.published}\``,
    `- ?꾪뿕 ?뚮옒洹?蹂댁쑀 湲 ?? \`${counts.flagged}\``,
    "",
    "## ?붿빟",
    "",
    `- \`thin_content_high\`: ${counts.thinHigh}`,
    `- \`thin_content_warn\`: ${counts.thinWarn}`,
    `- \`test_like_slug\`: ${counts.testLike}`,
    `- \`draft_or_test_candidate\`: ${counts.publishedTestLike}`,
    `- \`external_image\`: ${counts.externalImage}`,
    `- \`missing_excerpt\`: ${counts.missingExcerpt}`,
    `- \`missing_cover_alt\`: ${counts.missingCoverAlt}`,
    "",
    "## ?곸꽭 紐⑸줉",
    "",
    "| ?곹깭 | ?щ윭洹?| ?쒕ぉ | 移댄뀒怨좊━ | 蹂몃Ц 湲몄씠 | ?뚮옒洹?| 沅뚯옣 議곗튂 |",
    "|---|---|---|---|---:|---|---|",
    ...flagged.map(
      (row) =>
        `| ${row.status} | ${row.slug} | ${row.title.replace(/\|/g, "/")} | ${row.category.replace(/\|/g, "/")} | ${row.textLength} | ${row.flags.join(", ")} | ${row.suggestedAction} |`,
    ),
  ];

  const externalRows = flagged.filter((row) => row.externalImages.length);
  if (externalRows.length) {
    lines.push("", "## ?몃? ?대?吏 ?ъ슜 湲", "");
    for (const row of externalRows) {
      lines.push(`### ${row.title} (\`${row.slug}\`)`, "");
      for (const image of row.externalImages) {
        lines.push(`- ${image}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  const token = await login();
  const summaries = await request<PostSummary[]>("/api/admin/posts", token);
  const filtered = PUBLISHED_ONLY ? summaries.filter((item) => item.status === "published") : summaries;
  const details = await Promise.all(
    filtered.map((item) => request<PostDetail>(`/api/admin/posts/${item.id}`, token)),
  );
  const rows = details.map(auditPost).sort((left, right) => right.flags.length - left.flags.length || left.slug.localeCompare(right.slug));
  const report = buildReport(rows);

  await fs.mkdir(path.dirname(DEFAULT_OUTPUT), { recursive: true });
  await fs.writeFile(DEFAULT_OUTPUT, report, "utf8");

  console.log(`Wrote content audit report to ${DEFAULT_OUTPUT}`);
  console.log(report);
}

void main().catch((error) => {
  console.error("Content audit failed.");
  console.error(`- API base URL: ${DEFAULT_API_BASE_URL}`);
  console.error("- Ensure the admin API is running and the audit credentials are valid.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
