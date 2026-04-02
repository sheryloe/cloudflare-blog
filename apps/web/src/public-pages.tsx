import {
  DEFAULT_SITE_SETTINGS,
  type Category,
  type CategoryFeed,
  type Post,
  type PostSummary,
  type SiteSettings,
  type TagFeed,
  cloneSiteSettings,
} from "@cloudflare-blog/shared";
import { ArrowUpRight, MoveRight } from "lucide-react";
import type { FormEvent } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useParams, useSearchParams } from "react-router-dom";

import { AnalyticsTracker } from "./components/analytics-tracker";
import { MarkdownContent } from "./components/markdown-content";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  getCategoryFeed,
  getPost,
  getSiteSettings,
  getTagFeed,
  getWorkerResourceUrl,
  listCategories,
  listPosts,
  listTopPosts,
  recordPostView,
  searchPosts,
} from "./lib/api";
import {
  buildExcerpt,
  createBlogPostingStructuredData,
  createCollectionPageStructuredData,
  createWebPageStructuredData,
  createWebSiteStructuredData,
  type PageMetadataInput,
  useSeoMetadata,
} from "./lib/seo";
import { cn } from "./lib/utils";
import { ErrorMessage } from "./ui";

const KO_BASE_PATH = "/ko";

function withKoPath(path: string) {
  if (path === "/") {
    return `${KO_BASE_PATH}/`;
  }

  return `${KO_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

const RSS_FEED_URL = withKoPath("/rss.xml");
const FEED_XML_URL = withKoPath("/feed.xml");
const SITEMAP_URL = withKoPath("/sitemap.xml");
const DEFAULT_OG_IMAGE_PATH = "/og-default.svg";
const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);
type GiscusRuntimeConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: string;
  theme: string;
};

type CategoryTheme = "info" | "world" | "market" | "tech" | "personal" | "general";
type SummarySource = "excerpt" | "subtitle" | "contentLead" | "template";

type CategoryRenderRule = {
  key: CategoryTheme;
  listKicker: string;
  topKicker: string;
  summaryPriority: SummarySource[];
  buildFallbackSummary: (categoryName: string) => string;
  buildLeadIntro: (categoryName: string) => string;
};

function resolveGiscusConfig(): GiscusRuntimeConfig | null {
  const repo = import.meta.env.VITE_GISCUS_REPO?.trim() ?? "";
  const repoId = import.meta.env.VITE_GISCUS_REPO_ID?.trim() ?? "";
  const category = import.meta.env.VITE_GISCUS_CATEGORY?.trim() ?? "";
  const categoryId = import.meta.env.VITE_GISCUS_CATEGORY_ID?.trim() ?? "";
  const mapping = import.meta.env.VITE_GISCUS_MAPPING?.trim() || "pathname";
  const theme = import.meta.env.VITE_GISCUS_THEME?.trim() || "light";

  if (!repo || !repoId || !category || !categoryId) {
    return null;
  }

  return {
    repo,
    repoId,
    category,
    categoryId,
    mapping,
    theme,
  };
}

const publicLinks = [
  { href: withKoPath("/"), label: "홈", external: false },
  { href: withKoPath("/about"), label: "소개", external: false },
  { href: withKoPath("/search"), label: "검색", external: false },
];

const pageDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

const ARCHIVE_GROUPS = [
  {
    eyebrow: "정보의 기록",
    title: "문화와 공간, 축제와 시즌, 행사와 현장을 기록합니다.",
    description:
      "현장의 분위기와 계절의 결을 오래 남기기 위해, 문화와 공간 기반의 아카이브를 쌓아가는 카테고리입니다.",
    items: ["문화와 공간", "축제와 시즌", "행사와 현장"],
  },
  {
    eyebrow: "세상의 기록",
    title: "역사와 문화, 이슈와 해설, 미스터리와 전설을 다룹니다.",
    description:
      "흐름을 이해하기 위해 배경을 정리하고, 논점과 해석을 함께 기록하는 해설형 카테고리입니다.",
    items: ["역사와 문화", "이슈와 해설", "미스터리와 전설"],
  },
  {
    eyebrow: "시장의 기록",
    title: "주식과 크립토의 흐름을 관찰하고 기록합니다.",
    description:
      "단기 변동보다 중장기 패턴과 맥락을 중심으로, 시장의 변화 포인트를 정리하는 카테고리입니다.",
    items: ["주식의 흐름", "크립토의 흐름"],
  },
  {
    eyebrow: "기술의 기록",
    title: "신기술, 도구 리뷰, 글 분석을 실험하고 정리합니다.",
    description:
      "기술 트렌드와 도구 활용 경험을 비교 가능한 형태로 남기고, 글/콘텐츠 분석을 덧붙이는 카테고리입니다.",
    items: ["신기술과 도구", "유튜브 리뷰", "글 분석과 해설"],
  },
  {
    eyebrow: "동그리의 기록",
    title: "개발, 여행, 일상 메모를 개인 아카이브로 남깁니다.",
    description:
      "작업 과정과 생활의 장면을 함께 기록해, 시간이 지나도 다시 꺼내볼 수 있는 개인 기록 카테고리입니다.",
    items: ["개발과 프로그래밍", "여행과 기록", "일상과 메모"],
  },
] as const;

const CATEGORY_THEME_MATCHERS: Array<{ key: CategoryTheme; keywords: string[] }> = [
  {
    key: "info",
    keywords: ["정보의 기록", "문화와 공간", "축제와 시즌", "행사와 현장", "문화", "축제", "행사", "공간"],
  },
  {
    key: "world",
    keywords: ["세상의 기록", "역사와 문화", "이슈와 해설", "미스터리와 전설", "역사", "이슈", "해설", "전설"],
  },
  {
    key: "market",
    keywords: ["시장의 기록", "주식의 흐름", "크립토의 흐름", "주식", "크립토", "코인", "시장"],
  },
  {
    key: "tech",
    keywords: ["기술의 기록", "신기술과 도구", "유튜브 리뷰", "글 분석과 해설", "기술", "도구", "리뷰", "분석"],
  },
  {
    key: "personal",
    keywords: ["동그리의 기록", "개발과 프로그래밍", "여행과 기록", "일상과 메모", "개발", "여행", "일상", "메모"],
  },
];

const CATEGORY_RENDER_RULES: Record<CategoryTheme, CategoryRenderRule> = {
  info: {
    key: "info",
    listKicker: "현장 기록",
    topKicker: "장면 스냅샷",
    summaryPriority: ["excerpt", "contentLead", "subtitle", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 카테고리의 현장 분위기와 핵심 포인트를 빠르게 파악할 수 있도록 정리한 글입니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 관점에서 현장 맥락, 핵심 장면, 후속 확인 포인트를 빠르게 이해할 수 있도록 구성했습니다.`,
  },
  world: {
    key: "world",
    listKicker: "배경 해설",
    topKicker: "맥락 브리핑",
    summaryPriority: ["excerpt", "contentLead", "subtitle", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 카테고리의 배경 정보와 쟁점을 함께 읽을 수 있도록 핵심 흐름을 압축했습니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 주제를 배경-이슈-해석 순서로 연결해, 처음 보는 독자도 맥락을 놓치지 않도록 정리했습니다.`,
  },
  market: {
    key: "market",
    listKicker: "흐름 분석",
    topKicker: "시장 브리프",
    summaryPriority: ["excerpt", "contentLead", "subtitle", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 카테고리의 주요 변수와 흐름 변화를 데이터 관점에서 짧게 정리했습니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 흐름을 가격 변화 자체보다 변수와 맥락 중심으로 정리해, 판단 근거를 빠르게 확인할 수 있게 했습니다.`,
  },
  tech: {
    key: "tech",
    listKicker: "실험 기록",
    topKicker: "도구 리뷰",
    summaryPriority: ["contentLead", "excerpt", "subtitle", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 카테고리의 도구 사용 경험과 적용 포인트를 실무 기준으로 요약했습니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 주제를 기준으로 도구 선택 이유, 적용 과정, 실사용 포인트를 재현 가능한 형태로 정리했습니다.`,
  },
  personal: {
    key: "personal",
    listKicker: "개인 아카이브",
    topKicker: "기록 노트",
    summaryPriority: ["subtitle", "excerpt", "contentLead", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 카테고리의 경험과 메모를 다시 참고하기 쉽도록 핵심 장면 중심으로 정리했습니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 기록을 시간 흐름에 따라 정리해, 나중에 다시 읽어도 맥락이 이어지도록 구성했습니다.`,
  },
  general: {
    key: "general",
    listKicker: "아카이브",
    topKicker: "추천 글",
    summaryPriority: ["excerpt", "subtitle", "contentLead", "template"],
    buildFallbackSummary: (categoryName) =>
      `${categoryName} 주제의 핵심 내용을 짧고 명확하게 정리한 기록입니다.`,
    buildLeadIntro: (categoryName) =>
      `이 글은 ${categoryName} 주제의 핵심 맥락을 먼저 이해하고 본문을 따라갈 수 있도록 안내형 구조로 작성했습니다.`,
  },
};

function formatDate(value?: string | null) {
  if (!value) {
    return "날짜 미정";
  }

  return pageDateFormatter.format(new Date(value));
}

function estimateReadMinutes(content: string) {
  const words = content
    .replace(/[#>*_`~[\]()!-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

function normalizeForCompare(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_~"'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLeadSummary(post: Post | null): string | null {
  if (!post) {
    return null;
  }

  const summary = (post.excerpt ?? post.subtitle ?? "").trim();

  if (!summary) {
    return null;
  }

  const normalizedSummary = normalizeForCompare(summary);
  const normalizedBodyLead = normalizeForCompare(buildExcerpt(post.content, Math.max(220, summary.length + 40)));

  if (!normalizedSummary || !normalizedBodyLead) {
    return summary;
  }

  const isDuplicatedLead =
    normalizedBodyLead.startsWith(normalizedSummary) || normalizedSummary.startsWith(normalizedBodyLead);

  return isDuplicatedLead ? null : summary;
}

function resolveCategoryRenderRule(category?: Category | null): CategoryRenderRule {
  if (!category) {
    return CATEGORY_RENDER_RULES.general;
  }

  const normalized = `${category.slug} ${category.name}`.toLocaleLowerCase("ko-KR");

  for (const matcher of CATEGORY_THEME_MATCHERS) {
    if (matcher.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("ko-KR")))) {
      return CATEGORY_RENDER_RULES[matcher.key];
    }
  }

  return CATEGORY_RENDER_RULES.general;
}

function resolveCardSummary(
  post: Pick<PostSummary, "excerpt" | "subtitle" | "contentLead" | "category">,
  rule: CategoryRenderRule,
): string {
  for (const source of rule.summaryPriority) {
    if (source === "excerpt") {
      const excerpt = (post.excerpt ?? "").trim();
      if (excerpt) {
        return excerpt;
      }
      continue;
    }

    if (source === "subtitle") {
      const subtitle = (post.subtitle ?? "").trim();
      if (subtitle) {
        return subtitle;
      }
      continue;
    }

    if (source === "contentLead") {
      const contentLead = (post.contentLead ?? "").trim();
      if (contentLead) {
        return contentLead;
      }
      continue;
    }

    if (source === "template") {
      return rule.buildFallbackSummary(post.category?.name ?? "기록");
    }
  }

  return rule.buildFallbackSummary(post.category?.name ?? "기록");
}

function resolveLeadIntro(post: Post, rule: CategoryRenderRule): string {
  return rule.buildLeadIntro(post.category?.name ?? "기록");
}

function parseYoutubeVideo(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");
    let id = "";

    if (hostname === "youtu.be") {
      id = url.pathname.slice(1);
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v") ?? "";
      } else if (url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/").at(-1) ?? "";
      } else if (url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/").at(-1) ?? "";
      }
    }

    return id || null;
  } catch {
    return null;
  }
}

