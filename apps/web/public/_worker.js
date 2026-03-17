const SITE_TITLE = "Donggri 기록들";
const SITE_ALT_NAME = "Donggri Blog";
const SITE_AUTHOR = "동그리";
const SITE_DESCRIPTION =
  "문화와 축제, 역사와 이슈, 주식과 크립토, 신기술, 개발, 여행과 일상을 차분하게 기록하는 블로그입니다.";
const ABOUT_DESCRIPTION =
  "Donggri 기록들은 문화와 축제, 역사와 이슈, 주식과 크립토, 신기술, 개발, 여행과 일상을 한곳에 차분히 모아두는 공개 블로그입니다.";
const SEARCH_DESCRIPTION =
  "행사, 문화, 이슈, 미스터리, 주식, 크립토, AI 같은 키워드로 공개 글을 다시 찾을 수 있습니다.";
const DEFAULT_OG_IMAGE_PATH = "/og-default.svg";
const API_FALLBACK_ORIGIN = "https://donggeuri-api.wlflqna.workers.dev";

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function resolveApiOrigin(env) {
  return trimTrailingSlash(env.API_ORIGIN || API_FALLBACK_ORIGIN);
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
  const normalized = stripMarkdown(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength).trimEnd();
  const boundary = slice.lastIndexOf(" ");

  if (boundary >= maxLength * 0.6) {
    return `${slice.slice(0, boundary).trimEnd()}...`;
  }

  return `${slice}...`;
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

function createWebSiteStructuredData(origin, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_TITLE,
    alternateName: SITE_ALT_NAME,
    url: toAbsoluteUrl(origin, "/"),
    description,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: toAbsoluteUrl(origin, "/search?q={search_term_string}"),
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

function createBlogPostingStructuredData(origin, args) {
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
      author: {
        "@type": "Person",
        name: SITE_AUTHOR,
      },
      publisher: {
        "@type": "Person",
        name: SITE_AUTHOR,
      },
      inLanguage: "ko-KR",
    },
    createBreadcrumbStructuredData(origin, args.breadcrumbs),
  ];
}

async function fetchPublicData(apiOrigin, path) {
  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      headers: {
        Accept: "application/json",
      },
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

function matchRoute(pathname) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (normalized === "/") {
    return { kind: "home" };
  }

  if (normalized === "/about") {
    return { kind: "about" };
  }

  if (normalized === "/search") {
    return { kind: "search" };
  }

  let match = normalized.match(/^\/post\/([^/]+)$/);

  if (match) {
    return { kind: "post", slug: decodeURIComponent(match[1]) };
  }

  match = normalized.match(/^\/category\/([^/]+)$/);

  if (match) {
    return { kind: "category", slug: decodeURIComponent(match[1]) };
  }

  match = normalized.match(/^\/tag\/([^/]+)$/);

  if (match) {
    return { kind: "tag", slug: decodeURIComponent(match[1]) };
  }

  return { kind: "fallback" };
}

function getDefaultMetadata(origin, path) {
  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    canonicalUrl: toAbsoluteUrl(origin, path),
    robots: "index,follow",
    ogType: "website",
    ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
    structuredData: createWebSiteStructuredData(origin, SITE_DESCRIPTION),
  };
}

