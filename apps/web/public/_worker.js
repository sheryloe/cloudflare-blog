const DEFAULT_SITE_SETTINGS = {
  branding: {
    siteTitle: "동그리의 기록소",
    siteAltName: "동그리 아카이브",
    siteAuthor: "동그리",
    siteDescription: "동그리의 기록소는 기술, 시장, 생활, 미스터리 기록을 구조적으로 정리하는 아카이브입니다.",
  },
  about: {
    description: "보이는 글 하나를 모으고 맥락을 다시 정리하는 동그리의 기록소 블로그입니다.",
  },
  search: {
    description: "입력한 키워드로 공개 글을 빠르게 찾아보는 검색 페이지입니다.",
  },
};
const DEFAULT_OG_IMAGE_PATH = "/og-default.svg";
const API_FALLBACK_ORIGIN = "https://api.example.com";
const PUBLIC_SITE_ORIGIN = "https://example.com";
const KO_BASE_PATH = "/ko";

function withKoPath(path) {
  if (path === "/") {
    return `${KO_BASE_PATH}/`;
  }

  return `${KO_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

function stripKoPrefix(pathname) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (normalized === KO_BASE_PATH) {
    return "/";
  }

  if (normalized.startsWith(`${KO_BASE_PATH}/`)) {
    return normalized.slice(KO_BASE_PATH.length) || "/";
  }

  return normalized;
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function resolveApiOrigin(env) {
  return trimTrailingSlash(env.API_ORIGIN || API_FALLBACK_ORIGIN);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeSiteSettings(value) {
  if (!isRecord(value)) {
    return DEFAULT_SITE_SETTINGS;
  }

  const branding = isRecord(value.branding) ? value.branding : {};
  const about = isRecord(value.about) ? value.about : {};
  const search = isRecord(value.search) ? value.search : {};

  return {
    branding: {
      siteTitle: pickString(branding.siteTitle, DEFAULT_SITE_SETTINGS.branding.siteTitle),
      siteAltName: pickString(branding.siteAltName, DEFAULT_SITE_SETTINGS.branding.siteAltName),
      siteAuthor: pickString(branding.siteAuthor, DEFAULT_SITE_SETTINGS.branding.siteAuthor),
      siteDescription: pickString(branding.siteDescription, DEFAULT_SITE_SETTINGS.branding.siteDescription),
    },
    about: {
      description: pickString(about.description, DEFAULT_SITE_SETTINGS.about.description),
    },
    search: {
      description: pickString(search.description, DEFAULT_SITE_SETTINGS.search.description),
    },
  };
}

function toAbsoluteUrl(origin, pathOrUrl) {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, origin).toString();
  }
}

function stripMarkdown(value) {
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

function buildExcerpt(value, maxLength = 160) {
  const normalized = stripMarkdown(value || "");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength).trimEnd();
  const boundary = slice.lastIndexOf(" ");
  return boundary >= maxLength * 0.6 ? `${slice.slice(0, boundary).trimEnd()}...` : `${slice}...`;
}

function createBreadcrumbStructuredData(origin, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(origin, item.path),
    })),
  };
}

function createWebSiteStructuredData(origin, settings, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.branding.siteTitle,
    alternateName: settings.branding.siteAltName,
    url: toAbsoluteUrl(origin, withKoPath("/")),
    description,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: toAbsoluteUrl(origin, withKoPath("/search?q={search_term_string}")),
      "query-input": "required name=search_term_string",
    },
  };
}

function createWebPageStructuredData(origin, args) {
  const page = {
    "@context": "https://schema.org",
    "@type": args.type || "WebPage",
    name: args.name,
    description: args.description,
    url: toAbsoluteUrl(origin, args.path),
    inLanguage: "ko-KR",
  };

  if (!args.breadcrumbs?.length) {
    return page;
  }

  return [page, createBreadcrumbStructuredData(origin, args.breadcrumbs)];
}

function createCollectionPageStructuredData(origin, args) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: args.name,
      description: args.description,
      url: toAbsoluteUrl(origin, args.path),
      inLanguage: "ko-KR",
    },
    createBreadcrumbStructuredData(origin, args.breadcrumbs),
  ];
}

function createBlogPostingStructuredData(origin, settings, args) {
  const publisherName = args.publisherName || "동그리의 기록소";
  const authorName = args.authorName || "동그리";
  const publisherLogo = args.publisherLogo || DEFAULT_OG_IMAGE_PATH;

  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: args.title,
      description: args.description,
      mainEntityOfPage: toAbsoluteUrl(origin, args.path),
      url: toAbsoluteUrl(origin, args.path),
      image: [toAbsoluteUrl(origin, args.image || DEFAULT_OG_IMAGE_PATH)],
      datePublished: args.publishedAt || undefined,
      dateModified: args.updatedAt || args.publishedAt || undefined,
      articleSection: args.categoryName || undefined,
      keywords: args.tags?.length ? args.tags.join(", ") : undefined,
      author: { "@type": "Person", name: authorName },
      publisher: {
        "@type": "Organization",
        name: publisherName,
        logo: {
          "@type": "ImageObject",
          url: toAbsoluteUrl(origin, publisherLogo),
        },
      },
      inLanguage: "ko-KR",
    },
    createBreadcrumbStructuredData(origin, args.breadcrumbs),
  ];
}

async function fetchPublicData(apiOrigin, path) {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload && payload.success ? payload.data : null;
  } catch {
    return null;
  }
}

async function fetchSiteSettings(apiOrigin) {
  const data = await fetchPublicData(apiOrigin, "/api/public/site-settings");
  return normalizeSiteSettings(data);
}

function matchRoute(pathname) {
  const normalized = stripKoPrefix(pathname);

  if (normalized === "/") return { kind: "home" };
  if (normalized === "/about") return { kind: "about" };
  if (normalized === "/search") return { kind: "search" };
  if (normalized === "/privacy") return { kind: "privacy" };
  if (normalized === "/contact") return { kind: "contact" };
  if (normalized === "/terms") return { kind: "terms" };
  if (normalized === "/disclaimer") return { kind: "disclaimer" };
  if (normalized === "/editorial-policy") return { kind: "editorial-policy" };
  if (normalized === "/test-preview") return { kind: "test-preview" };

  let match = normalized.match(/^\/post\/([^/]+)$/);
  if (match) return { kind: "post", slug: decodeURIComponent(match[1]) };

  match = normalized.match(/^\/category-preview\/([^/]+)$/);
  if (match) return { kind: "category-preview", slug: decodeURIComponent(match[1]) };

  match = normalized.match(/^\/category\/([^/]+)$/);
  if (match) return { kind: "category", slug: decodeURIComponent(match[1]) };

  match = normalized.match(/^\/tag\/([^/]+)$/);
  if (match) return { kind: "tag", slug: decodeURIComponent(match[1]) };

  return { kind: "not-found" };
}

function getDefaultMetadata(origin, path, siteSettings) {
  return {
    title: siteSettings.branding.siteTitle,
    description: siteSettings.branding.siteDescription,
    canonicalUrl: toAbsoluteUrl(origin, path),
    robots: "index,follow",
    ogType: "website",
    ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
    status: 200,
    structuredData: createWebSiteStructuredData(origin, siteSettings, siteSettings.branding.siteDescription),
  };
}

async function buildMetadata(request, env) {
  const url = new URL(request.url);
  const canonicalOrigin = PUBLIC_SITE_ORIGIN;
  const apiOrigin = resolveApiOrigin(env);
  const siteSettings = await fetchSiteSettings(apiOrigin);
  const route = matchRoute(url.pathname);
  const previewRobots = url.hostname.endsWith(".pages.dev") ? "noindex,nofollow" : null;
  const staticPages = {
    privacy: ["개인정보처리방침", "동그리아카이브의 개인정보 처리 방침을 안내합니다.", withKoPath("/privacy")],
    contact: ["문의", "운영 문의, 정정 요청, 저작권 문의 방법을 안내합니다.", withKoPath("/contact")],
    terms: ["이용조건", "동그리아카이브 콘텐츠 이용 조건을 안내합니다.", withKoPath("/terms")],
    disclaimer: ["면책 고지", "콘텐츠 해석 범위와 면책 고지를 안내합니다.", withKoPath("/disclaimer")],
    "editorial-policy": ["편집 정책", "동그리아카이브의 편집 원칙과 기록 기준을 공개합니다.", withKoPath("/editorial-policy")],
  };

  if (route.kind === "home") {
    return {
      ...getDefaultMetadata(canonicalOrigin, withKoPath("/"), siteSettings),
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath("/")),
      robots: previewRobots ?? "index,follow",
    };
  }

  if (route.kind === "about") {
    return {
      title: `소개 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.about.description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath("/about")),
      robots: previewRobots ?? "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        type: "AboutPage",
        name: `소개 | ${siteSettings.branding.siteTitle}`,
        description: siteSettings.about.description,
        path: withKoPath("/about"),
        breadcrumbs: [
          { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
          { name: "소개", path: withKoPath("/about") },
        ],
      }),
    };
  }

  if (route.kind === "search") {
    return {
      title: `검색 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.search.description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath("/search")),
      robots: previewRobots ?? "noindex,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        name: `검색 | ${siteSettings.branding.siteTitle}`,
        description: siteSettings.search.description,
        path: withKoPath("/search"),
        breadcrumbs: [
          { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
          { name: "검색", path: withKoPath("/search") },
        ],
      }),
    };
  }

  if (route.kind === "test-preview") {
    return {
      title: `배포 전 테스트 | ${siteSettings.branding.siteTitle}`,
      description: "배포 전 공개 페이지/정책 페이지/피드 동작을 빠르게 확인하기 위한 내부 점검 페이지입니다.",
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath("/test-preview")),
      robots: "noindex,nofollow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        name: `배포 전 테스트 | ${siteSettings.branding.siteTitle}`,
        description: "배포 전 공개 페이지/정책 페이지/피드 동작을 빠르게 확인하기 위한 내부 점검 페이지입니다.",
        path: withKoPath("/test-preview"),
      }),
    };
  }

  if (staticPages[route.kind]) {
    const [label, description, path] = staticPages[route.kind];
    return {
      title: `${label} | ${siteSettings.branding.siteTitle}`,
      description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, path),
      robots: previewRobots ?? "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        name: `${label} | ${siteSettings.branding.siteTitle}`,
        description,
        path,
        breadcrumbs: [
          { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
          { name: label, path },
        ],
      }),
    };
  }

  if (route.kind === "category-preview") {
    return {
      title: `카테고리 프리뷰 | ${siteSettings.branding.siteTitle}`,
      description: "루트 카테고리와 하위 카테고리 레이아웃을 검토하기 위한 비색인 프리뷰 페이지입니다.",
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/category/${route.slug}`)),
      robots: "noindex,nofollow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        name: `카테고리 프리뷰 | ${siteSettings.branding.siteTitle}`,
        description: "루트 카테고리와 하위 카테고리 레이아웃을 검토하기 위한 비색인 프리뷰 페이지입니다.",
        path: withKoPath(`/category-preview/${route.slug}`),
      }),
    };
  }

  if (route.kind === "category") {
    const feed = await fetchPublicData(apiOrigin, `/api/public/categories/${encodeURIComponent(route.slug)}/posts`);

    if (!feed) {
      return {
        title: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
        description: "요청한 카테고리를 찾지 못했습니다.",
        canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/category/${route.slug}`)),
        robots: "noindex,follow",
        ogType: "website",
        ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
        status: 404,
        structuredData: createWebPageStructuredData(canonicalOrigin, {
          name: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
          description: "요청한 카테고리를 찾지 못했습니다.",
          path: withKoPath(`/category/${route.slug}`),
        }),
      };
    }

    const description = feed.category.description || `${feed.category.name} 공개 글을 모아보는 카테고리 페이지입니다.`;
    return {
      title: `${feed.category.name} | ${siteSettings.branding.siteTitle}`,
      description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/category/${feed.category.slug}`)),
      robots: previewRobots ?? "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createCollectionPageStructuredData(canonicalOrigin, {
        name: `${feed.category.name} | ${siteSettings.branding.siteTitle}`,
        description,
        path: withKoPath(`/category/${feed.category.slug}`),
        breadcrumbs: [
          { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
          { name: feed.category.name, path: withKoPath(`/category/${feed.category.slug}`) },
        ],
      }),
    };
  }

  if (route.kind === "tag") {
    const feed = await fetchPublicData(apiOrigin, `/api/public/tags/${encodeURIComponent(route.slug)}/posts`);
    const tagName = feed?.tag?.name ? `#${feed.tag.name}` : "태그";
    const description = feed?.tag?.name ? `#${feed.tag.name} 태그로 묶인 공개 글 목록입니다.` : "태그별 공개 글 목록입니다.";
    return {
      title: `${tagName} | ${siteSettings.branding.siteTitle}`,
      description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/tag/${route.slug}`)),
      robots: previewRobots ?? "noindex,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createWebPageStructuredData(canonicalOrigin, {
        name: `${tagName} | ${siteSettings.branding.siteTitle}`,
        description,
        path: withKoPath(`/tag/${route.slug}`),
        breadcrumbs: [
          { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
          { name: tagName, path: withKoPath(`/tag/${route.slug}`) },
        ],
      }),
    };
  }

  if (route.kind === "post") {
    const post = await fetchPublicData(apiOrigin, `/api/public/posts/${encodeURIComponent(route.slug)}`);

    if (!post) {
      return {
        title: `글을 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
        description: "요청한 글을 찾지 못했습니다.",
        canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/post/${route.slug}`)),
        robots: "noindex,follow",
        ogType: "website",
        ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
        status: 404,
        structuredData: createWebPageStructuredData(canonicalOrigin, {
          name: `글을 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
          description: "요청한 글을 찾지 못했습니다.",
          path: withKoPath(`/post/${route.slug}`),
        }),
      };
    }

    const seoTitle = typeof post.seoTitle === "string" && post.seoTitle.trim() ? post.seoTitle.trim() : null;
    const seoDescription =
      typeof post.seoDescription === "string" && post.seoDescription.trim() ? post.seoDescription.trim() : null;
    const description = seoDescription || post.excerpt || post.subtitle || buildExcerpt(post.content || post.title);
    const breadcrumbs = [{ name: siteSettings.branding.siteTitle, path: withKoPath("/") }];

    if (post.category?.name && post.category?.slug) {
      breadcrumbs.push({ name: post.category.name, path: withKoPath(`/category/${post.category.slug}`) });
    }

    breadcrumbs.push({ name: post.title, path: withKoPath(`/post/${post.slug}`) });

    return {
      title: `${seoTitle || post.title} | ${siteSettings.branding.siteTitle}`,
      description,
      canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath(`/post/${post.slug}`)),
      robots: previewRobots ?? "index,follow",
      ogType: "article",
      ogImage: toAbsoluteUrl(canonicalOrigin, post.coverImage || DEFAULT_OG_IMAGE_PATH),
      status: 200,
      structuredData: createBlogPostingStructuredData(canonicalOrigin, siteSettings, {
        title: seoTitle || post.title,
        description,
        path: withKoPath(`/post/${post.slug}`),
        image: post.coverImage || DEFAULT_OG_IMAGE_PATH,
        publishedAt: post.publishedAt || post.createdAt,
        updatedAt: post.updatedAt,
        categoryName: post.category?.name || undefined,
        tags: Array.isArray(post.tags) ? post.tags.map((tag) => tag.name) : [],
        authorName: "동그리",
        publisherName: "동그리의 기록소",
        publisherLogo: DEFAULT_OG_IMAGE_PATH,
        breadcrumbs,
      }),
    };
  }

  return {
    title: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
    description: "요청한 페이지를 찾지 못했습니다.",
    canonicalUrl: toAbsoluteUrl(canonicalOrigin, withKoPath("/404")),
    robots: "noindex,nofollow",
    ogType: "website",
    ogImage: toAbsoluteUrl(canonicalOrigin, DEFAULT_OG_IMAGE_PATH),
    status: 404,
    structuredData: createWebPageStructuredData(canonicalOrigin, {
      name: `페이지를 찾을 수 없음 | ${siteSettings.branding.siteTitle}`,
      description: "요청한 페이지를 찾지 못했습니다.",
      path: withKoPath("/404"),
    }),
  };
}