function buildCategoryTree(categories: Category[]) {
  const items = [...categories].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  const byId = new Map(items.map((category) => [category.id, category]));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  items.forEach((category) => {
    if (category.parentId && byId.has(category.parentId)) {
      children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
      return;
    }

    roots.push(category);
  });

  return roots.map((category) => ({
    category,
    children: (children.get(category.id) ?? []).sort((left, right) => left.name.localeCompare(right.name, "ko")),
  }));
}

function usePageMetadata(metadata: PageMetadataInput) {
  useSeoMetadata(metadata);
}

function NavigationLink(props: { href: string; label: string; external?: boolean }) {
  const location = useLocation();
  const normalizedHref = props.href.length > 1 ? props.href.replace(/\/$/, "") : props.href;
  const normalizedPathname = location.pathname.length > 1 ? location.pathname.replace(/\/$/, "") : location.pathname;
  const isActive =
    !props.external &&
    (normalizedHref === "/"
      ? normalizedPathname === "/"
      : normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`));

  if (props.external) {
    return (
      <a href={props.href} className="simple-nav-link">
        {props.label}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <Link to={props.href} className={cn("simple-nav-link", isActive && "simple-nav-link-active")}>
      {props.label}
    </Link>
  );
}

function CategoryChip(props: { category?: Category | null; fallback?: string }) {
  const label = props.category?.name ?? props.fallback ?? "미분류";

  if (props.category?.slug) {
    return (
      <Link to={withKoPath(`/category/${props.category.slug}`)} className="simple-chip simple-chip-link">
        {label}
      </Link>
    );
  }

  return <span className="simple-chip">{label}</span>;
}

function ArchiveGroupCard(props: (typeof ARCHIVE_GROUPS)[number]) {
  return (
    <article className="topic-card">
      <p className="sidebar-box__eyebrow">{props.eyebrow}</p>
      <h3 className="topic-card__title">{props.title}</h3>
        <p className="topic-card__text">{props.description}</p>
        <div className="topic-card__tags">
          {props.items.map((item) => (
            <span key={item} className="simple-chip simple-chip--archive">
              {item}
            </span>
          ))}
        </div>
      </article>
  );
}

function PostListItem(props: { post: PostSummary }) {
  const renderRule = resolveCategoryRenderRule(props.post.category);
  const summary = resolveCardSummary(props.post, renderRule);

  return (
    <article className={cn("post-row", `post-row--${renderRule.key}`)}>
      <div className="post-row__body">
        <div className="post-row__meta">
          <CategoryChip category={props.post.category} />
          <span className={cn("category-kicker", `category-kicker--${renderRule.key}`)}>{renderRule.listKicker}</span>
          <span>{formatDate(props.post.publishedAt ?? props.post.updatedAt)}</span>
          {typeof props.post.viewCount === "number" ? <span>조회 {props.post.viewCount}</span> : null}
        </div>
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="post-row__title">
          {props.post.title}
        </Link>
        <p className="post-row__summary">{summary}</p>
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="simple-inline-link">
          자세히 보기
          <MoveRight className="h-4 w-4" />
        </Link>
      </div>
      {props.post.coverImage ? (
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="post-row__thumb">
          <img src={props.post.coverImage} alt={props.post.coverAlt || props.post.title} />
        </Link>
      ) : null}
    </article>
  );
}

function TopPostCard(props: { post: PostSummary }) {
  const renderRule = resolveCategoryRenderRule(props.post.category);
  const summary = resolveCardSummary(props.post, renderRule);

  return (
    <article className={cn("top-post-card", `top-post-card--${renderRule.key}`)}>
      <Link to={withKoPath(`/post/${props.post.slug}`)} className="top-post-card__media">
        {props.post.coverImage ? (
          <img src={props.post.coverImage} alt={props.post.coverAlt || props.post.title} />
        ) : (
          <div className="top-post-card__placeholder">{props.post.title}</div>
        )}
      </Link>
      <div className="top-post-card__body">
        <div className="top-post-card__meta">
          <span className={cn("top-post-card__kicker", `top-post-card__kicker--${renderRule.key}`)}>{renderRule.topKicker}</span>
          <span>{typeof props.post.viewCount === "number" ? `조회 ${props.post.viewCount}` : "조회 집계중"}</span>
        </div>
        <Link to={withKoPath(`/post/${props.post.slug}`)} className="top-post-card__title">
          {props.post.title}
        </Link>
        <p className="top-post-card__summary">{summary}</p>
      </div>
    </article>
  );
}

function SidebarCategoryTree(props: { categories: Category[] }) {
  const tree = useMemo(() => buildCategoryTree(props.categories), [props.categories]);

  if (!tree.length) {
    return (
      <div className="sidebar-tree">
        {ARCHIVE_GROUPS.map((group) => (
          <div key={group.eyebrow} className="sidebar-tree__branch">
            <div className="sidebar-tree__parent sidebar-tree__parent-static">{group.eyebrow}</div>
            <div className="sidebar-tree__children">
              {group.items.map((item) => (
                <div key={item} className="sidebar-tree__child sidebar-tree__child-static">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sidebar-tree">
      {tree.map((node) => (
        <div key={node.category.id} className="sidebar-tree__branch">
          <Link to={withKoPath(`/category/${node.category.slug}`)} className="sidebar-tree__parent">
            <span>{node.category.name}</span>
            <MoveRight className="h-4 w-4" />
          </Link>
          {node.children.length ? (
            <div className="sidebar-tree__children">
              {node.children.map((child) => (
                <Link key={child.id} to={withKoPath(`/category/${child.slug}`)} className="sidebar-tree__child">
                  <span>{child.name}</span>
                  <MoveRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Sidebar(props: { categories: Category[] }) {
  const siteSettings = useSiteSettings();

  return (
    <aside className="simple-sidebar">
      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">{siteSettings.branding.siteTitle}</p>
        <h2 className="sidebar-box__title">{siteSettings.sidebar.title}</h2>
        <p className="sidebar-box__text">{siteSettings.sidebar.description}</p>
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">카테고리</p>
        <SidebarCategoryTree categories={props.categories} />
      </section>

      <section className="sidebar-box">
        <p className="sidebar-box__eyebrow">피드</p>
        <div className="sidebar-link-list">
          <a href={RSS_FEED_URL} className="sidebar-link-row">
            <span>RSS 피드</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href={FEED_XML_URL} className="sidebar-link-row">
            <span>Feed XML</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href={SITEMAP_URL} className="sidebar-link-row">
            <span>사이트맵 XML</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </aside>
  );
}

function ArchiveHeader(props: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="archive-header">
      <p className="archive-header__eyebrow">{props.eyebrow}</p>
      <h1 className="archive-header__title">{props.title}</h1>
      <p className="archive-header__description">{props.description}</p>
    </header>
  );
}

function BreadcrumbTrail(props: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumb-trail" aria-label="breadcrumb">
      {props.items.map((item, index) => {
        const key = `${item.label}-${index}`;
        const isLast = index === props.items.length - 1;

        return (
          <span key={key} className="breadcrumb-trail__item">
            {item.href && !isLast ? (
              <Link to={item.href} className="breadcrumb-trail__link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumb-trail__current">{item.label}</span>
            )}
            {!isLast ? <span className="breadcrumb-trail__divider">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

function VideoEmbed(props: { title: string; youtubeUrl: string }) {
  const videoId = parseYoutubeVideo(props.youtubeUrl);

  if (!videoId) {
    return null;
  }

  return (
    <section className="video-box">
      <p className="sidebar-box__eyebrow">영상</p>
      <div className="video-box__frame">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={`${props.title} video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  );
}