async function buildMetadata(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const apiOrigin = resolveApiOrigin(env);
  const route = matchRoute(url.pathname);

  if (route.kind === "home") {
    return {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      canonicalUrl: toAbsoluteUrl(origin, "/"),
      robots: "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
      structuredData: createWebSiteStructuredData(origin, SITE_DESCRIPTION),
    };
  }

  if (route.kind === "about") {
    return {
      title: `소개 | ${SITE_TITLE}`,
      description: ABOUT_DESCRIPTION,
      canonicalUrl: toAbsoluteUrl(origin, "/about"),
      robots: "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
      structuredData: createWebPageStructuredData(origin, {
        type: "AboutPage",
        name: `소개 | ${SITE_TITLE}`,
        description: ABOUT_DESCRIPTION,
        path: "/about",
        breadcrumbs: [
          { name: SITE_TITLE, path: "/" },
          { name: "소개", path: "/about" },
        ],
      }),
    };
  }

  if (route.kind === "search") {
    return {
      title: `검색 | ${SITE_TITLE}`,
      description: SEARCH_DESCRIPTION,
      canonicalUrl: toAbsoluteUrl(origin, "/search"),
      robots: "noindex,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
      structuredData: createWebPageStructuredData(origin, {
        name: `검색 | ${SITE_TITLE}`,
        description: SEARCH_DESCRIPTION,
        path: "/search",
        breadcrumbs: [
          { name: SITE_TITLE, path: "/" },
          { name: "검색", path: "/search" },
        ],
      }),
    };
  }

  if (route.kind === "category") {
    const feed = await fetchPublicData(apiOrigin, `/api/public/categories/${encodeURIComponent(route.slug)}/posts`);

    if (!feed) {
      return {
        ...getDefaultMetadata(origin, url.pathname),
        canonicalUrl: toAbsoluteUrl(origin, url.pathname),
        robots: "noindex,follow",
      };
    }

    return {
      title: `${feed.category.name} | ${SITE_TITLE}`,
      description: feed.category.description || `${feed.category.name} 갈래의 공개 글을 모아보는 페이지입니다.`,
      canonicalUrl: toAbsoluteUrl(origin, `/category/${feed.category.slug}`),
      robots: "index,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
      structuredData: createCollectionPageStructuredData(origin, {
        name: `${feed.category.name} | ${SITE_TITLE}`,
        description: feed.category.description || `${feed.category.name} 갈래의 공개 글을 모아보는 페이지입니다.`,
        path: `/category/${feed.category.slug}`,
        breadcrumbs: [
          { name: SITE_TITLE, path: "/" },
          { name: feed.category.name, path: `/category/${feed.category.slug}` },
        ],
      }),
    };
  }

  if (route.kind === "tag") {
    const feed = await fetchPublicData(apiOrigin, `/api/public/tags/${encodeURIComponent(route.slug)}/posts`);
    const tagName = feed?.tag?.name ? `#${feed.tag.name}` : "태그";
    const description = feed?.tag?.name
      ? `#${feed.tag.name}로 묶인 공개 글 목록입니다.`
      : "선택한 태그에 연결된 공개 글을 모아보는 페이지입니다.";

    return {
      title: `${tagName} | ${SITE_TITLE}`,
      description,
      canonicalUrl: toAbsoluteUrl(origin, `/tag/${route.slug}`),
      robots: "noindex,follow",
      ogType: "website",
      ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
      structuredData: createWebPageStructuredData(origin, {
        name: `${tagName} | ${SITE_TITLE}`,
        description,
        path: `/tag/${route.slug}`,
        breadcrumbs: [
          { name: SITE_TITLE, path: "/" },
          { name: tagName, path: `/tag/${route.slug}` },
        ],
      }),
    };
  }

  if (route.kind === "post") {
    const post = await fetchPublicData(apiOrigin, `/api/public/posts/${encodeURIComponent(route.slug)}`);

    if (!post) {
      return {
        title: `글을 찾을 수 없음 | ${SITE_TITLE}`,
        description: SITE_DESCRIPTION,
        canonicalUrl: toAbsoluteUrl(origin, url.pathname),
        robots: "noindex,follow",
        ogType: "website",
        ogImage: toAbsoluteUrl(origin, DEFAULT_OG_IMAGE_PATH),
        structuredData: createWebPageStructuredData(origin, {
          name: `글을 찾을 수 없음 | ${SITE_TITLE}`,
          description: SITE_DESCRIPTION,
          path: url.pathname,
          breadcrumbs: [
            { name: SITE_TITLE, path: "/" },
            { name: "글", path: url.pathname },
          ],
        }),
      };
    }

    const description = post.excerpt || post.subtitle || buildExcerpt(post.content || post.title);
    const breadcrumbs = [{ name: SITE_TITLE, path: "/" }];

    if (post.category?.name && post.category?.slug) {
      breadcrumbs.push({
        name: post.category.name,
        path: `/category/${post.category.slug}`,
      });
    }

    breadcrumbs.push({
      name: post.title,
      path: `/post/${post.slug}`,
    });

    return {
      title: `${post.title} | ${SITE_TITLE}`,
      description,
      canonicalUrl: toAbsoluteUrl(origin, `/post/${post.slug}`),
      robots: "index,follow",
      ogType: "article",
      ogImage: toAbsoluteUrl(origin, post.coverImage || DEFAULT_OG_IMAGE_PATH),
      structuredData: createBlogPostingStructuredData(origin, {
        title: post.title,
        description,
        path: `/post/${post.slug}`,
        image: post.coverImage || DEFAULT_OG_IMAGE_PATH,
        publishedAt: post.publishedAt || post.createdAt,
        updatedAt: post.updatedAt,
        categoryName: post.category?.name || undefined,
        tags: Array.isArray(post.tags) ? post.tags.map((tag) => tag.name) : [],
        breadcrumbs,
      }),
    };
  }

  return {
    ...getDefaultMetadata(origin, url.pathname),
    canonicalUrl: toAbsoluteUrl(origin, url.pathname),
    robots: "noindex,follow",
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

  return new HTMLRewriter()
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
}

function shouldServeStaticAsset(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|eot|txt)$/i.test(pathname)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const apiOrigin = resolveApiOrigin(env);

    if (pathname === "/rss.xml" || pathname === "/sitemap.xml") {
      const proxiedRequest = new Request(`${apiOrigin}${pathname}`, request);
      return fetch(proxiedRequest);
    }

    if (shouldServeStaticAsset(pathname) || pathname === "/robots.txt") {
      return env.ASSETS.fetch(request);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      return renderSeoShell(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
