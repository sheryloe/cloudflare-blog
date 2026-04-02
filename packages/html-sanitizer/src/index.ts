import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      figure: ["class", "data-align", "data-media-block"],
      figcaption: ["class"],
      img: ["src", "alt", "title", "width", "height", "loading", "class", "data-align"],
      "*": ["id"],
    },
    allowedSchemes: ["http", "https", "data"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noreferrer" }),
    },
  });
}

export function normalizeImageFigures(html: string) {
  return html.replace(
    /<img([^>]*?)title="([^"]+)"([^>]*?)>/gi,
    (_match, before, title, after) =>
      `<figure data-media-block="true"><img${before}${after} /><figcaption>${title}</figcaption></figure>`,
  );
}

export function prepareHtmlForMdx(html: string) {
  return sanitizeArticleHtml(normalizeImageFigures(html)).trim();
}
