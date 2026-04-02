import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z0-9#]+;/gi, "")
    .replace(/[^a-z0-9\uac00-\ud7a3\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function nextHeadingId(text: string, counts: Map<string, number>) {
  const base = slugifyHeading(text) || "section";
  const seen = counts.get(base) ?? 0;
  counts.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }

  if (isValidElement(node)) {
    return textFromNode(node.props.children);
  }

  return "";
}

export function MarkdownContent(props: { content: string }) {
  const headingCounts = new Map<string, number>();
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "article",
      "section",
      "aside",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
      "mark",
      "ins",
      "del",
      "details",
      "summary",
      "kbd",
      "sup",
      "sub",
    ],
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "id", "data-media-block", "data-align"],
      figure: [...(defaultSchema.attributes?.figure ?? []), "data-media-block", "data-align"],
      figcaption: [...(defaultSchema.attributes?.figcaption ?? []), "data-align"],
      a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "data-align",
      ],
    },
  } satisfies Parameters<typeof rehypeSanitize>[0];

  const components: Components = {
    a: ({ ...rest }) => <a target="_blank" rel="noreferrer" {...rest} />,
    figure: ({ children, ...rest }) => (
      <figure className="article-figure" {...rest}>
        {children}
      </figure>
    ),
    figcaption: ({ children, ...rest }) => (
      <figcaption className="article-figure__caption" {...rest}>
        {children}
      </figcaption>
    ),
    img: ({ alt, src, ...rest }) => (
      <img
        className="article-image"
        src={src ?? ""}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        {...rest}
      />
    ),
    h2: ({ children, ...rest }) => {
      const text = textFromNode(children).trim();
      const id = nextHeadingId(text, headingCounts);
      return <h2 id={id} {...rest}>{children}</h2>;
    },
    h3: ({ children, ...rest }) => {
      const text = textFromNode(children).trim();
      const id = nextHeadingId(text, headingCounts);
      return <h3 id={id} {...rest}>{children}</h3>;
    },
    code: ({ className, children, ...rest }) => {
      const match = /language-([\w-]+)/.exec(className ?? "");
      const code = String(children).replace(/\n$/, "");

      if (match) {
        return (
          <SyntaxHighlighter
            PreTag="div"
            language={match[1]}
            style={oneDark}
            customStyle={{
              margin: 0,
              background: "transparent",
              padding: 0,
              fontSize: "0.92rem",
              lineHeight: "1.8",
              fontFamily: '"IBM Plex Mono", monospace',
            }}
            codeTagProps={{
              style: {
                fontFamily: '"IBM Plex Mono", monospace',
              },
            }}
            className="article-code-block"
          >
            {code}
          </SyntaxHighlighter>
        );
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="article-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeRaw], [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {props.content}
      </ReactMarkdown>
    </div>
  );
}