function PostComments(props: { slug: string; title: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const giscusConfig = useMemo(() => resolveGiscusConfig(), []);

  useEffect(() => {
    if (!hostRef.current || !giscusConfig) {
      return;
    }

    hostRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", giscusConfig.repo);
    script.setAttribute("data-repo-id", giscusConfig.repoId);
    script.setAttribute("data-category", giscusConfig.category);
    script.setAttribute("data-category-id", giscusConfig.categoryId);
    script.setAttribute("data-mapping", giscusConfig.mapping);
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", giscusConfig.theme);
    script.setAttribute("data-lang", "ko");
    script.setAttribute("data-loading", "lazy");

    if (giscusConfig.mapping === "specific") {
      script.setAttribute("data-term", props.slug);
    }

    hostRef.current.appendChild(script);
  }, [giscusConfig, props.slug]);

  if (!giscusConfig) {
    return null;
  }

  return (
    <section className="list-section article-comments">
      <div className="list-section__header">
        <h2>댓글</h2>
        <p>이 글에 대한 의견을 남겨주세요.</p>
      </div>
      <div ref={hostRef} />
    </section>
  );
}

export function PublicLayout() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(cloneSiteSettings());

  useEffect(() => {
    void Promise.all([listCategories(), getSiteSettings()])
      .then(([categoryItems, nextSiteSettings]) => {
        setCategories(categoryItems);
        setSiteSettings(cloneSiteSettings(nextSiteSettings));
      })
      .catch(() => {
        setCategories([]);
        setSiteSettings(cloneSiteSettings());
      });
  }, []);

  return (
    <SiteSettingsContext.Provider value={siteSettings}>
      <div className="simple-shell">
        <AnalyticsTracker />
        <header className="simple-header">
          <div className="simple-header__brand">
            <Link to={withKoPath("/")} className="simple-brand">
              {siteSettings.branding.siteTitle}
            </Link>
            <p className="simple-brand__description">{siteSettings.branding.siteTagline}</p>
          </div>
          <nav className="simple-nav">
            {publicLinks.map((item) => (
              <NavigationLink key={item.href} href={item.href} label={item.label} external={item.external} />
            ))}
          </nav>
        </header>

        <main className="simple-grid">
          <div className="simple-main">
            <Outlet />
          </div>
          <Sidebar categories={categories} />
        </main>
      </div>
    </SiteSettingsContext.Provider>
  );
}

