import type { RelatedLink } from "@cloudflare-blog/shared";

const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const ATTRIBUTE_REGEX = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const PARAGRAPH_REGEX = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
const BLOCKED_TAGS_REGEX = /<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const numeric = Number(code);
      return Number.isFinite(numeric) ? String.fromCharCode(numeric) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const numeric = Number.parseInt(code, 16);
      return Number.isFinite(numeric) ? String.fromCharCode(numeric) : "";
    });
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(HTML_TAG_REGEX, " ").replace(/\s+/g, " ")).trim();
}

function truncate(value: string, maxLength: number) {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function parseAttributes(tag: string) {
  const attributes = new Map<string, string>();
  let match: RegExpExecArray | null = null;

  while ((match = ATTRIBUTE_REGEX.exec(tag)) !== null) {
    const [, key, , doubleQuoted, singleQuoted, bare] = match;
    attributes.set(key.toLowerCase(), decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? bare ?? "").trim());
  }

  return attributes;
}

function getMetaContent(html: string, names: string[]) {
  const expected = new Set(names.map((name) => name.toLowerCase()));
  let match: RegExpExecArray | null = null;

  while ((match = META_TAG_REGEX.exec(html)) !== null) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();

    if (expected.has(key)) {
      return attributes.get("content")?.trim() ?? "";
    }
  }

  return "";
}

function extractTitle(html: string) {
  const title = TITLE_REGEX.exec(html)?.[1] ?? "";
  return stripHtml(title);
}

function extractFirstParagraph(html: string) {
  const cleanedHtml = html.replace(BLOCKED_TAGS_REGEX, " ");
  let fallback = "";
  let match: RegExpExecArray | null = null;

  while ((match = PARAGRAPH_REGEX.exec(cleanedHtml)) !== null) {
    const text = stripHtml(match[1] ?? "");

    if (!text) {
      continue;
    }

    if (!fallback) {
      fallback = text;
    }

    if (text.length >= 40) {
      return text;
    }
  }

  return fallback;
}

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map((segment) => Number.parseInt(segment, 10));

  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.toLowerCase();

  if (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80:")
  ) {
    return true;
  }

  return /^[0-9.]+$/.test(lower) && isPrivateIpv4(lower);
}

function normalizePreviewUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("http ?먮뒗 https URL留?誘몃━蹂닿린濡?媛?몄삱 ???덉뒿?덈떎.");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error("濡쒖뺄 ?먮뒗 ?ъ꽕 ?ㅽ듃?뚰겕 二쇱냼??誘몃━蹂닿린濡?媛?몄삱 ???놁뒿?덈떎.");
  }

  return url;
}

function toAbsoluteUrl(baseUrl: URL, value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function getHostnameLabel(url: URL) {
  return url.hostname.replace(/^www\./i, "");
}

function buildFallbackPreview(url: URL): RelatedLink {
  const hostname = getHostnameLabel(url);

  return {
    url: url.toString(),
    title: hostname,
    description: null,
    image: null,
    siteName: hostname,
  };
}

export async function previewExternalLink(inputUrl: string): Promise<RelatedLink> {
  const normalizedUrl = normalizePreviewUrl(inputUrl);
  const fallback = buildFallbackPreview(normalizedUrl);

  const response = await fetch(normalizedUrl.toString(), {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "DongriArchivePreview/1.0 (+https://example.com)",
    },
  });

  const finalUrl = new URL(response.url || normalizedUrl.toString());
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return {
      ...fallback,
      url: finalUrl.toString(),
    };
  }

  const html = await response.text();
  const title =
    getMetaContent(html, ["og:title", "twitter:title"]) ||
    extractTitle(html) ||
    fallback.title ||
    getHostnameLabel(finalUrl);
  const description =
    getMetaContent(html, ["og:description", "twitter:description", "description"]) || extractFirstParagraph(html);
  const image = toAbsoluteUrl(
    finalUrl,
    getMetaContent(html, ["og:image", "twitter:image", "og:image:url", "twitter:image:src"]),
  );
  const siteName = getMetaContent(html, ["og:site_name"]) || getHostnameLabel(finalUrl);

  return {
    url: finalUrl.toString(),
    title: truncate(title || getHostnameLabel(finalUrl), 120),
    description: description ? truncate(description, 220) : null,
    image,
    siteName: siteName ? truncate(siteName, 80) : null,
  };
}
