export interface HtmlChunk {
  chunkId: string;
  order: number;
  html: string;
  hash: string;
  tokenEstimate: number;
}

export function slugify(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^#+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function checksum(value: string) {
  let hash = 5381;

  for (const character of value) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

export function splitHtmlIntoChunks(html: string, maxChars = 2400) {
  const normalized = html.trim();

  if (!normalized) {
    return [] satisfies HtmlChunk[];
  }

  const sections = normalized
    .split(/(?=<h[1-3][^>]*>)/i)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks: HtmlChunk[] = [];
  let order = 0;

  const pushChunk = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    order += 1;
    chunks.push({
      chunkId: `chunk-${order}`,
      order,
      html: trimmed,
      hash: checksum(trimmed),
      tokenEstimate: estimateTokens(trimmed),
    });
  };

  for (const section of sections.length ? sections : [normalized]) {
    if (section.length <= maxChars) {
      pushChunk(section);
      continue;
    }

    const blocks = section
      .split(/(?=<p>|<pre|<blockquote|<table|<ul|<ol|<figure)/i)
      .map((block) => block.trim())
      .filter(Boolean);

    let current = "";

    for (const block of blocks) {
      const candidate = current ? `${current}\n${block}` : block;

      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }

      pushChunk(current);
      current = block;
    }

    pushChunk(current);
  }

  return chunks;
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