class AttributeHandler {
  constructor(attribute, value) {
    this.attribute = attribute;
    this.value = value;
  }

  element(element) {
    element.setAttribute(this.attribute, this.value);
  }
}

class TextHandler {
  constructor(value) {
    this.value = value;
  }

  element(element) {
    element.setInnerContent(this.value, { html: false });
  }
}

async function renderSeoShell(request, env) {
  const url = new URL(request.url);
  const assetRequest = new Request(new URL("/", url), request);
  const shell = await env.ASSETS.fetch(assetRequest);
  const metadata = await buildMetadata(request, env);
  const rewritten = new HTMLRewriter()
    .on("title", new TextHandler(metadata.title))
    .on('meta[name="description"]', new AttributeHandler("content", metadata.description))
    .on('meta[name="robots"]', new AttributeHandler("content", metadata.robots))
    .on('link[rel="canonical"]', new AttributeHandler("href", metadata.canonicalUrl))
    .on('meta[property="og:title"]', new AttributeHandler("content", metadata.title))
    .on('meta[property="og:description"]', new AttributeHandler("content", metadata.description))
    .on('meta[property="og:url"]', new AttributeHandler("content", metadata.canonicalUrl))
    .on('meta[property="og:type"]', new AttributeHandler("content", metadata.ogType))
    .on('meta[property="og:image"]', new AttributeHandler("content", metadata.ogImage))
    .on('meta[name="twitter:title"]', new AttributeHandler("content", metadata.title))
    .on('meta[name="twitter:description"]', new AttributeHandler("content", metadata.description))
    .on('meta[name="twitter:image"]', new AttributeHandler("content", metadata.ogImage))
    .on("#structured-data", new TextHandler(JSON.stringify(metadata.structuredData)))
    .transform(shell);

  const response = new Response(rewritten.body, {
    status: metadata.status || 200,
    headers: rewritten.headers,
  });
  response.headers.set("X-Robots-Tag", metadata.robots);
  return response;
}

