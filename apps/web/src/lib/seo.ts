import { useEffect } from "react";

const DEFAULT_SITE_ORIGIN = "https://donggeuri-blog.pages.dev";
const DEFAULT_IMAGE_PATH = "/og-default.svg";
const DEFAULT_SITE_NAME = "Donggri 기록들";

type StructuredDataNode = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  robots?: string;
  ogType?: "website" | "article";
  image?: string | null;
  structuredData?: StructuredDataNode | StructuredDataNode[];
}

function resolveConfiguredOrigin() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return configured.replace(/\/$/, "");
  }
}

export function resolveSiteOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return resolveConfiguredOrigin() ?? DEFAULT_SITE_ORIGIN;
}

export function toAbsoluteUrl(pathOrUrl: string, origin = resolveSiteOrigin()) {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, origin).toString();
  }
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

export function buildExcerpt(value: string, maxLength = 160) {
  const normalized = stripMarkdown(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength).trimEnd();
  const safeBoundary = slice.lastIndexOf(" ");

  if (safeBoundary >= maxLength * 0.6) {
    return `${slice.slice(0, safeBoundary).trimEnd()}...`;
  }

  return `${slice}...`;
}

function upsertMetaTag(selector: string, attributes: Record<string, string>, content: string) {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertLinkTag(selector: string, attributes: Record<string, string>, href: string) {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function upsertScriptTag(id: string, content: string) {
  if (typeof document === "undefined") {
    return;
  }

  let element = document.head.querySelector(`#${id}`) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = content;
}

export function useSeoMetadata(input: PageMetadataInput) {
  const structuredData = input.structuredData ? JSON.stringify(input.structuredData) : "";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const siteOrigin = resolveSiteOrigin();
    const canonicalUrl = toAbsoluteUrl(input.path, siteOrigin);
    const imageUrl = toAbsoluteUrl(input.image ?? DEFAULT_IMAGE_PATH, siteOrigin);

    document.title = input.title;
    upsertMetaTag('meta[name="description"]', { name: "description" }, input.description);
    upsertMetaTag('meta[name="robots"]', { name: "robots" }, input.robots ?? "index,follow");
    upsertLinkTag('link[rel="canonical"]', { rel: "canonical" }, canonicalUrl);

    upsertMetaTag('meta[property="og:title"]', { property: "og:title" }, input.title);
    upsertMetaTag('meta[property="og:description"]', { property: "og:description" }, input.description);
    upsertMetaTag('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    upsertMetaTag('meta[property="og:site_name"]', { property: "og:site_name" }, DEFAULT_SITE_NAME);
    upsertMetaTag('meta[property="og:locale"]', { property: "og:locale" }, "ko_KR");
    upsertMetaTag('meta[property="og:type"]', { property: "og:type" }, input.ogType ?? "website");
    upsertMetaTag('meta[property="og:image"]', { property: "og:image" }, imageUrl);

    upsertMetaTag('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, input.title);
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description" }, input.description);
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);

    if (structuredData) {
      upsertScriptTag("structured-data", structuredData);
    }
  }, [
    input.description,
    input.image,
    input.ogType,
    input.path,
    input.robots,
    input.title,
    structuredData,
  ]);
}

export function createBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}

export function createWebSiteStructuredData(args: {
  name: string;
  alternateName?: string;
  description: string;
  path?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: args.name,
    alternateName: args.alternateName,
    url: toAbsoluteUrl(args.path ?? "/"),
    description: args.description,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: toAbsoluteUrl("/search?q={search_term_string}"),
      "query-input": "required name=search_term_string",
    },
  };
}

export function createWebPageStructuredData(args: {
  name: string;
  description: string;
  path: string;
  type?: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  const page = {
    "@context": "https://schema.org",
    "@type": args.type ?? "WebPage",
    name: args.name,
    description: args.description,
    url: toAbsoluteUrl(args.path),
    inLanguage: "ko-KR",
  };

  if (!args.breadcrumbs?.length) {
    return page;
  }

  return [page, createBreadcrumbStructuredData(args.breadcrumbs)];
}

export function createCollectionPageStructuredData(args: {
  name: string;
  description: string;
  path: string;
  breadcrumbs: BreadcrumbItem[];
}) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: args.name,
      description: args.description,
      url: toAbsoluteUrl(args.path),
      inLanguage: "ko-KR",
    },
    createBreadcrumbStructuredData(args.breadcrumbs),
  ];
}

export function createBlogPostingStructuredData(args: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  categoryName?: string | null;
  tags?: string[];
  breadcrumbs: BreadcrumbItem[];
  authorName: string;
}) {
  const post = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: args.title,
    description: args.description,
    mainEntityOfPage: toAbsoluteUrl(args.path),
    url: toAbsoluteUrl(args.path),
    image: [toAbsoluteUrl(args.image ?? DEFAULT_IMAGE_PATH)],
    datePublished: args.publishedAt ?? undefined,
    dateModified: args.updatedAt ?? args.publishedAt ?? undefined,
    articleSection: args.categoryName ?? undefined,
    keywords: args.tags?.length ? args.tags.join(", ") : undefined,
    author: {
      "@type": "Person",
      name: args.authorName,
    },
    publisher: {
      "@type": "Person",
      name: args.authorName,
    },
    inLanguage: "ko-KR",
  };

  return [post, createBreadcrumbStructuredData(args.breadcrumbs)];
}
