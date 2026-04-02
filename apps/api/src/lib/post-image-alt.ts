function escapeMarkdownAlt(value: string) {
  return value.replace(/[\[\]\r\n]+/g, " ").trim();
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractMarkdownImageSource(target: string) {
  const trimmed = target.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("<") && trimmed.includes(">")) {
    return trimmed.slice(1, trimmed.indexOf(">")).trim();
  }

  return trimmed.split(/\s+/)[0] ?? "";
}

function normalizeMediaPathFromSrc(src: string) {
  if (!src || /^data:/i.test(src)) {
    return null;
  }

  const normalizedSrc = src.trim();
  let path = normalizedSrc;

  try {
    path = new URL(normalizedSrc).pathname;
  } catch {
    path = normalizedSrc;
  }

  if (!path) {
    return null;
  }

  if (path.startsWith("/assets/")) {
    path = path.slice("/assets/".length);
  }

  if (path.startsWith("assets/")) {
    path = path.slice("assets/".length);
  }

  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  if (path.includes("media/posts/")) {
    return path.slice(path.indexOf("media/posts/"));
  }

  return path.startsWith("media/posts/") ? path : null;
}

function resolveFilenameFallback(src: string, title: string) {
  let value = src;

  try {
    value = new URL(src).pathname;
  } catch {
    value = src;
  }

  const normalized = decodeURIComponent(value)
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .at(-1);

  if (!normalized) {
    return `${title} 이미지`;
  }

  const basename = normalized.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return basename || `${title} 이미지`;
}

function resolveAltText(input: {
  src: string;
  title: string;
  mediaAltByPath: Map<string, string>;
}) {
  const mediaPath = normalizeMediaPathFromSrc(input.src);

  if (mediaPath) {
    const mediaAlt = input.mediaAltByPath.get(mediaPath)?.trim();

    if (mediaAlt) {
      return mediaAlt;
    }
  }

  return resolveFilenameFallback(input.src, input.title);
}

export function collectMediaPathsFromContent(content: string) {
  const paths = new Set<string>();

  const markdownMatches = content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g);
  for (const match of markdownMatches) {
    const src = extractMarkdownImageSource(match[1] ?? "");
    const normalized = normalizeMediaPathFromSrc(src);

    if (normalized) {
      paths.add(normalized);
    }
  }

  const htmlMatches = content.matchAll(/<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi);
  for (const match of htmlMatches) {
    const normalized = normalizeMediaPathFromSrc(match[2] ?? "");

    if (normalized) {
      paths.add(normalized);
    }
  }

  return [...paths.values()];
}

export function applyPublishImageAltFallback(input: {
  content: string;
  title: string;
  mediaAltByPath: Map<string, string>;
}) {
  const withMarkdownAlt = input.content.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (full, altText, target) => {
    const existingAlt = String(altText ?? "").trim();

    if (existingAlt) {
      return full;
    }

    const src = extractMarkdownImageSource(String(target ?? ""));

    if (!src) {
      return full;
    }

    const nextAlt = resolveAltText({
      src,
      title: input.title,
      mediaAltByPath: input.mediaAltByPath,
    });

    return `![${escapeMarkdownAlt(nextAlt)}](${target})`;
  });

  return withMarkdownAlt.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = /\bsrc\s*=\s*(['"])(.*?)\1/i.exec(imgTag);

    if (!srcMatch?.[2]) {
      return imgTag;
    }

    const altMatch = /\balt\s*=\s*(['"])(.*?)\1/i.exec(imgTag);

    if (altMatch?.[2]?.trim()) {
      return imgTag;
    }

    const nextAlt = escapeHtmlAttribute(
      resolveAltText({
        src: srcMatch[2],
        title: input.title,
        mediaAltByPath: input.mediaAltByPath,
      }),
    );

    if (altMatch) {
      return imgTag.replace(altMatch[0], `alt="${nextAlt}"`);
    }

    if (/\/>$/.test(imgTag)) {
      return imgTag.replace(/\/>$/, ` alt="${nextAlt}" />`);
    }

    return imgTag.replace(/>$/, ` alt="${nextAlt}">`);
  });
}