export function HomePage() {
  const siteSettings = useSiteSettings();

  usePageMetadata({
    title: siteSettings.branding.siteTitle,
    description: siteSettings.branding.siteDescription,
    path: withKoPath("/"),
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebSiteStructuredData({
      name: siteSettings.branding.siteTitle,
      alternateName: siteSettings.branding.siteAltName,
      description: siteSettings.branding.siteDescription,
      path: withKoPath("/"),
    }),
  });

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [topPosts, setTopPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listPosts(), listTopPosts(3)])
      .then(([items, topItems]) => {
        setPosts(items);
        setTopPosts(topItems);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const rest = posts;

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />

      <ArchiveHeader
        eyebrow={siteSettings.home.eyebrow}
        title={siteSettings.home.title}
        description={siteSettings.home.description}
      />

      {topPosts.length ? (
        <section className="list-section">
          <div className="list-section__header">
            <h2>{siteSettings.home.featuredTitle}</h2>
            <p>{siteSettings.home.featuredDescription}</p>
          </div>
          <div className="top-post-grid">
            {topPosts.map((post) => (
              <TopPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-box">아직 공개 글이 없습니다. 글을 발행하면 여기에 인기 글 카드가 먼저 보입니다.</div>
      )}
      <section className="list-section">
        <div className="list-section__header">
          <h2>{siteSettings.home.latestTitle}</h2>
          <p>{siteSettings.home.latestDescription}</p>
        </div>
        {rest.length ? (
          <div className="post-list">
            {rest.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="empty-box">첫 글 외에 이어지는 목록은 글이 쌓이면서 자연스럽게 채워집니다.</div>
        )}
      </section>
    </div>
  );
}

export function PostPage() {
  const siteSettings = useSiteSettings();
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const postPath = withKoPath(`/post/${slug}`);
  const leadSummary = useMemo(() => resolveLeadSummary(post), [post]);
  const renderRule = useMemo(() => resolveCategoryRenderRule(post?.category), [post?.category?.name, post?.category?.slug]);
  const leadIntro = useMemo(() => (post ? resolveLeadIntro(post, renderRule) : null), [post, renderRule]);
  const postDescription =
    post?.excerpt ?? post?.subtitle ?? (post ? buildExcerpt(post.content) : siteSettings.branding.siteDescription);
  const postBreadcrumbs = [
    { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
    ...(post?.category?.slug && post?.category?.name
      ? [{ name: post.category.name, path: withKoPath(`/category/${post.category.slug}`) }]
      : []),
    { name: post?.title ?? "글", path: postPath },
  ];

  usePageMetadata({
    title: post ? `${post.title} | ${siteSettings.branding.siteTitle}` : `글 불러오는 중 | ${siteSettings.branding.siteTitle}`,
    description: postDescription,
    path: postPath,
    robots: error ? "noindex,follow" : "index,follow",
    ogType: post ? "article" : "website",
    image: post?.coverImage ?? DEFAULT_OG_IMAGE_PATH,
    structuredData: post
      ? createBlogPostingStructuredData({
          title: post.title,
          description: postDescription,
          path: postPath,
          image: post.coverImage ?? DEFAULT_OG_IMAGE_PATH,
          publishedAt: post.publishedAt ?? post.createdAt,
          updatedAt: post.updatedAt,
          categoryName: post.category?.name,
          tags: post.tags.map((tag) => tag.name),
          breadcrumbs: postBreadcrumbs,
          authorName: siteSettings.branding.siteAuthor,
        })
      : createWebPageStructuredData({
          name: `글 불러오는 중 | ${siteSettings.branding.siteTitle}`,
          description: siteSettings.branding.siteDescription,
          path: postPath,
          breadcrumbs: postBreadcrumbs,
        }),
  });

  useEffect(() => {
    void getPost(slug)
      .then((item) => {
        setPost(item);
        setError(null);
      })
      .catch((reason: Error) => {
        setPost(null);
        setError(reason.message);
      });
  }, [slug]);

  useEffect(() => {
    if (!post?.slug || typeof window === "undefined") {
      return;
    }

    const key = `donggeuri:view:${post.slug}`;
    const today = new Date().toISOString().slice(0, 10);

    if (window.localStorage.getItem(key) === today) {
      return;
    }

    void recordPostView(post.slug)
      .then((result) => {
        setPost((current) => (current ? { ...current, viewCount: result.viewCount } : current));
        window.localStorage.setItem(key, today);
      })
      .catch(() => undefined);
  }, [post?.slug]);

  useEffect(() => {
    if (!post?.category?.slug) {
      setRelatedPosts([]);
      return;
    }

    void getCategoryFeed(post.category.slug)
      .then((value) => {
        setRelatedPosts(value.posts.filter((item) => item.slug !== post.slug).slice(0, 3));
      })
      .catch(() => setRelatedPosts([]));
  }, [post?.category?.slug, post?.slug]);

  useEffect(() => {
    if (!post) {
      return;
    }

    const updateReadingState = () => {
      const documentElement = document.documentElement;
      const maxScroll = documentElement.scrollHeight - documentElement.clientHeight;
      const nextProgress = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
      setProgress(nextProgress);
    };

    updateReadingState();
    window.addEventListener("scroll", updateReadingState, { passive: true });
    window.addEventListener("resize", updateReadingState);

    return () => {
      window.removeEventListener("scroll", updateReadingState);
      window.removeEventListener("resize", updateReadingState);
    };
  }, [post]);

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <div className="simple-reading-progress" aria-hidden="true">
        <span className="simple-reading-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <article className="article-page">
        <header className="article-page__header">
          <BreadcrumbTrail
            items={[
              { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
              ...(post?.category?.slug && post?.category?.name
                ? [{ label: post.category.name, href: withKoPath(`/category/${post.category.slug}`) }]
                : []),
              { label: post?.title ?? "글" },
            ]}
          />
          <div className="post-row__meta">
            {post?.category ? <CategoryChip category={post.category} /> : null}
            {post ? <span className={cn("category-kicker", `category-kicker--${renderRule.key}`)}>{renderRule.listKicker}</span> : null}
            {post?.publishedAt ? <span>발행 {formatDate(post.publishedAt)}</span> : null}
            <span>수정 {formatDate(post?.updatedAt ?? post?.createdAt)}</span>
            {typeof post?.viewCount === "number" ? <span>조회 {post.viewCount}</span> : null}
            <span>{post ? `${estimateReadMinutes(post.content)}분 읽기` : ""}</span>
          </div>
          <h1>{post?.title ?? "글 불러오는 중"}</h1>
          {leadIntro ? <p className={cn("article-page__intro", `article-page__intro--${renderRule.key}`)}>{leadIntro}</p> : null}
          {leadSummary ? <p className="article-page__summary">{leadSummary}</p> : null}
          <div className="article-page__actions">
            <Link to={withKoPath("/")} className="simple-inline-link">
              목록으로 돌아가기
            </Link>
            {post?.tags.length ? (
              <div className="article-tags">
                {post.tags.map((tag) => (
                  <Link key={tag.id} to={withKoPath(`/tag/${tag.slug}`)} className="simple-chip">
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {post?.coverImage ? (
          <div className="article-cover">
            <img src={post.coverImage} alt={post.coverAlt || post.title} />
          </div>
        ) : null}

        {post?.youtubeUrl ? <VideoEmbed title={post.title} youtubeUrl={post.youtubeUrl} /> : null}

        <div className="article-layout">
          <div className="article-content-wrap">
            {post ? <MarkdownContent content={post.content} /> : <div className="empty-box">요청한 글을 불러오지 못했습니다.</div>}
          </div>
        </div>


        {post ? <PostComments slug={post.slug} title={post.title} /> : null}

        {relatedPosts.length ? (
          <section className="list-section article-related">
            <div className="list-section__header">
              <h2>{post?.category?.name ? `${post.category.name}에서 더 읽기` : "함께 읽기 좋은 글"}</h2>
              <p>같은 카테고리에서 이어서 읽기 좋은 글을 모았습니다.</p>
            </div>
            <div className="post-list">
              {relatedPosts.map((item) => (
                <PostListItem key={item.id} post={item} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}

export function CategoryArchivePage() {
  const siteSettings = useSiteSettings();
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<CategoryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const categoryPath = withKoPath(`/category/${slug}`);
  const categoryDescription = feed?.category.description ?? "선택한 카테고리에 속한 공개 글을 모아보는 페이지입니다.";

  usePageMetadata({
    title: feed ? `${feed.category.name} | ${siteSettings.branding.siteTitle}` : `카테고리 | ${siteSettings.branding.siteTitle}`,
    description: categoryDescription,
    path: categoryPath,
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createCollectionPageStructuredData({
      name: feed ? `${feed.category.name} | ${siteSettings.branding.siteTitle}` : `카테고리 | ${siteSettings.branding.siteTitle}`,
      description: categoryDescription,
      path: categoryPath,
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: feed?.category.name ?? "카테고리", path: categoryPath },
      ],
    }),
  });

  useEffect(() => {
    void getCategoryFeed(slug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [slug]);

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <BreadcrumbTrail
        items={[
          { label: siteSettings.branding.siteTitle, href: withKoPath("/") },
          { label: feed?.category.name ?? "카테고리" },
        ]}
      />
      <ArchiveHeader
        eyebrow="카테고리"
        title={feed?.category.name ?? "카테고리"}
        description={feed?.category.description ?? "선택한 카테고리에 속한 글을 시간순으로 모아둔 목록입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 카테고리에는 아직 공개 글이 없습니다.</div>
      )}
    </div>
  );
}

export function TagArchivePage() {
  const siteSettings = useSiteSettings();
  const { slug = "" } = useParams();
  const [feed, setFeed] = useState<TagFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tagPath = withKoPath(`/tag/${slug}`);
  const tagTitle = feed
    ? `#${feed.tag.name} | ${siteSettings.branding.siteTitle}`
    : `태그 | ${siteSettings.branding.siteTitle}`;
  const tagDescription = feed ? `#${feed.tag.name}로 묶인 공개 글 목록입니다.` : "선택한 태그와 연결된 공개 글을 모아보는 페이지입니다.";

  usePageMetadata({
    title: tagTitle,
    description: tagDescription,
    path: tagPath,
    robots: "noindex,follow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: tagTitle,
      description: tagDescription,
      path: tagPath,
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: feed ? `#${feed.tag.name}` : "태그", path: tagPath },
      ],
    }),
  });

  useEffect(() => {
    void getTagFeed(slug)
      .then((value) => {
        setFeed(value);
        setError(null);
      })
      .catch((reason: Error) => {
        setFeed(null);
        setError(reason.message);
      });
  }, [slug]);

  return (
    <div className="simple-page">
      <ErrorMessage message={error} />
      <ArchiveHeader
        eyebrow="태그"
        title={feed ? `#${feed.tag.name}` : "태그"}
        description={feed ? `#${feed.tag.name}로 묶인 글 목록입니다.` : "선택한 태그와 연결된 글을 모아보는 페이지입니다."}
      />
      {feed?.posts.length ? (
        <div className="post-list">
          {feed.posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="empty-box">이 태그에는 아직 공개 글이 없습니다.</div>
      )}
    </div>
  );
}

export function SearchPage() {
  const siteSettings = useSiteSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(currentQuery);
  const [results, setResults] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const syncQuery = (query: string) => {
    if (!query) {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ q: query }, { replace: true });
  };

  usePageMetadata({
    title: currentQuery
      ? `"${currentQuery}" 검색 | ${siteSettings.branding.siteTitle}`
      : `검색 | ${siteSettings.branding.siteTitle}`,
    description: siteSettings.search.description,
    path: withKoPath("/search"),
    robots: "noindex,follow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: currentQuery
        ? `"${currentQuery}" 검색 | ${siteSettings.branding.siteTitle}`
        : `검색 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.search.description,
      path: withKoPath("/search"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "검색", path: withKoPath("/search") },
      ],
    }),
  });

  useEffect(() => {
    setDraft(currentQuery);

    if (!currentQuery) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    void searchPosts(currentQuery)
      .then((result) => {
        setResults(result.posts);
        setError(null);
      })
      .catch((reason: Error) => {
        setResults([]);
        setError(reason.message);
      })
      .finally(() => setLoading(false));
  }, [currentQuery]);

  useEffect(() => {
    const normalizedDraft = draft.trim();

    if (normalizedDraft === currentQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      syncQuery(normalizedDraft);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [draft, currentQuery, setSearchParams]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable),
      );

      if (isEditable) {
        return;
      }

      if (event.key === "/" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    syncQuery(draft.trim());
  };

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow={siteSettings.search.eyebrow}
        title={siteSettings.search.title}
        description={siteSettings.search.description}
      />

      <form className="search-panel" onSubmit={handleSubmit}>
        <Input
          ref={searchInputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={siteSettings.search.placeholder}
          aria-label="검색어"
        />
        <Button type="submit" className="simple-primary-button search-panel__button">
          검색
        </Button>
      </form>
      <p className="search-panel__hint">단축키: <code>/</code> 또는 <code>s</code> 로 검색창 포커스</p>

      <ErrorMessage message={error} />

      {currentQuery ? (
        <section className="list-section">
          <div className="list-section__header">
            <h2>{loading ? "검색 중..." : `"${currentQuery}" 검색 결과`}</h2>
            <p>{loading ? "공개 글에서 관련 기록을 찾고 있습니다." : `${results.length}개의 글을 찾았습니다.`}</p>
          </div>

          {results.length ? (
            <div className="post-list">
              {results.map((post) => (
                <PostListItem key={post.id} post={post} />
              ))}
            </div>
          ) : loading ? (
            <div className="empty-box">검색 결과를 불러오는 중입니다.</div>
          ) : (
            <div className="empty-box">일치하는 공개 글이 없습니다. 다른 키워드로 다시 검색해보세요.</div>
          )}
        </section>
      ) : (
        <div className="empty-box">궁금한 주제 하나만 적어도 관련 기록을 다시 찾을 수 있습니다.</div>
      )}
    </div>
  );
}

export function AboutPage() {
  const siteSettings = useSiteSettings();

  usePageMetadata({
    title: `소개 | ${siteSettings.branding.siteTitle}`,
    description: siteSettings.about.description,
    path: withKoPath("/about"),
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      type: "AboutPage",
      name: `소개 | ${siteSettings.branding.siteTitle}`,
      description: siteSettings.about.description,
      path: withKoPath("/about"),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: "소개", path: withKoPath("/about") },
      ],
    }),
  });

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow={siteSettings.about.eyebrow}
        title={siteSettings.about.title}
        description={siteSettings.about.description}
      />

      <section className="featured-post">
        <div className="featured-post__body">
          <div className="post-row__meta">
            <span className="simple-chip">Public Web</span>
            <span className="simple-chip">Admin CMS</span>
            <span className="simple-chip">Worker API</span>
          </div>
          <h2 className="featured-post__title">{siteSettings.about.featureTitle}</h2>
          <p className="featured-post__summary">{siteSettings.about.featureDescription}</p>
        </div>

        <div className="grid gap-4">
          <section className="sidebar-box">
            <p className="sidebar-box__eyebrow">기록</p>
            <h3 className="sidebar-box__title">자주 머무를 이야기</h3>
            <p className="sidebar-box__text">
              이 섹션은 private repo에서 주력 카테고리, 브랜드 소개, 운영 메시지처럼 서비스에 맞는 내용으로 교체하면 됩니다.
            </p>
          </section>
          <section className="sidebar-box">
            <p className="sidebar-box__eyebrow">문장</p>
            <h3 className="sidebar-box__title">빠르게 읽히는 기본 문체</h3>
            <p className="sidebar-box__text">
              짧게 읽어도 구조가 보이고 길게 읽어도 흐름이 끊기지 않는 기본 레이아웃을 지향합니다. 정보형 글과 기록형 글이 모두 무리 없이 담기도록 구성했습니다.
            </p>
          </section>
        </div>
      </section>

      <section className="list-section">
        <div className="list-section__header">
          <h2>{siteSettings.about.categoriesTitle}</h2>
          <p>{siteSettings.about.categoriesDescription}</p>
        </div>
        <div className="topic-grid">
          {ARCHIVE_GROUPS.map((group) => (
            <ArchiveGroupCard key={group.eyebrow} {...group} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function WorkerResourceRedirectPage(props: { title: string; resourcePath: string }) {
  const siteSettings = useSiteSettings();
  const resourceUrl = getWorkerResourceUrl(props.resourcePath);

  usePageMetadata({
    title: `${props.title} | ${siteSettings.branding.siteTitle}`,
    description: `${props.title}는 Worker에서 직접 제공하는 리소스입니다.`,
    path: withKoPath(props.resourcePath),
    robots: "noindex,follow",
    image: DEFAULT_OG_IMAGE_PATH,
    structuredData: createWebPageStructuredData({
      name: `${props.title} | ${siteSettings.branding.siteTitle}`,
      description: `${props.title}는 Worker에서 직접 제공하는 리소스입니다.`,
      path: withKoPath(props.resourcePath),
      breadcrumbs: [
        { name: siteSettings.branding.siteTitle, path: withKoPath("/") },
        { name: props.title, path: withKoPath(props.resourcePath) },
      ],
    }),
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace(resourceUrl);
    }
  }, [resourceUrl]);

  return (
    <div className="simple-page">
      <ArchiveHeader
        eyebrow={props.title}
        title={`${props.title}는 Worker에서 직접 제공합니다.`}
        description="이 경로는 실제 XML 응답을 반환하는 Worker endpoint로 바로 이동합니다."
      />
      <div className="empty-box">
        브라우저가 자동으로 이동하지 않으면 아래 링크를 눌러주세요.
        <div className="mt-4">
          <a href={resourceUrl} className="simple-inline-link">
            {resourceUrl}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
