import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

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

export function extractTocHeadings(content: string): TocHeading[] {
  const matches = content.matchAll(/^(#{2,3})\s+(.+)$/gm);
  const counts = new Map<string, number>();
  const headings: TocHeading[] = [];

  for (const match of matches) {
    const level = match[1].length as 2 | 3;
    const rawText = match[2].trim();
    const text = rawText.replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/[`*_~]/g, "").trim();

    headings.push({
      id: nextHeadingId(text, counts),
      text,
      level,
    });
  }

  return headings;
}

export function MarkdownContent(props: { content: string }) {
  const headingCounts = new Map<string, number>();

  const components: Components = {
    a: ({ ...rest }) => <a target="_blank" rel="noreferrer" {...rest} />,
    img: ({ alt, src }) => (
      <figure className="overflow-hidden rounded-[28px] border border-black/5 bg-white/70">
        <img className="h-auto w-full object-cover" src={src ?? ""} alt={alt ?? ""} />
        {alt ? <figcaption className="px-4 py-3 text-sm text-[var(--color-soft-ink)]">{alt}</figcaption> : null}
      </figure>
    ),
    h2: ({ children, ...rest }) => {
      const text = textFromNode(children).trim();
      const id = nextHeadingId(text, headingCounts);
      return (
        <h2 id={id} {...rest}>
          {children}
        </h2>
      );
    },
    h3: ({ children, ...rest }) => {
      const text = textFromNode(children).trim();
      const id = nextHeadingId(text, headingCounts);
      return (
        <h3 id={id} {...rest}>
          {children}
        </h3>
      );
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {props.content}
      </ReactMarkdown>
    </div>
  );
}
