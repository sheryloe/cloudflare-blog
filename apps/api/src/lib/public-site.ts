import type { Category, PostSummary } from "@donggeuri/shared";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(siteUrl: string, path: string) {
  return new URL(path, ensureSiteOrigin(siteUrl)).toString();
}

export function ensureSiteOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function toLastModified(post: PostSummary) {
  return post.publishedAt ?? post.updatedAt ?? post.createdAt;
}

export function renderRssXml(args: {
  siteUrl: string;
  title: string;
  description: string;
  posts: PostSummary[];
}) {
  const siteUrl = ensureSiteOrigin(args.siteUrl);
  const items = args.posts
    .map((post) => {
      const link = toAbsoluteUrl(siteUrl, `/post/${post.slug}`);
      const description = post.excerpt ?? post.subtitle ?? `${post.title} 글 요약`;
      const publishedAt = toLastModified(post);

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(stripMarkdown(description))}</description>`,
        publishedAt ? `      <pubDate>${new Date(publishedAt).toUTCString()}</pubDate>` : null,
        post.category?.name ? `      <category>${escapeXml(post.category.name)}</category>` : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(args.title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(args.description)}</description>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}

function renderSitemapEntry(loc: string, lastmod?: string | null) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderSitemapXml(args: {
  siteUrl: string;
  categories: Category[];
  posts: PostSummary[];
}) {
  const siteUrl = ensureSiteOrigin(args.siteUrl);
  const entries = [
    renderSitemapEntry(toAbsoluteUrl(siteUrl, "/")),
    renderSitemapEntry(toAbsoluteUrl(siteUrl, "/about")),
    ...args.categories.map((category) =>
      renderSitemapEntry(toAbsoluteUrl(siteUrl, `/category/${category.slug}`), category.updatedAt ?? category.createdAt),
    ),
    ...args.posts.map((post) => renderSitemapEntry(toAbsoluteUrl(siteUrl, `/post/${post.slug}`), toLastModified(post))),
  ].join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
  ].join("\n");
}