function shouldServeStaticAsset(pathname) {
  return pathname.startsWith("/assets/") || /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|eot|txt)$/i.test(pathname);
}

function renderRobotsTxt(request) {
  const url = new URL(request.url);
  const body = url.hostname.endsWith(".pages.dev")
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${toAbsoluteUrl(PUBLIC_SITE_ORIGIN, "/sitemap.xml")}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const apiOrigin = resolveApiOrigin(env);

    if (pathname === "/") {
      return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath("/")), 301);
    }

    if (pathname === "/rss.xml") {
      return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath("/rss.xml")), 301);
    }

    if (pathname === "/feed.xml" || pathname === "/ko/feed.xml") {
      return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath("/rss.xml")), 301);
    }

    if (!pathname.startsWith(`${KO_BASE_PATH}/`)) {
      if (pathname === "/about" || pathname === "/search") {
        return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath(pathname)), 301);
      }

      let legacyMatch = pathname.match(/^\/post\/([^/]+)\/?$/);
      if (legacyMatch) return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath(`/post/${legacyMatch[1]}`)), 301);

      legacyMatch = pathname.match(/^\/category\/([^/]+)\/?$/);
      if (legacyMatch) return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath(`/category/${legacyMatch[1]}`)), 301);

      legacyMatch = pathname.match(/^\/tag\/([^/]+)\/?$/);
      if (legacyMatch) return Response.redirect(toAbsoluteUrl(PUBLIC_SITE_ORIGIN, withKoPath(`/tag/${legacyMatch[1]}`)), 301);
    }

    const resourcePath = pathname.startsWith(`${KO_BASE_PATH}/`) ? pathname.slice(KO_BASE_PATH.length) : pathname;

    if (resourcePath === "/rss.xml" || resourcePath === "/feed.xml" || resourcePath === "/sitemap.xml") {
      const upstreamPath = resourcePath === "/feed.xml" ? "/rss.xml" : resourcePath;
      return fetch(new Request(`${apiOrigin}${upstreamPath}`, request));
    }

    if (pathname === "/robots.txt") {
      return renderRobotsTxt(request);
    }

    if (shouldServeStaticAsset(pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      return renderSeoShell(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

